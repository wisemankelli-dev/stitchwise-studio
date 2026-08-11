/**
 * Collage Piece Segmentation — Scrapbook cutout pieces from the actual art image.
 *
 * The collage-quilting flow (owner direction, reference: collagequilter.com)
 * treats the requested art like a fabric scrapbook: the image is segmented into
 * natural regions, and each region becomes a PIECE that carries the real art
 * pixels inside its outline shape, with transparency outside the mask. The
 * customer then arranges these cutout pieces on the block.
 *
 * Pipeline:
 *   1. Downscale to a working resolution and quantize colors (k-means).
 *   2. Find connected components per quantized color (4-connectivity flood fill).
 *   3. Drop specks (< 0.5% of image), merge smallest regions into largest
 *      neighbor until at most maxPieces (default 40) remain.
 *   4. For each region emit a CollagePiece:
 *        { id, label, outline: [[x,y] normalized 0-1] (simplified polygon),
 *          bounds (normalized bbox), color (dominant fabric hex),
 *          image: data-URL PNG cutout with transparency outside the mask }
 *   5. Also return the full art image as a data-URL reference.
 */
import sharp from "sharp";
import { closestFabricColor } from "../../domain/collage/fabricColors";
import type { CollagePiece } from "../../domain/ai/collageAI";

/** Working resolution (max dimension) used for segmentation analysis. */
const WORK_SIZE = 160;
/** Default maximum number of pieces. */
const MAX_PIECES = 40;
/** Regions smaller than this fraction of the image are dropped as specks. */
const MIN_PIECE_FRACTION = 0.005;
/** Maximum pixel dimension of a piece image crop (keeps payloads sane). */
const PIECE_MAX_DIM = 256;
/** k-means palette size. */
const PALETTE_K = 12;

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
  const maxPieces = opts?.maxPieces ?? MAX_PIECES;

  const meta = await sharp(imageBuffer).metadata();
  const ow = meta.width ?? 400;
  const oh = meta.height ?? 400;
  const scale = Math.min(1, WORK_SIZE / Math.max(ow, oh));
  const w = Math.max(8, Math.round(ow * scale));
  const h = Math.max(8, Math.round(oh * scale));

  const { data } = await sharp(imageBuffer)
    .resize(w, h, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data);
  const n = w * h;

  // ── 1. Quantize colors (deterministic k-means) ────────────────────────────
  const { labels } = quantizePixels(pixels, w, h, PALETTE_K);

  // ── 2. Connected components per color label ───────────────────────────────
  const regions = connectedComponents(labels, w, h);

  // ── 3. Drop specks + cap piece count ──────────────────────────────────────
  const minArea = Math.max(4, Math.floor(n * MIN_PIECE_FRACTION));
  let kept = regions.filter((r) => r.cells.length >= minArea);
  kept = capRegions(kept, labels, w, h, maxPieces);

  if (kept.length === 0) {
    // Extremely uniform image — treat the whole canvas as one piece.
    kept = [{ id: 0, cells: Array.from({ length: n }, (_, i) => i) }];
  }

  // ── 4. Emit pieces ────────────────────────────────────────────────────────
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
    const image = await makePieceImage(
      imageBuffer,
      mask,
      w,
      h,
      ow,
      oh,
      bounds,
    );

    pieces.push({
      id: `piece-${i + 1}`,
      label: `Piece ${i + 1}`,
      outline,
      bounds,
      color: fabric.hex,
      image,
    });
  }

  // ── 5. Reference image (full art, downscaled) ─────────────────────────────
  const ref = await sharp(imageBuffer)
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  const referenceImage = `data:image/png;base64,${ref.toString("base64")}`;

  return { pieces, referenceImage };
}

// ─── K-means quantization ────────────────────────────────────────────────────

/**
 * Deterministic k-means color quantization. Returns per-pixel cluster labels.
 */
function quantizePixels(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  k: number,
): { labels: Uint8Array; centers: Array<[number, number, number]> } {
  const n = w * h;
  const labels = new Uint8Array(n);

  // Sample for deterministic farthest-first initialization
  const sampleStep = Math.max(1, Math.floor(n / 2000));
  const sample: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i += sampleStep) {
    sample.push([pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]]);
  }

  // Farthest-first: first center = first sample; then always pick the sample
  // farthest from the nearest existing center.
  const centers: Array<[number, number, number]> = [sample[0]];
  while (centers.length < k && centers.length < sample.length) {
    let bestIdx = 0;
    let bestDist = -1;
    for (let s = 0; s < sample.length; s++) {
      let minD = Infinity;
      for (const c of centers) {
        const dr = sample[s][0] - c[0];
        const dg = sample[s][1] - c[1];
        const db = sample[s][2] - c[2];
        const d = dr * dr + dg * dg + db * db;
        if (d < minD) minD = d;
      }
      if (minD > bestDist) {
        bestDist = minD;
        bestIdx = s;
      }
    }
    centers.push(sample[bestIdx]);
  }

  // Lloyd iterations
  for (let iter = 0; iter < 8; iter++) {
    for (let i = 0; i < n; i++) {
      const r = pixels[i * 4];
      const g = pixels[i * 4 + 1];
      const b = pixels[i * 4 + 2];
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const dr = r - centers[c][0];
        const dg = g - centers[c][1];
        const db = b - centers[c][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      labels[i] = best;
    }
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      const c = labels[i];
      sums[c][0] += pixels[i * 4];
      sums[c][1] += pixels[i * 4 + 1];
      sums[c][2] += pixels[i * 4 + 2];
      sums[c][3] += 1;
    }
    for (let c = 0; c < centers.length; c++) {
      if (sums[c][3] > 0) {
        centers[c] = [
          Math.round(sums[c][0] / sums[c][3]),
          Math.round(sums[c][1] / sums[c][3]),
          Math.round(sums[c][2] / sums[c][3]),
        ];
      }
    }
  }

  return { labels, centers };
}

// ─── Connected components ────────────────────────────────────────────────────

interface Region {
  id: number;
  cells: number[];
}

function connectedComponents(labels: Uint8Array, w: number, h: number): Region[] {
  const n = w * h;
  const visited = new Uint8Array(n);
  const regions: Region[] = [];
  const stack: number[] = [];

  for (let start = 0; start < n; start++) {
    if (visited[start]) continue;
    const label = labels[start];
    const cells: number[] = [];
    stack.length = 0;
    stack.push(start);
    visited[start] = 1;
    while (stack.length > 0) {
      const cell = stack.pop()!;
      cells.push(cell);
      const r = Math.floor(cell / w);
      const c = cell % w;
      const neighbors = [
        r > 0 ? cell - w : -1,
        r < h - 1 ? cell + w : -1,
        c > 0 ? cell - 1 : -1,
        c < w - 1 ? cell + 1 : -1,
      ];
      for (const nb of neighbors) {
        if (nb >= 0 && !visited[nb] && labels[nb] === label) {
          visited[nb] = 1;
          stack.push(nb);
        }
      }
    }
    regions.push({ id: regions.length, cells });
  }
  return regions;
}

// ─── Region capping ──────────────────────────────────────────────────────────

/**
 * If there are more than maxPieces regions, repeatedly merge the smallest
 * region into its largest neighbor (by shared border) until the cap is met.
 */
function capRegions(
  regions: Region[],
  labels: Uint8Array,
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
      // No neighbor (shouldn't happen with connected regions) — merge into largest
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

  // Ensure the polygon is closed (first point repeated not required by canvas clip)
  if (result.length < 3) return [[0, 0], [1, 0], [1, 1], [0, 1]];
  return result;
}

/**
 * Ramer–Douglas–Peucker polyline simplification.
 */
function rdp(points: Array<[number, number]>, epsilon: number): Array<[number, number]> {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance from the line between first and last
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

  // Build alpha channel: upscale working mask (nearest) to crop size
  const alpha = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    const sy = Math.min(h - 1, Math.floor((y / ch) * h));
    for (let x = 0; x < cw; x++) {
      const sx = Math.min(w - 1, Math.floor((x / cw) * w));
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
