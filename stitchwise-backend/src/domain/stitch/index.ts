/**
 * Stitch Domain — Barrel exports.
 *
 * Re-exports all stitch-related functionality from a single entry point.
 */

// Types
export {
  type StitchCell,
  type StitchGrid,
  type DmcUsage,
  type PatternResult,
  type GridSize,
  AVAILABLE_GRID_SIZES,
  DEFAULT_GRID_SIZE,
} from "./types";

// Grid utilities
export {
  createEmptyGrid,
  getGridDimensions,
  validateGrid,
  cloneGrid,
  flipGridHorizontal,
  flipGridVertical,
  rotateGrid90,
  rotateGrid180,
  rotateGrid270,
  getColorStats,
  isValidHexColor,
  isValidDmcCode,
} from "./stitchGrid";

// DMC colors
export {
  closestDmcColor,
  rgbToHex,
  DMC_COLORS,
} from "./dmcColors";
export type { DMCColor } from "./dmcColors";

// Pattern conversion
export {
  imageUrlToStitchGrid,
  imageBufferToStitchGrid,
  resizeStitchGrid,
} from "./patternConverter";

// Color reduction
export {
  quantizePixels,
  mapToDmcPalette,
  snapGridToDmc,
} from "./colorReducer";