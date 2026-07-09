/**
 * Domain types for AI Collage Generation.
 *
 * Defines the data structures for:
 * - Text-to-Collage: generating a collage layout from a text prompt
 * - Image-to-Collage: converting an uploaded image into collage fabric layers
 *
 * FabricLayer mirrors the frontend's FabricLayer for collage quilting.
 */
import { z } from "zod";

// ─── Fabric Layer ───────────────────────────────────────────────────────────

/**
 * A single fabric layer in the collage.
 * Matches the frontend's FabricLayer interface shape.
 */
export interface CollageLayer {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Hex color string (e.g. "#f9a8d4") */
  color: string;
  /** Fabric texture pattern */
  pattern: string;
  /** X position on canvas */
  x: number;
  /** Y position on canvas */
  y: number;
  /** Layer width */
  width: number;
  /** Layer height */
  height: number;
  /** Rotation in degrees */
  rotation: number;
  /** Opacity (0-1) */
  opacity: number;
  /** Z-index for layering order */
  zIndex: number;
}

// ─── Fabric Color Usage ─────────────────────────────────────────────────────

/** A fabric color used in the collage with count information. */
export interface FabricColorUsage {
  hex: string;
  name: string;
  count: number; // Number of layers using this color
}

// ─── Collage Generation Result ──────────────────────────────────────────────

/** Complete collage generation result. */
export interface CollageGenerationResult {
  /** Array of fabric layers */
  layers: CollageLayer[];
  /** Grid size used for quantization */
  gridSize: number;
  /** Total number of layers */
  layerCount: number;
  /** Fabric color usage breakdown */
  fabricColors: FabricColorUsage[];
  /** URL to the AI-generated preview image (for text-to-collage) */
  previewUrl?: string;
  /** Original prompt used (for text-to-collage) */
  prompt?: string;
}

// ─── Request / Response Types ───────────────────────────────────────────────

export interface TextToCollageRequest {
  /** Text description of the desired collage */
  prompt: string;
  /** Grid size (e.g. 16, 32, 64). Default 32 */
  gridSize?: number;
  /** Optional negative prompt */
  negativePrompt?: string;
}

export interface TextToCollageResponse {
  success: boolean;
  data?: CollageGenerationResult;
  error?: string;
}

export interface ImageToCollageRequest {
  /** Image file buffer */
  imageBuffer: Buffer;
  /** Original filename */
  filename: string;
  /** Grid size (e.g. 16, 32, 64). Default 32 */
  gridSize?: number;
}

export interface ImageToCollageResponse {
  success: boolean;
  data?: CollageGenerationResult;
  error?: string;
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const TextToCollageSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(1000),
  gridSize: z
    .union([z.literal(16), z.literal(24), z.literal(32), z.literal(48), z.literal(64)])
    .optional()
    .default(32),
  negativePrompt: z.string().max(500).optional(),
});

export const ImageToCollageSchema = z.object({
  gridSize: z
    .union([z.literal(16), z.literal(24), z.literal(32), z.literal(48), z.literal(64)])
    .optional()
    .default(32),
});

/** Default grid size if not specified. */
export const DEFAULT_GRID_SIZE = 32;