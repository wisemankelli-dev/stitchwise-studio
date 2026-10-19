/**
 * Edge-halo fill for product-shape silhouettes (owner 10-09 retest #4).
 *
 * Owner verdict: "Blue snowflake stocking 2" (154×238) — "stocking is better,
 * It did leave an odd white lip edge around the entire stocking edge. Masking
 * may still be off for filling to edge." Evidence: /home/team/shared/lip-facts.txt
 *
 * ROOT CAUSE: the AI image renders the blue stocking body with a soft WHITE
 * transition band at its silhouette edges (white-background bleed /
 * anti-aliasing). Downsampling + quantization maps that band to `#ffffff`,
 * and the band survives INSIDE the masked silhouette — so the stitched body is
 * blue only in the interior and reads a white lip all around the contour. The
 * mask itself is correct (outside the silhouette is cleared); the FILL simply
 * does not reach the mask edge. Quantified on her real grid (Chebyshev depth =
 * distance to the unstitched canvas): depth-1 ring = 601 white + 71 dark blue
 * (89% white), decaying 601→543→473→384→267→189→137 over depths 1–7 — a smooth
 * ~6-8-cell halo, NOT a 1-cell mask artifact.
 *
 * WHY NOT COMPONENT-BASED: the spec described "8-connected white components
 * that are thin" — but on her real grid the white lip, the legit white top
 * (cap) and the legit white toe are ALL one 8-connected (and 4-connected)
 * mass: the lip ring circles the entire blue body and is fused to the cap and
 * toe. Component thickness cannot separate them, so this pass works PER-CELL.
 *
 * DEPTH BASIS — the grid's OWN EMPTIED cells, not a rebuilt silhouette:
 *   The grid this pass receives is the OUTPUT of applyProductShapeMask, so its
 *   empty (`color: ""`) cells ARE the true silhouette boundary. Rebuilding the
 *   guide silhouette and measuring from ITS empties was WRONG for the owner's
 *   saved grid — applyProductShapeMask + recenterGrid can shift/mask the
 *   content slightly, and measuring from a rebuild put 2000+ real stitched
 *   cells OUTSIDE the measured shape, so the fill's rings never touched the
 *   actual rim (owner 10-09 17:38Z save "Blue stock white snowflake- 3": her
 *   analyze script measures ring-1 = 84.9% white from the SAVED grid's empties,
 *   while the rebuild-based pass saw 0% — two different grids). Depth is now
 *   seeded from `!cell.color` exactly as her acceptance script measures it.
 *
 * DETERMINISTIC RULE (one pass over the ORIGINAL grid — never cascades, never
 *   mutates the input, idempotent):
 *   For each white (`#ffffff`) stitched cell at Chebyshev depth d in [1..8]
 *   (the observed 6-8-cell band width):
 *   - inward white run := longest walk along a straight 8-direction ray,
 *     staying on white cells while the depth is non-decreasing with at most
 *     2 consecutive flat (plateau) steps — i.e. how far white CONTINUES
 *     toward the interior. A thick legit white region (cap/toe/white-body)
 *     scores >= EDGE_HALO_THICK_RUN (9); the thin transition band scores
 *     less.
 *   - if run < EDGE_HALO_THICK_RUN (thin) AND a USED non-white color exists
 *     within CUP_RADIUS (4) — the cell is "cupped" by the interior body —
 *     recolor the cell to that modal non-white color. The body then reaches
 *     the mask edge.
 *
 * PRESERVED:
 *   - thick legit whites (cap/toe — in her grid the top white band rows 22–43
 *     and the toe tip: inward run >= 9) stay white;
 *   - 'white background' prompts have no non-white cup at all → untouched;
 *   - deep interior details (snowflake islands at depth >= 9) are outside the
 *     band gate → untouched;
 *   - near-edge white details at depth <= 8 that are cupped by the body are
 *     absorbed (they read as part of the lip frame anyway — documented
 *     trade-off of the 8-cell band gate).
 *
 * Gate: intended for shape === 'stocking' only, and NOT for <= 60-cell small
 * grids (their flat-sticker path already produces cut-out edges). The call
 * site enforces both; a defensive shape check lives here too.
 */
import type { StitchCell, StitchGrid } from "./types";
import type { ProductMaskShape } from "./productShapeMask";

const WHITE_HEX = "#ffffff";

/** Band depth gate — the observed 6-8-cell halo, rounded up. */
export const EDGE_HALO_MAX_DEPTH = 8;
/** Inward white run at/above this = a THICK white region → keep. */
export const EDGE_HALO_THICK_RUN = 9;
/** Cells within this Chebyshev radius supply the "cupping" interior color. */
const CUP_RADIUS = 4;
// ─── Wide-band mode (owner 10-09 17:30Z verdict: "Blue stock white snowflake-
//   3" — the retest-4 fix is INSUFFICIENT: that source's white transition band
//   is 12+ cells deep (ring1 72% white / ring8 48% / ring12 33%), so the
//   depth≤8 + run<9 + cup-radius-4 gates never fire. This mode widens the
//   gates for white-WASHED sources (detected via ring white fractions) while
//   the per-cell rules still protect legit thick whites and interior flakes).
/** Wide gate — the observed 12+ cell band, with margin. */
export const EDGE_HALO_WIDE_MAX_DEPTH = 14;
/** A white structure whose inward run reaches this depth = THICK legit white
 *  (cuff/toe columns reach depth ~14-25) → keep even in wide mode. The
 *  shallow lip band terminates at the blue body well before this. */
export const EDGE_HALO_WIDE_THICK_DEPTH = 12;
/** Wider cup for washed sources — the blue body sits further from the rim. */
export const EDGE_HALO_WIDE_CUP_RADIUS = 8;
/** A local white fraction (radius-4 window) below this = an ISOLATED interior
 *  detail island (snowflake) → keep; a band cell sits in a majority-white
 *  context → recolor. */
export const EDGE_HALO_DENSITY_RADIUS = 4;
export const EDGE_HALO_DENSITY_MIN = 0.5;
/** Wide mode fires when the stitched ring-3 (or ring-8) is majority white —
 *  a white-washed source (a thin 6-8-cell band is gone by ring 8). */
export const EDGE_HALO_WIDE_RING8_PCT = 0.4;
/** trimLegWhites mode (owner 10-09 17:30Z verdict): when the prompt-directed
 *  body color fires (stockingBodyDirective — the body is blue, cuff/toe white),
 *  the LEG rows must read body color edge-to-edge. White there at depth <= 14
 *  is wash (a 12+ cell transition band around a blue core), NOT legit thick
 *  white. ROW BAND: her real 238-tall grid's leg runs rows 70–195 (cuff ends
 *  ~55, toe starts ~187 — the guide's 0.87 fraction would EAT the toe, so the
 *  hi bound is 0.82 = row 195 exclusive). Isolated low-density white islands
 *  (snowflake detail ON the blue body) stay — the localWhiteDensity gate is
 *  the flake-vs-band discriminator. */
export const EDGE_HALO_TRIM_MAX_DEPTH = 14;
export const EDGE_HALO_TRIM_ROW_LO_FRAC = 0.27;
export const EDGE_HALO_TRIM_ROW_HI_FRAC = 0.82;
/** Depth beyond which cells define the shape's TRUE body color (the blue core
 *  in a washed source). Used as the fallback cup when the shallow band has no
 *  non-white within the wide cup radius (a fully-white 12-deep wash). */
export const EDGE_HALO_DEEP_REFERENCE_DEPTH = 16;

function isWhite(cell: StitchCell | undefined): boolean {
  return !!cell && cell.color !== "" && cell.color.toLowerCase() === WHITE_HEX;
}

function isStitchedNonWhite(cell: StitchCell | undefined): boolean {
  return !!cell && cell.color !== "" && cell.color.toLowerCase() !== WHITE_HEX;
}

/**
 * Chebyshev (8-direction) distance from every cell to the nearest cell that is
 * EMPTY (`color: ""`) in the grid — the true silhouette boundary of the
 * already-masked grid (applyProductShapeMask clears everything outside). Cells
 * outside read depth 0; mask-inside cells get 1..N. Measured against the
 * GRID'S OWN EMPTIES (her acceptance scripts' metric), not a rebuilt guide:
 * recenter + mask can shift the content, and the rebuild mismatch caused the
 * fill to see 0% white on the very grid her script measured 84.9%.
 */
function chebyshevDepth(grid: StitchGrid): number[][] {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const depth: number[][] = Array.from({ length: height }, () => Array(width).fill(Infinity));
  const queue: Array<[number, number]> = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = grid[r]?.[c];
      if (!cell || !cell.color || cell.color === "") {
        depth[r][c] = 0;
        queue.push([r, c]);
      }
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const [r, c] = queue[i];
    const d = depth[r][c];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
        if (depth[nr][nc] > d + 1) {
          depth[nr][nc] = d + 1;
          queue.push([nr, nc]);
        }
      }
    }
  }
  return depth;
}

/** Public depth helper — matches the grid-empties metric (acceptance scripts).
 *  Accepts an optional silhouette for backward compatibility with tests that
 *  pass the fixture mask; the depth itself is ALWAYS seeded from the grid's
 *  own empty cells (fixtures are built with empties == !mask, so both give
 *  identical ring geometry there). */
export function edgeHaloDepth(grid: StitchGrid, _silhouette?: boolean[][]): number[][] {
  return chebyshevDepth(grid);
}

const DIRECTIONS: Array<[number, number]> = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];
/** Max plateau (non-increasing) steps allowed before the walk must resume climbing. */
const MAX_FLAT_STEPS = 2;
/** Hard cap so a giant white body cannot walk forever. */
const MAX_RUN_STEPS = 32;

/**
 * How many white cells white continues INWARD (non-decreasing depth, <=2 flat
 * steps, stops on any non-white or canvas cell).
 */
function inwardWhiteRun(
  r0: number,
  c0: number,
  depth: number[][],
  grid: StitchGrid,
): number {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const d0 = depth[r0][c0];
  let best = 0;
  for (const [dr, dc] of DIRECTIONS) {
    let r = r0 + dr;
    let c = c0 + dc;
    let steps = 0;
    let prev = d0;
    let flat = 0;
    while (r >= 0 && r < height && c >= 0 && c < width) {
      const nd = depth[r][c];
      if (nd < prev) break; // walking backward (away from the interior)
      if (nd === prev) {
        flat++;
        if (flat > MAX_FLAT_STEPS) break; // plateau too long
      } else {
        flat = 0;
      }
      if (!isWhite(grid[r]?.[c])) break; // hit the body or canvas
      steps++;
      prev = nd;
      if (steps >= MAX_RUN_STEPS) break;
      r += dr;
      c += dc;
    }
    if (steps > best) best = steps;
  }
  return best;
}

/**
 * Modal color of stitched non-white cells within `radius` (Chebyshev) of the
 * cell — the "cup" the band cell sits in. Returns the color string (lowercase
 * hex) or null when no non-white used color is nearby. Ties resolve to the
 * lexicographically smallest color for determinism.
 */
function cuppingColor(
  r0: number,
  c0: number,
  radius: number,
  grid: StitchGrid,
): string | null {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const counts = new Map<string, number>();
  for (let r = Math.max(0, r0 - radius); r <= Math.min(height - 1, r0 + radius); r++) {
    for (let c = Math.max(0, c0 - radius); c <= Math.min(width - 1, c0 + radius); c++) {
      if (r === r0 && c === c0) continue;
      const cell = grid[r]?.[c];
      if (isStitchedNonWhite(cell)) {
        const color = cell!.color.toLowerCase();
        counts.set(color, (counts.get(color) ?? 0) + 1);
      }
    }
  }
  if (counts.size === 0) return null;
  let best: string | null = null;
  let bestCount = 0;
  for (const [color, count] of counts) {
    if (count > bestCount || (count === bestCount && (best === null || color < best))) {
      best = color;
      bestCount = count;
    }
  }
  return best;
}

/**
 * White fraction of the stitched cells at exactly `ring` Chebyshev depth,
 * RESTRICTED to the LEG rows (default the middle 28%-85% of the height — the
 * owner's acceptance leg region rows 70-195 of 238 ≈ 29%-82%). Measuring the
 * WHOLE silhouette is wrong: the legit full-width white cap and toe make the
 * global ring fractions majority-white even on a thin-band source. Canvas
 * cells (depth 0) are excluded; a ring with no stitched cells reads 0.
 */
function whiteFractionAtRing(
  depth: number[][],
  grid: StitchGrid,
  ring: number,
  rowLo?: number,
  rowHi?: number,
): number {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const lo = rowLo ?? Math.floor(height * 0.28);
  const hi = rowHi ?? Math.floor(height * 0.85);
  let stitched = 0;
  let white = 0;
  for (let r = lo; r <= hi && r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (depth[r]?.[c] !== ring) continue;
      stitched++;
      if (isWhite(grid[r]?.[c])) white++;
    }
  }
  return stitched === 0 ? 0 : white / stitched;
}
/**
 * True when some inward white ray from (r0,c0) reaches a white cell whose
 * Chebyshev depth is STRICTLY GREATER than `target` (non-decreasing depth,
 * <=2 flat steps — same walk contract as inwardWhiteRun). A deep-reaching
 * white structure (cuff column, toe like, a genuine white-washed BODY) is
 * thick and must survive; a shallow lip band terminates at the blue body
 * before reaching the target.
 */
function inwardWhiteRunReaches(
  r0: number,
  c0: number,
  depth: number[][],
  grid: StitchGrid,
  target: number,
): boolean {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const d0 = depth[r0][c0];
  for (const [dr, dc] of DIRECTIONS) {
    let r = r0 + dr;
    let c = c0 + dc;
    let prev = d0;
    let flat = 0;
    while (r >= 0 && r < height && c >= 0 && c < width) {
      const nd = depth[r][c];
      if (nd < prev) break;
      if (nd === prev) {
        flat++;
        if (flat > MAX_FLAT_STEPS) break;
      } else {
        flat = 0;
      }
      if (!isWhite(grid[r]?.[c])) break;
      if (nd > target) return true;
      prev = nd;
      r += dr;
      c += dc;
    }
  }
  return false;
}
/**
 * White fraction within a Chebyshev `radius` window around (r0,c0). Band
 * cells sit in majority-white contexts; isolated interior detail islands
 * (snowflakes ON the blue body) sit in majority-non-white contexts.
 */
function localWhiteDensity(
  r0: number,
  c0: number,
  radius: number,
  grid: StitchGrid,
): number {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  let seen = 0;
  let white = 0;
  for (let r = Math.max(0, r0 - radius); r <= Math.min(height - 1, r0 + radius); r++) {
    for (let c = Math.max(0, c0 - radius); c <= Math.min(width - 1, c0 + radius); c++) {
      if (r === r0 && c === c0) continue;
      const cell = grid[r]?.[c];
      if (!cell || !cell.color || cell.color === "") continue;
      seen++;
      if (isWhite(cell)) white++;
    }
  }
  return seen === 0 ? 0 : white / seen;
}
/**
 * Enforce fill-to-edge on a product-shape silhouette by absorbing the white
 * transition band ("lip") that survives inside the mask.
 *
 * Pure: returns a NEW grid (rows re-sliced, recolored cells replaced). Never
 * mutates the input. Cells outside the silhouette are left exactly as given
 * (the mask pass owns them). Other shapes return the input reference unchanged.
 *
 * ONE PASS over the ORIGINAL grid only: every cell's run/cup is evaluated
 * against the INPUT, so no cell's decision depends on a sibling's recolor
 * (no cascading, fully deterministic, and input-independent of pass order).
 * A fixpoint (re-pass until stable) was measured and REJECTED: on the owner's
 * real 154×238 grid the second pass keeps firing on the cap/toe rims — their
 * inward run shortens the moment the adjacent band cells turn blue, eroding
 * the legit white cuff from 133→87→41 and the toe from 171→46→25. A single
 * pass preserves them (cap 133/134, toe 171/208) while clearing the leg ring
 * to 16/330 (4.85%) — exactly the acceptance the owner verified conceptually
 * in lip-facts.txt.
 */
/**
 * Modal color of NON-WHITE stitched cells at depth >= minDepth (the shape's
 * deep body). Null when the deep interior is empty or all white (a genuinely
 * white stocking — nothing to fill toward). Ties → lexicographic smallest.
 */
function deepInteriorModalNonWhite(
  depth: number[][],
  grid: StitchGrid,
  minDepth: number,
): string | null {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const counts = new Map<string, number>();
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if ((depth[r]?.[c] ?? 0) < minDepth) continue;
      if (!isStitchedNonWhite(grid[r]?.[c])) continue;
      const color = grid[r][c]!.color.toLowerCase();
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;
  let best: string | null = null;
  let bestCount = 0;
  for (const [color, count] of counts) {
    if (count > bestCount || (count === bestCount && (best === null || color < best))) {
      best = color;
      bestCount = count;
    }
  }
  return best;
}
export interface EdgeHaloFillOptions {
  /** Prompt-directed body color fired (stockingBodyDirective): trim washed white
   *  in the LEG rows (depth <= 14) down to the local interior color, keeping
   *  cuff/toe rows and isolated interior flakes. */
  trimLegWhites?: boolean;
}

/** Shape type this module applies to (stocking only — other shapes are
 *  returned unchanged by the caller contract; the defensive check keeps the
 *  literal union so the call site can pass the parsed request shape). */
type StockingLike = ProductMaskShape;

export function edgeHaloFill(
  grid: StitchGrid,
  shape: StockingLike,
  targetW: number,
  targetH: number,
  opts?: EdgeHaloFillOptions,
): StitchGrid {
  if (shape !== "stocking") return grid;
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (height === 0 || width === 0) return grid;
  const depth = chebyshevDepth(grid);

  // Index cells by color so a recolored cell can carry the same dmc info as
  // the palette entry it merges into (first occurrence wins).
  const cellByColor = new Map<string, StitchCell>();
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = grid[r]?.[c];
      if (cell && cell.color && cell.color !== "" && !cellByColor.has(cell.color.toLowerCase())) {
        cellByColor.set(cell.color.toLowerCase(), cell);
      }
    }
  }
  const recover = (color: string): StitchCell => {
    const proto = cellByColor.get(color);
    return proto ? { ...proto } : { color };
  };

  const out: StitchGrid = grid.map((row) => row.slice());
  const trimLegWhites = !!opts?.trimLegWhites && shape === "stocking";
  const trimRowLo = Math.floor(height * EDGE_HALO_TRIM_ROW_LO_FRAC);
  const trimRowHi = Math.floor(height * EDGE_HALO_TRIM_ROW_HI_FRAC);
  // Wide mode activates on WHITE-WASHED sources via the DEEP ring only: in
  // the LEG rows (cap/toe excluded) a thin 6-8-cell band is gone by ring 8
  // (owner retest-4 source ring8 26%), while a 12+ cell wash still reads
  // majority white at ring 8 (owner's new source ring8 48%). Ring 3 is
  // deliberately NOT used — both band types look white at ring 3.
  const wideMode = whiteFractionAtRing(depth, grid, 8) >= EDGE_HALO_WIDE_RING8_PCT;
  // trimLegWhites flood: find every white cell in the LEG band that is
  // 8-connected (through white) to the rim (a depth-1 white cell). Those are
  // wash; interior flakes (snowflakes ON the blue body, surrounded by blue)
  // are NOT reachable — the localWhiteDensity gate in the per-cell loop is the
  // second, independent flake-vs-band discriminator (a flake sits in a
  // majority-non-white radius-4 window even when a long white slab touches the
  // rim of the band).
  const trimFlood = new Set<string>();
  if (trimLegWhites) {
    const stack: Array<[number, number]> = [];
    for (let r = Math.max(0, trimRowLo); r < Math.min(height, trimRowHi); r++) {
      for (let c = 0; c < width; c++) {
        const d = depth[r]?.[c] ?? 0;
        if (d !== 1) continue;
        if (!isWhite(grid[r]?.[c])) continue;
        const key = `${r},${c}`;
        if (trimFlood.has(key)) continue;
        trimFlood.add(key);
        stack.push([r, c]);
      }
    }
    while (stack.length) {
      const [r, c] = stack.pop()!;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr < Math.max(0, trimRowLo) || nr >= Math.min(height, trimRowHi)) continue;
          if (nc < 0 || nc >= width) continue;
          const d = depth[nr]?.[nc] ?? 0;
          if (d < 1 || d > EDGE_HALO_TRIM_MAX_DEPTH) continue;
          if (!isWhite(grid[nr]?.[nc])) continue;
          const key = `${nr},${nc}`;
          if (trimFlood.has(key)) continue;
          trimFlood.add(key);
          stack.push([nr, nc]);
        }
      }
    }
  }
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const d = depth[r]?.[c] ?? 0;
      if (!isWhite(grid[r]?.[c])) continue;
      if (d < 1) continue;
      if (trimLegWhites) {
        // Trim CONTRACT (owner 10-09 17:38Z verdict): the ONLY wash is the LEG
        // band (rows [trimRowLo, trimRowHi), depth <= 14) — the legit white
        // cuff (rows ~22-55) and toe (rows ~187-215) are outside the band and
        // must NEVER be recolored, so in trim mode nothing outside the band is
        // touched (no legacy/wide fall-through that could eat them: the toe's
        // 4-dir depth-1 cells have short runs like the leg's, and the old
        // depth≤8+run<9 legacy branch would erase them).
        if (r < trimRowLo || r >= trimRowHi || d > EDGE_HALO_TRIM_MAX_DEPTH) continue;
        // Prompt says the BODY is colored (blue) with white cuff/toe: white in
        // the leg at depth <= 14 is the washed transition band. The FLOOD is
        // the flake-vs-band discriminator: any white cell 8-connected through
        // white to the rim (a depth-1 white cell) is WASH — recolor it to the
        // interior color. Interior flakes (snowflakes ON the blue body) are
        // surrounded by blue, so the flood never reaches them. No density gate
        // here: a NARROW leg's band cells sit in a mixed blue/white window
        // (her real 154×238 grid: ring-1 84.9% white, but only 130/219 pass a
        // >=0.5 local-white gate) — density cannot separate them, connectivity
        // can.
        if (!trimFlood.has(`${r},${c}`)) continue;
        const cup =
          cuppingColor(r, c, EDGE_HALO_WIDE_CUP_RADIUS, grid) ??
          deepInteriorModalNonWhite(depth, grid, EDGE_HALO_DEEP_REFERENCE_DEPTH);
        if (!cup) continue;
        out[r][c] = recover(cup);
        continue;
      }
      if (wideMode) {
        if (d > EDGE_HALO_WIDE_MAX_DEPTH) continue;
        // Keep thick legit whites: anything whose white structure reaches
        // deeper than the lip band (cuff columns, toe body, a genuinely
        // white-washed BODY) survives; the shallow lip terminates at blue.
        if (inwardWhiteRunReaches(r, c, depth, grid, EDGE_HALO_WIDE_THICK_DEPTH)) continue;
        // Keep ISOLATED interior detail islands (snowflakes ON the blue body)
        // — they sit in a majority-non-white neighborhood, band cells don't.
        if (localWhiteDensity(r, c, EDGE_HALO_DENSITY_RADIUS, grid) < EDGE_HALO_DENSITY_MIN) continue;
        const cup = cuppingColor(r, c, EDGE_HALO_WIDE_CUP_RADIUS, grid);
        if (!cup) continue;
        out[r][c] = recover(cup);
      } else {
        if (d > EDGE_HALO_MAX_DEPTH) continue;
        if (inwardWhiteRun(r, c, depth, grid) >= EDGE_HALO_THICK_RUN) continue;
        const cup = cuppingColor(r, c, CUP_RADIUS, grid);
        if (!cup) continue;
        out[r][c] = recover(cup);
      }
    }
  }
  return out;
}