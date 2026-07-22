// ─── Fabric Count Types ──────────────────────────────────────────────────────
// Fabric count = stitches per inch. Higher count = smaller stitches = more detail.
// Owner's directive: 11/14/16/18/20 are the primary counts.
// Color limits: larger mesh = more colors (up to 30 at 20ct).

/** Supported fabric counts with metadata. */
export interface FabricCountInfo {
  /** Human-readable name */
  name: string;
  /** Stitches per inch */
  stitchesPerInch: number;
  /** Recommended maximum number of distinct DMC colors for this fabric count */
  maxColors: number;
  /** Category for UI grouping */
  category: "beginner" | "standard" | "detail";
}

/** Primary supported fabric counts. Keyed by stitches-per-inch value. */
export const FABRIC_COUNTS: Record<number, FabricCountInfo> = {
  11: { name: "11-count Aida", stitchesPerInch: 11, maxColors: 10, category: "beginner" },
  14: { name: "14-count Aida", stitchesPerInch: 14, maxColors: 15, category: "standard" },
  16: { name: "16-count Aida", stitchesPerInch: 16, maxColors: 20, category: "standard" },
  18: { name: "18-count Aida", stitchesPerInch: 18, maxColors: 24, category: "detail" },
  20: { name: "20-count Aida", stitchesPerInch: 20, maxColors: 30, category: "detail" },
};

/** Sorted list of available fabric count values. */
export const AVAILABLE_FABRIC_COUNTS = Object.keys(FABRIC_COUNTS)
  .map(Number)
  .sort((a, b) => a - b);

/** Default fabric count (most common for beginners). */
export const DEFAULT_FABRIC_COUNT = 14;

// ─── Validation ──────────────────────────────────────────────────────────────

/** Check whether a fabric count is supported. */
export function isValidFabricCount(count: number): boolean {
  return count in FABRIC_COUNTS;
}

/** Get fabric count info, returning null for unsupported counts. */
export function getFabricCountInfo(count: number): FabricCountInfo | null {
  return FABRIC_COUNTS[count] ?? null;
}

// ─── Color Limits ────────────────────────────────────────────────────────────

/**
 * Get the recommended maximum number of DMC colors for a given fabric count.
 * Returns the exact owner-specified limit for supported counts.
 * Falls back to the highest known limit for unsupported counts.
 */
export function getMaxColors(fabricCount: number): number {
  const info = FABRIC_COUNTS[fabricCount];
  if (info) return info.maxColors;

  // For unsupported counts: use the highest known limit as a safe default
  return 30;
}

/**
 * Check whether a palette exceeds the recommended color limit for a fabric count.
 */
export function isPaletteWithinLimit(colorCount: number, fabricCount: number): boolean {
  return colorCount <= getMaxColors(fabricCount);
}

/**
 * Get all fabric counts that can support a given number of colors.
 * Returns sorted ascending.
 */
export function getCompatibleFabricCounts(colorCount: number): number[] {
  return AVAILABLE_FABRIC_COUNTS.filter(
    (count) => FABRIC_COUNTS[count].maxColors >= colorCount,
  );
}

// ─── Dimension Calculator ────────────────────────────────────────────────────

/** Physical dimensions of a pattern on a specific fabric count. */
export interface FabricDimensions {
  /** Width in inches */
  widthInches: number;
  /** Height in inches */
  heightInches: number;
  /** Width in centimeters */
  widthCm: number;
  /** Height in centimeters */
  heightCm: number;
  /** Total stitch count (gridWidth × gridHeight) */
  totalStitches: number;
  /** The fabric count used for calculation */
  fabricCount: number;
}

const INCHES_TO_CM = 2.54;

/**
 * Calculate the physical dimensions of a pattern on a given fabric count.
 */
export function calculateDimensions(
  gridWidth: number,
  gridHeight: number,
  fabricCount: number,
): FabricDimensions {
  const spi = fabricCount;
  const widthInches = gridWidth / spi;
  const heightInches = gridHeight / spi;

  return {
    widthInches: roundTo(widthInches, 2),
    heightInches: roundTo(heightInches, 2),
    widthCm: roundTo(widthInches * INCHES_TO_CM, 1),
    heightCm: roundTo(heightInches * INCHES_TO_CM, 1),
    totalStitches: gridWidth * gridHeight,
    fabricCount,
  };
}

/**
 * Calculate the maximum grid size that fits within given physical dimensions.
 */
export function gridSizeFromDimensions(
  widthInches: number,
  heightInches: number,
  fabricCount: number,
): { width: number; height: number } {
  return {
    width: Math.floor(widthInches * fabricCount),
    height: Math.floor(heightInches * fabricCount),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ─── Fabric Piece Calculator ─────────────────────────────────────────────────

/** The result of calculating how much fabric is needed for a pattern. */
export interface FabricPieceResult {
  /** Pattern width/height in inches (square grid) */
  patternInches: number;
  /** Total fabric width/height needed (pattern + margins on both sides) */
  fabricInches: number;
  /** Total stitch count across the fabric piece */
  fabricStitches: number;
  /** Margin used on each side (inches) */
  marginInches: number;
}

/** Default margin for framing/hooping/finishing (inches). */
export const DEFAULT_FABRIC_MARGIN = 3;

/**
 * Calculate recommended fabric piece size for a pattern.
 *
 * Standard practice: pattern size + 2-3″ margin on each side
 * for framing, hooping, and finishing.
 *
 * @param gridSize - The grid dimensions (square grid assumed)
 * @param fabricCount - Stitches per inch (11, 14, 16, 18, 20)
 * @param marginInches - Margin on each side (default 3″)
 */
export function calculateFabricPiece(
  gridSize: number,
  fabricCount: number,
  marginInches: number = DEFAULT_FABRIC_MARGIN,
): FabricPieceResult {
  const patternInches = roundTo(gridSize / fabricCount, 2);
  const fabricInches = roundTo(patternInches + 2 * marginInches, 2);
  const fabricStitches = Math.ceil(fabricInches * fabricCount);

  return {
    patternInches,
    fabricInches,
    fabricStitches,
    marginInches,
  };
}
