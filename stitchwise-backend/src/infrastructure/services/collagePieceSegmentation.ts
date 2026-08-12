/**
 * Collage Piece Segmentation — Scrapbook cutout pieces from the actual art image.
 *
 * The collage-quilting flow (owner direction, reference: collagequilters.com)
 * treats the requested art like a fabric collage: the image is divided into
 * ORGANIC, CONTOUR-FOLLOWING pieces that tile the canvas EDGE-TO-EDGE (like a
 * stained-glass window / jigsaw). Each piece carries the real art pixels inside
 * its outline, with transparency outside the mask. The customer cuts each piece
 * from fabric, lays the pieces on the quilt block, and reassembles them into
 * the lifelike design.
 *
 * Segmentation algorithm (replaced k-means color blobs on 2026-08-12):
 *   1. Compute the luminance image + Sobel gradient magnitude (smoothed).
 *   2. Place seeds on a jittered grid (organic puzzle look), snapped to local
 *      gradient minima so seeds never start on an edge.
 *   3. Watershed by immersion (priority flood): pixels are claimed by the seed
 *      that reaches them first, ordered by gradient cost, so region boundaries
 *      settle along the strongest image edges.
 *   4. Merge tiny regions into their largest neighbor until at most maxPieces
 *      remain. EVERY pixel belongs to exactly one piece — the reassembly is
 *      complete with no gaps (this was the "splattered marks" bug: the old
 *      k-means path dropped specks and left holes).
 *   5. For each region emit a CollagePiece:
 *        { id, label, outline: [[x,y] normalized 0-1] (simplified polygon),
 *          bounds (normalized bbox), color (dominant fabric hex),
 *          image: data-URL PNG cutout with transparency outside the mask }
 *   6. Also return the full art image as a data-URL reference.
 */
import sharp from "sharp";
import { closestFabricColor } from "../../domain/collage/fabricColors";
import type { CollagePiece } from "../../domain/ai/collageAI";

/** Working resolution (max dimension) used for segmentation analysis. */
const WORK_SIZE = 256;
/** Default maximum number of pieces. */
const MAX_PIECES = 40;
/**
 * Regions smaller than this fraction of the image are merged into a neighbor.
 * With grid-seeded watershed every pixel is already assigned, so this only
 * cleans up accidental slivers (e.g. a 2px boundary artifact).
 */
const MIN_PIECE_FRACTION = 0.001;
/** Maximum pixel dimension of a piece image crop (keeps payloads sane). */
const PIECE_MAX_DIM = 256;

export interface SegmentationOptions {
  maxPieces?: number;
}

export interface SegmentationResult {
  pieces: CollagePiece[];
  /** Full art image as data-URL PNG (reference for the piece tray). */
  referenceImage: string;
}

/**
 * Segment an art image into scrapbook cutout pieces.
 */
export async function segmentImageIntoPieces(
  imageBuffer: Buffer,
  opts?: SegmentationOptions,
): Promise<SegmentationResult> {
  const maxPieces = Math.max(1, opts?.maxPieces ?? MAX_PIECES);

  const meta = await sharp(imageBuffer).metadata();
  const ow = meta.width ?? 400;
  const oh = meta.height ?? 400;
  const scale = Math.min(1, WORK_SIZE / Math.max(ow, oh));
  const w = Math.max(8, Math.round(ow * scale));
  const h = Math.max(8, Math.round(oh * scale));

  const { data } = await sharp(imageBuffer)
    .resize(w, h, { fit: "fill" })
    .median(2)
    // CRITICAL: force 4 channels. Real AI art comes back as RGB (no alpha)
    // and the whole pipeline indexes pixels[i*4] assuming RGBA.
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data);
  const n = w * h;

  // ── 1. Luminance + gradient ────────────────────────────────────────────────
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    lum[i] = 0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2];
  }
  const grad = sobelGradient(lum, w, h);
  smoothBox(grad, w, h, 2); // suppress noise so boundaries don't zigzag

  // ── 2. Jittered grid seeds, snapped to local gradient minima ──────────────
  const dim = Math.max(1, Math.ceil(Math.sqrt(maxPieces)));
  const seeds: number[] = [];
  const jitterAmp = 0.22; // fraction of a grid cell
  let seedIndex = 0;
  for (let gy = 0; gy < dim; gy++) {
    for (let gx = 0; gx < dim; gx++) {
      const jx = (hash01(seedIndex * 2 + 1) - 0.5) * 2 * jitterAmp;
      const jy = (hash01(seedIndex * 2 + 2) - 0.5) * 2 * jitterAmp;
      const cx = (gx + 0.5 + jx) / dim;
      const cy = (gy + 0.5 + jy) / dim;
      const px = Math.max(0, Math.min(w - 1, Math.round(cx * w)));
      const py = Math.max(0, Math.min(h - 1, Math.round(cy * h)));
      // Snap to lowest gradient in a 5x5 neighborhood so seeds don't sit on edges.
      let best = py * w + px;
      let bestG = grad[best];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const yy = py + dy;
          const xx = px + dx;
          if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
          const idx = yy * w + xx;
          if (grad[idx] < bestG) {
            bestG = grad[idx];
            best = idx;
          }
        }
      }
      seeds.push(best);
      seedIndex++;
    }
  }

  // ── 3. Watershed by immersion (priority flood) ─────────────────────────────
  // Every pixel is claimed by the seed that floods it first, expanding in
  // order of gradient cost → boundaries land on high-gradient (edge) lines and
  // the canvas is perfectly tiled (no unassigned pixels). Equal-cost pixels are
  // popped in FIFO order (monotonic seq) so flat regions expand uniformly from
  // ALL seeds — without the tie-break, early seeds swallow the whole background
  // and later seeds end up as tiny slivers that get merged away.
  const labels = new Int32Array(n).fill(-1);
  const heap: number[][] = []; // [cost, seq, idx, owner]
  let seq = 0;
  const heapPop = (): number[] | undefined => {
    if (heap.length === 0) return undefined;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = l + 1;
        let m = c;
        if (l < heap.length && less(heap[l], heap[m])) m = l;
        if (r < heap.length && less(heap[r], heap[m])) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };

  for (let s = 0; s < seeds.length; s++) {
    labels[seeds[s]] = s;
    pushNeighbors(seeds[s], w, h, grad, labels, heap, s, () => ++seq);
  }
  while (true) {
    const entry = heapPop();
    if (!entry) break;
    const [, , idx, owner] = entry;
    if (labels[idx] !== -1) continue;
    labels[idx] = owner;
    pushNeighbors(idx, w, h, grad, labels, heap, owner, () => ++seq);
  }

  // ── 4. Regions from labels + merge to maxPieces ───────────────────────────
  const regionCount = seeds.length;
  const regions: Region[] = [];
  const sizes = new Int32Array(regionCount);
  for (let i = 0; i < n; i++) {
    if (labels[i] >= 0) sizes[labels[i]]++;
  }
  for (let r = 0; r < regionCount; r++) {
    if (sizes[r] === 0) continue;
    regions.push({ id: regions.length, cells: [] });
  }
  const remap = new Int32Array(regionCount).fill(-1);
  let regionIdx = 0;
  for (let r = 0; r < regionCount; r++) {
    if (sizes[r] === 0) continue;
    remap[r] = regionIdx++;
  }
  for (let i = 0; i < n; i++) {
    if (labels[i] >= 0) regions[remap[labels[i]]].cells.push(i);
  }

  // Merge tiny regions into their largest neighbor (NEVER drop pixels — every
  // pixel must belong to exactly one piece or the reassembly has holes).
  const minArea = Math.max(4, Math.floor(n * MIN_PIECE_FRACTION));
  let kept = mergeTinyRegions(regions, labels, w, h, minArea);
  if (kept.length === 0) {
    kept = [{ id: 0, cells: Array.from({ length: n }, (_, i) => i) }];
  }
  kept = capRegions(kept, labels, w, h, maxPieces);

  // ── 5. Emit pieces ────────────────────────────────────────────────────────
  const pieces: CollagePiece[] = [];
  for (let i = 0; i < kept.length; i++) {
    const region = kept[i];
    const mask = new Uint8Array(n);
    for (const cell of region.cells) mask[cell] = 1;

    // Normalized bounds
    const rows: number[] = [];
    const cols: number[] = [];
    for (const cell of region.cells) {
      rows.push(Math.floor(cell / w));
      cols.push(cell % w);
    }
    const minR = Math.min(...rows);
    const maxR = Math.max(...rows);
    const minC = Math.min(...cols);
    const maxC = Math.max(...cols);
    const bounds = {
      x: minC / w,
      y: minR / h,
      width: (maxC - minC + 1) / w,
      height: (maxR - minR + 1) / h,
    };

    // Dominant color: average of original pixels in the region → closest fabric
    const avg = averageColor(pixels, w, h, region.cells);
    const fabric = closestFabricColor(avg[0], avg[1], avg[2]);

    // Simplified outline polygon (normalized 0-1)
    const outline = traceOutline(mask, w, h, minR, maxR, minC, maxC);

    // Cutout image: crop bbox from ORIGINAL art, transparency outside mask
    const image = await makePieceImage(imageBuffer, mask, w, h, ow, oh, bounds);

    pieces.push({
      id: `piece-${i + 1}`,
      label: `Piece ${i + 1}`,
      outline,
      bounds,
      color: fabric.hex,
      image,
    });
  }

  // ── 6. Reference image (full art, downscaled) ─────────────────────────────
  const ref = await sharp(imageBuffer)
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  const referenceImage = `data:image/png;base64,${ref.toString("base64")}`;

  return { pieces, referenceImage };
}

// ─── Gradient helpers ────────────────────────────────────────────────────────

function sobelGradient(lum: Float32Array, w: number, h: number): Float32Array {
  const grad = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        lum[i - w - 1] + 2 * lum[i - 1] + lum[i + w - 1] -
        (lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1]);
      const gy =
        lum[i - w - 1] + 2 * lum[i - w] + lum[i - w + 1] -
        (lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1]);
      grad[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  // Fill borders by copying the nearest interior value.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y === 0 || y === h - 1 || x === 0 || x === w - 1) {
        const yy = Math.max(1, Math.min(h - 2, y));
        const xx = Math.max(1, Math.min(w - 2, x));
        grad[y * w + x] = grad[yy * w + xx];
      }
    }
  }
  return grad;
}

/** In-place 3x3 box smoothing, `passes` times. */
function smoothBox(grad: Float32Array, w: number, h: number, passes: number): void {
  const src = new Float32Array(grad);
  for (let p = 0; p < passes; p++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        grad[i] =
          (src[i - w - 1] + src[i - w] + src[i - w + 1] +
           src[i - 1] + src[i] + src[i + 1] +
           src[i + w - 1] + src[i + w] + src[i + w + 1]) / 9;
      }
    }
    src.set(grad);
  }
}

/** Deterministic pseudo-random in [0,1). */
function hash01(seed: number): number {
  let x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function heapPush(
  heap: number[][],
  cost: number,
  idx: number,
  owner: number,
  nextSeq: () => number,
): void {
  heap.push([cost, nextSeq(), idx, owner]);
  let c = heap.length - 1;
  while (c > 0) {
    const p = (c - 1) >> 1;
    if (!less(heap[c], heap[p])) break;
    [heap[p], heap[c]] = [heap[c], heap[p]];
    c = p;
  }
}

/** Min-heap ordering: cost first, then FIFO seq (stable expansion in flat areas). */
function less(a: number[], b: number[]): boolean {
  return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
}

function pushNeighbors(
  idx: number,
  w: number,
  h: number,
  grad: Float32Array,
  labels: Int32Array,
  heap: number[][],
  owner: number,
  nextSeq: () => number,
): void {
  const r = Math.floor(idx / w);
  const c = idx % w;
  if (r > 0) {
    const nb = idx - w;
    if (labels[nb] === -1) heapPush(heap, grad[nb], nb, owner, nextSeq);
  }
  if (r < h - 1) {
    const nb = idx + w;
    if (labels[nb] === -1) heapPush(heap, grad[nb], nb, owner, nextSeq);
  }
  if (c > 0) {
    const nb = idx - 1;
    if (labels[nb] === -1) heapPush(heap, grad[nb], nb, owner, nextSeq);
  }
  if (c < w - 1) {
    const nb = idx + 1;
    if (labels[nb] === -1) heapPush(heap, grad[nb], nb, owner, nextSeq);
  }
}

// ─── Regions ─────────────────────────────────────────────────────────────────

interface Region {
  id: number;
  cells: number[];
}

/**
 * Merge every region smaller than minArea into its largest neighbor (by shared
 * border). Pixels are NEVER dropped — the canvas stays fully tiled.
 */
function mergeTinyRegions(
  regions: Region[],
  labels: Uint8Array | Int32Array,
  w: number,
  h: number,
  minArea: number,
): Region[] {
  let current = regions.map((r) => ({ ...r, cells: [...r.cells] }));
  const n = w * h;
  const regionIdOf = new Int32Array(n).fill(-1);

  const rebuildIdMap = () => {
    regionIdOf.fill(-1);
    for (let i = 0; i < current.length; i++) {
      for (const cell of current[i].cells) regionIdOf[cell] = i;
    }
  };
  rebuildIdMap();

  let changed = true;
  while (changed) {
    changed = false;
    // Find the smallest region below minArea
    let tinyIdx = -1;
    let tinySize = Infinity;
    for (let i = 0; i < current.length; i++) {
      if (current[i].cells.length < minArea && current[i].cells.length < tinySize) {
        tinySize = current[i].cells.length;
        tinyIdx = i;
      }
    }
    if (tinyIdx === -1) break;

    // Pick neighbor with the largest shared border
    const borderCounts = new Map<number, number>();
    for (const cell of current[tinyIdx].cells) {
      const r = Math.floor(cell / w);
      const c = cell % w;
      const neighbors = [
        r > 0 ? cell - w : -1,
        r < h - 1 ? cell + w : -1,
        c > 0 ? cell - 1 : -1,
        c < w - 1 ? cell + 1 : -1,
      ];
      for (const nb of neighbors) {
        if (nb >= 0) {
          const nbRegion = regionIdOf[nb];
          if (nbRegion >= 0 && nbRegion !== tinyIdx) {
            borderCounts.set(nbRegion, (borderCounts.get(nbRegion) ?? 0) + 1);
          }
        }
      }
    }

    if (borderCounts.size === 0) break; // isolated — leave it

    let bestNeighbor = -1;
    let bestBorder = -1;
    for (const [rid, count] of borderCounts) {
      if (count > bestBorder) {
        bestBorder = count;
        bestNeighbor = rid;
      }
    }

    const absorbed = current[tinyIdx].cells;
    current[bestNeighbor].cells.push(...absorbed);
    for (const cell of absorbed) regionIdOf[cell] = bestNeighbor;
    current.splice(tinyIdx, 1);
    rebuildIdMap();
    changed = true;
  }

  return current.map((r, i) => ({ id: i, cells: r.cells }));
}

/**
 * If there are more than maxPieces regions, repeatedly merge the smallest
 * region into its largest neighbor (by shared border) until the cap is met.
 */
function capRegions(
  regions: Region[],
  labels: Uint8Array | Int32Array,
  w: number,
  h: number,
  maxPieces: number,
): Region[] {
  if (regions.length <= maxPieces) return regions;

  let current = regions.map((r) => ({ ...r, cells: [...r.cells] }));
  const n = w * h;
  const regionIdOf = new Int32Array(n).fill(-1);

  const rebuildIdMap = () => {
    regionIdOf.fill(-1);
    for (let i = 0; i < current.length; i++) {
      for (const cell of current[i].cells) regionIdOf[cell] = i;
    }
  };
  rebuildIdMap();

  while (current.length > maxPieces) {
    // Find smallest region
    let smallestIdx = 0;
    let smallestSize = Infinity;
    for (let i = 0; i < current.length; i++) {
      if (current[i].cells.length < smallestSize) {
        smallestSize = current[i].cells.length;
        smallestIdx = i;
      }
    }

    // Count shared borders with each neighbor
    const borderCounts = new Map<number, number>();
    for (const cell of current[smallestIdx].cells) {
      const r = Math.floor(cell / w);
      const c = cell % w;
      const neighbors = [
        r > 0 ? cell - w : -1,
        r < h - 1 ? cell + w : -1,
        c > 0 ? cell - 1 : -1,
        c < w - 1 ? cell + 1 : -1,
      ];
      for (const nb of neighbors) {
        if (nb >= 0) {
          const nbRegion = regionIdOf[nb];
          if (nbRegion >= 0 && nbRegion !== smallestIdx) {
            borderCounts.set(nbRegion, (borderCounts.get(nbRegion) ?? 0) + 1);
          }
        }
      }
    }

    if (borderCounts.size === 0) {
      let largestIdx = 0;
      for (let i = 1; i < current.length; i++) {
        if (current[i].cells.length > current[largestIdx].cells.length) largestIdx = i;
      }
      borderCounts.set(largestIdx, 1);
    }

    let bestNeighbor = -1;
    let bestBorder = -1;
    for (const [rid, count] of borderCounts) {
      if (count > bestBorder) {
        bestBorder = count;
        bestNeighbor = rid;
      }
    }

    // Merge smallest into bestNeighbor
    const absorbed = current[smallestIdx].cells;
    current[bestNeighbor].cells.push(...absorbed);
    for (const cell of absorbed) regionIdOf[cell] = bestNeighbor;
    current.splice(smallestIdx, 1);
    rebuildIdMap();
  }

  return current.map((r, i) => ({ id: i, cells: r.cells }));
}

// ─── Outline tracing ─────────────────────────────────────────────────────────

/**
 * Trace a simplified outline polygon around a region mask.
 * Uses boundary-cell tracing + moving-average smoothing, normalized to 0-1.
 */
function traceOutline(
  mask: Uint8Array,
  w: number,
  h: number,
  minR: number,
  maxR: number,
  minC: number,
  maxC: number,
): Array<[number, number]> {
  // Collect boundary cells (inside region, adjacent to outside or image edge)
  const boundary: Array<{ r: number; c: number }> = [];
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const idx = r * w + c;
      if (!mask[idx]) continue;
      const isEdge =
        r === 0 || r === h - 1 || c === 0 || c === w - 1 ||
        !mask[idx - w] || !mask[idx + w] || !mask[idx - 1] || !mask[idx + 1];
      if (isEdge) boundary.push({ r, c });
    }
  }
  if (boundary.length === 0) {
    return [[0, 0], [1, 0], [1, 1], [0, 1]];
  }

  // Order boundary cells by angle around the region centroid
  let sumR = 0;
  let sumC = 0;
  for (const b of boundary) {
    sumR += b.r;
    sumC += b.c;
  }
  const cr = sumR / boundary.length;
  const cc = sumC / boundary.length;
  boundary.sort((a, b) => Math.atan2(a.r - cr, a.c - cc) - Math.atan2(b.r - cr, b.c - cc));

  // Moving-average smoothing (2 passes, window 3)
  let pts = boundary.map((b) => [b.c, b.r] as [number, number]);
  for (let pass = 0; pass < 2; pass++) {
    const smoothed: Array<[number, number]> = [];
    const m = pts.length;
    for (let i = 0; i < m; i++) {
      const p0 = pts[(i - 1 + m) % m];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % m];
      smoothed.push([
        (p0[0] + p1[0] + p2[0]) / 3,
        (p0[1] + p1[1] + p2[1]) / 3,
      ]);
    }
    pts = smoothed;
  }

  // Simplify with Ramer–Douglas–Peucker to a compact polygon
  const simplified = rdp(pts, 0.03);

  // Hard cap on outline points — subsample if RDP didn't compact enough
  const MAX_OUTLINE_POINTS = 120;
  let finalPts = simplified;
  if (finalPts.length > MAX_OUTLINE_POINTS) {
    const step = Math.ceil(finalPts.length / MAX_OUTLINE_POINTS);
    finalPts = finalPts.filter((_, i) => i % step === 0);
  }

  const result = finalPts.map(([x, y]) => [
    Math.max(0, Math.min(1, x / w)),
    Math.max(0, Math.min(1, y / h)),
  ] as [number, number]);

  if (result.length < 3) return [[0, 0], [1, 0], [1, 1], [0, 1]];
  return result;
}

/**
 * Ramer–Douglas–Peucker polyline simplification.
 */
function rdp(points: Array<[number, number]>, epsilon: number): Array<[number, number]> {
  if (points.length <= 2) return points;

  const first = points[0];
  const last = points[points.length - 1];
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function perpendicularDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) {
    return Math.hypot(p[0] - a[0], p[1] - a[1]);
  }
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / Math.hypot(dx, dy);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function averageColor(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  cells: number[],
): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const cell of cells) {
    r += pixels[cell * 4];
    g += pixels[cell * 4 + 1];
    b += pixels[cell * 4 + 2];
  }
  const n = Math.max(1, cells.length);
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

/**
 * Crop the piece's bounding box from the ORIGINAL art image and apply the
 * region mask as an alpha channel, producing a PNG data URL with transparency
 * outside the piece shape.
 */
async function makePieceImage(
  original: Buffer,
  maskWorking: Uint8Array,
  w: number,
  h: number,
  ow: number,
  oh: number,
  bounds: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const left = Math.max(0, Math.round(bounds.x * ow));
  const top = Math.max(0, Math.round(bounds.y * oh));
  const width = Math.max(1, Math.min(ow - left, Math.round(bounds.width * ow)));
  const height = Math.max(1, Math.min(oh - top, Math.round(bounds.height * oh)));

  const crop = await sharp(original)
    .extract({ left, top, width, height })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Downscale crop to PIECE_MAX_DIM
  const cscale = Math.min(1, PIECE_MAX_DIM / Math.max(width, height));
  const cw = Math.max(1, Math.round(width * cscale));
  const ch = Math.max(1, Math.round(height * cscale));
  const resized = await sharp(crop.data, {
    raw: { width, height, channels: 3 },
  })
    .resize(cw, ch, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Build alpha channel: upscale working mask (nearest) to crop size.
  // CRITICAL: sample from the piece's OWN region of the working mask — the
  // crop is the piece's bbox in ORIGINAL resolution, so the mask must be
  // offset by (bounds.x*w, bounds.y*h) and scaled by (bounds.width*w/h).
  // Without the offset, every piece sampled the top-left corner of the mask,
  // so pieces below/right of the origin got transparency from the wrong
  // region (the CSS clip-path hid this on canvas, but exports were wrong).
  const alpha = new Uint8Array(cw * ch);
  const mx0 = Math.round(bounds.x * w);
  const my0 = Math.round(bounds.y * h);
  const mw = Math.max(1, Math.round(bounds.width * w));
  const mh = Math.max(1, Math.round(bounds.height * h));
  for (let y = 0; y < ch; y++) {
    const sy = Math.min(h - 1, my0 + Math.floor((y / ch) * mh));
    for (let x = 0; x < cw; x++) {
      const sx = Math.min(w - 1, mx0 + Math.floor((x / cw) * mw));
      alpha[y * cw + x] = maskWorking[sy * w + sx] ? 255 : 0;
    }
  }

  const rgba = Buffer.alloc(cw * ch * 4);
  for (let i = 0; i < cw * ch; i++) {
    rgba[i * 4] = resized.data[i * 3];
    rgba[i * 4 + 1] = resized.data[i * 3 + 1];
    rgba[i * 4 + 2] = resized.data[i * 3 + 2];
    rgba[i * 4 + 3] = alpha[i];
  }

  const png = await sharp(rgba, {
    raw: { width: cw, height: ch, channels: 4 },
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}
