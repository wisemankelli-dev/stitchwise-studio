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
 * Owner-conclusive (09-21, 4th report): Kelli regenerated bag charm 4 after the
 * 09-15 build and STILL got no readable eyes. The saved grid ("bagcharm
 * update", 28×28, went through Gemini) had 10.8% dark cells (#584436 brown
 * body/clothing at rows 13–19) — but the dark marks are a faint dot pair at row
 * 13 and a 10-wide bar at row 16, NOT a symmetric eye-pair + nose in the upper
 * head. The old trigger used the GLOBAL dark-%-of-fill ratio (< 2% = fire) as a
 * proxy for "featureless", so 10.8% dark made it look "already detailed" and
 * the guard skipped — even though no real face existed.
 *
 * This module makes features DETERMINISTIC for NEW small-grid generations
 * (≤ 60 cells, the isSmallGrid outlinePreserve path) by checking the face
 * itself rather than a color-ratio proxy:
 *   • ANIMAL/FACE prompts: fire (dark outline + symmetric eyes + nose)
 *     whenever a genuine symmetric dark eye-pair + nose is ABSENT from the
 *     upper/head portion of the silhouette — regardless of the global dark-%
 *     (a brown body or clothing must not be mistaken for a face).
 *   • Non-animal prompts (snowflake/heart/flower/stocking scenes) have no face
 *     to preserve, so the featureless-blob threshold still applies (outline
 *     only when dark < 2% — the original 09-15 behavior).
 *
 * The rescue itself (pure, side-effect free):
 *   1. DARK OUTLINE (safe for ANY subject) — walk the subject silhouette's
 *      border cells and repaint them to the darkest DMC
 *      (closestDmcColor(64,64,64) → DMC 3799, same machinery the converter's
 *      outline pass uses); the DMC counts delta + symbol reassignment mirror
 *      that pass exactly.
 *   2. EYES + NOSE (only for animal/face-like prompts) — content bbox → head
 *      region = top ~37.5% of subject rows; two dark cells symmetric around the
 *      bbox centerX (~40% of head width apart) at a row ~60% down the head; one
 *      dark nose cell at centerX just below the eyes. Skipped when the head
 *      region is too narrow (< 6 cells in either dimension) — a flat shape that
 *      can't plausibly hold a face must not be distorted.
 *
 * The input grid / dmcColors are never mutated; a grid that already carries a
 * genuine symmetric eye-pair + nose (or a ≥ 2% dark non-animal design) returns
 * the SAME references (byte-identical no-op). Fixes apply to NEW generations
 * only — saved patterns keep their baked grids.
 */
import type { StitchCell, StitchGrid, DmcUsage } from "./types";
import { CROSS_STITCH_SYMBOLS } from "./types";
import { closestDmcColor, rgbToHex } from "./dmcColors";
import { isBackgroundCell } from "./recenterGrid";

/** Same "dark" definition as the converter's outline pass and qualityGate:
 *  a cell whose brightest channel is below 110 (out of 255). */
export const DARK_RGB_MAX = 110;

/** Featureless-blob threshold (NON-animal prompts only): when dark cells are
 *  ≥ 2% of the filled subject, the subject has details worth keeping. */
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
      if (isDarkCell(cell)) dark++;
    }
  }
  return dark;
}

function isDarkCell(cell: StitchCell | undefined): boolean {
  const h = (cell?.color || "").replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return Math.max(r, g, b) < DARK_RGB_MAX;
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

// ─── Face-presence detection (owner 09-21: 4th report) ──────────────────────
//
// The old trigger used GLOBAL dark-% as a proxy for "featureless". That
// misfires both ways: a brown/blue/green body with 10.8% dark cells but NO face
// was treated as "already detailed", while a light-eyed face could look
// "featureless". The real question for an animal prompt is: is there a genuine
// symmetric dark eye-pair + nose in the upper/head portion of the silhouette?
// These geometry constants bound the detector (all fractions are of the subject
// bounding box; sizes scale with the grid so 28×28 and 50×50 behave the same).

/** Eye search zone = top 55% of the subject rows (eyes live high on the head). */
const EYE_ZONE_TOP_FRACTION = 0.55;
/** Eye candidates must sit near the same row (± 2 cells). */
const EYE_MAX_ROW_DELTA = 2;
/** Minimum horizontal separation between the two eyes (distinct dots). */
const EYE_MIN_SEPARATION = 3;
/** Maximum eye-pair separation (of subject width) — eyes are not at the ears. */
const EYE_MAX_SEPARATION_FRACTION = 0.7;
/** Symmetry tolerance: the pair midpoint may drift this far from centerX. */
const EYE_SYMMETRY_TOLERANCE_FRACTION = 0.15;
/** Max eye-marker size (of subject width/height) — eyes are small dots. */
const EYE_MAX_WIDTH_FRACTION = 0.15;
const EYE_MAX_HEIGHT_FRACTION = 0.1;
/** Nose search zone: immediately below the eyes, up to this deep (subject H). */
const NOSE_ZONE_HEIGHT_FRACTION = 0.3;
/** Nose must sit within this band around centerX (of subject width). */
const NOSE_CENTER_BAND_FRACTION = 0.15;
/** Max nose-marker size (of subject width/height). */
const NOSE_MAX_WIDTH_FRACTION = 0.2;
const NOSE_MAX_HEIGHT_FRACTION = 0.12;
/** Any single dark component bigger than this can't be an eye or nose. */
const FEATURE_MAX_CELLS = 6;

interface DarkComponent {
  cells: Array<readonly [number, number]>;
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
  rowCenter: number;
  colCenter: number;
}

/** 4-connected components of dark cells (whole grid, but only non-background
 *  dark cells are seeds so background never bridges two dots). */
function darkComponents(grid: StitchGrid, box: { top: number; bottom: number; left: number; right: number }): DarkComponent[] {
  const seen = new Set<string>();
  const out: DarkComponent[] = [];
  for (let r = box.top; r <= box.bottom; r++) {
    for (let c = box.left; c <= box.right; c++) {
      if (!isDarkCell(grid[r]?.[c])) continue;
      const key0 = `${r},${c}`;
      if (seen.has(key0)) continue;
      const stack: Array<[number, number]> = [[r, c]];
      seen.add(key0);
      const cells: Array<readonly [number, number]> = [];
      while (stack.length) {
        const [cr, cc] = stack.pop()!;
        cells.push([cr, cc]);
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const nr = cr + dr, nc = cc + dc;
          if (nr < box.top || nr > box.bottom || nc < box.left || nc > box.right) continue;
          if (!isDarkCell(grid[nr]?.[nc])) continue;
          const k = `${nr},${nc}`;
          if (!seen.has(k)) {
            seen.add(k);
            stack.push([nr, nc]);
          }
        }
      }
      let minRow = Infinity, maxRow = -1, minCol = Infinity, maxCol = -1, sumR = 0, sumC = 0;
      for (const [cr, cc] of cells) {
        if (cr < minRow) minRow = cr;
        if (cr > maxRow) maxRow = cr;
        if (cc < minCol) minCol = cc;
        if (cc > maxCol) maxCol = cc;
        sumR += cr;
        sumC += cc;
      }
      out.push({
        cells,
        minRow, maxRow, minCol, maxCol,
        rowCenter: sumR / cells.length,
        colCenter: sumC / cells.length,
      });
    }
  }
  return out;
}

/**
 * True when the grid already carries a GENUINE symmetric dark eye-pair + nose
 * in the upper/head portion of the subject silhouette. This is the trigger
 * that replaces the global dark-% proxy for animal/face prompts: a bear with a
 * brown body and clothing (10.8% dark, but no face) returns FALSE and the guard
 * fires; a face with real symmetric eyes and a nose returns TRUE (no-op).
 *
 * Pure — reads the grid only, never mutates anything.
 */
export function hasGenuineFaceFeatures(grid: StitchGrid): boolean {
  const box = contentBox(grid);
  if (!box) return false;
  const subjectH = box.bottom - box.top + 1;
  const subjectW = box.right - box.left + 1;
  // A subject too small to hold a 2-dot eye pair + nose can't have one.
  if (subjectH < 6 || subjectW < 6) return false;
  const centerX = (box.left + box.right) / 2;
  const eyeZoneBottom = box.top + Math.round(EYE_ZONE_TOP_FRACTION * subjectH);
  const components = darkComponents(grid, box);
  if (components.length < 3) return false; // need ≥ 2 eyes + 1 nose

  const eyeMaxW = Math.max(3, Math.round(EYE_MAX_WIDTH_FRACTION * subjectW));
  const eyeMaxH = Math.max(2, Math.round(EYE_MAX_HEIGHT_FRACTION * subjectH));

  // 1. Eye candidates: small dark dots in the upper zone.
  const eyeCandidates = components.filter((c) => {
    if (c.rowCenter > eyeZoneBottom) return false;
    if (c.maxCol - c.minCol + 1 > eyeMaxW) return false;
    if (c.maxRow - c.minRow + 1 > eyeMaxH) return false;
    if (c.cells.length > FEATURE_MAX_CELLS) return false;
    return true;
  });

  // 2. Symmetric eye pair around the head centerX, at the same height.
  const eyePairs: Array<[DarkComponent, DarkComponent]> = [];
  const maxSeparation = Math.round(EYE_MAX_SEPARATION_FRACTION * subjectW);
  const symmetryTol = Math.max(2, Math.round(EYE_SYMMETRY_TOLERANCE_FRACTION * subjectW));
  for (let i = 0; i < eyeCandidates.length; i++) {
    for (let j = i + 1; j < eyeCandidates.length; j++) {
      const a = eyeCandidates[i], b = eyeCandidates[j];
      const left = a.colCenter <= b.colCenter ? a : b;
      const right = a.colCenter <= b.colCenter ? b : a;
      if (left.colCenter >= centerX || right.colCenter <= centerX) continue; // one on each side
      if (Math.abs(left.rowCenter - right.rowCenter) > EYE_MAX_ROW_DELTA) continue;
      const separation = right.colCenter - left.colCenter;
      if (separation < EYE_MIN_SEPARATION || separation > maxSeparation) continue;
      if (Math.abs((left.colCenter + right.colCenter) / 2 - centerX) > symmetryTol) continue;
      eyePairs.push([left, right]);
    }
  }
  if (eyePairs.length === 0) return false;

  // 3. Nose: a small dark marker just below the eyes, near centerX.
  const noseMaxW = Math.max(3, Math.round(NOSE_MAX_WIDTH_FRACTION * subjectW));
  const noseMaxH = Math.max(2, Math.round(NOSE_MAX_HEIGHT_FRACTION * subjectH));
  const noseHalfW = Math.max(2, Math.round(NOSE_CENTER_BAND_FRACTION * subjectW)); // same scale for the zone
  for (const [left, right] of eyePairs) {
    const eyeBottom = Math.max(left.maxRow, right.maxRow);
    const noseZoneTop = eyeBottom + 1;
    const noseZoneBottom = Math.min(box.bottom, eyeBottom + Math.round(NOSE_ZONE_HEIGHT_FRACTION * subjectH));
    const noseZoneMinCol = Math.round(centerX - noseHalfW);
    const noseZoneMaxCol = Math.round(centerX + noseHalfW);
    for (const c of components) {
      if (c === left || c === right) continue;
      if (c.minRow < noseZoneTop) continue;
      if (c.maxCol - c.minCol + 1 > noseMaxW) continue;
      if (c.maxRow - c.minRow + 1 > noseMaxH) continue;
      if (c.cells.length > FEATURE_MAX_CELLS) continue;
      if (Math.abs(c.colCenter - centerX) > noseHalfW) continue;
      if (c.minCol > noseZoneMaxCol || c.maxCol < noseZoneMinCol) continue;
      if (c.minRow > noseZoneBottom) continue;
      // At least one cell inside the nose zone rectangle.
      if (!c.cells.some(([cr, cc]) => cr <= noseZoneBottom && cc >= noseZoneMinCol && cc <= noseZoneMaxCol)) continue;
      return true; // genuine eyes + nose present
    }
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

  let filled = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell && !isBackgroundCell(cell)) filled++;
    }
  }
  if (filled === 0) return { grid, dmcColors };

  if (isAnimalFacePrompt(prompt)) {
    // Trigger on ABSENCE of a genuine face, regardless of global dark-% —
    // a brown body / clothing must never masquerade as "already detailed".
    // (owner 09-21: bag charm had 10.8% dark but no readable face).
    if (hasGenuineFaceFeatures(grid)) return { grid, dmcColors };
  } else {
    // Non-animal subjects (snowflake/heart/flower/stocking scenes) have no
    // face to preserve: keep the featureless-blob dark-%-threshold (outline
    // only when the design is genuinely dark-free).
    const darkCells = countDarkCells(grid);
    if ((darkCells * 100) / filled >= GUARD_DARK_PCT) return { grid, dmcColors };
  }

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