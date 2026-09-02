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
import { AVAILABLE_FABRIC_COUNTS, isValidFabricCount } from "../stitch/fabricCounts";

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

// ─── Zod Schemas ────────────────────────────────────────────────────────────

// Designer canvas sizes can be any integer in [8, 240] (11×17 stocking at 14ct = 238).
const gridSizeSchema = z.number().int().min(8).max(240).optional().default(50);

/**
 * All fabric counts the Designer's picker offers and the backend accepts.
 * Driven by the shared fabricCounts table so the API and the UI can never
 * drift again: [11, 13, 14, 18, 22, 25, 28, 32, 36] (14 is the default).
 * NOTE: AVAILABLE_FABRIC_COUNTS also includes 16 and 20 (legacy table
 * entries); the Designer's picker omits those, but accepting them is
 * backward-compatible and keeps existing tests untouched.
 */
const supportedFabricCount = z.number().int().refine(
  (n) => isValidFabricCount(n) && AVAILABLE_FABRIC_COUNTS.includes(n),
  "Invalid fabricCount — must be one of " + AVAILABLE_FABRIC_COUNTS.join(", "),
);

export const TextToPatternSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(1000),
  gridSize: gridSizeSchema,
  maxColors: z.number().int().min(2).max(80).optional().default(24),
  negativePrompt: z.string().max(500).optional(),
  fabricCount: supportedFabricCount.optional(),
  desiredInches: z.number().positive().max(30).optional(),
  premiumModel: z.boolean().optional(),
  /** Canvas dims for aspect-aware generation (e.g. 154×238 stocking). */
  canvasWidth: z.number().int().min(8).max(300).optional(),
  canvasHeight: z.number().int().min(8).max(300).optional(),
  /** Aspect ratio for the generated art ("1:1"|"2:3"|"3:4"|"9:16"|"16:9"). */
  aspectRatio: z.enum(["1:1", "2:3", "3:4", "9:16", "16:9"]).optional(),
  /** Product shape hint for prompt enrichment ("stocking"|"ornament"|"pillow"|"square"). */
  shape: z.enum(["stocking", "ornament", "pillow", "square", "rect"]).optional(),
});

export const ImageToPatternSchema = z.object({
  gridSize: gridSizeSchema,
  maxColors: z.number().int().min(2).max(80).optional().default(24),
  fabricCount: supportedFabricCount.optional(),
  desiredInches: z.number().positive().max(30).optional(),
});

export const ResizePatternSchema = z.object({
  grid: z.array(z.array(z.string().min(1))).min(1),
  gridSize: z.number().int().min(8).max(240),
  maxColors: z.number().int().min(2).max(80).optional().default(24),
});