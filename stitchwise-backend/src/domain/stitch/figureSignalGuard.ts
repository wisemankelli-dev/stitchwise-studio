/**
 * Deterministic figure-signal guard for scattered / repeating-pattern subjects.
 *
 * Owner-conclusive (09-21, gap #41 3rd report): "snowflakes on a blue
 * stocking" regenerated after PR #185 now has the CORRECT palette (3 colors:
 * white + two blues) but STILL drew ONE big snowman-like figure instead of
 * scattered white snowflakes on blue. Root cause: the non-animal stocking
 * shape hint ("the subject fills the entire stocking silhouette ... spreading
 * and stretching edge to edge") transforms a scatter/pattern subject into ONE
 * stretched object, and Gemini reads "snowflakes in a stocking" as a
 * character (head + torso + feet).
 *
 * Two deterministic layers:
 *   1. isScatterPatternPrompt() — prompt-side gate: does the user ask for a
 *      scattered / repeating pattern (snowflakes, stars, dots, polka, candy
 *      canes, confetti, "repeating/pattern/many small")? Prompt enrichment
 *      uses this to switch from the stretch-fill sentence to a REPEATING-
 *      PATTERN sentence (no single large object / no character / no snowman /
 *      no face).
 *   2. analyzeFigureSignal() — grid-side check, run after quantization:
 *      connected-component analysis over the FOREGROUND cells, where
 *      "foreground" = every color EXCEPT the most common (dominant) color of
 *      the canvas. For a scattered pattern the canvas background is almost
 *      always the dominant color, so the subject (white snowflakes on blue,
 *      red dots on white, navy stars on cream …) becomes the foreground and
 *      each motif is a separate component. If the LARGEST component covers
 *      > 50% of the foreground AND the prompt asked for a scattered pattern,
 *      the AI drew ONE big figure, not the pattern → qualityGate raises
 *      conversionWarning "The AI drew a single figure instead of your
 *      pattern — please regenerate".
 *
 * Why NOT the converter's near-white "background" rule here: a white snowman
 * on a blue stocking would be classified as background (near-white), so the
 * figure would be invisible to the analysis. The dominant-color split keeps
 * the SUBJECT in the foreground no matter which side of the contrast the
 * canvas falls on — the correct read for pattern subjects.
 *
 * Animal/face prompts are NEVER scatter-like (isScatterPatternPrompt matches
 * only the scatter token set, which contains no animal terms), so the
 * bag-charm #182–#184 paths stay byte-identical.
 */
import type { StitchCell } from "./types";

/**
 * Scatter/pattern subject tokens. Plural forms of common motifs plus
 * arrangement words that describe a REPEATING pattern. "a star" (single
 * subject) does NOT match; "stars" does.
 */
const SCATTER_SUBJECT_REGEX =
  /\b(snowflakes|snow flakes|stars|dots|polka|candy canes|snowmen|confetti|bunting|sparkles|motifs|chevrons|sprinkles|scatter|scattered|repeating|repeated|repeats?|pattern|patterns|many small|all over|patchwork of|field of|swarm of|banner of)\b/i;

/** True when the prompt asks for a scattered / repeating pattern (not a single object). */
export function isScatterPatternPrompt(prompt: string): boolean {
  if (!prompt) return false;
  return SCATTER_SUBJECT_REGEX.test(prompt);
}

export interface FigureSignal {
  /** Total foreground cells (every color except the dominant canvas color). */
  filled: number;
  /** Number of 4-connected foreground components. */
  componentCount: number;
  /** Size (cells) of the largest component. */
  largestComponent: number;
  /** largestComponent / filled (0 when filled === 0). */
  largestFraction: number;
  /** Bounding box of the LARGEST component, or null when nothing is filled. */
  bbox: { minRow: number; maxRow: number; minCol: number; maxCol: number } | null;
  /** Component height (rows) of the largest component. */
  rowSpan: number;
  /** Component width (cols) of the largest component. */
  colSpan: number;
  /** The dominant (most common) canvas color, lowercased; "" when the canvas is empty. */
  dominantHex: string;
}

/**
 * Connected-component analysis (4-connectivity) over the grid's FOREGROUND
 * cells — every color EXCEPT the dominant canvas color. Optional dominantHex
 * override for tests.
 */
export function analyzeFigureSignal(
  grid: StitchCell[][],
  opts?: { dominantHex?: string },
): FigureSignal {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const empty: FigureSignal = {
    filled: 0,
    componentCount: 0,
    largestComponent: 0,
    largestFraction: 0,
    bbox: null,
    rowSpan: 0,
    colSpan: 0,
    dominantHex: "",
  };
  if (rows === 0 || cols === 0) return empty;

  // Dominant color = most common cell color (first-seen tie-break via Map
  // insertion order). Cells with no color are always background.
  const histogram = new Map<string, number>();
  for (const row of grid) {
    for (const cell of row) {
      const h = (cell?.color || "").toLowerCase();
      if (h) histogram.set(h, (histogram.get(h) || 0) + 1);
    }
  }
  let dominantHex = "";
  let maxCount = 0;
  for (const [hex, count] of histogram) {
    if (count > maxCount) {
      maxCount = count;
      dominantHex = hex;
    }
  }
  if (!dominantHex) return empty;
  const bgHex = (opts?.dominantHex || dominantHex).toLowerCase();
  const isForeground = (hex: string) => (hex || "").toLowerCase() !== bgHex;

  const filledCells: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) {
    const row = grid[r];
    for (let c = 0; c < cols; c++) {
      const cell = row?.[c];
      if (cell?.color && isForeground(cell.color)) filledCells.push([r, c]);
    }
  }
  const filled = filledCells.length;
  if (filled === 0) return { ...empty, dominantHex: bgHex };

  const visited = new Uint8Array(rows * cols);
  let largestComponent = 0;
  let componentCount = 0;
  let largestBBox: FigureSignal["bbox"] = null;
  const idx = (r: number, c: number) => r * cols + c;

  for (const [sr, sc] of filledCells) {
    if (visited[idx(sr, sc)]) continue;
    componentCount++;
    // BFS flood fill
    const stack: Array<[number, number]> = [[sr, sc]];
    visited[idx(sr, sc)] = 1;
    let size = 0;
    let minR = sr, maxR = sr, minC = sc, maxC = sc;
    while (stack.length > 0) {
      const [r, c] = stack.pop()!;
      size++;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
      for (const [nr, nc] of [
        [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
      ] as const) {
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (visited[idx(nr, nc)]) continue;
        const cell = grid[nr][nc];
        if (cell?.color && isForeground(cell.color)) {
          visited[idx(nr, nc)] = 1;
          stack.push([nr, nc]);
        }
      }
    }
    if (size > largestComponent) {
      largestComponent = size;
      largestBBox = { minRow: minR, maxRow: maxR, minCol: minC, maxCol: maxC };
    }
  }

  return {
    filled,
    componentCount,
    largestComponent,
    largestFraction: largestComponent / filled,
    bbox: largestBBox,
    rowSpan: largestBBox ? largestBBox.maxRow - largestBBox.minRow + 1 : 0,
    colSpan: largestBBox ? largestBBox.maxCol - largestBBox.minCol + 1 : 0,
    dominantHex: bgHex,
  };
}

/**
 * Figure-signal conversion warning. Returns a warning string ONLY for
 * scatter/pattern prompts whose converted grid is dominated by a single
 * figure (one component > ~50% of foreground AND [vertically elongated OR
 * very few components]) — the "snowman instead of snowflakes" signature.
 * Returns null for everything else (in particular for any prompt that is not
 * scatter-like, so animal/single-subject paths never warn).
 */
export function figureSignalWarning(
  grid: StitchCell[][],
  prompt: string,
  opts?: { dominantHex?: string },
): string | null {
  if (!isScatterPatternPrompt(prompt)) return null;
  const s = analyzeFigureSignal(grid, opts);
  // Not enough subject to judge, or the grid is genuinely empty.
  if (!s.bbox || s.filled < 40) return null;
  const dominating = s.largestFraction > 0.5;
  if (!dominating) return null;
  const verticallyElongated = s.rowSpan >= s.colSpan * 1.3;
  const veryFewComponents = s.componentCount <= 2;
  if (verticallyElongated || veryFewComponents) {
    return "The AI drew a single figure instead of your scattered pattern — please regenerate";
  }
  return null;
}