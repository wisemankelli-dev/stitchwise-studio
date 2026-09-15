/**
 * Deterministic face-feature guard for small AI stitch grids.
 *
 * Owner-conclusive (09-15, 3rd report): the bag-charm preset 28×28 prompt
 * "teddy bear" converted to a FEATURELESS ORANGE BLOB — 0 dark cells (no eyes,
 * no nose, no dark outline). The enriched prompt already asks the model for
 * "THICK dark outline ... simple readable features", but Gemini ignores it on a
 * coin-flip basis (bagcharm2 kept eyes, bagcharm3 lost ears, bagcharm4 lost the
 * whole face — pure model variance), and the converter's outline-preservation
 * pass can only repaint dark pixels the source image actually contains (the
 * model drew none). The quality gate merely ADDS a warning and returns the blob.
 *
 * This module makes features DETERMINISTIC for NEW small-grid generations
 * (≤ 60 cells, the isSmallGrid outlinePreserve path): after conversion
 * (outline pass + recenterContent + shape mask), when the dark-cell check fails
 * (darkCells × 100 / filled < 2%), it rescues the subject:
 *   1. DARK OUTLINE (safe for ANY subject) — walk the subject silhouette's
 *      border cells and repaint them to the darkest DMC
 *      (closestDmcColor(64,64,64) → DMC 3799, same machinery the converter's
 *      outline pass uses); the DMC counts delta + symbol reassignment mirror
 *      that pass exactly.
 *   2. EYES + NOSE (ONLY for animal/face-like prompts — NEVER for
 *      snowflake/heart/flower/stocking-generic) — content bbox → head region =
 *      top ~37.5% of subject rows; two dark cells symmetric around the bbox
 *      centerX (~40% of head width apart) at a row ~60% down the head; one dark
 *      nose cell at centerX just below the eyes. Skipped when the head region is
 *      too narrow (< 6 cells in either dimension) — a flat shape that can't
 *      plausibly hold a face must not be distorted.
 *
 * Pure and side-effect free: the input grid / dmcColors are never mutated;
 * an already-detailed grid (dark ≥ 2% of fill) returns the SAME references
 * (byte-identical no-op). Fixes apply to NEW generations only — saved patterns
 * keep their baked grids.
 */
import type { StitchCell, StitchGrid, DmcUsage } from "./types";
import { CROSS_STITCH_SYMBOLS } from "./types";
import { closestDmcColor, rgbToHex } from "./dmcColors";
import { isBackgroundCell } from "./recenterGrid";

/** Same "dark" definition as the converter's outline pass and qualityGate:
 *  a cell whose brightest channel is below 110 (out of 255). */
export const DARK_RGB_MAX = 110;

/** Guard triggers when dark cells are under 2% of the filled subject. */
export const GUARD_DARK_PCT = 2;

/** Small-grid threshold — the guard only applies to grids where the flat
 *  cartoon path is active (≤ 60 cells, matches isSmallGrid/outlinePreserve). */
export const SMALL_GRID_MAX_DIM = 60;

/** ANIMAL/FACE keyword gate for eyes+nose synthesis. Animals with faces get
 *  eyes+nose on a featureless rescue; everything else (snowflake, heart,
 *  flower, stocking/pillow scenes) gets ONLY the dark outline (or nothing when
 *  already ≥ 2% dark). Word boundaries prevent "beard" matching "bear". */
export const ANIMAL_FACE_KEYWORDS_REGEX =
  /\b(teddy|bear|cat|dog|bunny|rabbit|fox|owl|pig|mouse|kitten|puppy|deer|face|animal|hippo|cow|sheep|chick|duck|penguin|monkey|lion|tiger|elephant|koala|panda|frog|bird|horse|snowman)\b/;

/** True when the prompt (lowercased) describes an animal/face subject that
 *  should get synthesized eyes+nose on a featureless small grid. */
export function isAnimalFacePrompt(prompt: string): boolean {
  return ANIMAL_FACE_KEYWORDS_REGEX.test((prompt || "").toLowerCase());
}

/** Count cells whose brightest channel is below DARK_RGB_MAX (110). Shared by
 *  qualityGate and the guard so the two can never disagree about what "dark"
 *  means. */
export function countDarkCells(grid: StitchGrid): number {
  let dark = 0;
  for (const row of grid) {
    for (const cell of row) {
      const h = (cell?.color || "").replace("#", "");
      if (h.length !== 6) continue;
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      if (Math.max(r, g, b) < DARK_RGB_MAX) dark++;
    }
  }
  return dark;
}

/** Subject content bounding box in grid coordinates (inclusive bounds), or
 *  null when the grid has no non-background cells. */
function contentBox(grid: StitchGrid): { top: number; bottom: number; left: number; right: number } | null {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  let top = height, bottom = -1, left = width, right = -1;
  for (let r = 0; r < height; r++) {
    const row = grid[r];
    for (let c = 0; c < width; c++) {
      if (isBackgroundCell(row?.[c])) continue;
      if (r < top) top = r;
      if (r > bottom) bottom = r;
      if (c < left) left = c;
      if (c > right) right = c;
    }
  }
  return bottom < top ? null : { top, bottom, left, right };
}

/** True when the cell at (r,c) lies on the subject silhouette: a non-background
 *  cell with at least one 4-connected background neighbor (or grid edge). */
function isBorderCell(grid: StitchGrid, r: number, c: number): boolean {
  if (isBackgroundCell(grid[r]?.[c])) return false;
  const dirs: Array<readonly [number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= grid.length || nc < 0 || nc >= (grid[0]?.length ?? 0)) return true;
    if (isBackgroundCell(grid[nr]?.[nc])) return true;
  }
  return false;
}

/**
 * Deterministic face-feature rescue for small AI grids.
 *
 * @param grid - Final converted grid (AFTER recenter + shape mask — eyes land
 *   inside the silhouette because they are only painted onto non-background
 *   subject cells within the content bbox).
 * @param dmcColors - The pattern's DMC palette (never mutated; a new array is
 *   returned when repainting occurs so counts stay exact and the dark entry
 *   exists).
 * @param prompt - The user's original prompt (lowercased internally).
 * @returns { grid, dmcColors } — the rescued grid + consistent palette, or
 *   the SAME references when nothing needed to change (no-op).
 */
export function applyFaceFeatureGuard(
  grid: StitchGrid,
  dmcColors: DmcUsage[],
  prompt: string,
): { grid: StitchGrid; dmcColors: DmcUsage[] } {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (height === 0 || width === 0) return { grid, dmcColors };
  // Small-grid only — larger canvases keep full detail already.
  if (Math.min(height, width) > SMALL_GRID_MAX_DIM) return { grid, dmcColors };

  // Dark-ratio check: rescue only a genuinely featureless design.
  let filled = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell && !isBackgroundCell(cell)) filled++;
    }
  }
  if (filled === 0) return { grid, dmcColors };
  const darkCells = countDarkCells(grid);
  if ((darkCells * 100) / filled >= GUARD_DARK_PCT) return { grid, dmcColors }; // already detailed

  // 1. Silhouette border cells → dark outline (safe for any subject).
  const border: Array<[number, number]> = [];
  for (let r = 0; r < height; r++) {
    const row = grid[r];
    for (let c = 0; c < width && c < (row?.length ?? 0); c++) {
      if (isBorderCell(grid, r, c)) border.push([r, c]);
    }
  }

  // 2. Eyes + nose — ONLY for animal/face prompts and only when the head
  //    region is wide AND tall enough to plausibly hold a face.
  const eyeNosepaint: Array<[number, number]> = [];
  if (isAnimalFacePrompt(prompt)) {
    const box = contentBox(grid);
    if (box) {
      const headHeight = Math.max(1, Math.round(0.375 * (box.bottom - box.top + 1)));
      const headWidth = box.right - box.left + 1;
      if (headWidth >= 6 && headHeight >= 6) {
        const headTop = box.top;
        const eyeRow = Math.min(headTop + headHeight - 1, headTop + Math.round(0.6 * headHeight));
        const eyeSep = Math.max(2, Math.round(0.4 * headWidth));
        const centerX = (box.left + box.right) / 2;
        const leftEyeCol = Math.round(centerX - eyeSep / 2);
        const rightEyeCol = Math.round(centerX + eyeSep / 2);
        const noseRow = Math.min(box.bottom, eyeRow + Math.max(1, Math.round(0.2 * headHeight)));
        const noseCol = Math.round(centerX);
        for (const [er, ec] of [[eyeRow, leftEyeCol], [eyeRow, rightEyeCol], [noseRow, noseCol]] as Array<readonly [number, number]>) {
          if (er >= 0 && er < height && ec >= 0 && ec < (grid[er]?.length ?? 0)) {
            // Paint only onto subject cells — never float dark on background.
            if (!isBackgroundCell(grid[er]?.[ec])) eyeNosepaint.push([er, ec]);
          }
        }
      }
    }
  }

  const targets = border.concat(eyeNosepaint);
  if (targets.length === 0) return { grid, dmcColors };

  // Clone the grid (never mutate the input) so repainting can't leak back.
  const out: StitchGrid = grid.map((row) => row.map((cell) => ({ ...cell }) as StitchCell));

  // Repaint with the same darkest-DMC machinery the converter's outline pass
  // uses (closestDmcColor(64,64,64) → DMC 3799 Pewter Gray Very Dark).
  const dark = closestDmcColor(64, 64, 64);
  const darkCode = dark.code;
  const darkHex = rgbToHex(dark.rgb[0], dark.rgb[1], dark.rgb[2]);
  const darkName = dark.name;
  const codeByHex = new Map<string, string>();
  for (const d of dmcColors) codeByHex.set(d.hex.toLowerCase(), d.code);
  const delta = new Map<string, number>();
  delta.set(darkCode, 0);
  let repainted = 0;
  for (const [r, c] of targets) {
    const cell = out[r][c];
    const oldHex = (cell.color || "").toLowerCase();
    if (oldHex === darkHex.toLowerCase()) continue;
    const oldCode = codeByHex.get(oldHex) ?? cell.dmcCode;
    if (oldCode) delta.set(oldCode, (delta.get(oldCode) ?? 0) - 1);
    delta.set(darkCode, (delta.get(darkCode) ?? 0) + 1);
    cell.color = darkHex;
    cell.dmcCode = darkCode;
    cell.dmcName = darkName;
    repainted++;
  }
  if (repainted === 0) return { grid, dmcColors };

  // Rebuild the palette: adjust counts by the delta, ensure the dark entry
  // exists, re-sort by usage and reassign symbols (same as the outline pass).
  const next = dmcColors.map((d) => ({ ...d }));
  for (const d of next) {
    const dl = delta.get(d.code);
    if (dl && dl !== 0) d.count = Math.max(0, d.count + dl);
  }
  if (!next.some((d) => d.code === darkCode)) {
    next.push({
      code: darkCode,
      name: darkName,
      hex: darkHex,
      count: Math.max(0, delta.get(darkCode) ?? 0),
    });
  }
  next.sort((a, b) => b.count - a.count);
  next.forEach((d, i) => {
    d.symbol = CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length];
  });
  return { grid: out, dmcColors: next };
}