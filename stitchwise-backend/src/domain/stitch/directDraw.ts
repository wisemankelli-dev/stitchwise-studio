/**
 * b134 DIRECT-DRAW (owner 10-26: "…we cannot after months get a basic bear
 * into a circle? Or a simple blue sock with basically stars on it will not
 * generate in a grid pattern…"; direction change 10-26 14:23/14:32/14:56).
 *
 * For the two simple product items the AI-photo→quantize→mask chain's output
 * ceiling is the rejection reason (proven by exact HTTP replay on the shipped
 * b133 bundle: the regenerate route returns her saved grids cell-for-cell —
 * charm 100.000%, stocking 99.924% with the only diffs being her own 28
 * erased cells). The fix is therefore NOT another patch of that chain:
 * small/simple subjects are drawn DIRECTLY in the grid from deterministic
 * geometry — no AI content in the decoration, identical output every run,
 * "recognizable at a glance with defined edges" BY CONSTRUCTION.
 *
 *   CHARM   (owner floor: 3in × 18ct = 54×54, generation minimum):
 *           procedural bear-face ornament — #113b69 ornament ring + crown
 *           loop, #5d3c2e bear head + ears (#8a6c54 inner ears), #3c3c3c
 *           symmetric eyes + nose + smile, #ffffff muzzle + inside-ring
 *           background, #254267 sweater band; outside the ornament = empty.
 *           Face features are geometric primitives, so the face can NEVER be
 *           a white slab and the eyes/nose are always present and symmetric.
 *   STOCKING (her size 238 rows × 154 cols @14ct):
 *           procedural stocking silhouette (cuff + toe cap #ffffff, body
 *           #2e609d, shade #6c95c4), FIVE six-point #113b69 snowflake stars
 *           at the specified centres (60,55) (98,62) (52,100) (96,102)
 *           (74,138), each with 8-cell arms + branch ticks + a 3×3 hub, plus
 *           a 1-cell #113b69 outline around the whole silhouette (defined
 *           edges); everything outside the silhouette = empty.
 *
 * The geometry is a faithful port of the lead's visual contract
 * /home/team/shared/b134-preview/make_preview.py (build_charm /
 * build_stocking) — same constants, same per-cell 4-subcell majority vote,
 * same Python round() semantics (half-to-EVEN) so the cells match the
 * preview grids. Pure + deterministic + palette-locked.
 */
import type { StitchCell, StitchGrid } from "./types";

// ─── python round(): half floats round to EVEN (Python 3 semantics) ────────
function pyRound(v: number): number {
  const f = Math.floor(v);
  const frac = v - f;
  if (frac < 0.5) return f;
  if (frac > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

const SUB = [
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
] as const;

function cell(color: string): StitchCell {
  if (!color) return { color: "" };
  return { color };
}

// ═══════════════════════════════ CHARM (bear ornament) ═════════════════════
const CHROWN = "#113b69"; // ornament ring + crown loop
const BROWN = "#5d3c2e"; // bear head
const INNER = "#8a6c54"; // inner ears
const WHITE = "#ffffff"; // muzzle + inside-ring background
const DARK = "#3c3c3c"; // eyes / nose / smile
const SWEATER = "#254267"; // blue sweater band

/** Ornament + bear geometry in CELL units at N=54 (the owner floor).  For
 *  N≠54 every constant scales by N/54 so the proportions stay identical. */
function buildCharm(N: number): StitchGrid {
  const s = N / 54;
  const cx = 26.5 * s, cy = 27.0 * s, R = 23.0 * s, Ri = 21.8 * s;
  const inC = (x: number, y: number, px: number, py: number, r: number): boolean =>
    (x - px) * (x - px) + (y - py) * (y - py) <= r * r;
  const inE = (x: number, y: number, px: number, py: number, rx: number, ry: number): boolean =>
    ((x - px) / rx) * ((x - px) / rx) + ((y - py) / ry) * ((y - py) / ry) <= 1;

  const zone = (sx: number, sy: number): string => {
    if (!inC(sx, sy, cx, cy, R)) return ""; // outside ornament -> empty
    if (inC(sx, sy, cx, 3.0 * s, 2.5 * s)) return CHROWN; // crown loop
    if (inC(sx, sy, cx, cy, R) && !inC(sx, sy, cx, cy, Ri)) return CHROWN; // ornament rim
    // EARS drawn BEFORE the head so they fully render above the skull.
    if (inC(sx, sy, 13.8 * s, 20.0 * s, 5.8 * s) || inC(sx, sy, 39.2 * s, 20.0 * s, 5.8 * s)) {
      if (inC(sx, sy, 14.0 * s, 20.8 * s, 2.7 * s) || inC(sx, sy, 39.0 * s, 20.8 * s, 2.7 * s)) {
        return INNER; // inner ear
      }
      return BROWN; // ear
    }
    if (inC(sx, sy, 26.5 * s, 29.5 * s, 13.2 * s)) {
      if (inE(sx, sy, 26.5 * s, 37.6 * s, 8.6 * s, 6.2 * s)) {
        if (inE(sx, sy, 26.5 * s, 34.8 * s, 3.4 * s, 2.6 * s)) {
          return DARK; // nose (solid dark)
        }
        if (sy >= 40.6 * s && sy <= 41.4 * s && Math.abs(sx - 26.5 * s) <= 3.0 * s) {
          return DARK; // small smile
        }
        return WHITE; // muzzle
      }
      if (inE(sx, sy, 20.4 * s, 30.4 * s, 2.1 * s, 2.9 * s) || inE(sx, sy, 32.6 * s, 30.4 * s, 2.1 * s, 2.9 * s)) {
        return DARK; // eyes
      }
      return BROWN; // head
    }
    if (sy >= 42.8 * s && inC(sx, sy, cx, cy, Ri)) {
      return SWEATER; // blue sweater lower band
    }
    return WHITE; // background inside rim
  };

  const out: StitchGrid = [];
  for (let r = 0; r < N; r++) {
    const row: StitchCell[] = [];
    for (let c = 0; c < N; c++) {
      const votes = new Map<string, number>();
      for (const [dx, dy] of SUB) {
        const z = zone(c + dx, r + dy);
        votes.set(z, (votes.get(z) ?? 0) + 1);
      }
      let best = "";
      let bestN = 0;
      for (const [z, n] of votes) {
        if (n > bestN) { bestN = n; best = z; }
      }
      row.push(cell(best));
    }
    out.push(row);
  }
  return out;
}

// ═══════════════════════════════ STOCKING ══════════════════════════════════
const BODY = "#2e609d";
const SHADE = "#6c95c4";
const DARKBLUE = "#113b69";

function buildStocking(rows: number, cols: number): StitchGrid {
  const inEll = (x: number, y: number, px: number, py: number, rx: number, ry: number): boolean =>
    ((x - px) / rx) * ((x - px) / rx) + ((y - py) / ry) * ((y - py) / ry) <= 1;
  // Geometric silhouette (lead spec): cuff band, leg box, heel bump ellipse,
  // foot ellipse. Coordinates are the spec's 154×238 space; for other canvases
  // the whole spec scales proportionally (sx = cols/154, sy = rows/238).
  const sy = rows / 238, sx = cols / 154;
  const inSil = (x: number, y: number): "cuff" | "leg" | "foot" | null => {
    const X = x / sx, Y = y / sy; // back into spec units
    if (26 <= X && X <= 127 && 4 <= Y && Y <= 19) return "cuff";
    if (34 <= X && X <= 120 && 20 <= Y && Y <= 164) return "leg";
    if (inEll(X, Y, 104, 172, 22, 22)) return "leg"; // heel bump
    if (inEll(X, Y, 58, 197, 47, 35) && 160 <= Y && Y <= 232) return "foot";
    return null;
  };

  const g: StitchCell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: StitchCell[] = [];
    for (let c = 0; c < cols; c++) row.push({ color: "" });
    g.push(row);
  }

  // paint the silhouette
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const z = inSil(c, r);
      if (!z) continue;
      if (z === "cuff") g[r][c].color = WHITE;
      else if (z === "foot") {
        g[r][c].color = c >= 66 * sx ? SHADE : BODY;
        if (r >= 216 * sy) g[r][c].color = WHITE; // white toe cap
      } else {
        g[r][c].color = c >= 101 * sx ? SHADE : BODY;
      }
    }
  }

  // snowflake stars (five, six-point, geometric) at her-spec positions.
  const starSpec = [[60, 55], [98, 62], [52, 100], [96, 102], [74, 138]];
  const starCentres = starSpec.map(([sx0, sy0]) => [pyRound(sx0 * sx), pyRound(sy0 * sy)] as const);
  const L = Math.max(4, Math.round(8 * Math.min(sx, sy))); // arm length (8 at her size)
  for (const [scx, scy] of starCentres) {
    for (let k = 0; k < 6; k++) {
      const a = (k * 60 * Math.PI) / 180;
      for (let d = 1; d <= L; d++) {
        const xi = pyRound(scx + d * Math.cos(a));
        const yi = pyRound(scy + d * Math.sin(a));
        if (xi >= 0 && xi < cols && yi >= 0 && yi < rows && inSil(xi, yi) === "leg") {
          g[yi][xi] = { color: DARKBLUE };
        }
        // branch ticks at arm mid and 3/4
        if (d === Math.floor(L / 2) || d === Math.floor((L * 3) / 4)) {
          for (const sd of [-1, 0, 1]) {
            const px = pyRound(scx + d * Math.cos(a) + sd * Math.cos(a + Math.PI / 2) * 1.5);
            const py = pyRound(scy + d * Math.sin(a) + sd * Math.sin(a + Math.PI / 2) * 1.5);
            if (px >= 0 && px < cols && py >= 0 && py < rows && inSil(px, py) === "leg") {
              g[py][px] = { color: DARKBLUE };
            }
          }
        }
      }
    }
    // 3×3 hub
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const X = scx + dx, Y = scy + dy;
        if (X >= 0 && X < cols && Y >= 0 && Y < rows && inSil(X, Y) === "leg") {
          g[Y][X] = { color: DARKBLUE };
        }
      }
    }
  }

  // defined outline (#113b69, 1 cell) around the whole silhouette — a cell
  // that borders empty fabric becomes part of the dark edge line.
  const out: StitchGrid = g.map((row) => row.map((c) => ({ ...c })));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!out[r]?.[c]?.color) continue;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !out[nr]?.[nc]?.color) {
          out[r][c] = { ...out[r][c], color: DARKBLUE };
          break;
        }
      }
    }
  }
  return out;
}

// ══════════════════════════════ ELIGIBILITY GATE ═══════════════════════════
const BEAR_RE = /\bteddy\b|\bbear\b|\bbears?\b/i;

/** 3in × 18ct = 54×54 — the owner-set charm generation floor (10-26 14:32). */
export const CHARM_GRID_FLOOR = 54;

export interface DirectDrawInput {
  shape?: string;
  prompt?: string;
  patternName?: string;
  canvasWidth?: number;
  canvasHeight?: number;
}

/**
 * Returns the direct-drawn grid when this generation is one of the two
 * simple deterministic items, else null (the AI path runs unchanged):
 *   - shape "stocking"                     → ALWAYS direct (item + stars)
 *   - shape "ornament" AND bear-family      → direct bear ornament
 *     (charm = the owner's 3×3″@18ct item; non-bear ornaments keep the AI
 *     path so penguins/wreaths/etc. still get model variety)
 *   - anything else                         → null
 */
export function tryDirectDraw(input: DirectDrawInput): StitchGrid | null {
  const shape = input.shape;
  if (shape === "stocking") {
    const w = Math.max(1, Math.round(input.canvasWidth || 154));
    const h = Math.max(1, Math.round(input.canvasHeight || 238));
    return buildStocking(h, w);
  }
  if (shape === "ornament") {
    const source = `${input.patternName ?? ""} ${input.prompt ?? ""}`;
    if (!BEAR_RE.test(source)) return null; // AI path for non-bear ornaments
    const w = Math.round(input.canvasWidth || 0);
    const h = Math.round(input.canvasHeight || 0);
    const gs = Math.max(w, h, CHARM_GRID_FLOOR);
    return buildCharm(gs);
  }
  return null;
}

/**
 * DMC seeds for the direct-draw palettes — the SAME shape the converter feeds
 * to recountDmcFromGrid (which then sets the real counts from the drawn grid
 * and re-sorts). Every hex here is a REAL thread in the app's DMC table; the
 * AI path's conversions use the same recount flow, so direct-draw designs
 * report a normal DMC palette like any other generation.
 */
export const DIRECT_DRAW_PALETTE: Array<{ code: string; name: string; hex: string; count: number }> = [
  { code: "939", name: "Navy Blue", hex: "#113b69", count: 0 },
  { code: "3371", name: "Black Brown", hex: "#5d3c2e", count: 0 },
  { code: "402", name: "Mahogany", hex: "#8a6c54", count: 0 },
  { code: "3799", name: "Pewter Gray", hex: "#3c3c3c", count: 0 },
  { code: "520", name: "White", hex: "#ffffff", count: 0 },
  { code: "311", name: "Medium Royal Blue", hex: "#254267", count: 0 },
  { code: "799", name: "Medium Blue", hex: "#2e609d", count: 0 },
  { code: "3755", name: "Very Pale Navy", hex: "#6c95c4", count: 0 },
];