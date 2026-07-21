/**
 * Stitch Grid Types — Canonical data structures for the embroidery platform.
 *
 * These types define the core in-memory representation of an embroidery
 * pattern: a 2D grid where each cell is one stitch. All pattern generation,
 * editing, and export functionality builds on these types.
 *
 * Extracted from domain/ai/embroideryAI.ts to serve as the canonical
 * module-agnostic grid representation.
 */

// ─── Stitch Grid ────────────────────────────────────────────────────────────

/**
 * A single cell in the stitch grid.
 * Each cell represents one embroidery stitch with a color.
 */
export interface StitchCell {
  /** Hex color string (e.g. "#ff0000") */
  color: string;
  /** DMC thread code if matched (e.g. "DMC 321") */
  dmcCode?: string;
  /** DMC color name (e.g. "Christmas Red") */
  dmcName?: string;
}

/**
 * 2D grid of stitch cells representing the embroidery pattern.
 * grid[row][col] where row 0 is the top of the design.
 */
export type StitchGrid = StitchCell[][];

// ─── DMC Usage ──────────────────────────────────────────────────────────────

/** A DMC color used in the pattern with count information. */
export interface DmcUsage {
  /** DMC product code (e.g. "DMC 321") */
  code: string;
  /** Human-readable color name */
  name: string;
  /** Hex color (e.g. "#e11d48") */
  hex: string;
  /** Number of stitches using this color */
  count: number;
}

// ─── Pattern Result ─────────────────────────────────────────────────────────

/** Complete pattern generation result returned by all pattern endpoints. */
export interface PatternResult {
  /** 2D grid of stitch cells */
  grid: StitchGrid;
  /** Grid dimensions (both width and height are equal) */
  gridSize: number;
  /** Total number of stitches (gridSize × gridSize) */
  stitchCount: number;
  /** DMC color usage breakdown, sorted by count descending */
  dmcColors: DmcUsage[];
  /** URL to the AI-generated preview image (for text-to-pattern) */
  previewUrl?: string;
  /** Original prompt used (for text-to-pattern) */
  prompt?: string;
  /** Base64 data URL of the original uploaded image (for image-to-pattern) */
  originalImageData?: string;
  /** URL to the original uploaded image (for image-to-pattern) */
  originalImageUrl?: string;
}

// ─── Grid Constants ─────────────────────────────────────────────────────────

/** Valid grid sizes for pattern generation. Each pixel = one stitch. */
export const AVAILABLE_GRID_SIZES = [50, 75, 100, 150, 200] as const;

/** Union type of valid grid size literals. */
export type GridSize = (typeof AVAILABLE_GRID_SIZES)[number];

/** Default grid size used when no size is specified. */
export const DEFAULT_GRID_SIZE = 50;