/**
 * Domain types for the Quilt Block Studio feature.
 *
 * Quilt blocks consist of a grid (e.g. 4x4) where each cell contains a patch
 * (a geometric shape like half-square triangle, square, rectangle).
 * Each patch references a fabric by its index in the block's fabric palette.
 *
 * Follows the same Option A (JSON blob) pattern as Collage Studio for MVP.
 */

import { z } from "zod";

// ─── Enums ─────────────────────────────────────────────────────────────────

export enum PatchShape {
  SQUARE = "square",
  RECTANGLE = "rectangle",
  HALF_SQUARE_TRIANGLE = "half_square_triangle", // HST — diagonal split
  QUARTER_SQUARE_TRIANGLE = "quarter_square_triangle", // QST — both diagonals
  TRIANGLE = "triangle",
  FLYING_GEESE = "flying_geese", // Large triangle with two smaller triangles
  DIAMOND = "diamond",
}

export enum GridSplit {
  NONE = "none",        // Single patch fills the cell
  HST_A = "hst_a",      // Half-square triangle: orientation A (\\)
  HST_B = "hst_b",      // Half-square triangle: orientation B (/)
  QST = "qst",          // Quarter-square triangle (both diagonals)
  FOUR_PATCH = "four_patch", // 2x2 subdivision
  NINE_PATCH = "nine_patch", // 3x3 subdivision
}

// ─── Fabric Reference ───────────────────────────────────────────────────────

/** A fabric entry in the block's palette. */
export interface BlockFabric {
  id: string;
  name: string;
  /** Hex color string */
  color: string;
  /** Texture pattern name (solid, linen, polka, stripe, plaid) */
  texture: string;
  /** Optional DMC thread match for quilting stitches */
  dmcSku?: string;
}

// ─── Patches & Grid ─────────────────────────────────────────────────────────

/** A single patch within a grid cell. */
export interface Patch {
  id: string;
  /** Shape of this patch */
  shape: PatchShape;
  /** Grid row (0-indexed) */
  row: number;
  /** Grid column (0-indexed) */
  col: number;
  /** Index into the block's fabric palette */
  fabricIndex: number;
  /** How the cell is subdivided (for multi-patch cells) */
  split: GridSplit;
  /** Rotation in degrees (0, 90, 180, 270) — common for quilt blocks */
  rotation: number;
  /** Scale factor (0.1-2.0) for size adjustment */
  scale: number;
  /** Sub-patches if this cell is subdivided (e.g. four-patch) */
  subPatches?: SubPatch[];
}

/** A sub-patch within a subdivided grid cell. */
export interface SubPatch {
  id: string;
  shape: PatchShape;
  /** Local position within the cell (0-1 relative coordinates) */
  x: number;
  y: number;
  /** Width and height as fraction of cell (0-1) */
  width: number;
  height: number;
  /** Index into the block's fabric palette */
  fabricIndex: number;
  /** Rotation in degrees */
  rotation: number;
}

// ─── Quilt Block Project ────────────────────────────────────────────────────

export interface QuiltBlockProject {
  id: string;
  name: string;
  userId: string;
  data: string; // JSON: full block state
  blockSize: number;
  gridRows: number;
  gridCols: number;
  thumbnail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The JSON structure stored in QuiltBlockProject.data */
export interface QuiltBlockData {
  version: number;
  blockSize: number;
  gridRows: number;
  gridCols: number;
  /** Fabric palette used in this block */
  fabrics: BlockFabric[];
  /** Grid patches in row-major order */
  patches: Patch[];
  /** Set of sub-patches for subdivided cells */
  subPatches?: SubPatch[];
  /** Design metadata */
  description?: string;
  tags?: string[];
  /** Optional seam allowance in inches (default 0.25) */
  seamAllowance?: number;
}

// ─── Input DTOs ────────────────────────────────────────────────────────────

export interface CreateQuiltBlockProjectInput {
  name: string;
  data?: string;
  blockSize?: number;
  gridRows?: number;
  gridCols?: number;
  userId: string;
}

export interface UpdateQuiltBlockProjectInput {
  name?: string;
  data?: string;
  blockSize?: number;
  gridRows?: number;
  gridCols?: number;
  thumbnail?: string | null;
}

// ─── Block Template Presets ─────────────────────────────────────────────────

/** Common quilt block templates with predefined grid splits. */
export interface BlockTemplate {
  name: string;
  description: string;
  gridRows: number;
  gridCols: number;
  blockSize: number;
  /** Pre-defined cell splits */
  cellSplits: GridSplit[][];
}

/** Pre-defined quilt block templates for quick-start. */
export const BLOCK_TEMPLATES: BlockTemplate[] = [
  {
    name: "Nine Patch",
    description: "Classic 3x3 grid with alternating patch colors",
    gridRows: 3,
    gridCols: 3,
    blockSize: 12,
    cellSplits: [
      [GridSplit.NONE, GridSplit.NONE, GridSplit.NONE],
      [GridSplit.NONE, GridSplit.NONE, GridSplit.NONE],
      [GridSplit.NONE, GridSplit.NONE, GridSplit.NONE],
    ],
  },
  {
    name: "Flying Geese",
    description: "4x4 grid with flying geese patches",
    gridRows: 4,
    gridCols: 4,
    blockSize: 12,
    cellSplits: [
      [GridSplit.HST_A, GridSplit.NONE, GridSplit.NONE, GridSplit.HST_B],
      [GridSplit.NONE, GridSplit.HST_A, GridSplit.HST_B, GridSplit.NONE],
      [GridSplit.NONE, GridSplit.HST_B, GridSplit.HST_A, GridSplit.NONE],
      [GridSplit.HST_B, GridSplit.NONE, GridSplit.NONE, GridSplit.HST_A],
    ],
  },
  {
    name: "Ohio Star",
    description: "9-patch style with quarter-square triangles in corners",
    gridRows: 3,
    gridCols: 3,
    blockSize: 12,
    cellSplits: [
      [GridSplit.QST, GridSplit.NONE, GridSplit.QST],
      [GridSplit.NONE, GridSplit.NONE, GridSplit.NONE],
      [GridSplit.QST, GridSplit.NONE, GridSplit.QST],
    ],
  },
  {
    name: "Log Cabin (Modern)",
    description: "4x4 grid with concentric rectangle patches",
    gridRows: 4,
    gridCols: 4,
    blockSize: 12,
    cellSplits: [
      [GridSplit.NONE, GridSplit.NONE, GridSplit.NONE, GridSplit.NONE],
      [GridSplit.NONE, GridSplit.NONE, GridSplit.NONE, GridSplit.NONE],
      [GridSplit.NONE, GridSplit.NONE, GridSplit.NONE, GridSplit.NONE],
      [GridSplit.NONE, GridSplit.NONE, GridSplit.NONE, GridSplit.NONE],
    ],
  },
];

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const CreateQuiltBlockProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  data: z.string().optional(),
  blockSize: z.number().min(6).max(48).optional().default(12),
  gridRows: z.number().int().min(1).max(16).optional().default(4),
  gridCols: z.number().int().min(1).max(16).optional().default(4),
});

export const UpdateQuiltBlockProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  data: z.string().optional(),
  blockSize: z.number().min(6).max(48).optional(),
  gridRows: z.number().int().min(1).max(16).optional(),
  gridCols: z.number().int().min(1).max(16).optional(),
  thumbnail: z.string().nullable().optional(),
});

/**
 * Default quilt block canvas state (empty 4x4 block).
 */
export function defaultQuiltBlockData(): string {
  return JSON.stringify({
    version: 1,
    blockSize: 12,
    gridRows: 4,
    gridCols: 4,
    fabrics: [
      { id: "fab-1", name: "Fabric A", color: "#fce7f3", texture: "solid" },
      { id: "fab-2", name: "Fabric B", color: "#fbcfe8", texture: "solid" },
      { id: "fab-3", name: "Background", color: "#ffffff", texture: "solid" },
    ],
    patches: [],
    description: "",
    tags: [],
    seamAllowance: 0.25,
  });
}