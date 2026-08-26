/**
 * Convert black-and-white coloring-page line art into enclosed cuttable pieces.
 *
 * Unlike color segmentation, this intentionally follows the ink boundaries:
 * every white cell enclosed by an outline becomes one piece, while white cells
 * connected to the image edge remain the background fabric. This gives the
 * collage editor deterministic, non-overlapping shapes suitable for manual
 * coloring and cutting.
 */
import sharp from "sharp";
import type { CollagePiece } from "../../domain/ai/collageAI";

const WORK_SIZE = 512;
const INK_THRESHOLD = 120;
/**
 * A 512×512 analysis canvas has 262,144 pixels. Regions below 50 pixels are
 * typically anti-aliasing flecks or tiny decorative dots (under roughly 0.02%
 * of the canvas), not practical fabric pieces. They are merged into the
 * largest adjacent enclosed region instead of being silently discarded.
 */
const MIN_REGION_PIXELS = 50;
/** Keep the final pattern within a human-cuttable piece count. */
const MAX_PIECES = 100;
const MAX_OUTLINE_POINTS = 120;

export interface ColoringPageTracingResult {
  pieces: CollagePiece[];
  referenceImage: string;
}

/**
 * Trace enclosed white cells in line art into normalized collage pieces.
 *
 * The analysis canvas is a centered 512×512 cover resize, as image generation
 * produces square artwork. The original image is retained as the reference
 * image so the client can show the source without losing its native detail.
 */
export async function traceColoringPageIntoPieces(
  imageBuffer: Buffer,
): Promise<ColoringPageTracingResult> {
  const { data } = await sharp(imageBuffer)
    .resize(WORK_SIZE, WORK_SIZE, { fit: "cover", position: "centre" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const gray = new Uint8Array(data);
  const n = WORK_SIZE * WORK_SIZE;
  const ink = new Uint8Array(n);
  for (let i = 0; i < n; i++) ink[i] = gray[i] < INK_THRESHOLD ? 1 : 0;

  // Flood-fill all non-ink pixels reachable from an edge. These are the page
  // background. The remaining non-ink cells are enclosed by line boundaries.
  const outside = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const enqueueIfOpen = (index: number) => {
    if (index < 0 || index >= n || ink[index] || outside[index]) return;
    outside[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < WORK_SIZE; x++) {
    enqueueIfOpen(x);
    enqueueIfOpen((WORK_SIZE - 1) * WORK_SIZE + x);
  }
  for (let y = 1; y < WORK_SIZE - 1; y++) {
    enqueueIfOpen(y * WORK_SIZE);
    enqueueIfOpen(y * WORK_SIZE + WORK_SIZE - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    const row = Math.floor(index / WORK_SIZE);
    const col = index % WORK_SIZE;
    if (row > 0) enqueueIfOpen(index - WORK_SIZE);
    if (row + 1 < WORK_SIZE) enqueueIfOpen(index + WORK_SIZE);
    if (col > 0) enqueueIfOpen(index - 1);
    if (col + 1 < WORK_SIZE) enqueueIfOpen(index + 1);
  }

  const visited = new Uint8Array(n);
  const regions: number[][] = [];
  for (let start = 0; start < n; start++) {
    if (ink[start] || outside[start] || visited[start]) continue;
    const cells: number[] = [];
    head = 0;
    tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const index = queue[head++];
      cells.push(index);
      const row = Math.floor(index / WORK_SIZE);
      const col = index % WORK_SIZE;
      const neighbors = [
        row > 0 ? index - WORK_SIZE : -1,
        row + 1 < WORK_SIZE ? index + WORK_SIZE : -1,
        col > 0 ? index - 1 : -1,
        col + 1 < WORK_SIZE ? index + 1 : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && !ink[neighbor] && !outside[neighbor] && !visited[neighbor]) {
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
    }
    // Keep every non-empty component for now. Small components must be merged
    // into a neighboring region so their pixels are not dropped and the final
    // pattern remains edge-complete.
    if (cells.length > 0) regions.push(cells);
  }

  // Stable ordering makes generated labels deterministic across runs.
  regions.sort((a, b) => {
    const firstA = Math.min(...a);
    const firstB = Math.min(...b);
    return firstA - firstB;
  });

  // Merge impractical specks first, then enforce the overall human-cuttable
  // cap. Both passes merge into the largest neighboring region; no cells are
  // discarded and meaningful regions above the floor survive naturally.
  mergeSmallRegions(regions, ink, MIN_REGION_PIXELS);
  mergeSmallestRegionsToCap(regions, ink, MAX_PIECES);

  const pieces: CollagePiece[] = [];
  for (let i = 0; i < regions.length; i++) {
    const cells = regions[i];
    const mask = new Uint8Array(n);
    let minRow = WORK_SIZE;
    let minCol = WORK_SIZE;
    let maxRow = 0;
    let maxCol = 0;
    for (const index of cells) {
      mask[index] = 1;
      const row = Math.floor(index / WORK_SIZE);
      const col = index % WORK_SIZE;
      if (row < minRow) minRow = row;
      if (row > maxRow) maxRow = row;
      if (col < minCol) minCol = col;
      if (col > maxCol) maxCol = col;
    }
    const bounds = {
      x: minCol / WORK_SIZE,
      y: minRow / WORK_SIZE,
      width: (maxCol - minCol + 1) / WORK_SIZE,
      height: (maxRow - minRow + 1) / WORK_SIZE,
    };
    pieces.push({
      id: `piece-${i + 1}`,
      label: `Piece ${i + 1}`,
      outline: traceBoundary(mask, minRow, maxRow, minCol, maxCol),
      bounds,
      color: "#f8f8f8",
      image: await makePieceImage(mask, minRow, maxRow, minCol, maxCol),
    });
  }

  return {
    pieces,
    referenceImage: await makeReferenceImage(imageBuffer),
  };
}

/**
 * Merge every region below the practical cuttable floor into its largest
 * neighboring region. Components are separated by ink lines, so "neighbor"
 * means the closest enclosed region reached by walking through the separating
 * ink. This correctly maps a tiny dot inside a larger outlined shape back to
 * the shape around it, rather than merging it with an unrelated nearby piece.
 */
function mergeSmallRegions(regions: number[][], ink: Uint8Array, minimum: number): void {
  while (regions.length > 1) {
    let smallest = -1;
    let smallestSize = minimum;
    for (let i = 0; i < regions.length; i++) {
      if (regions[i].length < smallestSize) {
        smallest = i;
        smallestSize = regions[i].length;
      }
    }
    if (smallest < 0) break;
    if (!mergeRegionIntoLargestNeighbor(regions, smallest, ink)) break;
  }
}

/** Merge the smallest regions until the output is within the human-cuttable cap. */
function mergeSmallestRegionsToCap(regions: number[][], ink: Uint8Array, cap: number): void {
  while (regions.length > cap) {
    let smallest = 0;
    for (let i = 1; i < regions.length; i++) {
      if (regions[i].length < regions[smallest].length) smallest = i;
    }
    if (!mergeRegionIntoLargestNeighbor(regions, smallest, ink)) break;
  }
}

/** Merge one region into its largest closest neighbor without dropping pixels. */
function mergeRegionIntoLargestNeighbor(
  regions: number[][],
  sourceIndex: number,
  ink: Uint8Array,
): boolean {
  if (regions.length < 2) return false;
  const regionMap = buildRegionMap(regions);
  let targetIndex = findLargestNeighbor(regions, sourceIndex, regionMap, ink);
  if (targetIndex < 0) {
    // Every enclosed region should have a surrounding region, but retain a
    // lossless fallback for malformed/open artwork rather than dropping cells.
    targetIndex = findLargestOtherRegion(regions, sourceIndex);
  }
  if (targetIndex < 0) return false;
  regions[targetIndex].push(...regions[sourceIndex]);
  regions.splice(sourceIndex, 1);
  return true;
}

function buildRegionMap(regions: number[][]): Int32Array {
  const map = new Int32Array(WORK_SIZE * WORK_SIZE).fill(-1);
  for (let regionIndex = 0; regionIndex < regions.length; regionIndex++) {
    for (const cell of regions[regionIndex]) map[cell] = regionIndex;
  }
  return map;
}

/**
 * Find candidates at the smallest ink-crossing distance, then choose the
 * largest candidate. Eight-connectivity lets this work with anti-aliased and
 * diagonal line boundaries while retaining the existing four-connected white
 * component extraction.
 */
function findLargestNeighbor(
  regions: number[][],
  sourceIndex: number,
  regionMap: Int32Array,
  ink: Uint8Array,
): number {
  const source = regions[sourceIndex];
  const n = WORK_SIZE * WORK_SIZE;
  const seen = new Uint8Array(n);
  const queue = new Int32Array(n);
  const distance = new Int32Array(n);
  let head = 0;
  let tail = 0;
  let nearestDistance = Infinity;
  const candidates = new Set<number>();
  const directions: Array<[number, number]> = [
    [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1],
  ];
  const inspect = (cell: number, nextDistance: number) => {
    const row = Math.floor(cell / WORK_SIZE);
    const col = cell % WORK_SIZE;
    for (const [dr, dc] of directions) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= WORK_SIZE || nc < 0 || nc >= WORK_SIZE) continue;
      const neighbor = nr * WORK_SIZE + nc;
      const neighborRegion = regionMap[neighbor];
      if (neighborRegion >= 0 && neighborRegion !== sourceIndex) {
        if (nextDistance < nearestDistance) {
          nearestDistance = nextDistance;
          candidates.clear();
        }
        if (nextDistance === nearestDistance) candidates.add(neighborRegion);
      } else if (neighborRegion < 0 && ink[neighbor] && !seen[neighbor]) {
        seen[neighbor] = 1;
        queue[tail] = neighbor;
        distance[tail] = nextDistance;
        tail++;
      }
    }
  };
  for (const cell of source) inspect(cell, 0);
  while (head < tail) {
    const cell = queue[head];
    const cellDistance = distance[head];
    head++;
    if (cellDistance > nearestDistance) break;
    inspect(cell, cellDistance + 1);
  }
  let largest = -1;
  for (const candidate of candidates) {
    if (candidate >= 0 && (largest < 0 || regions[candidate].length > regions[largest].length)) {
      largest = candidate;
    }
  }
  return largest;
}

function findLargestOtherRegion(regions: number[][], sourceIndex: number): number {
  let largest = -1;
  for (let i = 0; i < regions.length; i++) {
    if (i !== sourceIndex && (largest < 0 || regions[i].length > regions[largest].length)) largest = i;
  }
  return largest;
}

/** Render a white filled, transparent-outside crop for the piece tray. */
async function makePieceImage(
  mask: Uint8Array,
  minRow: number,
  maxRow: number,
  minCol: number,
  maxCol: number,
): Promise<string> {
  const width = Math.max(1, maxCol - minCol + 1);
  const height = Math.max(1, maxRow - minRow + 1);
  const rgba = new Uint8Array(width * height * 4);
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (!mask[row * WORK_SIZE + col]) continue;
      const offset = ((row - minRow) * width + (col - minCol)) * 4;
      rgba[offset] = 255;
      rgba[offset + 1] = 255;
      rgba[offset + 2] = 255;
      rgba[offset + 3] = 255;
    }
  }
  const png = await sharp(Buffer.from(rgba), {
    raw: { width, height, channels: 4 },
  }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function makeReferenceImage(imageBuffer: Buffer): Promise<string> {
  const png = await sharp(imageBuffer).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

/**
 * Moore-neighbor boundary tracing, normalized to the piece's local bounding box.
 * Enclosed components are 4-connected, so one outer contour is sufficient for
 * the editor while preserving concave outlines.
 */
function traceBoundary(
  mask: Uint8Array,
  minRow: number,
  maxRow: number,
  minCol: number,
  maxCol: number,
): Array<[number, number]> {
  let startRow = -1;
  let startCol = -1;
  for (let row = minRow; row <= maxRow && startRow < 0; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const index = row * WORK_SIZE + col;
      if (!mask[index]) continue;
      if (
        row === 0 || row === WORK_SIZE - 1 || col === 0 || col === WORK_SIZE - 1 ||
        !mask[index - WORK_SIZE] || !mask[index + WORK_SIZE] ||
        !mask[index - 1] || !mask[index + 1]
      ) {
        startRow = row;
        startCol = col;
        break;
      }
    }
  }
  if (startRow < 0) return [[0, 0], [1, 0], [1, 1], [0, 1]];

  const dirs: Array<[number, number]> = [
    [0, -1], [-1, -1], [-1, 0], [-1, 1],
    [0, 1], [1, 1], [1, 0], [1, -1],
  ];
  const inRegion = (row: number, col: number) =>
    row >= 0 && row < WORK_SIZE && col >= 0 && col < WORK_SIZE && mask[row * WORK_SIZE + col] === 1;
  const contour: Array<[number, number]> = [];
  let row = startRow;
  let col = startCol;
  let backRow = startRow;
  let backCol = startCol - 1;
  const maxSteps = (maxRow - minRow + 1) * (maxCol - minCol + 1) * 8 + 1024;
  for (let step = 0; step < maxSteps; step++) {
    contour.push([col, row]);
    let backDir = dirs.findIndex(([dr, dc]) => row + dr === backRow && col + dc === backCol);
    if (backDir < 0) backDir = 0;
    let found = false;
    for (let offset = 1; offset <= 8; offset++) {
      const dir = (backDir + offset) % 8;
      const nextRow = row + dirs[dir][0];
      const nextCol = col + dirs[dir][1];
      if (inRegion(nextRow, nextCol)) {
        backRow = row;
        backCol = col;
        row = nextRow;
        col = nextCol;
        found = true;
        break;
      }
    }
    if (!found || (row === startRow && col === startCol)) break;
  }
  if (contour.length < 3) return [[0, 0], [1, 0], [1, 1], [0, 1]];

  // Remove consecutive duplicate points and cap payload size without smoothing
  // (not smoothing guarantees the polygon never includes pixels outside mask).
  const deduped = contour.filter((point, index) => {
    const previous = contour[(index - 1 + contour.length) % contour.length];
    return point[0] !== previous[0] || point[1] !== previous[1];
  });
  const step = Math.max(1, Math.ceil(deduped.length / MAX_OUTLINE_POINTS));
  const sampled = deduped.filter((_, index) => index % step === 0);
  const width = Math.max(1, maxCol - minCol + 1);
  const height = Math.max(1, maxRow - minRow + 1);
  const result = sampled.map(([x, y]) => [
    Math.max(0, Math.min(1, (x - minCol) / width)),
    Math.max(0, Math.min(1, (y - minRow) / height)),
  ] as [number, number]);
  return result.length >= 3 ? result : [[0, 0], [1, 0], [1, 1], [0, 1]];
}
