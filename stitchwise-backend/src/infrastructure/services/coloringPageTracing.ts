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
const MIN_REGION_PIXELS = 3;
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
    if (cells.length >= MIN_REGION_PIXELS) regions.push(cells);
  }

  // Stable ordering makes generated labels deterministic across runs.
  regions.sort((a, b) => {
    const firstA = Math.min(...a);
    const firstB = Math.min(...b);
    return firstA - firstB;
  });

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
