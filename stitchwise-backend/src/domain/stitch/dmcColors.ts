/**
 * DMC Color Reference for thread color matching and quantization.
 *
 * ~80 common DMC colors with RGB values, suitable for color quantization
 * of AI-generated embroidery patterns. Sourced from industry-standard DMC
 * thread color charts.
 */

export interface DMCColor {
  /** DMC product code, e.g. "DMC 321" */
  code: string;
  /** Common name for the color */
  name: string;
  /** RGB color values (0-255) */
  rgb: [number, number, number];
}

/**
 * Canonical DMC color palette for embroidery pattern quantization.
 * Organized by color family for maintainability.
 */
export const DMC_COLORS: DMCColor[] = [
  // ─── Reds ─────────────────────────────────────────────────────────────
  { code: "DMC 321", name: "Christmas Red", rgb: [201, 38, 45] },
  { code: "DMC 304", name: "Red - Medium", rgb: [183, 44, 49] },
  { code: "DMC 309", name: "Rose - Dark", rgb: [215, 82, 95] },
  { code: "DMC 3326", name: "Rose - Light", rgb: [236, 141, 148] },
  { code: "DMC 3713", name: "Salmon - Very Light", rgb: [249, 206, 196] },

  // ─── Pinks ────────────────────────────────────────────────────────────
  { code: "DMC 601", name: "Cranberry", rgb: [198, 42, 97] },
  { code: "DMC 600", name: "Cranberry - Very Dark", rgb: [155, 26, 71] },
  { code: "DMC 603", name: "Cranberry - Light", rgb: [243, 155, 177] },
  { code: "DMC 604", name: "Cranberry - Very Light", rgb: [250, 199, 210] },

  // ─── Oranges ──────────────────────────────────────────────────────────
  { code: "DMC 946", name: "Burnt Orange - Medium", rgb: [226, 115, 35] },
  { code: "DMC 900", name: "Burnt Orange - Dark", rgb: [191, 88, 22] },
  { code: "DMC 947", name: "Burnt Orange", rgb: [243, 147, 43] },
  { code: "DMC 741", name: "Tangerine - Medium", rgb: [255, 167, 42] },
  { code: "DMC 742", name: "Tangerine - Light", rgb: [255, 201, 103] },
  { code: "DMC 743", name: "Yellow - Pale", rgb: [255, 220, 152] },

  // ─── Yellows ──────────────────────────────────────────────────────────
  { code: "DMC 444", name: "Lemon - Dark", rgb: [255, 209, 0] },
  { code: "DMC 307", name: "Lemon", rgb: [255, 220, 40] },
  { code: "DMC 445", name: "Lemon - Light", rgb: [255, 240, 120] },
  { code: "DMC 725", name: "Topaz", rgb: [255, 191, 0] },
  { code: "DMC 726", name: "Topaz - Light", rgb: [255, 210, 60] },

  // ─── Greens ───────────────────────────────────────────────────────────
  { code: "DMC 699", name: "Green - Very Dark", rgb: [9, 82, 40] },
  { code: "DMC 700", name: "Green - Dark", rgb: [12, 103, 48] },
  { code: "DMC 701", name: "Green - Light", rgb: [75, 137, 72] },
  { code: "DMC 702", name: "Green - Bright", rgb: [113, 175, 87] },
  { code: "DMC 703", name: "Green - Pale", rgb: [155, 198, 115] },
  { code: "DMC 704", name: "Chartreuse - Bright", rgb: [220, 234, 148] },
  { code: "DMC 989", name: "Forest Green", rgb: [39, 102, 50] },

  // ─── Blues ────────────────────────────────────────────────────────────
  { code: "DMC 336", name: "Blue - Dark", rgb: [17, 59, 105] },
  { code: "DMC 334", name: "Blue - Medium", rgb: [46, 96, 157] },
  { code: "DMC 332", name: "Blue - Light", rgb: [108, 149, 196] },
  { code: "DMC 3750", name: "Antique Blue - Very Dark", rgb: [37, 66, 103] },
  { code: "DMC 3753", name: "Antique Blue - Ultraviolet", rgb: [174, 191, 213] },
  { code: "DMC 519", name: "Sky Blue", rgb: [133, 170, 196] },
  { code: "DMC 747", name: "Peacock Blue - Light", rgb: [197, 223, 231] },

  // ─── Purples ──────────────────────────────────────────────────────────
  { code: "DMC 550", name: "Violet - Very Dark", rgb: [89, 27, 87] },
  { code: "DMC 552", name: "Violet - Medium", rgb: [143, 80, 134] },
  { code: "DMC 553", name: "Violet - Light", rgb: [182, 120, 168] },
  { code: "DMC 554", name: "Violet - Very Light", rgb: [220, 176, 207] },

  // ─── Browns ───────────────────────────────────────────────────────────
  { code: "DMC 898", name: "Coffee Brown - Very Dark", rgb: [61, 40, 34] },
  { code: "DMC 801", name: "Coffee Brown - Dark", rgb: [93, 60, 46] },
  { code: "DMC 839", name: "Beige Brown - Dark", rgb: [88, 68, 54] },
  { code: "DMC 840", name: "Beige Brown - Medium", rgb: [138, 108, 84] },
  { code: "DMC 841", name: "Beige Brown - Light", rgb: [180, 154, 128] },
  { code: "DMC 842", name: "Beige Brown - Very Light", rgb: [214, 195, 173] },

  // ─── Grays & Neutrals ─────────────────────────────────────────────────
  { code: "DMC 310", name: "Black", rgb: [0, 0, 0] },
  { code: "DMC 317", name: "Gray - Dark", rgb: [89, 88, 88] },
  { code: "DMC 318", name: "Gray - Light", rgb: [178, 178, 178] },
  { code: "DMC 415", name: "Pearl Gray - Light", rgb: [214, 214, 214] },
  { code: "DMC 762", name: "Pearl Gray - Very Light", rgb: [234, 234, 234] },
  { code: "DMC 520", name: "White", rgb: [255, 255, 255] },

  // ─── Pastels & Specialty ──────────────────────────────────────────────
  { code: "DMC 818", name: "Baby Pink", rgb: [255, 218, 223] },
  { code: "DMC 819", name: "Baby Pink - Light", rgb: [255, 235, 238] },
  { code: "DMC 827", name: "Blue - Very Light", rgb: [204, 219, 232] },
  { code: "DMC 928", name: "Blue-Gray - Light", rgb: [170, 185, 198] },
  { code: "DMC 963", name: "Dusty Rose - Very Light", rgb: [243, 211, 211] },
  { code: "DMC 3712", name: "Salmon - Medium", rgb: [228, 171, 163] },
  { code: "DMC 3721", name: "Shell Pink - Dark", rgb: [194, 109, 107] },
  { code: "DMC 3740", name: "Antique Violet - Dark", rgb: [113, 83, 104] },
  { code: "DMC 3743", name: "Antique Violet - Very Light", rgb: [210, 196, 197] },
  { code: "DMC 3761", name: "Sky Blue - Light", rgb: [181, 204, 219] },
  { code: "DMC 3766", name: "Peacock Blue - Light", rgb: [155, 192, 195] },
  { code: "DMC 3768", name: "Gray Green - Dark", rgb: [82, 96, 85] },
  { code: "DMC 3770", name: "Flesh - Light", rgb: [238, 210, 195] },
  { code: "DMC 3778", name: "Terracotta - Light", rgb: [210, 120, 90] },
  { code: "DMC 3781", name: "Mocha Brown - Dark", rgb: [112, 80, 60] },
  { code: "DMC 3782", name: "Mocha Brown - Light", rgb: [167, 145, 124] },
  { code: "DMC 3799", name: "Pewter Gray - Very Dark", rgb: [60, 60, 60] },
  { code: "DMC 3801", name: "Melon - Dark", rgb: [219, 100, 100] },
  { code: "DMC 3820", name: "Straw - Dark", rgb: [210, 181, 98] },
  { code: "DMC 3821", name: "Straw", rgb: [224, 198, 118] },
  { code: "DMC 3822", name: "Straw - Light", rgb: [235, 214, 147] },
  { code: "DMC 3823", name: "Yellow - Pale", rgb: [245, 230, 180] },
];

/**
 * Pre-computed cache for fast color matching.
 */
let dmcCache: Array<DMCColor & { r2: number; g2: number; b2: number }> | null = null;

function buildDmcCache(): void {
  dmcCache = DMC_COLORS.map((c) => ({
    ...c,
    r2: c.rgb[0] * c.rgb[0],
    g2: c.rgb[1] * c.rgb[1],
    b2: c.rgb[2] * c.rgb[2],
  }));
}

/**
 * Find the closest DMC color to a given RGB value using Euclidean distance.
 * Returns the DMC color entry with distance score.
 */
export function closestDmcColor(r: number, g: number, b: number): DMCColor & { distance: number } {
  if (!dmcCache) buildDmcCache();

  let best = dmcCache![0];
  let bestDist = Infinity;

  for (const entry of dmcCache!) {
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
    code: best.code,
    name: best.name,
    rgb: [...best.rgb] as [number, number, number],
    distance: Math.round(Math.sqrt(bestDist) * 10) / 10,
  };
}

/**
 * Convert RGB to hex color string.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert hex color string to RGB tuple.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const match = hex.replace("#", "").match(/^([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i);
  if (!match) return [128, 128, 128];
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}