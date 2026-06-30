/**
 * Domain types for the Fabric Usage Estimator (Collage Quilting).
 *
 * Calculates surface area and yardage requirements for fabric pieces
 * used in collage quilting projects. Supports standard fabric widths
 * and configurable buffer percentages for cutting waste.
 */

import { z } from "zod";

// ─── Constants ─────────────────────────────────────────────────────────────

/** Standard fabric widths in inches (44/45" is the most common for quilting cotton). */
export enum StandardFabricWidth {
  WIDTH_44 = 44,   // 44 inches (~1118 mm)
  WIDTH_45 = 45,   // 45 inches (~1143 mm)
  WIDTH_54 = 54,   // 54 inches (~1372 mm) — wideback
  WIDTH_60 = 60,   // 60 inches (~1524 mm) — wideback/minky
  WIDTH_108 = 108, // 108 inches (~2743 mm) — extra-wide backing
}

/** Default standard fabric width for yardage calculation. */
export const DEFAULT_FABRIC_WIDTH_INCHES = 44;

/** Default buffer percentage for cutting waste. */
export const DEFAULT_WASTE_BUFFER_PERCENT = 15; // 15%

/** Conversion factor: 1 inch = 25.4 mm */
export const MM_PER_INCH = 25.4;

/** Conversion factor: 1 yard = 36 inches */
export const INCHES_PER_YARD = 36;

/**
 * Standard fabric widths as a map for user-facing options.
 */
export const FABRIC_WIDTH_OPTIONS: Record<number, string> = {
  44: "Standard Quilting Cotton (44\")",
  45: "Standard Quilting Cotton (45\")",
  54: "Wideback (54\")",
  60: "Wideback/Minky (60\")",
  108: "Extra-Wide Backing (108\")",
};

// ─── Collage Canvas Data Types ──────────────────────────────────────────────

/**
 * A fabric piece layer within a collage project.
 * Matches the structure from the CollageStudio frontend prototype.
 */
export interface CollageFabricLayer {
  id: string;
  name: string;
  /** RGB color as [r, g, b] */
  color: [number, number, number];
  /** Texture pattern name */
  texture: string;
  /** Width in mm */
  width: number;
  /** Height in mm */
  height: number;
  /** X position on canvas in mm */
  x: number;
  /** Y position on canvas in mm */
  y: number;
  /** Rotation in degrees (-180 to 180) */
  rotation: number;
  /** Opacity (0-1) */
  opacity: number;
}

/**
 * The canvas data JSON structure stored in CollageProject.data.
 */
export interface CollageCanvasData {
  version: number;
  width: number;
  height: number;
  gridSize: number;
  fabrics: Array<{
    id: string;
    name: string;
    color: string;
    texture: string;
    width: number;
    height: number;
    x: number;
    y: number;
    rotation: number;
    opacity: number;
  }>;
  layers: string[]; // IDs of fabrics in z-order
}

// ─── Domain Types ────────────────────────────────────────────────────────────

/** Uniquely identified fabric material (by color + texture combination). */
export interface FabricMaterialKey {
  color: [number, number, number];
  texture: string;
}

/** Represents a unique fabric material with its total area requirement. */
export interface FabricMaterialEstimate {
  /** RGB color as [r, g, b] */
  color: [number, number, number];
  /** Hex color string for display */
  colorHex: string;
  /** Texture pattern name */
  texture: string;
  /** Total surface area in square mm */
  totalAreaMm2: number;
  /** Total surface area in square inches */
  totalAreaIn2: number;
  /** Number of layers/pieces using this material */
  pieceCount: number;
  /** Suggested yardage based on standard fabric width */
  suggestedYardage: FabricYardageSuggestion;
  /** Names of the pieces using this fabric (for material list) */
  pieceNames: string[];
}

/** Yardage suggestion for a single fabric material. */
export interface FabricYardageSuggestion {
  /** Fabric width used for calculation (inches) */
  fabricWidthInches: number;
  /** Raw yardage needed without buffer (yards) */
  rawYards: number;
  /** Yardage with waste buffer applied (yards) */
  bufferedYards: number;
  /** Rounded-up yardage for purchasing (to nearest 1/8 yard, min 1/8) */
  purchaseYards: number;
  /** Waste buffer percentage applied */
  wasteBufferPercent: number;
  /** Formatted string like "1 1/4 yards" */
  formatted: string;
}

/** Complete fabric usage estimate result. */
export interface FabricEstimateResult {
  /** Total canvas dimensions in mm */
  canvasWidthMm: number;
  canvasHeightMm: number;
  /** Total fabric area across all layers (square mm) */
  totalFabricAreaMm2: number;
  /** Total fabric area across all layers (square inches) */
  totalFabricAreaIn2: number;
  /** Per-material breakdown */
  materials: FabricMaterialEstimate[];
  /** Number of unique fabric types */
  uniqueFabricCount: number;
  /** Number of total fabric pieces */
  totalPieceCount: number;
  /** Fabric width used for yardage calculation */
  fabricWidthInches: number;
  /** Waste buffer percentage applied */
  wasteBufferPercent: number;
  /** Summary yardage string */
  summary: string;
}

// ─── Input DTOs ─────────────────────────────────────────────────────────────

export interface EstimateFromCanvasInput {
  /** The canvas data JSON string (from CollageProject.data) */
  canvasData: string;
  /** Canvas width in mm (optional, inferred from data) */
  canvasWidthMm?: number;
  /** Canvas height in mm (optional, inferred from data) */
  canvasHeightMm?: number;
  /** Fabric width in inches (default: 44) */
  fabricWidthInches?: number;
  /** Waste buffer percentage (default: 15) */
  wasteBufferPercent?: number;
}

export interface EstimateFromLayersInput {
  /** Array of fabric layers */
  layers: CollageFabricLayer[];
  /** Canvas width in mm */
  canvasWidthMm?: number;
  /** Canvas height in mm */
  canvasHeightMm?: number;
  /** Fabric width in inches (default: 44) */
  fabricWidthInches?: number;
  /** Waste buffer percentage (default: 15) */
  wasteBufferPercent?: number;
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const EstimateFromCanvasSchema = z.object({
  canvasData: z.string().min(1, "canvasData is required"),
  canvasWidthMm: z.number().min(50).max(2000).optional(),
  canvasHeightMm: z.number().min(50).max(2000).optional(),
  fabricWidthInches: z
    .union([
      z.literal(44),
      z.literal(45),
      z.literal(54),
      z.literal(60),
      z.literal(108),
    ])
    .optional()
    .default(DEFAULT_FABRIC_WIDTH_INCHES),
  wasteBufferPercent: z.number().min(0).max(50).optional().default(DEFAULT_WASTE_BUFFER_PERCENT),
});

export const EstimateFromLayersSchema = z.object({
  layers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      color: z.tuple([z.number(), z.number(), z.number()]),
      texture: z.string(),
      width: z.number().positive(),
      height: z.number().positive(),
      x: z.number(),
      y: z.number(),
      rotation: z.number().min(-180).max(180),
      opacity: z.number().min(0).max(1),
    })
  ).min(1, "At least one layer is required"),
  canvasWidthMm: z.number().min(50).max(2000).optional(),
  canvasHeightMm: z.number().min(50).max(2000).optional(),
  fabricWidthInches: z
    .union([
      z.literal(44),
      z.literal(45),
      z.literal(54),
      z.literal(60),
      z.literal(108),
    ])
    .optional()
    .default(DEFAULT_FABRIC_WIDTH_INCHES),
  wasteBufferPercent: z.number().min(0).max(50).optional().default(DEFAULT_WASTE_BUFFER_PERCENT),
});

/**
 * Zod schema for estimate request when referencing a saved project.
 */
export const EstimateByProjectSchema = z.object({
  fabricWidthInches: z
    .union([
      z.literal(44),
      z.literal(45),
      z.literal(54),
      z.literal(60),
      z.literal(108),
    ])
    .optional()
    .default(DEFAULT_FABRIC_WIDTH_INCHES),
  wasteBufferPercent: z.number().min(0).max(50).optional().default(DEFAULT_WASTE_BUFFER_PERCENT),
});