/**
 * Domain types for AI Embroidery Pattern Generation.
 *
 * Defines the data structures for:
 * - Text-to-Pattern: generating a design from a text prompt
 * - Image-to-Pattern: converting an uploaded image into a stitch grid
 *
 * Grid types (StitchCell, StitchGrid, etc.) are now in domain/stitch/types.ts
 * as the canonical module-agnostic representation. This file re-exports them
 * for backward compatibility and defines AI-specific request/response types.
 */

import { z } from "zod";
import type { StitchCell, StitchGrid, DmcUsage, PatternResult } from "../stitch/types";
import { AVAILABLE_GRID_SIZES, DEFAULT_GRID_SIZE } from "../stitch/types";

// ─── Re-exports (backward compatibility) ────────────────────────────────────

export type { StitchCell, StitchGrid, DmcUsage, PatternResult };
export { AVAILABLE_GRID_SIZES, DEFAULT_GRID_SIZE };

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
  maxColors: z.number().int().min(15).max(80).optional().default(24),
  negativePrompt: z.string().max(500).optional(),
});

export const ImageToPatternSchema = z.object({
  gridSize: gridSizeSchema,
  maxColors: z.number().int().min(15).max(80).optional().default(24),
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
  maxColors: z.number().int().min(15).max(80).optional().default(24),
});