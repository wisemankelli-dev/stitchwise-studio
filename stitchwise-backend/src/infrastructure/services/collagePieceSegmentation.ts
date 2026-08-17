/**
 * Collage Piece Segmentation — Scrapbook cutout pieces from the actual art image.
 *
 * The collage-quilting flow (owner direction, reference: collagequilters.com)
 * treats the requested art like a fabric collage: the image is divided into
 * pieces that each represent ONE COLOR VARIANT of the artwork, so the customer
 * cuts each piece from fabric similar in color/texture and reassembles them
 * into the lifelike design.
 *
 * Segmentation algorithm (color-region segmentation, replaced gradient
 * watershed on 2026-08-12 after the owner reported "random shapes"):
 *   The old watershed followed luminance/texture edges, so painterly shading
 *   and brush texture inside a single color area got split into arbitrary
 *   slivers. Real collage quilting follows COLOR areas: each fabric piece is
 *   one region of similar color. So:
 *
 *   1. K-means color quantization (deterministic, k = f(maxPieces)) turns the
 *      art into a small palette of representative color centroids.
 *   2. Every pixel is assigned to its nearest centroid → label map.
 *   3. A 3x3 majority (median) filter is applied to the label map (2 passes)
 *      to remove single-pixel speckle so regions come out contiguous.
 *   4. Connected components (4-connectivity) of equal labels are the pieces.
 *      Every pixel belongs to exactly one component → edge-to-edge tiling with
 *      no gaps (this was the "splattered marks" bug of the old k-means path,
 *      which DROPPED specks and left holes — here we MERGE, never drop).
 *   5. Tiny regions merge into their largest neighbor (never dropped), and the
 *      result is capped at maxPieces by merging the smallest into the largest
 *      neighbor (by shared border).
 *   6. For each region emit a CollagePiece:
 *        { id, label, outline: [[x,y] normalized 0-1] (piece-local bbox),
 *          bounds (normalized bbox in the art), color (the quantized color
 *          variant — the fabric the customer should match),
 *          image: data-URL PNG cutout with transparency outside the mask }
 *   7. Background pieces (near-white AND touching >= 2 canvas edges) are
 *      excluded server-side: in a collage quilt the background is the BASE
 *      FABRIC, not a cutout piece (the client also re-checks this).
 *   8. Also return the full art image as a data-URL reference.
 *
 * Outline tracing uses Moore-neighbor boundary following so CONCAVE color
 * regions (C-shapes, rings, tentacle forks) trace their true contour — the old
 * angle-sort-around-centroid approach could only produce star-shaped outlines.
 */
import sharp from "sharp";
import type { CollagePiece } from "../../domain/ai/collageAI";

/** Working resolution (max dimension) used for segmentation analysis. */
const WORK_SIZE = 384;
/** Default maximum number of pieces. */
const MAX_PIECES = 40;
/**
 * Regions smaller than this fraction of the image are merged into a neighbor.
 * With label-map connected components every pixel is already assigned, so this
 * only cleans up accidental slivers (e.g. a 2px boundary artifact).
 */
const MIN_PIECE_FRACTION = 0.001;
/** Maximum pixel dimension of a piece image crop (keeps payloads sane). */
const PIECE_MAX_DIM = 256;
/** K-means palette size factor: colors = clamp(round(maxPieces * 1.0), 10, 48). */
const COLOR_FACTOR = 1.0;
const COLOR_MIN = 10;
const COLOR_MAX = 48;
/**
 * Adjacent regions whose average colors are within this RGB Euclidean
 * distance are merged into one piece — collage patterns group only
 * near-identical fabric shades into a single larger region, while keeping
 * distinct feather/color variations as separate pieces (a 16x16 block can
 * reach 40-60 pieces when the artwork has rich color detail).
 */
const COLOR_MERGE_DISTANCE = 18;
/** Never merge below this many pieces, even if colors are close. */
const MIN_PIECES_AFTER_MERGE = 30;

export interface SegmentationOptions {
  maxPieces?: number;
}

export interface SegmentationResult {
  pieces: CollagePiece[];
  /** Full art image as data-URL PNG (reference for the piece tray). */
  referenceImage: string;
}

/**
 * Segment an art image into scrapbook cutout pieces that follow COLOR regions.
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
    .median(1)
    // CRITICAL: force 4 channels. Real AI art comes back as RGB (no alpha)
    // and the whole pipeline indexes pixels[i*4] assuming RGBA.
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data);
  const n = w * h;

  // ── 1. Deterministic k-means color quantization ───────────────────────────
  const k = Math.max(COLOR_MIN, Math.min(COLOR_MAX, Math.round(maxPieces * COLOR_FACTOR)));
  const { labels, centroids } = kmeansQuantize(pixels, w, h, k);

  // ── 1b. Exclude the BACKGROUND at pixel level BEFORE segmentation ─────────
  // In a collage quilt the backdrop is the BASE FABRIC, not a cutout piece.
  // Flood-fill from the image border over near-white pixels (the "white
  // background" of prompts like "red octopus on a white background") and mask
  // those pixels out of the label map entirely: they belong to no piece, and
  // the white canvas shows through as the base fabric. This prevents the
  // background from fragmenting into dozens of near-white pieces (each touching
  // only 0-1 edges, so the edge-count filter can't catch them) that would tile
  // around the subject and make the pattern look scrambled.
  const bgMask = floodBackground(pixels, w, h);
  for (let i = 0; i < n; i++) {
    if (bgMask[i]) labels[i] = -1; // -1 = background: never a piece
  }

  // ── 2. Median filter labels (majority of 3x3) to remove speckle ──────────
  const cleanLabels = medianFilterLabels(labels, w, h, 1);

  // ── 3. Connected components of equal labels → pieces ─────────────────────
  const regions = connectedComponents(cleanLabels, w, h);
  if (regions.length === 0) {
    return {
      pieces: [],
      referenceImage: await makeReferenceImage(imageBuffer),
    };
  }

  // ── 4. Merge tiny regions into largest neighbor (never drop pixels) ───────
  const minArea = Math.max(4, Math.floor(n * MIN_PIECE_FRACTION));
  let kept = mergeTinyRegions(regions, cleanLabels, w, h, minArea);
  if (kept.length === 0) {
    kept = [{ id: 0, cells: Array.from({ length: n }, (_, i) => i) }];
  }
  kept = capRegions(kept, cleanLabels, w, h, maxPieces);

  // ── 4b. Merge adjacent regions with SIMILAR colors into larger pieces ─────
  // Collage-quilt patterns group near-identical fabric shades into ONE piece:
  // a 16x16 block typically has 50-75 pieces, and color regions should be big,
  // not tiny gradient slivers. Repeatedly merge the closest-colored adjacent
  // pair until no pair is within COLOR_MERGE_DISTANCE or we hit the floor.
  kept = mergeSimilarColors(kept, pixels, w, h, COLOR_MERGE_DISTANCE, MIN_PIECES_AFTER_MERGE);

  // ── 5. Emit pieces ────────────────────────────────────────────────────────
  const pieces: CollagePiece[] = [];
  for (let i = 0; i < kept.length; i++) {
    const region = kept[i];
    const mask = new Uint8Array(n);
    for (const cell of region.cells) mask[cell] = 1;

    // Normalized bounds in the full art
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

    // Dominant color = the quantized color variant (centroid of this region's
    // dominant label). This is the fabric color the customer should match.
    // For regions merged from similar shades, the true average color of the
    // region's pixels is the fabric color the customer should match.
    const labelColor = averageColor(pixels, region.cells);
    const color = rgbToHex(labelColor);

    // True boundary contour (Moore neighbor tracing), normalized piece-local
    const outline = traceOutline(mask, w, h, minR, maxR, minC, maxC);

    // Cutout image: crop bbox from ORIGINAL art, transparency outside mask
    const image = await makePieceImage(imageBuffer, mask, w, h, ow, oh, bounds);

    pieces.push({
      id: `piece-${i + 1}`,
      label: `Piece ${i + 1}`,
      outline,
      bounds,
      color,
      image,
    });
  }

  // ── 6. Exclude background pieces (near-white + touching >= 2 edges) ───────
  // In a collage quilt the backdrop is the base fabric, not a cutout piece.
  // The white canvas becomes the base fabric underneath the subject pieces.
  const subjectPieces = pieces.filter((p) => !isBackgroundPiece(p));

  return {
    pieces: subjectPieces,
    referenceImage: await makeReferenceImage(imageBuffer),
  };
}

// ─── K-means color quantization ──────────────────────────────────────────────

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * K-means color quantization with k-means++ seeding. Returns the label map and
 * the centroids (as [r,g,b]).
 */
function kmeansQuantize(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  k: number,
): { labels: Int32Array; centroids: Array<[number, number, number]> } {
  const n = w * h;
  const rng = mulberry32(20260812);

  // Sample pool: every 2nd pixel (speed) — plenty for palette estimation.
  const pool: number[] = [];
  for (let i = 0; i < n; i += 2) pool.push(i);
  if (pool.length < k) {
    for (let i = 1; i < n; i += 2) pool.push(i);
  }
  const sample = pool.length > 0 ? pool : [0];

  const pxAt = (idx: number): [number, number, number] => [
    pixels[idx * 4],
    pixels[idx * 4 + 1],
    pixels[idx * 4 + 2],
  ];

  // k-means++ seeding (deterministic via seeded RNG)
  const centroids: Array<[number, number, number]> = [];
  const first = sample[Math.floor(rng() * sample.length)];
  centroids.push(pxAt(first));

  const dist2 = (a: [number, number, number], b: [number, number, number]): number => {
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    return dr * dr + dg * dg + db * db;
  };

  for (let c = 1; c < k; c++) {
    const dists = new Float64Array(sample.length);
    let total = 0;
    for (let i = 0; i < sample.length; i++) {
      const col = pxAt(sample[i]);
      let best = Infinity;
      for (const center of centroids) {
        const d = dist2(col, center);
        if (d < best) best = d;
      }
      dists[i] = best;
      total += best;
    }
    let r = rng() * total;
    let pick = sample.length - 1;
    for (let i = 0; i < sample.length; i++) {
      r -= dists[i];
      if (r <= 0) {
        pick = i;
        break;
      }
    }
    centroids.push(pxAt(sample[pick]));
  }

  // Lloyd iterations
  const labels = new Int32Array(n);
  const MAX_ITERS = 24;
  for (let iter = 0; iter < MAX_ITERS; iter++) {
    let changed = 0;
    for (let i = 0; i < n; i++) {
      const col = pxAt(i);
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = dist2(col, centroids[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (labels[i] !== best) {
        labels[i] = best;
        changed++;
      }
    }
    if (changed === 0) break;

    // Update centroids
    const sums: Array<[number, number, number, number]> = centroids.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      const c = labels[i];
      sums[c][0] += pixels[i * 4];
      sums[c][1] += pixels[i * 4 + 1];
      sums[c][2] += pixels[i * 4 + 2];
      sums[c][3]++;
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sums[c][3] > 0) {
        centroids[c] = [
          Math.round(sums[c][0] / sums[c][3]),
          Math.round(sums[c][1] / sums[c][3]),
          Math.round(sums[c][2] / sums[c][3]),
        ];
      }
    }
  }

  return { labels, centroids };
}

/** 3x3 majority filter over the label map (mode filter), `passes` times. */
function medianFilterLabels(
  labels: Int32Array,
  w: number,
  h: number,
  passes: number,
): Int32Array {
  let cur = new Int32Array(labels);
  const n = w * h;
  for (let p = 0; p < passes; p++) {
    const next = new Int32Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const counts = new Map<number, number>();
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
            const v = cur[yy * w + xx];
            counts.set(v, (counts.get(v) ?? 0) + 1);
          }
        }
        let bestV = cur[y * w + x];
        let bestC = -1;
        for (const [v, cnt] of counts) {
          if (cnt > bestC) {
            bestC = cnt;
            bestV = v;
          }
        }
        next[y * w + x] = bestV;
      }
    }
    cur = next;
  }
  return cur;
}

// ─── Regions ─────────────────────────────────────────────────────────────────

interface Region {
  id: number;
  cells: number[];
}

/**
 * Flood-fill from the image border over near-white pixels (brightness >= 200
 * and low saturation) to find the white background region(s). Returns a mask
 * (1 = background). In a collage quilt the backdrop is the base fabric — it is
 * excluded from the pieces so the white canvas shows through underneath.
 */
function floodBackground(pixels: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const n = w * h;
  const isNearWhite = (i: number): boolean => {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    const bright = (r + g + b) / 3;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx - mn;
    // TRUE near-white (bright AND essentially colorless): pure-white AI
    // backgrounds (bright ≥235, sat ≤25) or neutral light grays (bright ≥200,
    // sat ≤8). Anything with real color survives — pale animal legs (rooster
    // shanks, cream/light-tan limbs) sit at bright 200-235 with sat 30-65 and
    // were being flooded as "background", which dropped the legs from the
    // pattern entirely.
    return (bright >= 235 && sat <= 25) || (bright >= 200 && sat <= 8);
  };

  const mask = new Uint8Array(n);
  const stack: number[] = [];
  // Seed from all border pixels that are near-white
  for (let x = 0; x < w; x++) {
    const top = x;
    const bottom = (h - 1) * w + x;
    for (const idx of [top, bottom]) {
      if (!mask[idx] && isNearWhite(idx)) {
        mask[idx] = 1;
        stack.push(idx);
      }
    }
  }
  for (let y = 0; y < h; y++) {
    const left = y * w;
    const right = y * w + (w - 1);
    for (const idx of [left, right]) {
      if (!mask[idx] && isNearWhite(idx)) {
        mask[idx] = 1;
        stack.push(idx);
      }
    }
  }

  // 4-connectivity flood
  while (stack.length > 0) {
    const idx = stack.pop()!;
    const r = Math.floor(idx / w);
    const c = idx % w;
    const nbs = [
      r > 0 ? idx - w : -1,
      r < h - 1 ? idx + w : -1,
      c > 0 ? idx - 1 : -1,
      c < w - 1 ? idx + 1 : -1,
    ];
    for (const nb of nbs) {
      if (nb >= 0 && !mask[nb] && isNearWhite(nb)) {
        mask[nb] = 1;
        stack.push(nb);
      }
    }
  }
  return mask;
}

/** Connected components (4-connectivity) of equal labels (skip label -1). */
function connectedComponents(labels: Int32Array, w: number, h: number): Region[] {
  const n = w * h;
  const visited = new Uint8Array(n);
  const regions: Region[] = [];
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    if (visited[i] || labels[i] < 0) continue;
    visited[i] = 1;
    const label = labels[i];
    stack.push(i);
    const cells: number[] = [];
    while (stack.length > 0) {
      const idx = stack.pop()!;
      cells.push(idx);
      const r = Math.floor(idx / w);
      const c = idx % w;
      const nbs = [
        r > 0 ? idx - w : -1,
        r < h - 1 ? idx + w : -1,
        c > 0 ? idx - 1 : -1,
        c < w - 1 ? idx + 1 : -1,
      ];
      for (const nb of nbs) {
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

/**
 * Merge every region smaller than minArea into its largest neighbor (by shared
 * border). Pixels are NEVER dropped — the canvas stays fully tiled.
 */
function mergeTinyRegions(
  regions: Region[],
  _labels: Int32Array,
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
  _labels: Int32Array,
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

/**
 * Merge adjacent regions whose average colors are similar into LARGER pieces.
 * Collage-quilt patterns group near-identical fabric shades into one region —
 * the piece count for a 16x16 block typically stays at 50-75, and each piece
 * is a big color area, not a tiny gradient sliver.
 *
 * Strategy: compute each region's average color (over its real pixels, not the
 * quantized label), then repeatedly merge the closest-colored ADJACENT pair
 * (by shared border) until no pair is within maxDist or we reach minPieces.
 * Pixels are never dropped; contiguity is preserved because only neighbors
 * merge. The merged region's color becomes the area-weighted average, which is
 * what the customer should match in fabric.
 */
function mergeSimilarColors(
  regions: Region[],
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  maxDist: number,
  minPieces: number,
): Region[] {
  if (regions.length <= minPieces) return regions;

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

  // Average color per region (r,g,b as floats).
  const regionColor = (cells: number[]): [number, number, number] => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const cell of cells) {
      r += pixels[cell * 4];
      g += pixels[cell * 4 + 1];
      b += pixels[cell * 4 + 2];
    }
    const m = Math.max(1, cells.length);
    return [r / m, g / m, b / m];
  };

  const colors = current.map((r) => regionColor(r.cells));
  const colorDist = (a: number, b: number): number => {
    const dr = colors[a][0] - colors[b][0];
    const dg = colors[a][1] - colors[b][1];
    const db = colors[a][2] - colors[b][2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  while (current.length > minPieces) {
    // Find the closest-colored adjacent pair.
    let bestA = -1;
    let bestB = -1;
    let bestDist = Infinity;

    // Shared-border counts are computed per region on demand via the id map.
    // Iterate pairs of regions (i<j) and test adjacency through border pixels.
    for (let i = 0; i < current.length; i++) {
      const iCells = current[i].cells;
      for (let j = i + 1; j < current.length; j++) {
        const d = colorDist(i, j);
        if (d >= bestDist) continue;
        // Check adjacency: any cell of i with a 4-neighbor in j.
        let adjacent = false;
        for (const cell of iCells) {
          const r = Math.floor(cell / w);
          const c = cell % w;
          const nbs = [
            r > 0 ? cell - w : -1,
            r < h - 1 ? cell + w : -1,
            c > 0 ? cell - 1 : -1,
            c < w - 1 ? cell + 1 : -1,
          ];
          for (const nb of nbs) {
            if (nb >= 0 && regionIdOf[nb] === j) {
              adjacent = true;
              break;
            }
          }
          if (adjacent) break;
        }
        if (adjacent) {
          bestDist = d;
          bestA = i;
          bestB = j;
        }
      }
    }

    if (bestA === -1 || bestDist > maxDist) break;

    // Merge the smaller region into the larger.
    let keepIdx: number;
    let absorbIdx: number;
    if (current[bestA].cells.length >= current[bestB].cells.length) {
      keepIdx = bestA;
      absorbIdx = bestB;
    } else {
      keepIdx = bestB;
      absorbIdx = bestA;
    }

    const absorbed = current[absorbIdx].cells;
    current[keepIdx].cells.push(...absorbed);
    for (const cell of absorbed) regionIdOf[cell] = keepIdx;

    // Area-weighted average color for the merged region.
    const total = current[keepIdx].cells.length;
    const kc = colors[keepIdx];
    const ac = colors[absorbIdx];
    const keepCellsBefore = total - absorbed.length;
    const absorbCells = absorbed.length;
    colors[keepIdx] = [
      (kc[0] * keepCellsBefore + ac[0] * absorbCells) / total,
      (kc[1] * keepCellsBefore + ac[1] * absorbCells) / total,
      (kc[2] * keepCellsBefore + ac[2] * absorbCells) / total,
    ];
    current.splice(absorbIdx, 1);
    colors.splice(absorbIdx, 1);
    rebuildIdMap();
  }

  return current.map((r, i) => ({ id: i, cells: r.cells }));
}

// ─── Outline tracing (Moore-neighbor boundary following) ─────────────────────

/**
 * Trace the TRUE boundary contour of a region mask with Moore-neighbor
 * following, then smooth + simplify. Normalized to the PIECE's own bbox
 * (0..1 across minR..maxR / minC..maxC) — matches all client consumers
 * (canvas viewBox, PDF, tray). Returns [[x,y], ...] normalized 0-1.
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
  // Find the topmost-leftmost in-region boundary pixel as the start.
  let startR = -1;
  let startC = -1;
  outer: for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const idx = r * w + c;
      if (!mask[idx]) continue;
      const isEdge =
        r === 0 || r === h - 1 || c === 0 || c === w - 1 ||
        !mask[idx - w] || !mask[idx + w] || !mask[idx - 1] || !mask[idx + 1];
      if (isEdge) {
        startR = r;
        startC = c;
        break outer;
      }
    }
  }
  if (startR < 0) {
    return [[0, 0], [1, 0], [1, 1], [0, 1]];
  }

  // Moore neighbor tracing. dirs ordered clockwise starting at W.
  // eslint-disable-next-line prettier/prettier
  const dirs: Array<[number, number]> = [
    [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1],
  ];
  const inRegion = (r: number, c: number): boolean =>
    r >= 0 && r < h && c >= 0 && c < w && mask[r * w + c] === 1;

  const contour: Array<[number, number]> = [];
  let br = startR;
  let bc = startC;
  // backtrack = the pixel we "came from" (west of start initially)
  let tr = startR;
  let tc = startC - 1;
  const maxSteps = (maxR - minR + 1) * (maxC - minC + 1) * 8 + 1024;
  let guard = 0;

  while (guard++ < maxSteps) {
    contour.push([bc, br]);
    // Find the index of the backtrack pixel around current b
    let startDir = -1;
    for (let d = 0; d < 8; d++) {
      if (br + dirs[d][0] === tr && bc + dirs[d][1] === tc) {
        startDir = d;
        break;
      }
    }
    if (startDir < 0) startDir = 0;
    // Scan clockwise starting from the neighbor after backtrack
    let found = false;
    for (let k = 1; k <= 8; k++) {
      const d = (startDir + k) % 8;
      const nr = br + dirs[d][0];
      const nc = bc + dirs[d][1];
      if (inRegion(nr, nc)) {
        tr = br;
        tc = bc;
        br = nr;
        bc = nc;
        found = true;
        break;
      }
    }
    if (!found) break;
    // Stop when we return to the start pixel (full loop closed)
    if (br === startR && bc === startC) break;
  }

  if (contour.length < 3) {
    return [[0, 0], [1, 0], [1, 1], [0, 1]];
  }

  // Moving-average smoothing (2 passes, window 3)
  let pts = contour;
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

  // Simplify with Ramer–Douglas–Peucker
  const simplified = rdp(pts, 0.05);

  // Hard cap on outline points
  const MAX_OUTLINE_POINTS = 120;
  let finalPts = simplified;
  if (finalPts.length > MAX_OUTLINE_POINTS) {
    const step = Math.ceil(finalPts.length / MAX_OUTLINE_POINTS);
    finalPts = finalPts.filter((_, i) => i % step === 0);
  }

  // Normalize to the piece's own bbox
  const pw = maxC - minC + 1;
  const ph = maxR - minR + 1;
  const result = finalPts.map(([x, y]) => [
    Math.max(0, Math.min(1, (x - minC) / pw)),
    Math.max(0, Math.min(1, (y - minR) / ph)),
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

/** Average RGB color over the region's pixels (the fabric color to match). */
function averageColor(
  pixels: Uint8ClampedArray,
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
  const m = Math.max(1, cells.length);
  return [Math.round(r / m), Math.round(g / m), Math.round(b / m)];
}

/** Mode label of the region's cells → its centroid color. */
function dominantLabelColor(
  labels: Int32Array,
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  cells: number[],
  centroids: Array<[number, number, number]>,
): [number, number, number] {
  const counts = new Map<number, number>();
  for (const cell of cells) {
    const v = labels[cell];
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let bestLabel = -1;
  let bestC = -1;
  for (const [v, cnt] of counts) {
    if (cnt > bestC) {
      bestC = cnt;
      bestLabel = v;
    }
  }
  if (bestLabel >= 0 && bestLabel < centroids.length) return centroids[bestLabel];
  // Fallback: average color of the cells
  let r = 0;
  let g = 0;
  let b = 0;
  for (const cell of cells) {
    r += pixels[cell * 4];
    g += pixels[cell * 4 + 1];
    b += pixels[cell * 4 + 2];
  }
  const m = Math.max(1, cells.length);
  return [Math.round(r / m), Math.round(g / m), Math.round(b / m)];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const to2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/**
 * Background detection: a piece is "background" if it is near-white AND touches
 * >= 2 canvas edges. In a collage quilt the backdrop is the base fabric.
 */
function isBackgroundPiece(p: CollagePiece): boolean {
  const b = p.bounds;
  const touchesLeft = b.x <= 0.005;
  const touchesTop = b.y <= 0.005;
  const touchesRight = b.x + b.width >= 0.995;
  const touchesBottom = b.y + b.height >= 0.995;
  const edgeCount =
    (touchesLeft ? 1 : 0) + (touchesTop ? 1 : 0) +
    (touchesRight ? 1 : 0) + (touchesBottom ? 1 : 0);
  return edgeCount >= 2 && hexBrightness(p.color) >= 200;
}

function hexBrightness(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 0;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r + g + b) / 3;
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

async function makeReferenceImage(imageBuffer: Buffer): Promise<string> {
  const ref = await sharp(imageBuffer)
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  return `data:image/png;base64,${ref.toString("base64")}`;
}
