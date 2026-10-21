/**
 * Geometric shape-mask enforcement for AI product shapes.
 *
 * Owner-conclusive (09-15 pillow repro): prompting "a heart-shaped pillow" with
 * shape=pillow returns a FULL-CANVAS scene — the pillow silhouette is NOT
 * enforced at the grid level, so the heart bleeds to the canvas edges and the
 * mask is over-filled. Identical root cause to the stocking snowflake-scene
 * defect: the prompt alone can't guarantee Gemini respects the shape outline.
 *
 * This module enforces the silhouette geometrically, AFTER the content has been
 * recentered (recenterGrid) and BEFORE the quality gate:
 *   1. Build the silhouette mask for the shape (stocking / ornament / pillow).
 *   2. Clear every cell OUTSIDE the silhouette to background.
 *   3. Fill: BFS-flood from the grid exterior; any interior background cell NOT
 *      reachable from outside (enclosed between subject content and the
 *      silhouette boundary) gets filled with the nearest non-background color,
 *      giving a coherent solid subject with true cut-out edges.
 *
 * Pure and side-effect free (returns a new grid; never mutates the input).
 * Fixes apply to NEW generations only — saved patterns keep their baked grids.
 */
import type { StitchCell, StitchGrid } from "./types";
import { isBackgroundCell } from "./recenterGrid";

/** Background fabric cell — matches the converter's white (DMC 520) merge. */
const BACKGROUND_CELL: StitchCell = { color: "#ffffff", dmcCode: "520", dmcName: "White" };

/** Product shapes the mask applies to (NOT square/rect/frame). */
export type ProductMaskShape = "stocking" | "ornament" | "pillow";

// ─── Stocking silhouette (ported from client src/data/guides.ts) ───────────
/**
 * Owner's recovered Blank Stocking silhouette, 49-point contour (toe at
 * bottom-right), normalized PER AXIS over the shape's own bbox. x was divided
 * by bbox WIDTH (67), y by bbox HEIGHT (96) — so x must be multiplied by
 * STOCKING_GUIDE_ASPECT (67/96) when mapping into a stitch box.
 */
const STOCKING_GUIDE: [number, number][] = [
  [0.0758, 0], [0.1061, 0.0421], [0.5909, 0.0842], [0.7121, 0.1263],
  [0.7121, 0.1684], [0.7121, 0.2105], [0.7121, 0.2526], [0.697, 0.2947],
  [0.6818, 0.3368], [0.6818, 0.3789], [0.6818, 0.4211], [0.6667, 0.4632],
  [0.6667, 0.5053], [0.6667, 0.5474], [0.6667, 0.5895], [0.6667, 0.6316],
  [0.697, 0.6737], [0.7273, 0.7158], [0.803, 0.7579], [0.8939, 0.8],
  [0.9394, 0.8421], [0.9545, 0.8526], [0.9697, 0.8658], [0.9818, 0.8816],
  [0.9909, 0.8987], [0.9939, 0.9105], [0.9909, 0.9211], [0.9818, 0.9342],
  [0.9667, 0.9474], [0.947, 0.9605], [0.9242, 0.9737], [0.9, 0.9868],
  [0.84, 0.9961], [0.76, 1], [0.66, 0.9974], [0.57, 0.9895],
  [0.48, 0.9789], [0.39, 0.9684], [0.31, 0.9605], [0.2879, 0.9579],
  [0.1364, 0.9158], [0.0758, 0.8737],
  [0.0606, 0.8316], [0.0606, 0.7895], [0.0758, 0.7474], [0.0758, 0.7053],
  [0.0909, 0.6632], [0.0909, 0.6211], [0.1061, 0.5789], [0.1061, 0.5368],
  [0.0909, 0.4947], [0.0909, 0.4526], [0.0909, 0.4105], [0.0909, 0.3684],
  [0.0758, 0.3263], [0.0606, 0.2842], [0.0606, 0.2421], [0.0606, 0.2],
  [0.0455, 0.1579], [0.0455, 0.1158], [0.0303, 0.0737], [0.0152, 0.0316],
  [0.0303, 0],
];
const STOCKING_GUIDE_ASPECT = 67 / 96;

/** Map the stocking contour into stitch coordinates (aspect-correct, ~14% margin). */
function stockingPointsInBox(colW: number, rowH: number): [number, number][] {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of STOCKING_GUIDE) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const bboxW = (maxX - minX) * STOCKING_GUIDE_ASPECT;
  const bboxH = maxY - minY;
  const scale = Math.min(colW / bboxW, rowH / bboxH) * 0.86;
  const scaledW = bboxW * scale;
  const scaledH = bboxH * scale;
  const dx = (colW - scaledW) / 2 - minX * STOCKING_GUIDE_ASPECT * scale;
  const dy = (rowH - scaledH) / 2 - minY * scale;
  return STOCKING_GUIDE.map(([px, py]) => [
    px * STOCKING_GUIDE_ASPECT * scale + dx,
    py * scale + dy,
  ]);
}

/** Ray-casting point-in-polygon test on a cell's center. */
function pointInPolygon(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ─── Silhouette construction ────────────────────────────────────────────────
/** Deterministic rim inset so the silhouette reads as a cut-out with a thin
 *  fabric edge (never touches the absolute canvas edge). */
function rimInset(w: number, h: number): number {
  return Math.max(1, Math.round(0.03 * Math.min(w, h)));
}

/** Corner-convention final clip (owner 10-20 P0 4dfb1359, corrected b132).
 *  buildProductSilhouette keeps cells whose CENTER (c+0.5 convention) is within
 *  the radius, but the visible dashed guide circle runs through cell CORNERS —
 *  so the outermost ring of cells (center-distance == r) straddles the drawn
 *  circle and reads as "color outside the charm" (13 #ffffff ring cells on the
 *  stored 28×28 a4c16a62). Keep a cell only when ALL FOUR of its true corners
 *  (cell spans [c, c+1] × [rw, rw+1]) are within the radius — nothing stitched
 *  outside the drawn guide, while the head rows that b131 wrongly emptied (row 1
 *  cols 10–16 at 28×28 pass the true test) stay populated. Small grids only:
 *  at 70×70 the ring is field whites the b130 evidence bars count in-circle.
 *  Ornament (circle) only for now; other shapes return unchanged. */
export function clipShapeEdge(
  grid: StitchGrid,
  shape: ProductMaskShape,
  targetW: number,
  targetH: number,
): StitchGrid {
  if (shape !== "ornament") return grid;
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (height === 0 || width === 0) return grid;
  // Corner-convention clip is a SMALL-GRID (28/42) fixation: at 70×70 the
  // corner ring is ~1 cell of field whites that the b130 evidence bars count
  // in-circle — clipping there regressed them (b131 latent bug, owner tree
  // P0 4e3c90e7-adjacent). Larger ornaments keep the b130-era center ring.
  if (Math.min(width, height) > 60) return grid;
  const inset = rimInset(width, height);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const r = Math.min(width, height) / 2 - inset;
  const out: StitchGrid = grid.map((row) => row.map((cell) => ({ ...cell })));
  // TRUE corner-convention: a cell spans [c, c+1] × [rw, rw+1] in unit
  // coordinates (its center sits at c+0.5 / rw+0.5). Keep the cell only when
  // ALL FOUR of its corners lie inside the visible circle — i.e. its FARTHEST
  // corner is within r. b131 used corners at c±0.5 about a cell CENTERED at c,
  // which is a half-cell-left shift from the true cell span: it wrongly emptied
  // the charm head rows (row 1 cols 10–16 of a 28×28 charm DO pass the true
  // test — lead-verified) while leaving ring cells the true test would cut.
  for (let rw = 0; rw < height; rw++) {
    const dyMax = Math.max(Math.abs(rw - cy), Math.abs(rw + 1 - cy));
    for (let c = 0; c < width; c++) {
      const dxMax = Math.max(Math.abs(c - cx), Math.abs(c + 1 - cx));
      if (dxMax * dxMax + dyMax * dyMax > r * r) {
        out[rw][c] = { ...EMPTY_CELL };
      }
    }
  }
  return out;
}

/** Deterministic snowflake DEFINITION pass (owner P0 a9db240b, tightened b132).
 *  Runs AFTER preserveWhiteDetail (large stocking/ornament grids whose prompt
 *  asks for snowflakes). The AI's soft little flakes quantize into dense white
 *  blobs (fill ~0.70, 4 arms); this pass rewrites each blob that does NOT read
 *  as a star into a crisp 6-arm snowflake: hub + 6 arms at exact 60° (min arm
 *  length 4 cells so the star reads at 14ct) + TWO branch tiers per arm at
 *  0.55× / 0.75× armLen (4 side branches — delicate dendrites), dominant-angle
 *  snap, bbox wiped to the modal body color so blue gaps open between arms.
 *  Tiny components (< 7 cells) merge into neighbors (erased). Deterministic,
 *  palette-only (white + existing body color). Idempotent via audit: a flake
 *  that fails the tightened star test (6 sectors at ≥ 0.5R, fill ≤ 0.58) is
 *  redrawn once rotated 30° with armLen+1. */
const SNOWFLAKE_PROMPT_RE = /\bsnowflakes?\b|\bsnow[- ]flakes?\b/i;

function isWhiteStitchCell(cell: StitchCell | undefined): boolean {
  if (!cell || !cell.color) return false;
  if (cell.color.toLowerCase() === "#ffffff") return true;
  if (cell.color.length !== 7) return false;
  const r = parseInt(cell.color.slice(1, 3), 16);
  const g = parseInt(cell.color.slice(3, 5), 16);
  const b = parseInt(cell.color.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 200 && r > 235;
}

export function enforceSnowflakeDefinition(
  grid: StitchGrid,
  shape: ProductMaskShape,
  width: number,
  height: number,
  prompt: string,
): StitchGrid {
  if (shape !== "stocking" && shape !== "ornament") return grid;
  if (!SNOWFLAKE_PROMPT_RE.test((prompt || "").toLowerCase())) return grid;
  const gs = Math.min(width, height);
  const silhouette = buildProductSilhouette(shape, width, height);
  const out: StitchGrid = grid.map((row) => row.map((cell) => ({ ...cell })));

  // Flake band: stocking body (cuff top 16% / toe bottom 22% are legit big
  // whites); ornament: in-circle minus the 2-cell rim ring (field whites).
  const inBand = (r: number, c: number): boolean => {
    if (!silhouette[r]?.[c]) return false;
    if (shape === "stocking") {
      // Flake band = the stocking BODY. b131 used the canvas-height fraction
      // 0.16..0.78 (modeled on a 194-row canvas), but on the owner's 154-row
      // stocking that window starts at row 24 — INSIDE her ~35-row cuff, so
      // the cuff spill was star-ified/audited as a 500+ white "blob" and the
      // band leaked big cuff/toe whites into the retest gate (owner 10-20
      // "weird white lines"). b133 Fix D window: exclude the whole top 30%
      // (cuff + cuff shadow) and bottom 22% (toe) — the true body interior.
      return r >= 0.3 * height && r <= 0.78 * height;
    }
    const inset = rimInset(gs, gs);
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const rr = gs / 2 - inset;
    const dx = c + 0.5 - cx;
    const dy = r + 0.5 - cy;
    return dx * dx + dy * dy <= (rr - 2) * (rr - 2);
  };

  // Body modal (non-white, non-background) color inside the shape.
  const counts: Record<string, number> = {};
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!silhouette[r]?.[c]) continue;
      const cell = out[r]?.[c];
      if (!cell || isBackgroundCell(cell) || isWhiteStitchCell(cell)) continue;
      counts[cell.color] = (counts[cell.color] ?? 0) + 1;
    }
  }
  const body = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "#2e609d";

  // 4-connected white components inside the band.
  const seen = Array.from({ length: height }, () => new Array<boolean>(width).fill(false));
  const comps: Array<Array<[number, number]>> = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (seen[r][c] || !inBand(r, c) || !isWhiteStitchCell(out[r]?.[c])) continue;
      const q: Array<[number, number]> = [[r, c]];
      seen[r][c] = true;
      const comp: Array<[number, number]> = [];
      while (q.length) {
        const [rr, cc] = q.pop()!;
        comp.push([rr, cc]);
        for (const [dr2, dc2] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nr = rr + dr2, nc = cc + dc2;
          if (nr >= 0 && nr < height && nc >= 0 && nc < width && !seen[nr][nc] && inBand(nr, nc) && isWhiteStitchCell(out[nr]?.[nc])) {
            seen[nr][nc] = true;
            q.push([nr, nc]);
          }
        }
      }
      if (comp.length >= 2) comps.push(comp);
    }
  }

  const sectorArmCount = (comp: Array<[number, number]>, cr: number, cc: number, R: number): number => {
    const sectorBest = [0, 0, 0, 0, 0, 0];
    for (const [r, c] of comp) {
      const dr = r - cr, dc = c - cc;
      const rad = Math.sqrt(dr * dr + dc * dc);
      if (rad < R * 0.45) continue;
      let ang = (Math.atan2(dr, dc) * 180) / Math.PI;
      ang = ((ang % 360) + 360) % 360;
      const sect = Math.min(5, Math.floor(ang / 60));
      sectorBest[sect] = Math.max(sectorBest[sect], rad);
    }
    return sectorBest.filter((v) => v >= R * 0.5).length;
  };

  // b133 Fix D (owner 10-20 "weird white lines and no definition"): white
  // stars on her mid-blue body (#2e609d / #6c95c4) read as dirty smears; the
  // arms are drawn in a dark steel-blue #113b69 that CONTRASTS on both palette
  // blues (DMC recount maps it to a real thread: nearest = DMC 939).
  const ARM_COLOR = "#113b69";
  const isArmCell = (c: StitchCell | undefined): boolean => !!c && c.color.toLowerCase() === ARM_COLOR;

  const drawFlake = (comp: Array<[number, number]>, baseAng: number, armLen: number): void => {
    let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1;
    for (const [r, c] of comp) {
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
    const cr = Math.round((minR + maxR) / 2);
    const cc = Math.round((minC + maxC) / 2);
    let R2 = 0;
    for (const [r, c] of comp) {
      const d = (r - cr) * (r - cr) + (c - cc) * (c - cc);
      if (d > R2) R2 = d;
    }
    const R = Math.sqrt(R2);
    // Hub capped at radius 2 (≤13 white cells) — scaling with armLen made a
    // 4-radius white disc on big flakes, exactly the "indistinct white blob"
    // the owner rejected (b133 Fix D audit gate: no in-band white comp >15).
    const hubR = Math.max(1, Math.min(2, Math.round(armLen * 0.22)));
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = out[r]?.[c];
        // Wipe BOTH prior white blobs and any dark arms from a failed earlier
        // attempt (retry must start clean — no accumulation across rotations).
        if (!cell || (!isWhiteStitchCell(cell) && !isArmCell(cell))) continue;
        cell.color = body;
        if (silhouette[r]?.[c] && inBand(r, c) && (r - cr) * (r - cr) + (c - cc) * (c - cc) <= hubR * hubR) {
          cell.color = "#ffffff"; // hub overlay — the white core of the flake
        }
      }
    }
    for (let k = 0; k < 6; k++) {
      const dirR = Math.sin(((baseAng + k * 60) * Math.PI) / 180);
      const dirC = Math.cos(((baseAng + k * 60) * Math.PI) / 180);
      for (let t = 0; t <= armLen; t++) {
        const rr = Math.round(cr + dirR * t);
        const cc2 = Math.round(cc + dirC * t);
        if (!inBand(rr, cc2) || !silhouette[rr]?.[cc2]) continue; // arms stay in the flake band (cuff/toe/rim untouched)
        const cell = out[rr]?.[cc2];
        // DARK-ARM contrast (b133 Fix D): white-on-mid-blue reads as "weird
        // white lines"; #113b69 steel-blue pops on BOTH her palette blues
        // (#2e609d / #6c95c4) and the DMC recount maps it to a real thread.
        if (cell) cell.color = ARM_COLOR;
      }
      // Two branch tiers per arm (b132): 0.55× and 0.75× armLen at ±20°, so
      // the flake reads as a delicate dendrite — 4 side branches per arm —
      // instead of a chunky plus. Deterministic, palette-only (dark too).
      for (const f of [0.55, 0.75]) {
        for (const ofs of [-20, 20]) {
          const bA = ((baseAng + k * 60 + ofs) * Math.PI) / 180;
          const bt = Math.round(armLen * f);
          const rr = Math.round(cr + Math.sin(bA) * bt);
          const cc2 = Math.round(cc + Math.cos(bA) * bt);
          if (!inBand(rr, cc2) || !silhouette[rr]?.[cc2]) continue;
          const cell = out[rr]?.[cc2];
          if (cell) cell.color = ARM_COLOR;
        }
      }
    }
  };

  for (const comp of comps) {
    if (comp.length < 7) {
      // merge tiny specks into neighbors: erase to body
      for (const [r, c] of comp) {
        const cell = out[r]?.[c];
        if (cell) cell.color = body;
      }
      continue;
    }
    let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1;
    for (const [r, c] of comp) {
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
    const fillRatio = comp.length / ((maxR - minR + 1) * (maxC - minC + 1));
    const cr = Math.round((minR + maxR) / 2);
    const cc = Math.round((minC + maxC) / 2);
    let R2 = 0;
    for (const [r, c] of comp) {
      const d = (r - cr) * (r - cr) + (c - cc) * (c - cc);
      if (d > R2) R2 = d;
    }
    const R = Math.sqrt(R2);
    // Dominant-angle snap to the nearest 60° grid so arms align.
    let baseAng = 0, bestD = -1;
    for (const [r, c] of comp) {
      const d = (r - cr) * (r - cr) + (c - cc) * (c - cc);
      if (d > bestD) { bestD = d; baseAng = (Math.atan2(r - cr, c - cc) * 180) / Math.PI; }
    }
    baseAng = Math.round(baseAng / 60) * 60;
    const drawAndAudit = (ang: number, armLen: number): boolean => {
      drawFlake(comp, ang, armLen);
      // Audit on the DRAWN DARK-ARM cells within the flake bbox
      // (silhouette-clipped) — arms are now #113b69, not white.
      const drawn: Array<[number, number]> = [];
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          if (silhouette[r]?.[c] && isArmCell(out[r]?.[c])) drawn.push([r, c]);
        }
      }
      if (drawn.length < 7) return false;
      let dR2 = 0;
      for (const [r, c] of drawn) {
        const d = (r - cr) * (r - cr) + (c - cc) * (c - cc);
        if (d > dR2) dR2 = d;
      }
      const fill2 = drawn.length / ((maxR - minR + 1) * (maxC - minC + 1));
      // Arms must REACH near the target length (b133): at the band/silhouette
      // edge the draw is clipped and a dense half-star can pass a radius-ratio
      // sector audit by sheer proximity — require the drawn radius ≈ armLen
      // so a "star" is a real star, not a clipped smear (fail → rotate → erase).
      const reached = Math.sqrt(dR2) >= armLen * 0.8;
      // ≥5 of 6 sectors armed (lead target: ≥4 arms per flake) + not a filled
      // smear — a crisp dendrite, not a blob repainted dark.
      return reached && sectorArmCount(drawn, cr, cc, Math.sqrt(dR2)) >= 5 && fill2 <= 0.6;
    };
    if (fillRatio <= 0.58 && sectorArmCount(comp, cr, cc, R) >= 6) continue; // already a white star — keep
    const armLen = Math.max(4, Math.round(R * 0.9));
    // HARD audit: fail → rotate retry (three deterministic angles) → ERASE.
    // No partial-blob debris may ever reach the saved grid (owner b132 save:
    // 0 six-sector stars, 562-cell white blob in-band — undefined white runs).
    let ok = drawAndAudit(baseAng, armLen);
    for (const altAng of [baseAng + 30, baseAng + 60]) {
      if (ok) break;
      ok = drawAndAudit(altAng, armLen + 1);
    }
    if (!ok) {
      for (const [r, c] of comp) {
        const cell = out[r]?.[c];
        if (cell && (isWhiteStitchCell(cell) || isArmCell(cell))) cell.color = body;
      }
    }
  }
  // Final sweep: erase any leftover band specks (< 3 cells) to body so the
  // design reads clean stars, not noise dots.
  const seen2 = Array.from({ length: height }, () => new Array<boolean>(width).fill(false));
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (seen2[r][c] || !inBand(r, c) || !isWhiteStitchCell(out[r]?.[c])) continue;
      const q: Array<[number, number]> = [[r, c]];
      seen2[r][c] = true;
      const comp: Array<[number, number]> = [];
      while (q.length) {
        const [srr, scc] = q.pop()!;
        comp.push([srr, scc]);
        for (const [d1, d2] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nr = srr + d1, nc = scc + d2;
          if (nr >= 0 && nr < height && nc >= 0 && nc < width && !seen2[nr][nc] && inBand(nr, nc) && isWhiteStitchCell(out[nr]?.[nc])) {
            seen2[nr][nc] = true;
            q.push([nr, nc]);
          }
        }
      }
      // Keep flake HUBS (white core cells touching a dark arm) — only erase
      // isolated specks with no flake connection (b133 Fix D; before this the
      // hub alone read as a sub-3-cell comp and got erased).
      const touchesArm = comp.some(([srr, scc]) =>
        [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => (dr !== 0 || dc !== 0) && isArmCell(out[srr + dr]?.[scc + dc]))),
      );
      if (comp.length < 3 && !touchesArm) {
        for (const [srr, scc] of comp) {
          const cell = out[srr]?.[scc];
          if (cell) cell.color = body;
        }
      }
    }
  }
  return out;
}

/**
 * b133 Fix D1 (owner 10-20 "weird white lines and not definition"): the b132
 * STOCKING path left the entire field around the silhouette as white thread —
 * the ornament path reclassifies field whites, the stocking branch never
 * did — so a 154×238 stocking conversion carried ~30k white-cells
 * (replay on her real decoded source: 30,231 white, 0 empty; her saved grid:
 * 26,748 EMPTY, i.e. she or a tool erased the field by hand). Empty the
 * field OUTSIDE the silhouette once, right after the shape mask, so the
 * canvas reads bare fabric with a crisp stocking (cuff/toe/snowflakes live
 * INSIDE the silhouette and are untouched). Pure and side-effect free.
 */
export function emptyStockingField(grid: StitchGrid, width: number, height: number): StitchGrid {
  const silhouette = buildProductSilhouette("stocking", width, height);
  return grid.map((row, r) =>
    row.map((cell, c) =>
      silhouette[r]?.[c] ? cell : { ...cell, color: "", dmcCode: undefined, dmcName: undefined },
    ),
  );
}

/** Charm crown fill — REMOVED from the chain 10-20 (b131): rows 0-1 are NEVER
 *  inside the visible corner-convention circle at any grid size (a row-1 cell's
 *  top corner is gs/2 from center > radius by construction), so this pass is
 *  dead code; the white cap the owner saw sat OUTSIDE the drawn guide and is
 *  removed by clipShapeEdge. Kept only as documentation/reference. */
export function crownFillToPole(
  grid: StitchGrid,
  shape: ProductMaskShape,
  width: number,
  height: number,
): StitchGrid {
  if (shape !== "ornament") return grid;
  const out: StitchGrid = grid.map((row) => row.map((cell) => ({ ...cell })));
  const gs = Math.min(width, height);
  const inset = rimInset(gs, gs);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const r = gs / 2 - inset;
  for (let rw = 0; rw <= 1; rw++) {
    for (let c = 0; c < width; c++) {
      const dx = c + 0.5 - cx;
      const dy = rw + 0.5 - cy;
      if (dx * dx + dy * dy > r * r) continue; // inside the center circle
      // ALSO require corner-inside (clipShapeEdge convention): never paint
      // a cell that the visible guide excludes (owner P0 4dfb1359 — crown
      // must not re-create spill at the pole).
      const dxMax = Math.max(Math.abs(c - 0.5 - cx), Math.abs(c + 0.5 - cx));
      const dyMax = Math.max(Math.abs(rw - 0.5 - cy), Math.abs(rw + 0.5 - cy));
      if (dxMax * dxMax + dyMax * dyMax > r * r) continue;
      const cell = out[rw]?.[c];
      if (!cell) continue;
      const isW = isWhiteStitchCell(cell);
      const isBg = isBackgroundCell(cell);
      if (!isW && !isBg) continue; // already subject-colored
      // Fill EMPTY as well as white pole cells: for a charm the pole is often
      // already background (recenter pushed the subject down) and reads as the
      // same white cap. Only paint when a subject color exists below so we
      // never invent content on an empty design.
      for (let sr = rw + 1; sr <= rw + 4; sr++) {
        let found = "";
        for (const dc of [-1, 0, 1]) {
          const src = out[sr]?.[c + dc];
          if (src && !isBackgroundCell(src) && !isWhiteStitchCell(src)) { found = src.color; break; }
        }
        if (found) {
          if (isBg) cell.color = found;
          else cell.color = found;
          break;
        }
      }
    }
  }
  return out;
}

/** Build a boolean silhouette mask (true = inside the shape). */
export function buildProductSilhouette(
  shape: ProductMaskShape,
  width: number,
  height: number,
): boolean[][] {
  const inset = rimInset(width, height);
  const mask: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));

  if (shape === "ornament") {
    // Circle inscribed in the inset box.
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const r = Math.min(width, height) / 2 - inset;
    for (let rw = 0; rw < height; rw++) {
      for (let c = 0; c < width; c++) {
        const dx = c + 0.5 - cx;
        const dy = rw + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) mask[rw][c] = true;
      }
    }
  } else if (shape === "pillow") {
    // Rounded rectangle: corner radius ~13% of the min side.
    const r = Math.round(0.13 * Math.min(width, height));
    const x0 = inset, x1 = width - 1 - inset;
    const y0 = inset, y1 = height - 1 - inset;
    for (let rw = 0; rw < height; rw++) {
      for (let c = 0; c < width; c++) {
        const cx = c + 0.5, cy = rw + 0.5;
        // Clamp to the inner rectangle edge, then test corner quarter-circle.
        const nx = Math.max(x0 + r, Math.min(cx, x1 - r));
        const ny = Math.max(y0 + r, Math.min(cy, y1 - r));
        const ddx = cx - nx, ddy = cy - ny;
        const inRoundedRect =
          cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1 &&
          ddx * ddx + ddy * ddy <= r * r;
        mask[rw][c] = inRoundedRect;
      }
    }
  } else if (shape === "stocking") {
    // 49-point silhouette, aspect-correct, ~14% margin (already inset).
    const points = stockingPointsInBox(width - 2 * inset, height - 2 * inset);
    const shifted = points.map(([x, y]) => [x + inset, y + inset] as [number, number]);
    for (let rw = 0; rw < height; rw++) {
      for (let c = 0; c < width; c++) {
        if (pointInPolygon(c + 0.5, rw + 0.5, shifted)) mask[rw][c] = true;
      }
    }
  }
  return mask;
}

// ─── Mask application ───────────────────────────────────────────────────────
/**
 * Enforce a geometric product-shape silhouette on an AI-converted grid.
 *
 * 1. Build the shape silhouette (stocking / circle / rounded-rect), inset by a
 *    deterministic rim margin.
 * 2. Clear every cell OUTSIDE the silhouette to background.
 * 3. BFS-flood from the grid exterior through background cells; any interior
 *    background cell NOT reachable from outside (enclosed between subject
 *    content and the silhouette boundary) is filled with the nearest
 *    non-background color — a coherent solid subject with true cut-out edges.
 *
 * Idempotent: running twice produces the same grid (outside already cleared,
 * interior holes already filled, nearest-color source unchanged).
 */
/**
 * Small-grid subject-fit (owner 10-19 P0 c9f3e630-charm, e5f979cf).
 *
 * The 28×28 Bag Charm teddy uses only ~50% of the circle (white background
 * inside the mask) and its crown/ears rows 0-4 quantize into white — the
 * charm reads "cut-off head, no details". When the non-background subject
 * fills < 55% of the shape interior, crop to the subject's content bbox and
 * nearest-neighbor upscale it to fill the shape's bounding region (2-cell
 * inset so the flat-sticker outline + circle clip still read), then re-apply
 * the shape mask so the clip is preserved. Deterministic (existing palette
 * only — nearest-neighbor resample, no invented colors). Runs BEFORE the
 * face-feature and bear-color guards so the magnified subject still gets
 * eyes/nose + fur rescue. Idempotent for already-dense grids (>= 55%).
 */
export function magnifyToFillShape(
  grid: StitchGrid,
  shape: ProductMaskShape,
  targetW: number,
  targetH: number,
): StitchGrid {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (height === 0 || width === 0) return grid;
  const silhouette = buildProductSilhouette(shape, targetW || width, targetH || height);
  let interior = 0, fg = 0;
  let top = height, bottom = -1, left = width, right = -1;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!silhouette[r]?.[c]) continue;
      interior++;
      const cell = grid[r]?.[c];
      if (!cell || isBackgroundCell(cell)) continue;
      fg++;
      if (r < top) top = r;
      if (r > bottom) bottom = r;
      if (c < left) left = c;
      if (c > right) right = c;
    }
  }
  if (interior === 0 || top >= height) return grid;
  const fill = fg / interior;
  // Dense AND already at the shape top — keep the drawing as-is. A dense
  // subject that is stranded >= 2 rows below the shape top (owner 10-20 P0
  // 4dfb1359: charm head cut off because the white sky cap made top=3 but
  // fill was 67.5% >= 55%) still magnifies — the bbox cover-fit lands the
  // head near row 1 and the cap rows become background by construction
  // (dest only writes non-background cells).
  if (fill >= 0.55 && top <= 1) return grid;
  const bboxW = right - left + 1;
  const bboxH = bottom - top + 1;
  if (bboxW <= 0 || bboxH <= 0) return grid;
  // Target: edge-to-edge within the mask's bounding box (2-cell inset so the
  // dark-outline/face-guard pass has room and the circle clip reads).
  const availW = targetW - 2;
  const availH = targetH - 2;
  // Zoom to FILL the shape's inscribed box — for a tall-narrow subject in a
  // circle this pushes width (and with it the face) outward; any overflow past
  // the silhouette is clipped by the re-mask below. Never downscale.
  // cover-fit (Math.max) — contain-fit (min) kept a tall-narrow teddy narrow
  // (owner P0 1c6d2de8 e5f979cf: fill stuck at 58% because availW/bboxW never
  // applied when the height ratio was smaller).
  // Cover-fit zoom, but NEVER let the scaled size overflow the target canvas:
  // a tall-narrow subject inside a circle could otherwise scale height past
  // targetH and write out of bounds (TypeError in the repro pipeline). Clamp
  // to the target so dest stays in-bounds; the re-mask below clips overflow.
  const k = Math.max(1, Math.max(availW / bboxW, availH / bboxH));
  const scaledW = Math.max(bboxW, Math.min(targetW, Math.round(bboxW * k)));
  const scaledH = Math.max(bboxH, Math.min(targetH, Math.round(bboxH * k)));
  const destLeft = Math.max(0, Math.round((targetW - scaledW) / 2));
  const destTop = Math.max(0, Math.round((targetH - scaledH) / 2));
  const out: StitchGrid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ ...BACKGROUND_CELL }) as StitchCell),
  );
  for (let dy = 0; dy < scaledH; dy++) {
    const srcY = Math.min(Math.floor((dy * bboxH) / scaledH), bboxH - 1);
    for (let dx = 0; dx < scaledW; dx++) {
      const srcX = Math.min(Math.floor((dx * bboxW) / scaledW), bboxW - 1);
      const cell = grid[top + srcY]?.[left + srcX];
      if (cell && !isBackgroundCell(cell)) {
        out[destTop + dy][destLeft + dx] = { ...cell };
      }
    }
  }
  // Preserve the shape clip after magnification.
  return applyProductShapeMask(out, shape, targetW, targetH);
}

export function applyProductShapeMask(
  grid: StitchGrid,
  shape: ProductMaskShape,
  targetW: number,
  targetH: number,
): StitchGrid {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (height === 0 || width === 0) return grid;
  const silhouette = buildProductSilhouette(shape, targetW || width, targetH || height);

  // Step 2: clear everything outside the silhouette; snapshot in-shape content.
  const inside: (StitchCell | null)[][] = Array.from({ length: height }, () => Array(width).fill(null));
  const out: StitchGrid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ ...BACKGROUND_CELL }) as StitchCell),
  );
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (silhouette[r]?.[c]) {
        const src = grid[r]?.[c];
        if (src && !isBackgroundCell(src)) {
          inside[r][c] = src;
          out[r][c] = src;
        }
      }
    }
  }

  // Step 3: BFS from the exterior through background cells (4-connected).
  const reachable = Array.from({ length: height }, () => Array(width).fill(false));
  const queue: Array<[number, number]> = [];
  const push = (r: number, c: number) => {
    if (r < 0 || r >= height || c < 0 || c >= width) return;
    if (reachable[r][c]) return;
    if (out[r]?.[c] && !isBackgroundCell(out[r][c])) return; // only flood background
    reachable[r][c] = true;
    queue.push([r, c]);
  };
  for (let c = 0; c < width; c++) { push(0, c); push(height - 1, c); }
  for (let r = 0; r < height; r++) { push(r, 0); push(r, width - 1); }
  while (queue.length) {
    const [r, c] = queue.shift()!;
    push(r - 1, c); push(r + 1, c); push(r, c - 1); push(r, c + 1);
  }

  // Fill any enclosed interior background region with the nearest non-bg color,
  // but ONLY when the region is large enough to be a real hole (missing body),
  // not a white-DETAIL island (snowflake arms, star, highlights — owner P0
  // 1c6d2de8 Appendix C: 70x70 red-snowflake ornament lost 57% of source-white
  // to RED/PINK because the mask nearest-filled the flake cells; a 1-2 cell
  // enclosed white island on a saturated background must survive as detail).
  const DETAIL_MAX_CELLS = 3;
  const visitedFill = Array.from({ length: height }, () => Array(width).fill(false));
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!silhouette[r]?.[c] || visitedFill[r][c]) continue;
      if (!isBackgroundCell(out[r][c]) || reachable[r][c]) continue;
      // Collect this enclosed background region (4-connected).
      const region: Array<[number, number]> = [];
      const q = [[r, c]];
      visitedFill[r][c] = true;
      let enclosed = true;
      while (q.length) {
        const [cr, cc] = q.shift()!;
        region.push([cr, cc]);
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const nr = cr + dr, nc = cc + dc;
          if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
          if (visitedFill[nr][nc]) continue;
          if (silhouette[nr]?.[nc] && !reachable[nr][nc] && isBackgroundCell(out[nr][nc])) {
            visitedFill[nr][nc] = true;
            q.push([nr, nc]);
          } else if (silhouette[nr]?.[nc] && isBackgroundCell(out[nr][nc]) && reachable[nr][nc]) {
            enclosed = false; // touches a reachable field cell -> part of the field, not a hole
          }
        }
      }
      if (!enclosed) continue;
      if (region.length <= DETAIL_MAX_CELLS) continue; // white detail — leave it
      const near = nearestNonBackground(inside, r, c);
      if (near) for (const [fr, fc] of region) out[fr][fc] = near;
    }
  }
  return out;
}

/** BFS outward from (r,c) to the nearest non-background in-shape cell. */
function nearestNonBackground(
  inside: (StitchCell | null)[][],
  r0: number,
  c0: number,
): StitchCell | null {
  const height = inside.length;
  const width = inside[0]?.length ?? 0;
  const seen = Array.from({ length: height }, () => Array(width).fill(false));
  const queue: Array<[number, number, number]> = [[r0, c0, 0]];
  seen[r0][c0] = true;
  while (queue.length) {
    const [r, c, d] = queue.shift()!;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= height || nc < 0 || nc >= width || seen[nr][nc]) continue;
      seen[nr][nc] = true;
      const cell = inside[nr][nc];
      if (cell) return cell;
      queue.push([nr, nc, d + 1]);
    }
  }
  return null;
}

// ─── Field-white reclass + inset-box containment + grey snap (owner P0 1c6d2de8) ───
/** Truly empty cell — serializes as "" so the client drops it (no stitch = fabric). */
export const EMPTY_CELL: StitchCell = { color: "", dmcCode: undefined, dmcName: undefined };

/**
 * Reclassify pure FIELD white (the AI's default canvas inside a product shape) to
 * EMPTY so it is not stitched as white thread (owner P0 1c6d2de8 Appendix C:
 * 70x70 tree save stitched 1168 white field cells = 30% of the canvas).
 *
 * Rule (4-connected, in-shape only): a white cell that is reachable from the
 * silhouette rim through white AND has NO non-white 8-neighbor is pure canvas
 * field -> EMPTY. White cells that touch a non-white cell (star, flakes, AA
 * edges, stocking cuffs) are DETAIL and stay. Runs AFTER the hole-fill so the
 * subject is already solid.
 */
export function reclassFieldWhite(
  grid: StitchGrid,
  shape: ProductMaskShape,
  targetW: number,
  targetH: number,
): StitchGrid {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (height === 0 || width === 0) return grid;
  const silhouette = buildProductSilhouette(shape, targetW || width, targetH || height);
  const reachable = Array.from({ length: height }, () => Array(width).fill(false));
  const queue: Array<[number, number]> = [];
  const push = (r: number, c: number) => {
    if (r < 0 || r >= height || c < 0 || c >= width) return;
    if (reachable[r][c]) return;
    if (!silhouette[r]?.[c]) return;
    if (!isBackgroundCell(grid[r]?.[c])) return;
    reachable[r][c] = true;
    queue.push([r, c]);
  };
  // Seed from the rim: any in-shape background cell adjacent (4-conn) to an
  // out-of-shape cell is the field edge.
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!silhouette[r]?.[c]) continue;
      if (!isBackgroundCell(grid[r]?.[c])) continue;
      const touchesRim =
        (r > 0 && !silhouette[r - 1]?.[c]) ||
        (r < height - 1 && !silhouette[r + 1]?.[c]) ||
        (c > 0 && !silhouette[r]?.[c - 1]) ||
        (c < width - 1 && !silhouette[r]?.[c + 1]);
      if (touchesRim) push(r, c);
    }
  }
  while (queue.length) {
    const [r, c] = queue.shift()!;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      push(r + dr, c + dc);
    }
  }
  const out = grid.map(row => row.map(cell => ({ ...cell })));
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!silhouette[r]?.[c] || !reachable[r][c]) continue;
      // Has any non-white 8-neighbor? -> detail, keep.
      let touchesSubject = false;
      for (let dr = -1; dr <= 1 && !touchesSubject; dr++) {
        for (let dc = -1; dc <= 1 && !touchesSubject; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
          if (!isBackgroundCell(grid[nr]?.[nc])) touchesSubject = true;
        }
      }
      if (!touchesSubject) out[r][c] = { ...EMPTY_CELL };
    }
  }
  return out;
}

/**
 * Keep the subject inside the shape's rim inset box (owner P0 1c6d2de8
 * Appendix C item 2 — "cut off the top of the tree"): the converter's
 * auto-trim + cover-resize zoomed the 70x70 tree ~1.3x so green rows hit
 * 1-67 and the star was clipped by the circle. Mirror of the frame-margin
 * band's subject-aware scale-down: measure the in-shape subject bbox and,
 * when it crosses the safe box [inset+1, W-2-inset] x [inset+1, H-2-inset],
 * scale the whole content about the canvas center down to fit, then re-mask.
 * Deterministic nearest-neighbor (no invented colors); never upscales.
 */
export function containSubjectToRim(
  grid: StitchGrid,
  shape: ProductMaskShape,
  targetW: number,
  targetH: number,
): StitchGrid {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (height === 0 || width === 0) return grid;
  const silhouette = buildProductSilhouette(shape, targetW || width, targetH || height);
  const inset = rimInset(targetW || width, targetH || height);
  // Safe box: one cell of slack inside the rim inset.
  const safeTop = inset + 1;
  const safeBottom = (targetH || height) - 2 - inset;
  const safeLeft = inset + 1;
  const safeRight = (targetW || width) - 2 - inset;
  let top = height, bottom = -1, left = width, right = -1;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!silhouette[r]?.[c]) continue;
      if (isBackgroundCell(grid[r]?.[c])) continue;
      if (r < top) top = r;
      if (r > bottom) bottom = r;
      if (c < left) left = c;
      if (c > right) right = c;
    }
  }
  if (top >= height || bottom < 0) return grid;
  const crosses =
    top < safeTop || bottom > safeBottom || left < safeLeft || right > safeRight;
  if (!crosses) return grid;
  const bboxW = right - left + 1;
  const bboxH = bottom - top + 1;
  const availW = Math.max(1, safeRight - safeLeft + 1);
  const availH = Math.max(1, safeBottom - safeTop + 1);
  const scale = Math.min(1, availW / bboxW, availH / bboxH);
  if (scale >= 1) return grid;
  const scaledW = Math.max(1, Math.round(bboxW * scale));
  const scaledH = Math.max(1, Math.round(bboxH * scale));
  const destLeft = Math.max(0, Math.round((width - scaledW) / 2));
  const destTop = Math.max(0, Math.round((height - scaledH) / 2));
  const out: StitchGrid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ ...EMPTY_CELL })),
  );
  for (let dy = 0; dy < scaledH; dy++) {
    const srcY = Math.min(Math.floor((dy * bboxH) / scaledH), bboxH - 1);
    for (let dx = 0; dx < scaledW; dx++) {
      const srcX = Math.min(Math.floor((dx * bboxW) / scaledW), bboxW - 1);
      const cell = grid[top + srcY]?.[left + srcX];
      if (cell && !isBackgroundCell(cell)) {
        out[destTop + dy][destLeft + dx] = { ...cell };
      }
    }
  }
  return applyProductShapeMask(out, shape, targetW, targetH);
}

/**
 * Grey-mush coherence (owner P0 1c6d2de8 Appendix C item 4): anti-aliased
 * mid-greys (#b2b2b2/#3c3c3c = 583 cells, 12% of the 70x70 tree canvas)
 * survive the quantizer where branch detail should be. On product shapes,
 * snap low-saturation mid-luma cells to the nearest NON-grey color already
 * present in the in-shape grid (nearest RGB neighbor), so branch/star detail
 * reads instead of a grey band. Never touches white/black (outline) or
 * genuinely grey designs that have no chromatic neighbor (no-op then).
 */
export function snapGreyMushToPalette(
  grid: StitchGrid,
  shape: ProductMaskShape,
  targetW: number,
  targetH: number,
): StitchGrid {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (height === 0 || width === 0) return grid;
  const silhouette = buildProductSilhouette(shape, targetW || width, targetH || height);
  const parse = (hex: string): [number, number, number] | null => {
    if (!hex || hex.length !== 7) return null;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return [r, g, b];
  };
  const isGrey = (rgb: [number, number, number]): boolean => {
    const [r, g, b] = rgb;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    // Floor at 40 (not 70): her tree's dark branch grey #3c3c3c has luma 60
    // and MUST be snapped; true black outlines (~#1a1a1a, luma 26) stay.
    return max - min <= 24 && luma >= 40 && luma <= 235;
  };
  // Collect chromatic in-shape colors as nearest candidates (keep full cell
  // metadata so the snapped cell carries the candidate's DMC code/name).
  const palette = new Map<string, StitchCell>();
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!silhouette[r]?.[c]) continue;
      const cell = grid[r]?.[c];
      if (!cell || isBackgroundCell(cell)) continue;
      const rgb = parse(cell.color);
      if (rgb && !isGrey(rgb)) palette.set(cell.color, cell);
    }
  }
  if (palette.size === 0) return grid;
  const candidates = Array.from(palette.entries());
  const out = grid.map(row => row.map(cell => ({ ...cell })));
  let greyCount = 0;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!silhouette[r]?.[c]) continue;
      const cell = grid[r]?.[c];
      if (!cell || isBackgroundCell(cell)) continue;
      const rgb = parse(cell.color);
      if (!rgb || !isGrey(rgb)) continue;
      greyCount++;
      let bestCell: StitchCell = cell;
      let bestDist = Infinity;
      for (const [hex, cand] of candidates) {
        const [pr, pg, pb] = parse(cand.color)!;
        const d = (rgb[0] - pr) ** 2 + (rgb[1] - pg) ** 2 + (rgb[2] - pb) ** 2;
        if (d < bestDist) { bestDist = d; bestCell = cand; }
      }
      out[r][c] = { ...bestCell };
    }
  }
  return out;
}

/**
 * Recompute dmcUsage counts from a grid after color passes (field-reclass /
 * grey-snap change which colors exist). Mirrors patternConverter's recount.
 * Splits on cell.color (hex) and re-assigns count per dmc entry.
 */
export function recountDmcFromGrid(grid: StitchGrid, dmcColors: Array<{ code: string; name: string; hex: string; count: number; symbol?: string }>): Array<{ code: string; name: string; hex: string; count: number; symbol?: string }> {
  const counts = new Map<string, number>();
  for (const row of grid) {
    for (const cell of row) {
      if (!cell || !cell.color) continue;
      const key = cell.color.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const next = dmcColors.map(d => ({ ...d, count: counts.get(d.hex.toLowerCase()) ?? 0 }));
  next.sort((a, b) => b.count - a.count);
  return next;
}

/**
 * preserveWhiteDetail — convert near-white "wash" detail cells back to pure
 * white (#ffffff) so snowflakes/star light detail survives 30-color
 * quantization (which merges flake-white toward a chromatic neighbor, e.g.
 * #ec8d94).  Only cells that survive reclassFieldWhite (i.e. are NOT field
 * background) and that are light/low-contrast washes match; saturated
 * shading (pinks/reds/greens) and dark outlines never match.  Runs AFTER
 * snapGreyMushToPalette so #ffffff cannot become a grey-snap candidate.
 */
export function preserveWhiteDetail(
  grid: StitchGrid,
  shape: ProductMaskShape,
  targetW: number,
  targetH: number,
): StitchGrid {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (height === 0 || width === 0) return grid;
  const silhouette = buildProductSilhouette(shape, targetW || width, targetH || height);
  const out = grid.map(row => row.map(cell => ({ ...cell })));
  let preserved = 0;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!silhouette[r]?.[c]) continue;
      const cell = grid[r]?.[c];
      if (!cell || isBackgroundCell(cell)) continue;
      const hex = cell.color;
      if (!hex || hex.length !== 7) continue;
      const rr = parseInt(hex.slice(1, 3), 16);
      const gg = parseInt(hex.slice(3, 5), 16);
      const bb = parseInt(hex.slice(5, 7), 16);
      if ([rr, gg, bb].some(Number.isNaN)) continue;
      const max = Math.max(rr, gg, bb);
      const min = Math.min(rr, gg, bb);
      const luma = 0.299 * rr + 0.587 * gg + 0.114 * bb;
      // Light wash: bright, low-contrast, none of the channels dark.
      // #ec8d94 flake-wash: luma 170, max-min 95, min 141 -> matches.
      // True pinks/reds (luma < ~130), browns, greens -> no match.
      if (luma >= 155 && max - min <= 100 && min >= 120) {
        out[r][c] = { ...cell, color: "#ffffff" };
        preserved++;
      }
    }
  }
  return out;
}
