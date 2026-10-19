/**
 * P0 c9f3e630 acceptance repro — prompt-driven shape, measured on the REAL
 * pipeline with the OWNER's actual saved grid.
 *
 * Her save 533db2d2 ("Red stock with snowflakes", live-only, 100×100) is
 * FULL-BLEED because the request carried no shape (custom canvas, no preset
 * guide) → isFrameCanvas=true → no silhouette → the geometric mask never ran.
 * This repro runs the SAME mask the fixed route now applies
 * (effectiveShape = inferShapeFromPrompt(prompt) = "stocking") on her grid
 * and shows the outside-silhouette non-white count collapsing to 0.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import {
  applyProductShapeMask,
  buildProductSilhouette,
} from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/productShapeMask";
import { isBackgroundCell } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/recenterGrid";
import { inferShapeFromPrompt, resolveEffectiveShape } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/ai/shapeInference";
import type { StitchCell } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/types";
import { isFrameCanvas } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/infrastructure/routes/aiEmbroidery";

const HER_PROMPT = "Red stock with white top and white toe. Add white snowflakes in the design";
const raw = JSON.parse(readFileSync("/home/team/shared/her-grids/533db2d2-red-stock-with-snowflakes.json", "utf8"));
const saved: { color: string }[][] = raw.grid;
const H = saved.length, W = saved[0].length;
const grid: StitchCell[][] = saved.map((row, r) =>
  row.map((cell, c) => ({ row: r, col: c, color: cell.color })),
);
const DIMS = 100;
console.log(`grid ${W}x${H} (saved st=${raw.stitchCount})`);

// 1) Route decision (the fix): shape absent → prompt drives shape.
const effective = resolveEffectiveShape(undefined, HER_PROMPT);
const inferred = inferShapeFromPrompt(HER_PROMPT);
console.log(`inferShapeFromPrompt(her prompt) = ${inferred}`);
console.log(`resolveEffectiveShape(undefined, her prompt) = ${effective}`);
console.log(`OLD isFrameCanvas(undefined,${DIMS},${DIMS}) = ${isFrameCanvas(undefined, DIMS, DIMS)}  (frame → NO mask, full bleed)`);
console.log(`NEW isFrameCanvas(${effective},${DIMS},${DIMS})  = ${isFrameCanvas(effective, DIMS, DIMS)}  (product shape → mask fires)`);

// 2) Mask geometry at her canvas dims.
const silhouette = buildProductSilhouette("stocking", DIMS, DIMS);
let interior = 0;
for (let r = 0; r < DIMS; r++) for (let c = 0; c < DIMS; c++) if (silhouette[r]?.[c]) interior++;
console.log(`stocking silhouette interior cells @${DIMS}x${DIMS}: ${interior}`);

// 3) Pre-mask bleed: non-white outside the silhouette.
let outsideNonWhite = 0, insideNonWhite = 0, total = 0;
for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
  const cell = grid[r][c];
  if (!isBackgroundCell(cell)) {
    total++;
    if (silhouette[r]?.[c]) insideNonWhite++; else outsideNonWhite++;
  }
}
console.log(`BEFORE mask: non-white total=${total}  inside=${insideNonWhite}  OUTSIDE=${outsideNonWhite}`);

// 4) Apply the mask (what the fixed route now does).
const masked = applyProductShapeMask(grid, "stocking", DIMS, DIMS);
let afterTotal = 0, afterOutside = 0;
for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
  const cell = masked[r][c];
  if (!isBackgroundCell(cell)) {
    afterTotal++;
    if (!silhouette[r]?.[c]) afterOutside++;
  }
}
console.log(`AFTER  mask: non-white total=${afterTotal}  OUTSIDE=${afterOutside}  (outside must be 0)`);

mkdirSync("/home/team/shared/her-grids-masked", { recursive: true });
writeFileSync(
  "/home/team/shared/her-grids-masked/533db2d2-masked-stocking.json",
  JSON.stringify({
    recordId: raw.recordId,
    name: raw.name,
    prompt: HER_PROMPT,
    effectiveShape: effective,
    dims: [DIMS, DIMS],
    silhouetteInterior: interior,
    before: { nonWhite: total, outsideSilhouetteNonWhite: outsideNonWhite, insideSilhouetteNonWhite: insideNonWhite },
    after: { nonWhite: afterTotal, outsideSilhouetteNonWhite: afterOutside },
    grid: masked.map(row => row.map(c => c.color)),
  }),
);
console.log("artifact: /home/team/shared/her-grids-masked/533db2d2-masked-stocking.json");
const verdict = afterOutside === 0 ? "ACCEPT ✓ (outside-silhouette non-white = 0)" : "REJECT";
console.log(`VERDICT: ${verdict}`);