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
 *           background; outside the ornament = empty. Face features are
 *           geometric primitives, so the face can NEVER be a white slab and
 *           the eyes/nose are always present and symmetric.
 *           LOOK = the owner-picked "B2" (2026-10-29): complete round head
 *           with a brown chin, muzzle fully inside the head, and NO sweater
 *           (#254267 is gone — paper fills the ornament below the chin).
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

/**
 * CHARM BEAR — the owner-picked "B2" look (2026-10-29, +18 % face).
 *
 * The b134 bear was rejected on retest ("there is no bottom of the face for the
 * bear, just a blue blocked out space"): its muzzle was wider than the head at
 * the chin, so the chin was white-on-white, and the #254267 "sweater" was a
 * full-width navy slab starting 0.1 cells under the head. B2 replaces both:
 *   - a COMPLETE round head (r 14.4 cells at N=54) whose chin closes on a cell
 *     boundary, with the muzzle ellipse fully inside it (max boundary radius
 *     10.3·k < head 12.2·k), so the jaw is brown all the way down;
 *   - NO sweater at all — paper/white fills the ornament below the chin;
 *   - features in CELL space, mirrored about the axis (c ↔ 52−c), so the eyes,
 *     inner ears and nose are exactly symmetric.
 * The ornament rim, the crown loop and the palette are untouched (B2's rim and
 * crown are cell-for-cell identical to the shipped bear: navy 173, rim 685/720).
 *
 * Every number below is in the 54-cell reference space and scales by
 * s = N/54, so the composition is identical at any canvas ≥ the 54 floor.
 */
const FACE_K = 1.18; // face size vs the b134 bear (owner picked B2 of B1/B2/B3)
const HEAD_R = 12.2 * FACE_K; // 14.396 cells at N=54
/** Head bottom snapped to the cell boundary y = 42.0 — a chin edge that lands
 *  mid-cell leaves a 1-cell spike under the vote — so the face centre sits
 *  0.604 cells (not a round 0.6) below the ornament centre.  Order of the
 *  subtraction is kept identical to the approved render's snap. */
const FACE_DY = 42.0 - 27.0 - HEAD_R;
const EAR_POS = 0.8156242445111275; // ear POSITION vs proportional: the least tuck
// that keeps ≥1.2 cells of rendered paper between face and rim (solved by
// bisection on the rendered grid; the owner-facing report rounds it to 0.816 —
// this is the exact value, so the shipped grid is the approved one bit for bit)
/** B2's own numbers, in 54-space, relative to the face centre. */
const BEAR = {
  headR: HEAD_R, // 14.396 → head bottom lands on y = 42.0 exactly
  earDx: 11.7 * FACE_K * EAR_POS,
  earDy: -8.2 * FACE_K * EAR_POS,
  earR: 5.5 * FACE_K,
  muzDy: 6.4 * FACE_K, // muzzle ellipse centre below the face centre
  muzRx: 6.6 * FACE_K,
  muzRy: 3.9 * FACE_K,
  eyeCx: 6.5 * FACE_K, // eye centre distance from the mirror axis
  noseBlockDy: 3 * FACE_K, // nose+smile = ONE contiguous block under the face centre
  innerDx: -0.3 * FACE_K,
  innerDy: 0.7 * FACE_K,
} as const;

/** Ornament + bear geometry in CELL units at N=54 (the owner floor).  For
 *  N≠54 every constant scales by N/54 so the proportions stay identical. */
function buildCharm(N: number): StitchGrid {
  const s = N / 54;
  const cx = 26.5 * s, cy = 27.0 * s, R = 23.0 * s, Ri = 21.8 * s;
  const inC = (x: number, y: number, px: number, py: number, r: number): boolean =>
    (x - px) * (x - px) + (y - py) * (y - py) <= r * r;
  const inE = (x: number, y: number, px: number, py: number, rx: number, ry: number): boolean =>
    ((x - px) / rx) * ((x - px) / rx) + ((y - py) / ry) * ((y - py) / ry) <= 1;

  // ── B2 bear, built in the 54-cell reference space ────────────────────────
  const hx = 26.5; // ornament centre x == mirror axis
  const hy = 27.0 + FACE_DY; // face centre y (54-space)
  const axisC = 26; // cell index of the mirror axis (cols 26 ± hw)
  // Integer feature boxes snapped from the scaled geometry and then MIRRORED
  // (c → 52−c) so both sides are cell-exact (an ellipse centred on a half-cell
  // boundary rasterises asymmetrically — measured 12 vs 10 cells).
  const eyeW = Math.max(4, Math.round(4 * FACE_K)); // 5
  const eyeH = Math.max(4, Math.round(4 * FACE_K)); // 5
  const eyeC0 = Math.round(hx - BEAR.eyeCx - eyeW / 2);
  const eyeC1 = eyeC0 + eyeW - 1;
  const eyeC0R = 54 - 2 - eyeC1;
  const eyeC1R = 54 - 2 - eyeC0;
  const eyeR0 = Math.round(hy - eyeH / 2);
  const eyeR1 = eyeR0 + eyeH - 1;
  const noseHW1 = Math.max(2, Math.round(2 * FACE_K)); // 2 → 5 wide
  const noseHW2 = Math.max(1, Math.round(1 * FACE_K)); // 1 → 3 wide
  const smileHW = Math.max(3, Math.round(3 * FACE_K)); // 4 → 9 wide
  const blkA = Math.round(hy + BEAR.noseBlockDy); // 31
  const noseRows = Math.max(4, Math.round(4 * FACE_K)); // 5
  const wideRows = Math.ceil(noseRows / 2); // 3
  const n1a = blkA;
  const n1b = blkA + wideRows - 1;
  const n2a = n1b + 1;
  const n2b = blkA + noseRows - 1;
  const smA = n2b + 1;
  const smB = smA + Math.max(1, Math.round(1 * FACE_K)) - 1;
  const innerW = Math.max(3, Math.round(5 * FACE_K)); // 6
  const icx = hx - BEAR.earDx + BEAR.innerDx;
  const icy = hy + BEAR.earDy + BEAR.innerDy;
  const inC0 = Math.round(icx - innerW / 2);
  const inC1 = inC0 + innerW - 1;
  const inC0R = 54 - 2 - inC1;
  const inC1R = 54 - 2 - inC0;
  const inR0 = Math.round(icy - innerW / 2);
  const inR1 = inR0 + innerW - 1;
  // rounded box (corners cut) — the inner ears and the eyes
  const inRound = (r: number, c: number, r0: number, r1: number, c0: number, c1: number): boolean =>
    r >= r0 && r <= r1 && c >= c0 && c <= c1 && !((r === r0 || r === r1) && (c === c0 || c === c1));

  const zone = (sx: number, sy: number): string => {
    if (!inC(sx, sy, cx, cy, R)) return ""; // outside ornament -> empty
    if (inC(sx, sy, cx, 3.0 * s, 2.5 * s)) return CHROWN; // crown loop
    if (!inC(sx, sy, cx, cy, Ri)) return CHROWN; // ornament rim
    // the bear is drawn in 54-space: x/s turns the s-scaled constants into
    // B2's own numbers, so N=54 reproduces the approved render exactly.
    const x = sx / s, y = sy / s;
    // EARS drawn BEFORE the head so they fully render above the skull.
    for (const sgn of [-1, 1] as const) {
      const ex = hx + sgn * BEAR.earDx;
      const ey = hy + BEAR.earDy;
      if (inC(x, y, ex, ey, BEAR.earR)) {
        const c = Math.floor(x);
        const r = Math.floor(y);
        return inRound(r, c, inR0, inR1, sgn < 0 ? inC0 : inC0R, sgn < 0 ? inC1 : inC1R)
          ? INNER // inner ear
          : BROWN; // ear
      }
    }
    const hdx = x - hx;
    const hdy = y - hy;
    if (hdx * hdx + hdy * hdy <= BEAR.headR * BEAR.headR) {
      const muzCy = hy + BEAR.muzDy;
      if (inE(x, y, hx, muzCy, BEAR.muzRx, BEAR.muzRy)) {
        const c = Math.floor(x);
        const r = Math.floor(y);
        // nose (solid dark) + smile: one contiguous block, so the mouth can
        // never float away from the nose (a sub-cell band loses the 2–2 vote)
        if (r >= n1a && r <= n1b && Math.abs(c - axisC) <= noseHW1) return DARK;
        if (r >= n2a && r <= n2b && Math.abs(c - axisC) <= noseHW2) return DARK;
        if (r >= smA && r <= smB && Math.abs(c - axisC) <= smileHW) return DARK;
        return WHITE; // muzzle
      }
      const c = Math.floor(x);
      const r = Math.floor(y);
      if (inRound(r, c, eyeR0, eyeR1, eyeC0, eyeC1) || inRound(r, c, eyeR0, eyeR1, eyeC0R, eyeC1R)) {
        return DARK; // eyes
      }
      return BROWN; // head (chin closes on a cell boundary — no flat cut)
    }
    return WHITE; // background inside rim — NO sweater below the chin
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