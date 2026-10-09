/**
 * Deterministic bear-fur color rescue for small AI stitch grids.
 *
 * Owner-conclusive (10-09 17:40Z charm verdict #2 — "Teddy bag charm- No blue
 * sweater", id aba0bd27, 28×28): the #191 per-noun directive correctly scoped
 * "blue" to the sweater, but the directive's "use ONLY brown and tan tones"
 * was global — Gemini obeyed the global palette constraint and monochromed the
 * entire charm (0 blue pixels; bear STILL rust #bf5816, 182 of 784). The prior
 * save (f2a09e8e) had the reverse trade: blue sweater survived (#2e609d 43 +
 * #6c95c4 85) but the bear was orange #e27323 (142). The prompt alone cannot
 * hold this — the deterministic rescue below does:
 *
 *   (a) RUST→BROWN RESCUE: when the subject is a teddy bear (table match, no
 *       user-attached bear color — i.e. naturalColorDirectives fired) and the
 *       FINAL grid's dominant non-white family is rust/orange
 *       (#bf5816/#e27323/#f3932b — hexFamily "orange") with essentially no
 *       brown/tan present, recolor every orange-family cell to a canonical
 *       bear brown (closestDmcColor ~#5d3c2e, mirroring the face guard's
 *       darkest-DMC machinery), rebuild dmcColors counts + symbols. A grid
 *       that already reads brown/tan-dominant returns the same references.
 *       This is the deterministic fix for the ORIGINAL complaint ("Bear should
 *       have been brown and came out red") and the current rust regression.
 *
 *   (b) MISSING-NAMED-COLOR check: when the prompt names a color on ANOTHER
 *       noun ("blue sweater", "red scarf") and the final grid contains ZERO
 *       cells of that hue family, the route re-rolls once with a hardened
 *       prompt (this module exposes the family-presence check + the hardened
 *       clause) instead of silently saving a sweater-less charm; last resort
 *       the route emits a conversionWarning naming the missing color.
 *
 * Deliberately small-grid (≤ 60, same as applyFaceFeatureGuard): the charm path
 * is where the owner keeps hitting model variance; larger canvases keep their
 * painterly freedom. The input grid / dmcColors are never mutated; grids that
 * don't need the rescue return the SAME references (byte-identical no-op).
 */
import type { StitchCell, StitchGrid, DmcUsage } from "./types";
import { CROSS_STITCH_SYMBOLS } from "./types";
import { closestDmcColor, rgbToHex } from "./dmcColors";
import { hexFamily, type ColorFamily } from "./paletteViolationGuard";
import { naturalColorDirectives, otherNounColorPairs, COLOR_HUE_HINT, type OtherNounColor } from "./naturalColorDirective";
import { isBackgroundCell } from "./recenterGrid";
/** Small-grid threshold — same as the face guard / isSmallGrid. */
export const SMALL_GRID_MAX_DIM = 60;
/** Canonical teddy-bear brown (DMC ~801, #5d3c2e-ish) for the rust rescue. */
export const CANONICAL_BEAR_BROWN_RGB: readonly [number, number, number] = [93, 60, 46];
/** Hue families the rescue treats as rust/orange (the #bf5816/#e27323/#f3932b
 *  family — hexFamily "orange"). */
const RUST_FAMILIES: ReadonlySet<ColorFamily> = new Set(["orange"]);
/** Hue families that count as a legit bear brown/tan palette. */
const BROWN_TAN_FAMILIES: ReadonlySet<ColorFamily> = new Set(["brown", "tan"]);

/** True when the prompt fires the teddy-bear natural-color directive (table
 *  match AND no user color attached to the bear noun — the user didn't pick a
 *  bear color, so the canonical brown owns the fur). */
export function teddyBearDirectiveFires(prompt: string): boolean {
  return naturalColorDirectives(prompt || "").some((m) => m.subject === "a teddy bear");
}

/** True when the grid prints a rust/orange-dominant bear with no brown/tan
 *  fallback — the exact failure the owner keeps saving (aba0bd27: orange 182,
 *  brown/tan 0; f2a09e8e: orange 142, brown/tan 6). Background cells (color "")
 *  never count. */
export function isRustDominantBear(grid: StitchGrid): boolean {
  let orange = 0;
  let brownTan = 0;
  let neutral = 0;
  let other = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (isBackgroundCell(cell)) continue;
      const fam = hexFamily(cell?.color ?? "");
      if (RUST_FAMILIES.has(fam)) orange++;
      else if (BROWN_TAN_FAMILIES.has(fam)) brownTan++;
      else if (fam === "gray" || fam === "black" || fam === "white") neutral++;
      else other++;
    }
  }
  if (orange <= 8) return false; // a speckle of orange is not a rust bear
  return orange > brownTan * 2 && orange >= neutral + other;
}

/** True when the charm needs the deterministic rust→brown recolor. */
export function needsBearColorRescue(grid: StitchGrid, prompt: string): boolean {
  return teddyBearDirectiveFires(prompt) && isRustDominantBear(grid);
}

/** Deterministic rust→brown recolor for a rust-dominant teddy bear on the
 *  small-grid charm path. Pure: returns a NEW grid + rebuilt palette, or the
 *  SAME references when the rescue doesn't apply (byte-identical no-op). */
export function applyBearColorRescue(
  grid: StitchGrid,
  dmcColors: DmcUsage[],
  prompt: string,
): { grid: StitchGrid; dmcColors: DmcUsage[] } {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (height === 0 || width === 0) return { grid, dmcColors };
  if (Math.min(height, width) > SMALL_GRID_MAX_DIM) return { grid, dmcColors };
  if (!needsBearColorRescue(grid, prompt)) return { grid, dmcColors };
  const brown = closestDmcColor(CANONICAL_BEAR_BROWN_RGB[0], CANONICAL_BEAR_BROWN_RGB[1], CANONICAL_BEAR_BROWN_RGB[2]);
  const brownCode = brown.code;
  const brownHex = rgbToHex(brown.rgb[0], brown.rgb[1], brown.rgb[2]);
  const brownName = brown.name;
  const codeByHex = new Map<string, string>();
  for (const d of dmcColors) codeByHex.set(d.hex.toLowerCase(), d.code);
  const out: StitchGrid = grid.map((row) => row.map((cell) => ({ ...cell }) as StitchCell));
  const delta = new Map<string, number>();
  delta.set(brownCode, 0);
  let repainted = 0;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = out[r][c];
      if (isBackgroundCell(cell)) continue;
      const fam = hexFamily(cell?.color ?? "");
      if (!RUST_FAMILIES.has(fam)) continue;
      const oldHex = (cell.color || "").toLowerCase();
      if (oldHex === brownHex.toLowerCase()) continue;
      const oldCode = codeByHex.get(oldHex) ?? cell.dmcCode;
      if (oldCode) delta.set(oldCode, (delta.get(oldCode) ?? 0) - 1);
      delta.set(brownCode, (delta.get(brownCode) ?? 0) + 1);
      cell.color = brownHex;
      cell.dmcCode = brownCode;
      cell.dmcName = brownName;
      repainted++;
    }
  }
  if (repainted === 0) return { grid, dmcColors };
  const next = dmcColors.map((d) => ({ ...d }));
  for (const d of next) {
    const dl = delta.get(d.code);
    if (dl && dl !== 0) d.count = Math.max(0, d.count + dl);
  }
  if (!next.some((d) => d.code === brownCode)) {
    next.push({ code: brownCode, name: brownName, hex: brownHex, count: Math.max(0, delta.get(brownCode) ?? 0) });
  }
  next.sort((a, b) => b.count - a.count);
  next.forEach((d, i) => {
    d.symbol = CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length];
  });
  return { grid: out, dmcColors: next };
}

/** Prompt color word → hue family (mirrors hexFamily's taxonomy for the
 *  named-color presence check). */
function familyOfNamedColor(color: string): ColorFamily | null {
  const c = (color || "").toLowerCase();
  const map: Record<string, ColorFamily> = {
    blue: "blue", navy: "blue", sky: "blue", azure: "blue", turquoise: "teal",
    red: "red", crimson: "red", scarlet: "red", magenta: "pink", pink: "pink",
    orange: "orange", yellow: "yellow", gold: "yellow", green: "green", teal: "teal",
    olive: "green", emerald: "green", purple: "purple", violet: "purple", lavender: "purple",
    brown: "brown", tan: "tan", beige: "tan", khaki: "tan", white: "white",
    cream: "white", ivory: "white", black: "black", gray: "gray", grey: "gray", charcoal: "black",
  };
  return map[c] ?? null;
}

/** Count non-background cells in a given hue family (sweater-blue presence). */
export function countColorFamily(grid: StitchGrid, family: ColorFamily): number {
  let n = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (isBackgroundCell(cell)) continue;
      if (hexFamily(cell?.color ?? "") === family) n++;
    }
  }
  return n;
}

/** First prompt-named NON-subject color pair whose hue family is ABSENT from
 *  the final grid ("blue sweater" + zero blue cells → {blue, sweater}). This
 *  is the re-roll trigger — never save a sweater-less charm. */
export function missingNamedOtherColor(grid: StitchGrid, prompt: string): OtherNounColor | null {
  const pairs = otherNounColorPairs(prompt || "");
  for (const p of pairs) {
    const fam = familyOfNamedColor(p.color);
    if (!fam) continue;
    if (countColorFamily(grid, fam) === 0) return p;
  }
  return null;
}

/** Hardened prompt clause for a missing named color — the re-roll uses this so
 *  Gemini knows the sweater is a REAL blue area, not the bear's fur. */
export function hardenedColorClause(missing: OtherNounColor): string {
  const hint = COLOR_HUE_HINT[missing.color] ?? missing.color;
  return `VERY IMPORTANT: the ${missing.color} ${missing.noun} MUST be ${missing.color} — paint it ${hint}/${missing.color}; the ${missing.noun} is a separate ${missing.color} element, not fur or background`;
}