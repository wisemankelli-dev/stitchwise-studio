/**
 * Debug utility — saves every intermediate stage of the pattern pipeline to disk.
 * Set env var STITCHWISE_DEBUG=true to enable. Each pipeline run gets a
 * timestamped directory under /home/team/shared/debug-patterns/.
 *
 * The directory is also served via the site at /debug-patterns/ for easy viewing.
 */
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

const DEBUG = process.env.STITCHWISE_DEBUG === "true";
const BASE_DIR = "/home/team/shared/debug-patterns";

let runDir: string | null = null;

/** Start a new debug run — returns the run directory path. */
export function startDebugRun(prompt: string): string | null {
  if (!DEBUG) return null;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_");
  runDir = path.join(BASE_DIR, `${ts}_${slug}`);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, "prompt.txt"), prompt);
  console.error(`[debug] run dir: ${runDir}`);
  return runDir;
}

/** Save a raw buffer as PNG. stage name e.g. "1-raw-svg" or "3-downscaled". */
export function saveBuffer(stage: string, buffer: Buffer, width?: number, height?: number, channels?: number): void {
  if (!runDir) return;
  const filePath = path.join(runDir, `${stage}.png`);
  try {
    if (width && height && channels) {
      sharp(buffer, { raw: { width, height, channels } }).png().toFile(filePath);
    } else {
      fs.writeFileSync(filePath, buffer);
    }
    console.error(`[debug] saved ${stage}.png`);
  } catch (err) {
    console.error(`[debug] failed to save ${stage}:`, err);
  }
}

/** Save a raw SVG string. */
export function saveSVG(stage: string, svg: string): void {
  if (!runDir) return;
  const filePath = path.join(runDir, `${stage}.svg`);
  fs.writeFileSync(filePath, svg);
  console.error(`[debug] saved ${stage}.svg (${svg.length} chars)`);
}

/** Save a stitch grid as a scaled PNG for visual inspection. */
export function saveGrid(stage: string, grid: string[][], dmcPalette: Array<{ code: string; hex: string }>): void {
  if (!runDir) return;
  const lookup = new Map(dmcPalette.map(c => [c.code, c.hex]));
  const size = grid.length;
  const SCALE = 8;
  const buf = Buffer.alloc(size * SCALE * size * SCALE * 4);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const hex = lookup.get(grid[r][c]) || "#FF00FF";
      const rr = parseInt(hex.slice(1, 3), 16);
      const gg = parseInt(hex.slice(3, 5), 16);
      const bb = parseInt(hex.slice(5, 7), 16);
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const idx = ((r * SCALE + dy) * size * SCALE + (c * SCALE + dx)) * 4;
          buf[idx] = rr; buf[idx + 1] = gg; buf[idx + 2] = bb; buf[idx + 3] = 255;
        }
      }
    }
  }
  sharp(buf, { raw: { width: size * SCALE, height: size * SCALE, channels: 4 } })
    .png()
    .toFile(path.join(runDir!, `${stage}.png`));
  console.error(`[debug] saved ${stage}.png (${size}x${size} grid, ${SCALE}x scale)`);
}

/** Write a summary text file. */
export function saveSummary(text: string): void {
  if (!runDir) return;
  fs.writeFileSync(path.join(runDir, "summary.txt"), text);
  console.error(`[debug] saved summary.txt`);
}
