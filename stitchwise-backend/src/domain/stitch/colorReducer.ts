/**
 * Color Reducer Engine — Dynamic color quantization for embroidery patterns.
 *
 * Reduces an image to a target number of colors using median-cut quantization,
 * then maps each reduced color to the nearest DMC thread color. Deduplicates
 * colors that map to the same DMC thread.
 *
 * Owner directive: "Create clean artwork first, then convert to pixel grid."
 * This replaces the hardcoded 24-color palette with a dynamic per-image reducer.
 */

import { closestDmcColor, rgbToHex } from "./dmcColors";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

interface ColorBox {
  /** Index range into the sorted pixel array */
  start: number;
  end: number;
  /** Which channel this box was split on */
  channel: number;
  /** Average color of this box */
  average: RGBColor;
}

// ─── Median-Cut Quantization ────────────────────────────────────────────────

/**
 * Perform median-cut color quantization on a set of RGBA pixel data.
 *
 * @param pixels - Raw RGBA pixel buffer (Uint8ClampedArray)
 * @param targetColors - Desired number of colors (15–80)
 * @returns Array of quantized colors as RGB tuples
 */
export function quantizePixels(
  pixels: Uint8ClampedArray,
  targetColors: number,
): RGBColor[] {
  // Clamp target colors to valid range
  const numColors = Math.max(15, Math.min(80, targetColors));

  // Build list of unique pixel colors (ignoring alpha)
  const colorMap = new Map<string, { color: RGBColor; count: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    // Skip fully transparent pixels
    if (pixels[i + 3] < 128) continue;
    const key = `${r},${g},${b}`;
    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorMap.set(key, { color: { r, g, b }, count: 1 });
    }
  }

  // If there are fewer unique colors than requested, return them all
  if (colorMap.size <= numColors) {
    return Array.from(colorMap.values()).map(c => c.color);
  }

  // Convert to array of weighted colors (weighted by frequency)
  const weightedColors: Array<{ color: RGBColor; weight: number }> = [];
  for (const [, entry] of colorMap) {
    weightedColors.push({ color: entry.color, weight: entry.count });
  }

  // Sort by brightness for initial split
  weightedColors.sort((a, b) => {
    const lumA = a.color.r * 0.299 + a.color.g * 0.587 + a.color.b * 0.114;
    const lumB = b.color.r * 0.299 + b.color.g * 0.587 + b.color.b * 0.114;
    return lumA - lumB;
  });

  // Build boxes — start with one box containing all colors
  const boxes: ColorBox[] = [];
  const initialAvg = averageColors(weightedColors.map(w => w.color));
  boxes.push({
    start: 0,
    end: weightedColors.length - 1,
    channel: 0,
    average: initialAvg,
  });

  // Recursively split boxes until we have enough
  while (boxes.length < numColors) {
    // Find the box with the largest range to split
    let largestRange = -1;
    let boxToSplit = -1;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      const range = colorRange(weightedColors, box.start, box.end);
      if (range > largestRange) {
        largestRange = range;
        boxToSplit = i;
      }
    }

    if (boxToSplit === -1) break; // Can't split further

    const box = boxes[boxToSplit];
    const boxColors = weightedColors.slice(box.start, box.end + 1);

    // Find the channel with the widest spread
    const spread = channelSpread(boxColors.map(w => w.color));
    const channel = spread.indexOf(Math.max(...spread));

    // Sort by the chosen channel
    boxColors.sort((a, b) => {
      const av = channelValue(a.color, channel);
      const bv = channelValue(b.color, channel);
      return av - bv;
    });

    // Find the median split point (weighted by pixel count)
    const totalWeight = boxColors.reduce((sum, c) => sum + c.weight, 0);
    let weightSoFar = 0;
    let medianIdx = 0;
    for (let i = 0; i < boxColors.length; i++) {
      weightSoFar += boxColors[i].weight;
      if (weightSoFar >= totalWeight / 2) {
        medianIdx = i;
        break;
      }
    }

    // Ensure split creates two non-empty boxes
    if (medianIdx === 0 || medianIdx >= boxColors.length - 1) break;

    // Split the box
    const leftColors = boxColors.slice(0, medianIdx + 1);
    const rightColors = boxColors.slice(medianIdx + 1);

    // Replace the original box with two new ones
    boxes.splice(boxToSplit, 1);

    // Rebuild the full weightedColors array order for the new boxes
    // This is simplified: we just compute averages from the split colors
    boxes.push({
      start: 0,
      end: 0,
      channel,
      average: averageColors(leftColors.map(w => w.color)),
    });
    boxes.push({
      start: 0,
      end: 0,
      channel,
      average: averageColors(rightColors.map(w => w.color)),
    });
  }

  // Return the average color of each box
  return boxes.map(b => b.average);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function averageColors(colors: RGBColor[]): RGBColor {
  if (colors.length === 0) return { r: 0, g: 0, b: 0 };
  let sumR = 0, sumG = 0, sumB = 0;
  for (const c of colors) {
    sumR += c.r;
    sumG += c.g;
    sumB += c.b;
  }
  const n = colors.length;
  return { r: Math.round(sumR / n), g: Math.round(sumG / n), b: Math.round(sumB / n) };
}

function channelValue(c: RGBColor, channel: number): number {
  if (channel === 0) return c.r;
  if (channel === 1) return c.g;
  return c.b;
}

function channelSpread(colors: RGBColor[]): [number, number, number] {
  let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
  for (const c of colors) {
    if (c.r < minR) minR = c.r;
    if (c.r > maxR) maxR = c.r;
    if (c.g < minG) minG = c.g;
    if (c.g > maxG) maxG = c.g;
    if (c.b < minB) minB = c.b;
    if (c.b > maxB) maxB = c.b;
  }
  return [maxR - minR, maxG - minG, maxB - minB];
}

function colorRange(
  colors: Array<{ color: RGBColor; weight: number }>,
  start: number,
  end: number,
): number {
  const slice = colors.slice(start, end + 1).map(w => w.color);
  const spread = channelSpread(slice);
  return Math.max(...spread);
}

// ─── DMC Mapping ────────────────────────────────────────────────────────────

/**
 * Map quantized colors to DMC thread colors, deduplicating any that
 * map to the same DMC code. Returns the final palette.
 *
 * @param quantizedColors - Array of colors from quantizePixels
 * @returns Array of unique DmcUsage entries
 */
export function mapToDmcPalette(quantizedColors: RGBColor[]): Array<{
  code: string;
  name: string;
  hex: string;
  count: number;
}> {
  const dmcMap = new Map<string, { code: string; name: string; hex: string; count: number }>();

  for (const color of quantizedColors) {
    const dmc = closestDmcColor(color.r, color.g, color.b);
    const hex = rgbToHex(dmc.rgb[0], dmc.rgb[1], dmc.rgb[2]);

    const existing = dmcMap.get(dmc.code);
    if (existing) {
      existing.count++;
    } else {
      dmcMap.set(dmc.code, {
        code: dmc.code,
        name: dmc.name,
        hex,
        count: 1,
      });
    }
  }

  return Array.from(dmcMap.values()).sort((a, b) => b.count - a.count);
}

/**
 * Replace each pixel in a grid with the nearest DMC color from the given palette.
 * This is the final step: after quantization, snap each pixel to the nearest DMC.
 *
 * @param grid - The stitch grid (StitchCell[][])
 * @param paletteColors - The quantized palette colors before DMC mapping
 * @returns Updated grid with DMC-mapped colors
 */
export function snapGridToDmc(
  grid: StitchCell[][],
  paletteColors: RGBColor[],
): StitchCell[][] {
  return grid.map(row =>
    row.map(cell => {
      // Parse the hex color
      const hex = cell.color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      // Find the nearest quantized palette color
      let bestDist = Infinity;
      let bestColor = paletteColors[0];
      for (const pc of paletteColors) {
        const d = (r - pc.r) ** 2 + (g - pc.g) ** 2 + (b - pc.b) ** 2;
        if (d < bestDist) {
          bestDist = d;
          bestColor = pc;
        }
      }

      // Map to DMC
      const dmc = closestDmcColor(bestColor.r, bestColor.g, bestColor.b);
      const dmcHex = rgbToHex(dmc.rgb[0], dmc.rgb[1], dmc.rgb[2]);

      return {
        color: dmcHex,
        dmcCode: dmc.code,
        dmcName: dmc.name,
      };
    })
  );
}