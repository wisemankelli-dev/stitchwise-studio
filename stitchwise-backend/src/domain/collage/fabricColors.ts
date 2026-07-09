/**
 * Fabric Color Reference for collage quilting color matching and quantization.
 *
 * 15 fabric colors matching the frontend's FABRIC_COLORS palette.
 * Used for color quantization of AI-generated collage images.
 */
import { hexToRgb } from "../stitch/dmcColors";

export interface FabricColor {
  /** Hex color string (e.g. "#f9a8d4") */
  hex: string;
  /** Common name for the color */
  name: string;
  /** RGB color values (0-255) */
  rgb: [number, number, number];
}

/**
 * Canonical fabric color palette for collage quilting.
 * Matches the frontend's FABRIC_COLORS in CollageStudio.tsx.
 */
export const FABRIC_COLORS: FabricColor[] = [
  { hex: "#ffffff", name: "White", rgb: [255, 255, 255] },
  { hex: "#fce7f3", name: "Petal Pink", rgb: [252, 231, 243] },
  { hex: "#fbcfe8", name: "Blush Pink", rgb: [251, 207, 232] },
  { hex: "#f9a8d4", name: "Rose Pink", rgb: [249, 168, 212] },
  { hex: "#f472b6", name: "Vibrant Pink", rgb: [244, 114, 182] },
  { hex: "#ec4899", name: "Hot Pink", rgb: [236, 72, 153] },
  { hex: "#db2777", name: "Deep Pink", rgb: [219, 39, 119] },
  { hex: "#86efac", name: "Mint Green", rgb: [134, 239, 172] },
  { hex: "#fef3c7", name: "Cream", rgb: [254, 243, 199] },
  { hex: "#bfdbfe", name: "Sky Blue", rgb: [191, 219, 254] },
  { hex: "#c4b5fd", name: "Lavender", rgb: [196, 181, 253] },
  { hex: "#fca5a5", name: "Coral", rgb: [252, 165, 165] },
  { hex: "#d9f99d", name: "Lime", rgb: [217, 249, 157] },
  { hex: "#fed7aa", name: "Peach", rgb: [254, 215, 170] },
  { hex: "#e2e8f0", name: "Silver Gray", rgb: [226, 232, 240] },
];

/**
 * Pre-computed cache for fast color matching.
 */
let fabricCache: Array<FabricColor & { r2: number; g2: number; b2: number }> | null = null;

function buildFabricCache(): void {
  fabricCache = FABRIC_COLORS.map((c) => ({
    ...c,
    r2: c.rgb[0] * c.rgb[0],
    g2: c.rgb[1] * c.rgb[1],
    b2: c.rgb[2] * c.rgb[2],
  }));
}

/**
 * Find the closest fabric color to a given RGB value using Euclidean distance.
 * Returns the fabric color entry with distance score.
 */
export function closestFabricColor(r: number, g: number, b: number): FabricColor & { distance: number } {
  if (!fabricCache) buildFabricCache();

  let best = fabricCache![0];
  let bestDist = Infinity;

  for (const entry of fabricCache!) {
    const dr = r - entry.rgb[0];
    const dg = g - entry.rgb[1];
    const db = b - entry.rgb[2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }

  return {
    hex: best.hex,
    name: best.name,
    rgb: [...best.rgb] as [number, number, number],
    distance: Math.round(Math.sqrt(bestDist) * 10) / 10,
  };
}

/**
 * Find the closest fabric color to a given hex color.
 */
export function closestFabricColorFromHex(hex: string): FabricColor & { distance: number } {
  const [r, g, b] = hexToRgb(hex);
  return closestFabricColor(r, g, b);
}