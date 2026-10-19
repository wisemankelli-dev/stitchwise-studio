/** V2 verification — real e5f979cf source through the FULL small-grid pipeline.
 * Writes the report to /home/agent-backend-engineer/p0shape/v2_verify.txt via
 * Bun.write so results survive terminal issues. */
import { readFileSync } from "fs";
import sharp from "sharp";
import { subjectFitToCanvas, imageBufferToStitchGrid } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/patternConverter";
import { recenterGrid, isBackgroundCell } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/recenterGrid";
import { applyProductShapeMask, magnifyToFillShape, buildProductSilhouette } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/productShapeMask";
import { applyFaceFeatureGuard } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/faceFeatureGuard";
import { applyBearColorRescue } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/bearColorRescue";

const out: string[] = [];
const W = 28, H = 28;
const line = (s: string) => { out.push(s); console.log(s); };

try {
  const src = readFileSync("/home/team/shared/src-e5f979cf-red-sweater.png");
  line("== V2 subject-fit verification (e5f979cf real source) ==");

  // (1) V2 dark-pixel bbox measurement (mirrors subjectFitToCanvas gate)
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pw = info.width, ph = info.height, ch = info.channels || 3;
  let top = ph, bottom = -1, left = pw, right = -1, dark = 0;
  for (let y = 0; y < ph; y++) {
    const rb = y * pw * ch;
    for (let x = 0; x < pw; x++) {
      const i = rb + x * ch;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum >= 185) continue;
      dark++;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  const bboxW = (right - left + 1), bboxH = (bottom - top + 1);
  const fill = (bboxW * bboxH) / (pw * ph);
  line(`(1) source=${pw}x${ph} dark px=${dark} bbox=(${left},${top})-(${right},${bottom}) ${bboxW}x${bboxH} fill=${fill.toFixed(4)} ${fill >= 0.82 ? "-> gate SKIPS (unchanged => head still lost)" : "-> gate FIRES (crop)"}`);

  // (2) subjectFitToCanvas
  const fitted = await subjectFitToCanvas(src, W, H);
  line("(2) subjectFitToCanvas: " + (fitted === src ? "UNCHANGED" : "CHANGED (crop+upscale)"));

  // (3) real pipeline
  const t0 = Date.now();
  const res = await imageBufferToStitchGrid(fitted, 200, 22, { width: W, height: H }, { margin: false, outlinePreserve: true });
  line(`(3) conversion ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  let nw = 0;
  const rows: string[] = [];
  for (let r = 0; r < H; r++) {
    let s = "";
    for (let c = 0; c < W; c++) { const cell = res.grid[r]?.[c]; s += cell && !isBackgroundCell(cell) ? "#" : "."; if (cell && !isBackgroundCell(cell)) nw++; }
    rows.push(String(r).padStart(2) + " " + s);
  }
  line(`(4) converted grid non-white=${nw}/784`); line(rows.slice(0, 8).join("\n"));
  const headCells = rows.slice(0, 5).join("").replace(/[^#]/g, "").length;
  line(`    head rows 0-4 cells=${headCells} ${headCells >= 8 ? "(head PRESENT)" : "(head LOST)"}`);

  const rec = recenterGrid(res.grid, undefined);
  const masked = applyProductShapeMask(rec, "ornament", W, H);
  const magnified = magnifyToFillShape(masked, "ornament", W, H);
  const guarded = applyFaceFeatureGuard(magnified, res.dmcColors, "Teddy bear with a red sweater");
  const rescued = applyBearColorRescue(guarded.grid, guarded.dmcColors, "Teddy bear with a red sweater");
  const sil = buildProductSilhouette("ornament", W, H);
  let inCircle = 0, inCircleWhite = 0, silInterior = 0;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (!sil[r]?.[c]) continue; silInterior++;
    const cell = rescued.grid[r]?.[c];
    if (!cell || isBackgroundCell(cell)) inCircleWhite++; else inCircle++;
  }
  line(`(5) FINAL inside-circle: bear=${inCircle} white=${inCircleWhite} of ${silInterior} (fill ${(100 * inCircle / silInterior).toFixed(0)}%)`);
  line(headCells >= 8 && inCircle / silInterior >= 0.65 ? "V2 RESULT: ACCEPT" : "V2 RESULT: REJECT");
} catch (e: any) {
  line("ERROR: " + (e?.message ?? String(e)));
  line((e?.stack ?? "").split("\n").slice(0, 8).join("\n"));
}
line("DONE_V2");
await Bun.write("/home/agent-backend-engineer/p0shape/v2_verify.txt", out.join("\n") + "\n");