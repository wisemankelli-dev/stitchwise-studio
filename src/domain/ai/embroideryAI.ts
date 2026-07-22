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

/** A single cell in the stitch grid. */
export interface StitchCell {
  color: string;
  dmcCode?: string;
  dmcName?: string;
}

export type StitchGrid = StitchCell[][];

// ─── DMC Usage ──────────────────────────────────────────────────────────────

export interface DmcUsage {
  code: string;
  name: string;
  hex: string;
  count: number;
}

// ─── Pattern Result ─────────────────────────────────────────────────────────

export interface PatternResult {
  grid: StitchGrid;
  gridSize: number;
  stitchCount: number;
  dmcColors: DmcUsage[];
  previewUrl?: string;
  prompt?: string;
}

// ─── Request / Response ─────────────────────────────────────────────────────

export interface TextToPatternRequest {
  prompt: string;
  gridSize?: number;
  negativePrompt?: string;
  fabricCount?: number;
  desiredInches?: number;
}

export interface TextToPatternResponse {
  success: boolean;
  data?: PatternResult & { fabric?: { count: number; inches: number } };
  error?: string;
}

export interface ImageToPatternRequest {
  imageBuffer: Buffer;
  filename: string;
  gridSize?: number;
  fabricCount?: number;
  desiredInches?: number;
}

export interface ImageToPatternResponse {
  success: boolean;
  data?: PatternResult & { fabric?: { count: number; inches: number } };
  error?: string;
}

// ─── Leonardo AI Types ──────────────────────────────────────────────────────

export interface LeonardoGenerationResponse {
  id: string;
  url?: string;
  createdAt: string;
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const TextToPatternSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(1000),
  gridSize: z
    .union([
      z.literal(50), z.literal(75), z.literal(100),
      z.literal(150), z.literal(200), z.literal(250),
      z.literal(300), z.literal(350),
    ])
    .optional()
    .default(50),
  negativePrompt: z.string().max(500).optional(),
  /** Owner's fabric-count awareness */
  fabricCount: z
    .union([z.literal(11), z.literal(14), z.literal(16), z.literal(18), z.literal(20)])
    .optional(),
  /** Desired physical size in inches — overrides gridSize when set */
  desiredInches: z.number().positive().max(50).optional(),
});

export const ImageToPatternSchema = z.object({
  gridSize: z
    .union([
      z.literal(50), z.literal(75), z.literal(100),
      z.literal(150), z.literal(200), z.literal(250),
      z.literal(300), z.literal(350),
    ])
    .optional()
    .default(50),
  fabricCount: z
    .union([z.literal(11), z.literal(14), z.literal(16), z.literal(18), z.literal(20)])
    .optional(),
  desiredInches: z.number().positive().max(50).optional(),
});

/** Default grid size if not specified. */
export const DEFAULT_GRID_SIZE = 50;
