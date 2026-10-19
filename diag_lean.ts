/** Lean charm diagnosis: (a) source bbox under V1 near-white rule, (b) does
 * subjectFitToCanvas fire, (c) head rows after converting the FITTED buffer. */
import { readFileSync } from "fs";
import sharp from "sharp";
import { subjectFitToCanvas, imageBufferToStitchGrid } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/patternConverter";
import { isBackgroundCell } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/recenterGrid";

const src = readFileSync("/home/team/shared/src-e5f979cf-red-sweater.png");
const meta = await sharp(src).metadata();
console.log("source dims:", meta.width, "x", meta.height);

// (a) V1 gate: bbox on 192px preview, near-white >= 240 = background
{
  const P = 192;
  const { data, info } = await sharp(src).resize(P, P, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pw = info.width, ph = info.height;
  let top = ph, bottom = -1, left = pw, right = -1, n = 0;
  const hist = new Map<number, number>();
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const i = (y * pw + x) * 3;
    const r = data[i], g = data[i+1], b = data[i+2];
    if (r >= 240 && g >= 240 && b >= 240) continue;
    n++; if (y<top) top=y; if (y>bottom) bottom=y; if (x<left) left=x; if (x>right) right=x;
    const key = ((r>>4)<<8)|((g>>4)<<4)|(b>>4);
    hist.set(key, (hist.get(key) ?? 0) + 1);
  }
  const fill = ((bottom-top+1)*(right-left+1)/(pw*ph));
  console.log("V1 gate: nonWhite(>=240 test) px:", n, "bbox:", top, bottom, left, right, "fill:", fill.toFixed(4), fill >= 0.82 ? "-> GATE SKIPS (unchanged)" : "-> GATE FIRES");
  const topColors = [...hist.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${((k>>8)&15)*16},${((k>>4)&15)*16},${(k&15)*16}:${v}`);
  console.log("top non-near-white colors:", topColors.join("  "));
}

// (b) does subjectFitToCanvas fire at 28?
const fitted = await subjectFitToCanvas(src, 28, 28);
console.log("subjectFitToCanvas(28):", fitted === src ? "UNCHANGED" : "CHANGED", "bytes:", fitted.length);

// (c) convert the fitted buffer -> print rows 0-9
const res = await imageBufferToStitchGrid(fitted === src ? src : fitted, 200, 22, { width: 28, height: 28 }, { margin: false, outlinePreserve: true });
let nw = 0;
const rows: string[] = [];
for (let r = 0; r < 28; r++) {
  let line = "";
  for (let c = 0; c < 28; c++) { const cell = res.grid[r]?.[c]; line += cell && !isBackgroundCell(cell) ? "#" : "."; if (cell && !isBackgroundCell(cell)) nw++; }
  rows.push(String(r).padStart(2) + " " + line);
}
console.log("converted fitted -> non-white=" + nw + "/784\n" + rows.slice(0, 12).join("\n"));
console.log("EXIT_OK");