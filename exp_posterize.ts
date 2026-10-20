/** Compare posterize variants on the V3-fitted buffer (crown survival). */
import { readFileSync } from "fs";
import sharp from "sharp";
import { subjectFitToCanvas } from "/home/agent-backend-engineer/p0shape/stitchwise-backend/src/domain/stitch/patternConverter";

const src = readFileSync("/home/team/shared/src-e5f979cf-red-sweater.png");
const fitted = await subjectFitToCanvas(src, 28, 28);

function map(png: Buffer, label: string): string {
  const { data, info } = png;
  const w = info.width, h = info.height;
  const rows: string[] = [];
  let nw = 0;
  for (let r = 0; r < h; r++) {
    let line = "";
    for (let c = 0; c < w; c++) {
      const i = (r * w + c) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const wh = lum > 235 || (Math.max(data[i], data[i + 1], data[i + 2]) >= 190 &&
        (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2])) /
          Math.max(data[i], data[i + 1], data[i + 2]) <= 0.2);
      line += wh ? "." : "#";
      if (!wh) nw++;
    }
    rows.push((r < 10 ? " " + r : r) + " " + line);
  }
  return `\n=== ${label} — non-white=${nw}/${w * h} ===\n` + rows.slice(0, 10).join("\n");
}

// (a) resize only, no median, no palette (raw lanczos to 28)
const raw28 = await sharp(fitted)
  .resize(28, 28, { fit: "cover", position: "centre", kernel: sharp.kernel.lanczos3 })
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
console.log(map({ data: raw28.data, info: raw28.info }, "a) raw lanczos, no median/palette"));

// (b) resize + palette 22, no median
const pal22 = await sharp(fitted)
  .resize(28, 28, { fit: "cover", position: "centre", kernel: sharp.kernel.lanczos3 })
  .png({ palette: true, colours: 22, dither: 0 })
  .toBuffer();
const pal22raw = await sharp(pal22).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
console.log(map({ data: pal22raw.data, info: pal22raw.info }, "b) no median + palette 22"));

// (c) resize + palette 40, no median
const pal40 = await sharp(fitted)
  .resize(28, 28, { fit: "cover", position: "centre", kernel: sharp.kernel.lanczos3 })
  .png({ palette: true, colours: 40, dither: 0 })
  .toBuffer();
const pal40raw = await sharp(pal40).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
console.log(map({ data: pal40raw.data, info: pal40raw.info }, "c) no median + palette 40"));

// (d) resize + median + palette 40 (control with old median)
const med40 = await sharp(fitted)
  .resize(28, 28, { fit: "cover", position: "centre", kernel: sharp.kernel.lanczos3 })
  .median(3)
  .png({ palette: true, colours: 40, dither: 0 })
  .toBuffer();
const med40raw = await sharp(med40).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
console.log(map({ data: med40raw.data, info: med40raw.info }, "d) median + palette 40"));