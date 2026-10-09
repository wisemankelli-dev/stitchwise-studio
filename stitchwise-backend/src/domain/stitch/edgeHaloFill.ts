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
 * DETERMINISTIC RULE (one pass over the ORIGINAL grid — never cascades, never
 * mutates the input, idempotent):
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
import { buildProductSilhouette, type ProductMaskShape } from "./productShapeMask";

const WHITE_HEX = "#ffffff";

/** Band depth gate — the observed 6-8-cell halo, rounded up. */
export const EDGE_HALO_MAX_DEPTH = 8;
/** Inward white run at/above this = a THICK white region → keep. */
export const EDGE_HALO_THICK_RUN = 9;
/** Cells within this Chebyshev radius supply the "cupping" interior color. */
const CUP_RADIUS = 4;

function isWhite(cell: StitchCell | undefined): boolean {
  return !!cell && cell.color !== "" && cell.color.toLowerCase() === WHITE_HEX;
}

function isStitchedNonWhite(cell: StitchCell | undefined): boolean {
  return !!cell && cell.color !== "" && cell.color.toLowerCase() !== WHITE_HEX;
}

/**
 * Chebyshev (8-direction) distance from every cell to the nearest cell that is
 * NOT inside the silhouette (the mask boundary = the unstitched canvas). Cells
 * outside the silhouette read depth 0; mask-inside cells get 1..N.
 */
function chebyshevDepth(
  grid: StitchGrid,
  silhouette: boolean[][],
): number[][] {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const depth: number[][] = Array.from({ length: height }, () => Array(width).fill(Infinity));
  const queue: Array<[number, number]> = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!silhouette[r]?.[c]) {
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

/** Public depth helper — reused by tests to compute ring metrics. */
export function edgeHaloDepth(grid: StitchGrid, silhouette: boolean[][]): number[][] {
  return chebyshevDepth(grid, silhouette);
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
export function edgeHaloFill(
  grid: StitchGrid,
  shape: ProductMaskShape,
  targetW: number,
  targetH: number,
): StitchGrid {
  if (shape !== "stocking") return grid;
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (height === 0 || width === 0) return grid;
  const silhouette = buildProductSilhouette(shape, targetW || width, targetH || height);
  const depth = chebyshevDepth(grid, silhouette);

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
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const d = depth[r]?.[c] ?? 0;
      if (!isWhite(grid[r]?.[c])) continue;
      if (d < 1 || d > EDGE_HALO_MAX_DEPTH) continue;
      if (inwardWhiteRun(r, c, depth, grid) >= EDGE_HALO_THICK_RUN) continue;
      const cup = cuppingColor(r, c, CUP_RADIUS, grid);
      if (!cup) continue;
      out[r][c] = recover(cup);
    }
  }
  return out;
}