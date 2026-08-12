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

// ─── Pattern Region (outline mode) ───────────────────────────────────────────

/** A numbered outline region for the printable quilt pattern. */
export interface PatternRegion {
  /** Region number (1-based, for the color key) */
  number: number;
  /** Suggested fabric color name */
  suggestedColor: string;
  /** Suggested hex color */
  suggestedHex: string;
  /** Bounding box x */
  x: number;
  /** Bounding box y */
  y: number;
  /** Bounding box width */
  width: number;
  /** Bounding box height */
  height: number;
}

// ─── Fabric Color Usage ─────────────────────────────────────────────────────

/** A fabric color used in the collage with count information. */
export interface FabricColorUsage {
  hex: string;
  name: string;
  count: number; // Number of layers using this color
}

// ─── Scrapbook Piece ────────────────────────────────────────────────────────

/**
 * A single scrapbook-style collage piece.
 *
 * Scrapbook pieces are cutouts of the actual art image: each piece carries
 * the real art pixels inside its outline, with transparency outside the mask.
 * The customer arranges these pieces on the block like a fabric scrapbook
 * (reference: collagequilter.com).
 */
export interface CollagePiece {
  /** Unique identifier for the piece */
  id: string;
  /** Human-readable label (e.g. "Piece 1") */
  label: string;
  /** Simplified outline polygon as [x, y] points normalized 0-1 (image-relative) */
  outline: Array<[number, number]>;
  /** Normalized bounding box (0-1) of the piece within the full art image */
  bounds: { x: number; y: number; width: number; height: number };
  /** Dominant fabric color of the piece as hex */
  color: string;
  /** Data-URL PNG of the piece: original art pixels inside the shape, transparent outside */
  image: string;
}

// ─── Collage Generation Result ──────────────────────────────────────────────

/** Complete collage generation result. */
export interface CollageGenerationResult {
  /** Array of fabric layers (colored mode) */
  layers: CollageLayer[];
  /** Outline pattern regions for printable quilt pattern */
  regions: PatternRegion[];
  /** Grid size used for quantization */
  gridSize: number;
  /** Quilt block size in inches, when supplied by the designer */
  blockSize?: number;
  /** Original realistic artwork generated before quilt conversion */
  artworkUrl?: string;
  /** Total number of layers */
  layerCount: number;
  /** Fabric color usage breakdown */
  fabricColors: FabricColorUsage[];
  /** URL to the AI-generated preview image (for text-to-collage) */
  previewUrl?: string;
  /** Original prompt used (for text-to-collage) */
  prompt?: string;
  /** Scrapbook pieces — cutouts of the actual art image (scrapbook flow) */
  pieces?: CollagePiece[];
  /** Full art image as a data-URL PNG (reference for the piece tray) */
  referenceImage?: string;
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

export const COLLAGE_BLOCK_SIZES = [6, 8, 10, 12, 16, 18, 20, 24] as const;
export const TextToCollageSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(1000),
  blockSize: z.coerce.number().refine((value) => COLLAGE_BLOCK_SIZES.includes(value as typeof COLLAGE_BLOCK_SIZES[number]), "Unsupported block size").optional(),
  gridSize: z
    .union([z.literal(16), z.literal(24), z.literal(32), z.literal(48), z.literal(64), z.literal(72), z.literal(80), z.literal(96)])
    .optional()
    .default(32),
  negativePrompt: z.string().max(500).optional(),
  premiumModel: z.boolean().optional(),
});

export const ImageToCollageSchema = z.object({
  gridSize: z
    .union([z.literal(16), z.literal(24), z.literal(32), z.literal(48), z.literal(64)])
    .optional()
    .default(32),
});

/** Default grid size if not specified. */
export const DEFAULT_GRID_SIZE = 32;