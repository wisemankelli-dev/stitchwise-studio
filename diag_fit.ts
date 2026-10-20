/** Diagnose subjectFitToCanvas on the REAL e5f979cf source. */
import { readFileSync } from "fs";
import sharp from "sharp";
import { subjectFitToCanvas, imageBufferToStitchGrid } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/patternConverter";
import { isBackgroundCell } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/recenterGrid";

const src = readFileSync("/home/team/shared/src-e5f979cf-red-sweater.png");

// 1) raw bbox fill of the 1024 source (what the gate sees)
{
  const P = 192;
  const { data, info } = await sharp(src).resize(P, P, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pw = info.width, ph = info.height;
  let top = ph, bottom = -1, left = pw, right = -1, n = 0;
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const i = (y * pw + x) * 3;
    if (data[i] >= 240 && data[i+1] >= 240 && data[i+2] >= 240) continue;
    n++; if (y<top) top=y; if (y>bottom) bottom=y; if (x<left) left=x; if (x>right) right=x;
  }
  console.log("src non-white px:", n, "bbox:", top, bottom, left, right, "fill:", ((bottom-top+1)*(right-left+1)/(pw*ph)).toFixed(3));
}

// 2) run subjectFitToCanvas at 28 and at 200
for (const sz of [28, 200]) {
  const fitted = await subjectFitToCanvas(src, sz, sz);
  console.log("subjectFitToCanvas(" + sz + "):", fitted === src ? "UNCHANGED (gate skipped)" : "CHANGED", fitted.length, "bytes");
  const res = await imageBufferToStitchGrid(fitted === src ? src : fitted, 200, 22, { width: 28, height: 28 }, { margin: false, outlinePreserve: true });
  let nonWhite = 0;
  const rows: string[] = [];
  for (let r = 0; r < 28; r++) {
    let line = "";
    for (let c = 0; c < 28; c++) { const cell = res.grid[r]?.[c]; line += cell && !isBackgroundCell(cell) ? "#" : "."; if (cell && !isBackgroundCell(cell)) nonWhite++; }
    rows.push(String(r).padStart(2) + " " + line);
  }
  console.log("converted at " + sz + " target -> non-white=" + nonWhite + "/784\n" + rows.slice(0, 10).join("\n"));
}

// 3) control: convert WITHOUT any fitting (plain 200->28) — is the head gone there too?
{
  const res = await imageBufferToStitchGrid(src, 200, 22, { width: 28, height: 28 }, { margin: false, outlinePreserve: true });
  const rows: string[] = [];
  let nw = 0;
  for (let r = 0; r < 28; r++) { let line = ""; for (let c = 0; c < 28; c++) { const cell = res.grid[r]?.[c]; line += cell && !isBackgroundCell(cell) ? "#" : "."; if (cell && !isBackgroundCell(cell)) nw++; } rows.push(String(r).padStart(2) + " " + line); }
  console.log("CONTROL (plain conversion, no fit): non-white=" + nw + "/784\n" + rows.slice(0, 10).join("\n"));
}