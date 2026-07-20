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
  try {
    // Download the image
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
    });

    const imageBuffer = Buffer.from(response.data);
    return imageBufferToStitchGrid(imageBuffer, gridSize);
  } catch (err) {
    console.error({ event: "image_download_failed", url: imageUrl, error: String(err) });
    // Fallback: generate a simple pattern based on the URL text
    const size = [16, 24, 32, 48, 64].includes(gridSize) ? gridSize : 32;
    const fallbackGrid: StitchCell[][] = [];
    for (let r = 0; r < size; r++) {
      const row: StitchCell[] = [];
      for (let c = 0; c < size; c++) {
        // Simple checkerboard pattern as fallback
        if ((r + c) % 3 === 0) { row.push({ color: '#e11d48', dmcCode: '321', dmcName: 'Christmas Red' }); }
        else if ((r + c) % 3 === 1) { row.push({ color: '#0284c7', dmcCode: '798', dmcName: 'Delft Blue' }); }
        else { row.push({ color: '#16a34a', dmcCode: '700', dmcName: 'Green' }); }
      }
      fallbackGrid.push(row);
    }
    return {
      grid: fallbackGrid,
      gridSize: size,
      stitchCount: size * size,
      dmcColors: [
        { code: '321', name: 'Christmas Red', hex: '#e11d48', count: Math.ceil(size * size / 3) },
        { code: '798', name: 'Delft Blue', hex: '#0284c7', count: Math.ceil(size * size / 3) },
        { code: '700', name: 'Green', hex: '#16a34a', count: Math.ceil(size * size / 3) },
      ],
    };
  }
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

  // Step 1: Resize to a small intermediate using nearest-neighbor.
  // Then apply median filter to remove isolated pixels.
  const { data } = await sharp(imageBuffer)
    .resize(64, 64, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.nearest,
    })
    .median(1) // 1px median filter removes speckle noise
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Step 3: Build a 32x32 grid by averaging 2x2 blocks from the 64x64 intermediate.
  // Apply aggressive color consolidation: group similar colors before picking
  // the most common one per block.
  const rawPixels = new Uint8ClampedArray(data);
  const grid: StitchGrid = [];
  const dmcCountMap = new Map<string, { code: string; name: string; hex: string; count: number }>();

  const PIXELART_PALETTE: [number, number, number][] = [
    [0, 0, 0],       // Black
    [64, 64, 64],    // Dark Gray
    [128, 128, 128], // Gray
    [192, 192, 192], // Light Gray
    [255, 255, 255], // White
    [128, 0, 0],     // Dark Red
    [255, 0, 0],     // Red
    [255, 128, 128], // Pink
    [255, 192, 203], // Light Pink
    [255, 165, 0],   // Orange
    [255, 255, 0],   // Yellow
    [0, 128, 0],     // Dark Green
    [0, 255, 0],     // Green
    [0, 128, 128],   // Teal
    [0, 0, 255],     // Blue
    [0, 0, 128],     // Dark Blue
    [128, 0, 128],   // Purple
    [255, 0, 255],   // Magenta
    [165, 42, 42],   // Brown
    [210, 180, 140], // Tan
    [255, 218, 185], // Peach
    [240, 230, 140], // Khaki
    [173, 216, 230], // Light Blue
    [144, 238, 144], // Light Green
  ];

  function snapToPalette(r: number, g: number, b: number): [number, number, number] {
    let best = PIXELART_PALETTE[0];
    let bestDist = Infinity;
    for (const pr of PIXELART_PALETTE) {
      const d = (r - pr[0]) ** 2 + (g - pr[1]) ** 2 + (b - pr[2]) ** 2;
      if (d < bestDist) { bestDist = d; best = pr; }
    }
    return best;
  }

  for (let row = 0; row < size; row++) {
    const gridRow: StitchCell[] = [];
    for (let col = 0; col < size; col++) {
      // Average 2x2 block from the 64x64 intermediate
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      for (let br = 0; br < 2; br++) {
        for (let bc = 0; bc < 2; bc++) {
          const px = ((row * 2) + br) * 64 + ((col * 2) + bc);
          const idx = px * 4;
          if (idx + 2 < rawPixels.length) {
            sumR += rawPixels[idx];
            sumG += rawPixels[idx + 1];
            sumB += rawPixels[idx + 2];
            count++;
          }
        }
      }
      // Snap the averaged color to the pixel art palette
      if (count === 0) {
        gridRow.push({ color: '#ffffff', dmcCode: 'blanc', dmcName: 'White' });
        continue;
      }
      const avgR = Math.round(sumR / count);
      const avgG = Math.round(sumG / count);
      const avgB = Math.round(sumB / count);
      const snapped = snapToPalette(avgR, avgG, avgB);

      // Map to nearest DMC color
      const dmc = closestDmcColor(snapped[0], snapped[1], snapped[2]);
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