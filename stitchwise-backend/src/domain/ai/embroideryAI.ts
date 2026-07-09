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
}

// ─── Request / Response Types ───────────────────────────────────────────────

export interface TextToPatternRequest {
  /** Text description of the desired pattern */
  prompt: string;
  /** Grid size (e.g. 16, 32, 64). Default 32 */
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
  /** Grid size (e.g. 16, 32, 64). Default 32 */
  gridSize?: number;
}

export interface ImageToPatternResponse {
  success: boolean;
  data?: PatternResult;
  error?: string;
}

// ─── Leonardo AI Types ──────────────────────────────────────────────────────

/** Response from Leonardo AI image generation API. */
export interface LeonardoGenerationResponse {
  id: string;
  url?: string;
  createdAt: string;
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const TextToPatternSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(1000),
  gridSize: z
    .union([z.literal(16), z.literal(24), z.literal(32), z.literal(48), z.literal(64)])
    .optional()
    .default(32),
  negativePrompt: z.string().max(500).optional(),
});

export const ImageToPatternSchema = z.object({
  gridSize: z
    .union([z.literal(16), z.literal(24), z.literal(32), z.literal(48), z.literal(64)])
    .optional()
    .default(32),
});

/** Default grid size if not specified. */
export const DEFAULT_GRID_SIZE = 32;