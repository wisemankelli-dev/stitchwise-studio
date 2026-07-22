// ─── Stitch Grid Types ───────────────────────────────────────────────────────
// Canonical types for embroidery pattern grid representation.
// Each pixel maps directly to one stitch.

/** Available grid sizes for embroidery patterns. */
export const AVAILABLE_GRID_SIZES = [50, 75, 100, 150, 200, 250, 300, 350] as const;
export type GridSize = (typeof AVAILABLE_GRID_SIZES)[number];
export const DEFAULT_GRID_SIZE: GridSize = 50;

/** A single stitch cell with DMC thread color information. */
export interface StitchCell {
  /** 0-indexed column position */
  col: number;
  /** 0-indexed row position */
  row: number;
  /** DMC thread color code (e.g. "310" for black) */
  dmcCode: string;
  /** Display name of the DMC color */
  dmcName: string;
  /** Hex color value (e.g. "#000000") */
  hexColor: string;
}

/** 2D grid of stitch cells representing an embroidery pattern. */
export type StitchGrid = StitchCell[][];

/** Summary of DMC thread usage across a pattern. */
export interface DmcUsage {
  dmcCode: string;
  dmcName: string;
  hexColor: string;
  count: number;
  percentage: number;
}

/** Complete pattern result returned by the generate module. */
export interface PatternResult {
  grid: StitchGrid;
  gridSize: number;
  width: number;
  height: number;
  totalStitches: number;
  dmcPalette: DmcUsage[];
  previewUrl?: string;
  originalImageData?: string;
}

/** Pattern visibility settings. */
export enum PatternVisibility {
  PRIVATE = "PRIVATE",
  PUBLIC = "PUBLIC",
  UNLISTED = "UNLISTED",
}

// ─── Fabric Count Types ──────────────────────────────────────────────────────

/** Supported fabric counts (stitches per inch). */
export const FABRIC_COUNTS = [11, 14, 16, 18, 20] as const;
export type FabricCount = (typeof FABRIC_COUNTS)[number];
export const DEFAULT_FABRIC_COUNT: FabricCount = 14;

/** Recommended max DMC colors per fabric count. Higher mesh = more colors. */
export const FABRIC_COLOR_LIMITS: Record<FabricCount, number> = {
  11: 10,
  14: 15,
  16: 20,
  18: 24,
  20: 30,
};

/** Convert stitch count to physical inches at a given fabric count. */
export function stitchesToInches(stitches: number, fabricCount: number): number {
  return Math.round((stitches / fabricCount) * 100) / 100;
}

/** Convert desired inches to stitch count at a given fabric count. */
export function inchesToStitches(inches: number, fabricCount: number): number {
  return Math.round(inches * fabricCount);
}
