/**
 * Pattern Converter Tests — Validates image-to-stitch-grid conversion
 * including the content-cropping step.
 */

import sharp from "sharp";
import { imageBufferToStitchGrid } from "../domain/stitch/patternConverter";

/**
 * Create a synthetic PNG image with a colored subject on a solid background.
 * Subject is centered and occupies subjectFraction of each dimension.
 */
async function createSyntheticImage(
  width: number,
  height: number,
  bgColor: { r: number; g: number; b: number },
  subjectColor: { r: number; g: number; b: number },
  subjectFraction: number = 0.4,
): Promise<Buffer> {
  const subjectW = Math.round(width * subjectFraction);
  const subjectH = Math.round(height * subjectFraction);
  const offsetX = Math.round((width - subjectW) / 2);
  const offsetY = Math.round((height - subjectH) / 2);

  // Create background
  const bgBuffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: bgColor,
    },
  })
    .png()
    .toBuffer();

  // Create subject as a separate image
  const subjectBuffer = await sharp({
    create: {
      width: subjectW,
      height: subjectH,
      channels: 3,
      background: subjectColor,
    },
  })
    .png()
    .toBuffer();

  // Composite subject onto background
  return sharp(bgBuffer)
    .composite([{ input: subjectBuffer, top: offsetY, left: offsetX }])
    .png()
    .toBuffer();
}

describe("imageBufferToStitchGrid — content cropping", () => {
  it("crops large background areas so subject fills most of the grid", async () => {
    // Create a 400x400 white image with a 160x160 red square in center (40% fill)
    const img = await createSyntheticImage(
      400, 400,
      { r: 255, g: 255, b: 255 }, // white background
      { r: 255, g: 0, b: 0 },     // red subject
      0.4,
    );

    const result = await imageBufferToStitchGrid(img, 50, 24);

    // The subject should now fill most of the grid — at least 50% of cells
    // should be non-white (red ≈ christmas red DMC 321)
    const nonWhiteCount = result.grid.flat().filter(c => c.color !== "#ffffff").length;
    const totalCells = result.gridSize * result.gridSize;
    const fillFraction = nonWhiteCount / totalCells;

    // Without cropping, the subject would fill ~16% (0.4 × 0.4).
    // With cropping, it should fill >50%.
    expect(fillFraction).toBeGreaterThan(0.5);
    expect(result.gridSize).toBe(50);
    expect(result.stitchCount).toBe(2500);
  });

  it("handles images where the subject fills most of the frame (no cropping needed)", async () => {
    // Create a 400x400 white image with a 360x360 red square (90% fill)
    const img = await createSyntheticImage(
      400, 400,
      { r: 255, g: 255, b: 255 },
      { r: 255, g: 0, b: 0 },
      0.9,
    );

    const result = await imageBufferToStitchGrid(img, 50, 24);

    // Should still work — the cropToContent should return the original
    // because the content region is already >25% (it's 81%)
    expect(result.gridSize).toBe(50);
    expect(result.stitchCount).toBe(2500);
    // Should have non-white content
    const nonWhiteCount = result.grid.flat().filter(c => c.color !== "#ffffff").length;
    expect(nonWhiteCount).toBeGreaterThan(0);
  });

  it("handles very small images gracefully", async () => {
    // Create a tiny 32x32 image
    const img = await createSyntheticImage(
      32, 32,
      { r: 200, g: 200, b: 255 },
      { r: 255, g: 0, b: 0 },
      0.5,
    );

    const result = await imageBufferToStitchGrid(img, 50, 24);

    expect(result.gridSize).toBe(50);
    expect(result.stitchCount).toBe(2500);
  });

  it("produces valid DMC palette after cropping", async () => {
    const img = await createSyntheticImage(
      400, 400,
      { r: 255, g: 255, b: 255 },
      { r: 255, g: 0, b: 0 },
      0.3, // small subject — cropping will help
    );

    const result = await imageBufferToStitchGrid(img, 50, 24);

    // Should have at least one non-white DMC color
    const nonWhiteColors = result.dmcColors.filter(c => c.hex !== "#ffffff");
    expect(nonWhiteColors.length).toBeGreaterThanOrEqual(1);

    // Each dmcColor should have required fields
    for (const color of result.dmcColors) {
      expect(color.code).toBeTruthy();
      expect(color.name).toBeTruthy();
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(color.count).toBeGreaterThan(0);
    }
  });
});
