/**
 * P0 c9f3e630-charm — per-stage pipeline dump on her REAL stored source
 * (src-e5f979cf-red-sweater.png, 1024×1024 complete teddy) exactly as the
 * build-129 route ran it for the Bag Charm: gridSize=200, target 28×28,
 * margin=false (shape=ornament), outlinePreserve=true (small grid).
 * Prints a rows-0-9 map + fill stats at EVERY stage to locate where the
 * crown+ears (source rows 1-4) get lost and why the subject is 55%-white.
 */
import { readFileSync } from "fs";
import { imageBufferToStitchGrid } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/patternConverter";
import { recenterGrid } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/recenterGrid";
import { applyProductShapeMask, magnifyToFillShape, buildProductSilhouette } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/productShapeMask";
import { applyFaceFeatureGuard } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/faceFeatureGuard";
import { applyBearColorRescue } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/bearColorRescue";
import { isBackgroundCell } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/recenterGrid";

const W = 28, H = 28;
function dump(label: string, grid: any[][]) {
  let nonWhite = 0;
  const rows: string[] = [];
  for (let r = 0; r < H; r++) {
    let line = "";
    for (let c = 0; c < W; c++) {
      const cell = grid[r]?.[c];
      line += cell && !isBackgroundCell(cell) ? "#" : ".";
      if (cell && !isBackgroundCell(cell)) nonWhite++;
    }
    rows.push(String(r).padStart(2) + " " + line);
  }
  console.log(`\n=== ${label} — non-white=${nonWhite}/${W*H} (${(100*nonWhite/(W*H)).toFixed(1)}%) ===`);
  console.log(rows.slice(0, 12).join("\n"));
  return nonWhite;
}

const buf = readFileSync("/home/team/shared/src-e5f979cf-red-sweater.png");
const res = await imageBufferToStitchGrid(buf, 200, 22, { width: W, height: H }, { margin: false, outlinePreserve: true });
const conv = res.grid;
console.log("grid dims", conv.length, "x", conv[0]?.length);
dump("1. imageBufferToStitchGrid (raw conversion)", conv);
const rec = recenterGrid(conv, undefined);
dump("2. recenterGrid", rec);
const masked = applyProductShapeMask(rec, "ornament", W, H);
const magnified = magnifyToFillShape(masked, "ornament", W, H);
dump("3b. magnifyToFillShape (subject-fit)", magnified);
dump("3. applyProductShapeMask(ornament)", masked);
const sil = buildProductSilhouette("ornament", W, H);
let silInterior = 0; for (let r=0;r<H;r++) for (let c=0;c<W;c++) if (sil[r]?.[c]) silInterior++;
console.log(`\ncircle silhouette interior=${silInterior}`);
const guarded = applyFaceFeatureGuard(magnified, res.dmcColors, "Teddy bear with a red sweater");
dump("4. applyFaceFeatureGuard", guarded.grid);
const rescued = applyBearColorRescue(guarded.grid, guarded.dmcColors, "Teddy bear with a red sweater");
dump("5. applyBearColorRescue", rescued.grid);
// non-white inside circle for final
let inCircle = 0, inCircleWhite = 0;
for (let r=0;r<H;r++) for (let c=0;c<W;c++) if (sil[r]?.[c]) {
  const cell = rescued.grid[r]?.[c];
  if (!cell || isBackgroundCell(cell)) inCircleWhite++; else inCircle++;
}
console.log(`\nFINAL inside-circle: bear=${inCircle} white=${inCircleWhite} of ${silInterior} (subject fill ${(100*inCircle/silInterior).toFixed(0)}%)`);