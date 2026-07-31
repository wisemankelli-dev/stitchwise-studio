import { svgToStitchGrid } from "./infrastructure/services/openaiService";
import * as fs from "fs";

const svg = fs.readFileSync("/tmp/proper-bird.svg", "utf-8");

async function main() {
  const result = await svgToStitchGrid(svg, 100, "hand-crafted bluebird");
  console.log("Grid:", result.gridSize, "x", result.gridSize);
  console.log("Colors:", result.dmcColors.length);
  for (const c of result.dmcColors) {
    console.log(`  ${c.code} ${c.name}: ${c.count} (${c.hex})`);
  }
  let nonWhite = 0, total = result.gridSize ** 2;
  for (const row of result.grid) {
    for (const cell of row) {
      if (cell !== "DMC 520") nonWhite++;
    }
  }
  console.log(`Non-white: ${nonWhite}/${total} (${(nonWhite/total*100).toFixed(1)}%)`);
}
main().catch(e => console.error(e));
