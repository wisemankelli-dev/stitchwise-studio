/**
 * Visualize the full AI → Pattern pipeline, saving all stages.
 * Run: cd stitchwise-backend && npx ts-node visualize-pipeline.ts
 */
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

const OUT_DIR = "/home/team/shared/pipeline-viz";

async function main() {
  // Dynamic imports for ts-node compatibility
  const { generateImageWithOpenAI } = await import("./src/infrastructure/services/openaiService");
  const { quantizePixels } = await import("./src/domain/stitch/colorReducer");
  const { closestDmcColor, rgbToHex } = await import("./src/domain/stitch/dmcColors");

  const PROMPT = "a cute bunny rabbit";
  const GRID_SIZE = 75;
  const MAX_COLORS = 10;
  const INTERMEDIATE_SIZE = 200;
  const SCALE = 8; // pixel scale for grid visualization

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // ═══════════════ STAGE 1: Raw image from gpt-image-1 ═══════════════
  console.log("=== Stage 1: Generate raw image from gpt-image-1 ===");
  const imageBuffer = await generateImageWithOpenAI(PROMPT);
  fs.writeFileSync(path.join(OUT_DIR, "1-raw-image.png"), imageBuffer);
  console.log(`Saved: 1-raw-image.png (${(imageBuffer.length / 1024).toFixed(0)} KB)`);

  // ═══════════════ INTERMEDIATE: Resize + Posterize ═══════════════
  console.log("\n=== Intermediate: 200×200 posterize ===");
  const { data: intermData } = await sharp(imageBuffer)
    .resize(INTERMEDIATE_SIZE, INTERMEDIATE_SIZE, {
      fit: "cover", position: "centre", kernel: sharp.kernel.lanczos3,
    })
    .median(2)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const intermPixels = new Uint8ClampedArray(intermData);
  const intermQuantized = quantizePixels(intermPixels, MAX_COLORS);

  // Snap to quantized palette
  const flatBuffer = Buffer.alloc(INTERMEDIATE_SIZE * INTERMEDIATE_SIZE * 4);
  for (let i = 0; i < INTERMEDIATE_SIZE * INTERMEDIATE_SIZE; i++) {
    const r = intermPixels[i * 4], g = intermPixels[i * 4 + 1], b = intermPixels[i * 4 + 2];
    let bestDist = Infinity, bestColor = intermQuantized[0];
    for (const qc of intermQuantized) {
      const d = (r - qc.r) ** 2 + (g - qc.g) ** 2 + (b - qc.b) ** 2;
      if (d < bestDist) { bestDist = d; bestColor = qc; }
    }
    flatBuffer[i * 4] = bestColor.r;
    flatBuffer[i * 4 + 1] = bestColor.g;
    flatBuffer[i * 4 + 2] = bestColor.b;
    flatBuffer[i * 4 + 3] = 255;
  }
  await sharp(flatBuffer, {
    raw: { width: INTERMEDIATE_SIZE, height: INTERMEDIATE_SIZE, channels: 4 },
  }).png().toFile(path.join(OUT_DIR, "2-posterized.png"));
  console.log("Saved: 2-posterized.png");

  // Nearest-neighbor downscale to grid size
  const { data } = await sharp(flatBuffer, {
    raw: { width: INTERMEDIATE_SIZE, height: INTERMEDIATE_SIZE, channels: 4 },
  })
    .resize(GRID_SIZE, GRID_SIZE, { fit: "cover", kernel: sharp.kernel.nearest })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rawPixels = new Uint8ClampedArray(data);

  // ═══════════════ STAGE 2: Pre-despeckle grid ═══════════════
  console.log("\n=== Stage 2: Pre-despeckle grid (DMC mapped) ===");
  const preGridDmc: string[][] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    const gridRow: string[] = [];
    for (let col = 0; col < GRID_SIZE; col++) {
      const idx = (row * GRID_SIZE + col) * 4;
      const dmc = closestDmcColor(rawPixels[idx], rawPixels[idx + 1], rawPixels[idx + 2]);
      gridRow.push(dmc.code);
    }
    preGridDmc.push(gridRow);
  }

  // Count orphan cells (4-way: 0 same-color edge neighbors)
  function countOrphans(grid: string[][]): number {
    const size = grid.length;
    let count = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const code = grid[r][c];
        let same = 0;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size && grid[nr][nc] === code) same++;
        }
        if (same === 0) count++;
      }
    }
    return count;
  }

  // Build DMC code → RGB lookup from the same closestDmcColor we already imported
  const { DMC_COLORS } = await import("./src/domain/stitch/dmcColors");
  const dmcLookup = new Map<string, [number, number, number]>();
  for (const entry of DMC_COLORS) {
    dmcLookup.set(entry.code, entry.rgb);
  }

  // Render grid as scaled PNG
  function renderGrid(grid: string[][], scale: number): { buffer: Buffer; colorSet: Set<string> } {
    const size = grid.length;
    const buf = Buffer.alloc(size * scale * size * scale * 4);
    const colorSet = new Set<string>();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const code = grid[r][c];
        colorSet.add(code);
        let rVal = 255, gVal = 0, bVal = 255; // magenta fallback
        const rgb = dmcLookup.get(code);
        if (rgb) { rVal = rgb[0]; gVal = rgb[1]; bVal = rgb[2]; }
        else { console.error(`  WARN: no DMC entry for code "${code}"`); }
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const idx = ((r * scale + dy) * size * scale + (c * scale + dx)) * 4;
            buf[idx] = rVal; buf[idx + 1] = gVal; buf[idx + 2] = bVal; buf[idx + 3] = 255;
          }
        }
      }
    }
    return { buffer: buf, colorSet };
  }

  const preOrphans = countOrphans(preGridDmc);
  const { buffer: preBuf, colorSet: preColors } = renderGrid(preGridDmc, SCALE);
  await sharp(preBuf, {
    raw: { width: GRID_SIZE * SCALE, height: GRID_SIZE * SCALE, channels: 4 },
  }).png().toFile(path.join(OUT_DIR, "3-pre-despeckle-grid.png"));
  console.log(`Saved: 3-pre-despeckle-grid.png (${GRID_SIZE * SCALE}x${GRID_SIZE * SCALE}, ${preOrphans} orphans, ${preColors.size} colors)`);

  // ═══════════════ STAGE 3: Despeckle (same as patternConverter.ts) ═══════════════
  console.log("\n=== Stage 3: Final cleaned pattern (despeckle) ===");
  const cleanedDmc: string[][] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    const cleanedRow: string[] = [];
    for (let col = 0; col < GRID_SIZE; col++) {
      const myCode = preGridDmc[row][col];
      const neighborCounts = new Map<string, number>();
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr, nc = col + dc;
          if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
          const nCode = preGridDmc[nr][nc];
          neighborCounts.set(nCode, (neighborCounts.get(nCode) || 0) + 1);
        }
      }
      const sameCount = neighborCounts.get(myCode) || 0;
      if (sameCount < 2 && neighborCounts.size > 0) {
        let bestCode = myCode, bestCount = 0;
        for (const [code, count] of neighborCounts) {
          if (count > bestCount) { bestCount = count; bestCode = code; }
        }
        cleanedRow.push(bestCode);
      } else {
        cleanedRow.push(myCode);
      }
    }
    cleanedDmc.push(cleanedRow);
  }

  const finalOrphans = countOrphans(cleanedDmc);
  const { buffer: cleanBuf, colorSet: cleanColors } = renderGrid(cleanedDmc, SCALE);
  await sharp(cleanBuf, {
    raw: { width: GRID_SIZE * SCALE, height: GRID_SIZE * SCALE, channels: 4 },
  }).png().toFile(path.join(OUT_DIR, "4-final-cleaned-pattern.png"));
  console.log(`Saved: 4-final-cleaned-pattern.png (${GRID_SIZE * SCALE}x${GRID_SIZE * SCALE}, ${finalOrphans} orphans, ${cleanColors.size} colors)`);
  console.log(`Colors: ${[...cleanColors].sort().join(", ")}`);

  // Summary
  const summary = `Pipeline Visualization — "${PROMPT}"
Grid: ${GRID_SIZE}×${GRID_SIZE}  |  Max Colors: ${MAX_COLORS}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1-raw-image.png              ← 1024×1024 artwork from gpt-image-1
2-posterized.png             ← 200×200 posterized (${MAX_COLORS} colors)
3-pre-despeckle-grid.png     ← ${GRID_SIZE}×${GRID_SIZE} DMC grid (×${SCALE}), ${preOrphans} orphan cells
4-final-cleaned-pattern.png  ← ${GRID_SIZE}×${GRID_SIZE} after despeckle, ${finalOrphans} orphans, ${cleanColors.size} colors
`;
  fs.writeFileSync(path.join(OUT_DIR, "README.txt"), summary);
  console.log("\n✅ All artifacts in:", OUT_DIR);
  console.log(summary);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
