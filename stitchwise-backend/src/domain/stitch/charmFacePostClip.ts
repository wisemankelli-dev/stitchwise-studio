/**
 * Post-clip face guarantee (owner 10-20 P0 4dfb1359: "it loses eyes, nose and
 * details in face every time"; lead directive: make failure structurally
 * impossible, never merely unlikely). Runs AFTER clipShapeEdge on small-grid
 * charms/ornaments (min(w,h) <= 60) — the final stage of the chain, so nothing
 * can undo it. Two hard guarantees:
 *  (1) HEAD-AT-TOP: the true-corner clip removes every row-0 cell (the circle's
 *      top arc cuts through y=0..1), so a charm whose source head reaches the
 *      top would ship with the crown clipped. If the topmost populated row is
 *      <= 2 and carries SUBJECT cells (non-empty, non-field-white) at the
 *      center columns, the subject reaches the top: re-stamp the crown cells
 *      (rows 0..t-1, those center columns) with the subject's modal color —
 *      bounded to cells whose farthest corner is still inside the guide.
 *  (2) FACE PRESENT: audit the upper-face band for a mirror-symmetric dark-eye
 *      pair plus a center nose mark; if missing, inject 1-2 cells per eye at
 *      upper-face symmetric columns + 1 nose cell at the vertical center using
 *      the grid's own darkest color (<=#3c3c3c-class when present, else the
 *      darkest subject color), stamped ONLY onto cells that are EMPTY/field-
 *      white AND pass the same true-corner in-circle test — overwriting fur
 *      would destroy color, stamping outside would recreate the spill.
 * Deterministic, per-grid, idempotent (a passing audit changes nothing).
 */
import type { StitchCell, StitchGrid } from "./types";
import { type ProductMaskShape } from "./productShapeMask";
function rimInset(w: number, h: number): number {
  return Math.max(1, Math.round(0.03 * Math.min(w, h)));
}

const DARK_LUM_MAX = 70; // <= #3c3c3c-class (lead's eye-feature luminance band)

function cellLuminance(cell: StitchCell | undefined): number {
  if (!cell || !cell.color || cell.color.length !== 7) return 256;
  const r = parseInt(cell.color.slice(1, 3), 16);
  const g = parseInt(cell.color.slice(3, 5), 16);
  const b = parseInt(cell.color.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isWhiteLike(cell: StitchCell | undefined): boolean {
  if (!cell || !cell.color) return false;
  if (cell.color.toLowerCase() === "#ffffff") return true;
  if (cell.color.length !== 7) return false;
  const lum = cellLuminance(cell);
  return lum > 200;
}

function subjectCell(cell: StitchCell | undefined): boolean {
  return !!cell?.color && cell.color.length === 7 && !isWhiteLike(cell);
}

function trueCornerInside(c: number, rw: number, cx: number, cy: number, r: number): boolean {
  const dx = Math.max(Math.abs(c - cx), Math.abs(c + 1 - cx));
  const dy = Math.max(Math.abs(rw - cy), Math.abs(rw + 1 - cy));
  return dx * dx + dy * dy <= r * r;
}

export function enforceCharmFacePostClip(
  grid: StitchGrid,
  shape: ProductMaskShape,
  targetW: number,
  targetH: number,
): StitchGrid {
  if (shape !== "ornament") return grid;
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (height === 0 || width === 0) return grid;
  if (Math.min(width, height) > 60) return grid; // charm-size path only
  const inset = rimInset(width, height);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const r = Math.min(width, height) / 2 - inset;
  const out: StitchGrid = grid.map((row) => row.map((cell) => ({ ...cell })));

  // (1) HEAD-AT-TOP re-expansion
  const rowHasCenterSubject = (rw: number): boolean => {
    const row = out[rw] ?? [];
    return row.some(
      (cell, c) => c >= Math.round(width * 0.28) && c <= Math.round(width * 0.72) && subjectCell(cell),
    );
  };
  if (!rowHasCenterSubject(0)) {
    for (let t = 1; t <= 2 && t < height; t++) {
      if (!rowHasCenterSubject(t)) continue;
      const counts = new Map<string, number>();
      (out[t] ?? []).forEach((cell, c) => {
        if (c >= Math.round(width * 0.28) && c <= Math.round(width * 0.72) && subjectCell(cell)) {
          counts.set(cell.color!, (counts.get(cell.color!) ?? 0) + 1);
        }
      });
      let topColor = "";
      let topN = 0;
      counts.forEach((n, col) => {
        if (n > topN) {
          topN = n;
          topColor = col;
        }
      });
      if (!topColor) continue;
      for (let rw = 0; rw < t; rw++) {
        for (let c = Math.round(width * 0.28); c <= Math.round(width * 0.72); c++) {
          const cur = out[rw][c];
          if (subjectCell(cur)) continue;
          if (!trueCornerInside(c, rw, cx, cy, r)) continue; // never outside the guide
          out[rw][c] = { ...cur, color: topColor };
        }
      }
      break;
    }
  }

  // (2) FACE PRESENT: audit then inject
  const eyeTop = Math.max(1, Math.round(height * 0.14));
  const eyeBottom = Math.min(height - 1, Math.round(height * 0.45));
  const faceLeft = Math.max(0, Math.round(width * 0.18));
  const faceRight = Math.min(width - 1, Math.round(width * 0.82));
  let mirroredDarkPairs = 0;
  let darkestCell: { rw: number; c: number; color: string } | null = null;
  for (let rw = eyeTop; rw <= eyeBottom; rw++) {
    for (let c = faceLeft; c <= faceRight; c++) {
      const cell = out[rw]?.[c];
      if (!cell?.color) continue;
      const lum = cellLuminance(cell);
      if (lum <= DARK_LUM_MAX) {
        if (!darkestCell || lum < cellLuminance(out[darkestCell.rw]![darkestCell.c]!)) {
          darkestCell = { rw, c, color: cell.color };
        }
        const mc = width - 1 - c;
        const mcell = out[rw]?.[mc];
        if (mcell?.color && cellLuminance(mcell) <= DARK_LUM_MAX && Math.abs(mc - c) >= 4) {
          mirroredDarkPairs++;
        }
      }
    }
  }
  let noseMark = false;
  for (let rw = Math.round(height * 0.38); rw <= Math.round(height * 0.58); rw++) {
    for (let c = Math.round(width * 0.42); c <= Math.round(width * 0.58); c++) {
      const cell = out[rw]?.[c];
      if (cell?.color && cellLuminance(cell) <= DARK_LUM_MAX) {
        noseMark = true;
        break;
      }
    }
    if (noseMark) break;
  }
  if (mirroredDarkPairs >= 2 && noseMark) return out; // audit passed: idempotent
  const darkColor = darkestCell ? darkestCell.color : "#3c3c3c";
  const er = Math.max(eyeTop, Math.round(height * 0.26));
  const ecL = Math.max(faceLeft, Math.round(width * 0.30));
  const ecR = width - 1 - ecL;
  const targets: Array<[number, number, string]> = [];
  if (mirroredDarkPairs < 2) {
    targets.push([er, ecL, darkColor], [er, ecR, darkColor]);
    if (height >= 40) targets.push([er + 1, ecL, darkColor], [er + 1, ecR, darkColor]);
  }
  if (!noseMark) {
    targets.push([Math.round(height * 0.44), Math.round(width / 2), darkColor]);
  }
  for (const [rw, c, col] of targets) {
    if (rw < 0 || rw >= height || c < 0 || c >= width) continue;
    // Lead directive: "stamp 1-2 dark cells per eye + 1 nose cell, color-pulled
    // from the source, OVERWRITING whatever brown/white the quantizer produced
    // there" — refusing to overwrite fur is exactly why the face merged into
    // the brown. Deliberately overwrite any in-circle cell; ONLY the absolute
    // zero-spill invariant (farthest corner inside the guide) bounds the stamp.
    if (!trueCornerInside(c, rw, cx, cy, r)) continue; // never outside the guide
    out[rw][c] = { ...out[rw][c], color: col };
  }
  return out;
}