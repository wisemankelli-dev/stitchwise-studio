/**
 * Color Reducer Engine — Dynamic color quantization for embroidery patterns.
 *
 * Owner directive: "Reduce to a MINIMUM number of colors, not a maximum.
 * Most embroidery patterns use no more than 15 colors."
 *
 * Strategy:
 *   1. Extract all unique colors from the image
 *   2. Group near-identical colors (handles photo noise/compression artifacts)
 *   3. Take the most-frequent groups, keeping as many distinct colors as practical
 *   4. Map each group's centroid to the nearest DMC thread
 *
 * This preserves distinct colors rather than forcing them into arbitrary buckets.
 */

import { closestDmcColor, rgbToHex } from "./dmcColors";
import type { StitchCell } from "../ai/embroideryAI";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

interface ColorGroup {
  centroid: RGBColor;
  members: Array<{ color: RGBColor; count: number }>;
  totalCount: number;
}

// ─── Merging Threshold ──────────────────────────────────────────────────────

/**
 * Euclidean distance threshold for merging colors.
 * Two colors within this distance are considered "the same color"
 * in embroidery terms. This accounts for:
 *   - Phone camera noise (typically ±5-10 per channel)
 *   - JPEG compression artifacts
 *   - Slight lighting variations
 *
 * A distance of ~30 in RGB space means roughly ±10 per channel.
 * This is conservative — it won't merge genuinely different colors.
 */
const MERGE_THRESHOLD = 30; // Euclidean distance in RGB space
const PRACTICAL_MAX_COLORS = 15; // Embroidery-viable limit

// ─── Color Distance ─────────────────────────────────────────────────────────

function colorDistance(a: RGBColor, b: RGBColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function averageColor(colors: RGBColor[]): RGBColor {
  if (colors.length === 0) return { r: 0, g: 0, b: 0 };
  let sumR = 0, sumG = 0, sumB = 0;
  for (const c of colors) {
    sumR += c.r;
    sumG += c.g;
    sumB += c.b;
  }
  const n = colors.length;
  return {
    r: Math.round(sumR / n),
    g: Math.round(sumG / n),
    b: Math.round(sumB / n),
  };
}

// ─── Main Quantization ──────────────────────────────────────────────────────

/**
 * Reduce pixel data to a minimal set of distinct colors.
 *
 * Algorithm:
 *   1. Count unique colors (ignoring alpha)
 *   2. Sort by frequency (most common first)
 *   3. Build groups: for each color (in frequency order), if it's far enough
 *      from all existing group centroids, start a new group; otherwise
 *      merge into the closest group
 *   4. Cap at PRACTICAL_MAX_COLORS groups if needed
 *   5. Return group centroids
 *
 * @param pixels - Raw RGBA pixel buffer (Uint8ClampedArray)
 * @param _targetColors - Ignored (kept for API compatibility); we auto-determine
 * @returns Array of quantized colors as RGB tuples
 */
export function quantizePixels(
  pixels: Uint8ClampedArray,
  _targetColors: number,
): RGBColor[] {
  // ── Step 1: Count unique colors ──────────────────────────────────────────
  const colorCounts = new Map<string, { color: RGBColor; count: number }>();

  for (let i = 0; i < pixels.length; i += 4) {
    // Skip transparent/near-transparent pixels
    if (pixels[i + 3] < 128) continue;

    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = `${r},${g},${b}`;

    const existing = colorCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorCounts.set(key, { color: { r, g, b }, count: 1 });
    }
  }

  if (colorCounts.size === 0) {
    return [{ r: 255, g: 255, b: 255 }]; // fallback: white
  }

  // ── Step 2: Sort by frequency (most common first) ────────────────────────
  const sorted = Array.from(colorCounts.values()).sort(
    (a, b) => b.count - a.count,
  );

  // ── Step 3: Build color groups ───────────────────────────────────────────
  const groups: ColorGroup[] = [];

  for (const entry of sorted) {
    // Find the closest existing group
    let bestGroupIdx = -1;
    let bestDist = Infinity;

    for (let i = 0; i < groups.length; i++) {
      const d = colorDistance(entry.color, groups[i].centroid);
      if (d < bestDist) {
        bestDist = d;
        bestGroupIdx = i;
      }
    }

    if (bestDist <= MERGE_THRESHOLD && bestGroupIdx >= 0) {
      // Merge into existing group
      const group = groups[bestGroupIdx];
      group.members.push({ color: entry.color, count: entry.count });
      group.totalCount += entry.count;
      // Recompute centroid (weighted average)
      const allColors: RGBColor[] = [];
      for (const m of group.members) {
        for (let j = 0; j < m.count; j++) {
          allColors.push(m.color);
        }
      }
      group.centroid = averageColor(allColors);
    } else {
      // Start a new group
      groups.push({
        centroid: { ...entry.color },
        members: [{ color: entry.color, count: entry.count }],
        totalCount: entry.count,
      });
    }
  }

  // ── Step 4: Cap at PRACTICAL_MAX_COLORS ──────────────────────────────────
  // If we somehow have more than the embroidery-viable limit,
  // keep only the most frequent groups
  let finalGroups = groups;
  if (finalGroups.length > PRACTICAL_MAX_COLORS) {
    finalGroups = groups
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, PRACTICAL_MAX_COLORS);
  }

  // ── Step 5: Return centroids ─────────────────────────────────────────────
  return finalGroups.map(g => g.centroid);
}

// ─── DMC Mapping ────────────────────────────────────────────────────────────

/**
 * Map quantized colors to DMC thread colors, deduplicating any that
 * map to the same DMC code. Returns the final palette.
 */
export function mapToDmcPalette(quantizedColors: RGBColor[]): Array<{
  code: string;
  name: string;
  hex: string;
  count: number;
}> {
  const dmcMap = new Map<
    string,
    { code: string; name: string; hex: string; count: number }
  >();

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
 */
export function snapGridToDmc(
  grid: StitchCell[][],
  paletteColors: RGBColor[],
): StitchCell[][] {
  return grid.map(row =>
    row.map(cell => {
      // Parse the hex color
      const hex = cell.color.replace("#", "");
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
    }),
  );
}
