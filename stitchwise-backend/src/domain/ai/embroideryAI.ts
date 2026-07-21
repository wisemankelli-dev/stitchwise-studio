/**
 * Domain types for AI Embroidery Pattern Generation.
 *
 * Defines the data structures for:
 * - Text-to-Pattern: generating a design from a text prompt
 * - Image-to-Pattern: converting an uploaded image into a stitch grid
 * - StitchGrid: the core 2D array representing a pixelated embroidery pattern
 */

import { z } from "zod";

// ─── Stitch Grid ────────────────────────────────────────────────────────────

/**
 * A single cell in the stitch grid.
 * Each cell represents one embroidery stitch with a color.
 */
export interface StitchCell {
  /** Hex color string (e.g. "#ff0000") */
  color: string;
  /** DMC thread code if matched */
  dmcCode?: string;
  /** DMC color name */
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
  code: string;
  name: string;
  hex: string;
  count: number; // Number of stitches using this color
}

// ─── Pattern Result ─────────────────────────────────────────────────────────

/** Complete pattern generation result. */
export interface PatternResult {
  /** 2D grid of colors */
  grid: StitchGrid;
  /** Grid dimensions */
  gridSize: number;
  /** Total number of stitches */
  stitchCount: number;
  /** DMC color usage breakdown */
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

// ─── Request / Response Types ───────────────────────────────────────────────

export interface TextToPatternRequest {
  /** Text description of the desired pattern */
  prompt: string;
  /** Grid size (e.g. 50, 75, 100, 150, 200). Default 50 */
  gridSize?: number;
  /** Optional negative prompt */
  negativePrompt?: string;
}

export interface TextToPatternResponse {
  success: boolean;
  data?: PatternResult;
  error?: string;
}

export interface ImageToPatternRequest {
  /** Image file buffer */
  imageBuffer: Buffer;
  /** Original filename */
  filename: string;
  /** Grid size (e.g. 50, 75, 100, 150, 200). Default 50 */
  gridSize?: number;
}

export interface ImageToPatternResponse {
  success: boolean;
  data?: PatternResult;
  error?: string;
}

export interface ResizePatternRequest {
  /** The existing stitch grid (2D array of hex colors) */
  grid: string[][];
  /** New grid size to convert to */
  gridSize: number;
}

// ─── Leonardo AI Types ──────────────────────────────────────────────────────

/** Response from Leonardo AI image generation API. */
export interface LeonardoGenerationResponse {
  id: string;
  url?: string;
  createdAt: string;
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const AVAILABLE_GRID_SIZES = [50, 75, 100, 150, 200] as const;
export type GridSize = (typeof AVAILABLE_GRID_SIZES)[number];

const gridSizeSchema = z
  .union([
    z.literal(50),
    z.literal(75),
    z.literal(100),
    z.literal(150),
    z.literal(200),
  ])
  .optional()
  .default(50);

export const TextToPatternSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(1000),
  gridSize: gridSizeSchema,
  negativePrompt: z.string().max(500).optional(),
});

export const ImageToPatternSchema = z.object({
  gridSize: gridSizeSchema,
});

export const ResizePatternSchema = z.object({
  grid: z.array(z.array(z.string().min(1))).min(1),
  gridSize: z
    .union([
      z.literal(50),
      z.literal(75),
      z.literal(100),
      z.literal(150),
      z.literal(200),
    ]),
});

/** Default grid size if not specified. */
export const DEFAULT_GRID_SIZE = 50;