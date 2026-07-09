/**
 * Thread & Fabric Usage Estimation algorithms.
 *
 * Calculates physical material requirements for embroidery patterns:
 * - Thread length per DMC color based on stitch type and count
 * - Fabric dimensions based on grid size and fabric count
 */

import {
  StitchType,
  THREAD_LENGTH_CM,
  FABRIC_MARGIN_IN,
  FABRIC_MARGIN_CM,
  DEFAULT_FABRIC_COUNT,
  type ThreadEstimate,
  type FabricEstimate,
  type EstimateResult,
  type FabricCount,
  cmToInches,
  inchesToCm,
} from "./index";

// ─── DMC Color Reference (subset for estimation) ───────────────────────────

/**
 * Lookup table mapping DMC codes to color info for estimate output.
 * Used to enrich thread estimates with name and hex values.
 */
const DMC_LOOKUP: Record<string, { name: string; hex: string }> = {
  "DMC 321": { name: "Christmas Red", hex: "#c9262d" },
  "DMC 304": { name: "Red - Medium", hex: "#b72c31" },
  "DMC 309": { name: "Rose - Dark", hex: "#d7525f" },
  "DMC 3326": { name: "Rose - Light", hex: "#ec8d94" },
  "DMC 601": { name: "Cranberry", hex: "#c62a61" },
  "DMC 600": { name: "Cranberry - Very Dark", hex: "#9b1a47" },
  "DMC 946": { name: "Burnt Orange - Medium", hex: "#e27323" },
  "DMC 444": { name: "Lemon - Dark", hex: "#ffd100" },
  "DMC 700": { name: "Green - Dark", hex: "#0c6730" },
  "DMC 699": { name: "Green - Very Dark", hex: "#095228" },
  "DMC 336": { name: "Blue - Dark", hex: "#113b69" },
  "DMC 334": { name: "Blue - Medium", hex: "#2e609d" },
  "DMC 550": { name: "Violet - Very Dark", hex: "#591b57" },
  "DMC 310": { name: "Black", hex: "#000000" },
  "DMC 520": { name: "White", hex: "#ffffff" },
  "DMC 898": { name: "Coffee Brown - Very Dark", hex: "#3d2822" },
};

/**
 * Get DMC color info from code. Returns a fallback if not found.
 */
function getDmcInfo(code: string): { name: string; hex: string } {
  return DMC_LOOKUP[code] || { name: code, hex: "#888888" };
}

// ─── Thread Calculation ────────────────────────────────────────────────────

/**
 * Calculate thread length for a single stitch of a given type.
 *
 * @param stitchType - Type of stitch
 * @param stitchLengthCm - For satin stitch: length of the stitch in cm
 * @param areaWidthCm - For satin stitch: width of the satin area in cm
 * @returns Thread length in cm
 */
export function calculateStitchThreadCm(
  stitchType: StitchType,
  stitchLengthCm: number = 1,
  areaWidthCm: number = 1,
): number {
  switch (stitchType) {
    case StitchType.CROSS:
      return THREAD_LENGTH_CM[StitchType.CROSS];
    case StitchType.SATIN:
      // Satin stitch: stitch length × width of the satin area
      return stitchLengthCm * areaWidthCm;
    case StitchType.BACK:
      return THREAD_LENGTH_CM[StitchType.BACK];
    case StitchType.FRENCH_KNOT:
      return THREAD_LENGTH_CM[StitchType.FRENCH_KNOT];
    default:
      return THREAD_LENGTH_CM[StitchType.CROSS]; // Default to cross stitch
  }
}

/**
 * Calculate total thread usage for a pattern.
 *
 * @param stitches - Map of DMC code to stitch count
 * @param stitchTypes - Optional map of DMC code to stitch type string
 * @param satinAreas - Optional array of satin stitch areas
 * @returns Array of ThreadEstimate objects
 */
export function calculateThreadUsage(
  stitches: Record<string, number>,
  stitchTypes?: Record<string, string>,
  satinAreas?: Array<{ dmcCode: string; lengthCm: number; widthCm: number }>,
): { estimates: ThreadEstimate[]; totalMeters: number } {
  const estimates: ThreadEstimate[] = [];
  let totalMeters = 0;

  for (const [dmcCode, stitchCount] of Object.entries(stitches)) {
    if (stitchCount <= 0) continue;

    // Determine stitch type
    const stitchTypeStr = stitchTypes?.[dmcCode] || "cross";
    let stitchType: StitchType;
    let perStitchCm: number;

    switch (stitchTypeStr) {
      case "satin":
        stitchType = StitchType.SATIN;
        // For satin stitch, check if we have area info
        const area = satinAreas?.find((a) => a.dmcCode === dmcCode);
        perStitchCm = area
          ? calculateStitchThreadCm(StitchType.SATIN, area.lengthCm, area.widthCm)
          : calculateStitchThreadCm(StitchType.SATIN, 1, 1);
        break;
      case "back":
        stitchType = StitchType.BACK;
        perStitchCm = calculateStitchThreadCm(StitchType.BACK);
        break;
      case "french_knot":
        stitchType = StitchType.FRENCH_KNOT;
        perStitchCm = calculateStitchThreadCm(StitchType.FRENCH_KNOT);
        break;
      default:
        stitchType = StitchType.CROSS;
        perStitchCm = calculateStitchThreadCm(StitchType.CROSS);
    }

    const totalCm = perStitchCm * stitchCount;
    const meters = Math.round((totalCm / 100) * 100) / 100; // Convert cm to m, round to 2dp
    totalMeters += meters;

    const info = getDmcInfo(dmcCode);
    estimates.push({
      dmcCode,
      name: info.name,
      hex: info.hex,
      stitchCount,
      stitchType: stitchType,
      meters,
    });
  }

  // Sort by stitch count descending
  estimates.sort((a, b) => b.stitchCount - a.stitchCount);

  return {
    estimates,
    totalMeters: Math.round(totalMeters * 100) / 100,
  };
}

// ─── Fabric Calculation ────────────────────────────────────────────────────

/**
 * Calculate fabric dimensions from grid size and fabric count.
 *
 * Formula: dimensions = grid size / fabric count (stitches per inch)
 * Example: 32×32 grid at 14-count = 32/14 = 2.29" × 2.29"
 *
 * @param gridWidth - Grid width in stitches
 * @param gridHeight - Grid height in stitches
 * @param fabricCount - Fabric count (stitches per inch), default 14
 * @returns FabricEstimate object
 */
export function calculateFabricUsage(
  gridWidth: number,
  gridHeight: number,
  fabricCount: FabricCount = DEFAULT_FABRIC_COUNT,
): FabricEstimate {
  // Calculate dimensions
  const widthIn = Math.round((gridWidth / fabricCount) * 10) / 10;
  const heightIn = Math.round((gridHeight / fabricCount) * 10) / 10;
  const widthCm = inchesToCm(widthIn);
  const heightCm = inchesToCm(heightIn);

  // Recommended minimum with margins (rounded up to nearest quarter inch)
  const recommendedWidthIn = Math.ceil((widthIn + FABRIC_MARGIN_IN * 2) * 4) / 4;
  const recommendedHeightIn = Math.ceil((heightIn + FABRIC_MARGIN_IN * 2) * 4) / 4;
  const recommendedWidthCm = inchesToCm(recommendedWidthIn);
  const recommendedHeightCm = inchesToCm(recommendedHeightIn);

  return {
    widthIn,
    heightIn,
    widthCm,
    heightCm,
    recommendedWidthIn,
    recommendedHeightIn,
    recommendedWidthCm,
    recommendedHeightCm,
    fabricCount,
  };
}

// ─── Main Calculation ──────────────────────────────────────────────────────

/**
 * Calculate complete estimate (thread + fabric) from pattern data.
 *
 * @param stitches - Map of DMC code to stitch count
 * @param options - Additional options
 * @returns EstimateResult with thread and fabric estimates
 */
export function calculateEstimate(
  stitches: Record<string, number>,
  options: {
    stitchTypes?: Record<string, string>;
    gridWidth?: number;
    gridHeight?: number;
    fabricCount?: FabricCount;
    satinAreas?: Array<{ dmcCode: string; lengthCm: number; widthCm: number }>;
  } = {},
): EstimateResult {
  const {
    stitchTypes,
    gridWidth = 32,
    gridHeight = 32,
    fabricCount = DEFAULT_FABRIC_COUNT,
    satinAreas,
  } = options;

  const { estimates: threadEstimates, totalMeters: totalThreadMeters } =
    calculateThreadUsage(stitches, stitchTypes, satinAreas);

  const fabricEstimate = calculateFabricUsage(gridWidth, gridHeight, fabricCount);

  return {
    threadEstimates,
    totalThreadMeters,
    fabricEstimate,
  };
}