/**
 * Pattern Converter — Converts images to embroidery stitch grids.
 *
 * Core pipeline:
 * 1. Download/load image from URL or buffer
 * 2. Resize to target grid dimensions (gridSize x gridSize pixels)
 * 3. Quantize colors to nearest DMC thread colors
 * 4. Build StitchGrid and count DMC usage
 */

import sharp from "sharp";
import axios from "axios";
import type { StitchGrid, StitchCell, PatternResult, DmcUsage } from "../ai/embroideryAI";
import { closestDmcColor, rgbToHex, DMC_COLORS } from "./dmcColors";

/**
 * Convert an image URL to a stitch grid by:
 * 1. Downloading the image
 * 2. Resizing to gridSize x gridSize pixels
 * 3. Quantizing each pixel to the nearest DMC thread color
 *
 * @param imageUrl - URL of the image to convert
 * @param gridSize - Output grid dimensions (16, 24, 32, 48, 64)
 * @returns PatternResult with grid, stitch count, and DMC usage
 */
export async function imageUrlToStitchGrid(
  imageUrl: string,
  gridSize: number = 32,
): Promise<PatternResult> {
  // Download the image
  const response = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    timeout: 30000,
  });

  const imageBuffer = Buffer.from(response.data);
  return imageBufferToStitchGrid(imageBuffer, gridSize);
}

/**
 * Convert an image buffer to a stitch grid.
 *
 * @param imageBuffer - Raw image data
 * @param gridSize - Output grid dimensions
 * @returns PatternResult
 */
export async function imageBufferToStitchGrid(
  imageBuffer: Buffer,
  gridSize: number = 32,
): Promise<PatternResult> {
  // Validate grid size
  const validSizes = [16, 24, 32, 48, 64];
  const size = validSizes.includes(gridSize) ? gridSize : 32;

  // Resize image using sharp (pixel art resize — nearest neighbor)
  const { data, info } = await sharp(imageBuffer)
    .resize(size, size, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.nearest, // Nearest neighbor for pixel art look
    })
    .raw() // Raw pixel data
    .toBuffer({ resolveWithObject: true });

  // Convert raw RGBA pixels to stitch grid
  const pixels = new Uint8ClampedArray(data);
  const grid: StitchGrid = [];
  const dmcCountMap = new Map<string, { code: string; name: string; hex: string; count: number }>();

  for (let row = 0; row < size; row++) {
    const gridRow: StitchCell[] = [];
    for (let col = 0; col < size; col++) {
      const idx = (row * size + col) * 4; // RGBA — skip alpha
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      // Find closest DMC color
      const dmc = closestDmcColor(r, g, b);
      const hex = rgbToHex(dmc.rgb[0], dmc.rgb[1], dmc.rgb[2]);

      gridRow.push({
        color: hex,
        dmcCode: dmc.code,
        dmcName: dmc.name,
      });

      // Track DMC usage
      const key = dmc.code;
      if (dmcCountMap.has(key)) {
        dmcCountMap.get(key)!.count++;
      } else {
        dmcCountMap.set(key, {
          code: dmc.code,
          name: dmc.name,
          hex,
          count: 1,
        });
      }
    }
    grid.push(gridRow);
  }

  // Build DMC usage array sorted by count (descending)
  const dmcColors: DmcUsage[] = Array.from(dmcCountMap.values()).sort(
    (a, b) => b.count - a.count,
  );

  return {
    grid,
    gridSize: size,
    stitchCount: size * size,
    dmcColors,
  };
}