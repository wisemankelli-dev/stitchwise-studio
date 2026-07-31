import { generateSvgFromPrompt } from "./infrastructure/services/openaiSvgService";
import * as fs from "fs";
async function main() {
  console.error("Requesting...");
  const svg = await generateSvgFromPrompt("a sunflower with green leaves and stem");
  if (svg) {
    fs.writeFileSync("/home/team/shared/sunflower-output.svg", svg);
    console.log("OK", svg.length, "bytes");
    console.log(svg);
  } else {
    console.log("FAIL NULL");
  }
}
main().catch(e => console.error("ERR", e));
