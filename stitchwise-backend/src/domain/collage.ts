/**
 * Domain types for the Collage Studio feature.
 *
 * Collage quilting projects consist of layered fabric pieces arranged on a canvas.
 * Follows Option A from the research: JSON blob storage for MVP with versioned schema.
 */

import { z } from "zod";

// ─── Enums ─────────────────────────────────────────────────────────────────

export enum CollageTierAccess {
  ALL = "ALL",        // Hobbyist can view/basic edit
  PRO = "PRO",        // Pro features (advanced layering)
  STUDIO = "STUDIO",  // All features
}

// ─── Collage Project ───────────────────────────────────────────────────────

export interface CollageProject {
  id: string;
  name: string;
  userId: string;
  data: string; // JSON: full canvas state
  width: number;
  height: number;
  thumbnail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Input DTOs ────────────────────────────────────────────────────────────

export interface CreateCollageProjectInput {
  name: string;
  data?: string;
  width?: number;
  height?: number;
  userId: string;
}

export interface UpdateCollageProjectInput {
  name?: string;
  data?: string;
  width?: number;
  height?: number;
  thumbnail?: string | null;
}

// ─── Zod Schemas ───────────────────────────────────────────────────────────

export const CreateCollageProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  data: z.string().optional(),
  width: z.number().min(50).max(2000).optional().default(300),
  height: z.number().min(50).max(2000).optional().default(300),
});

export const UpdateCollageProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  data: z.string().optional(),
  width: z.number().min(50).max(2000).optional(),
  height: z.number().min(50).max(2000).optional(),
  thumbnail: z.string().nullable().optional(),
});

/**
 * Default collage canvas state (empty project).
 */
export function defaultCollageCanvas(): string {
  return JSON.stringify({
    version: 1,
    width: 300,
    height: 300,
    gridSize: 10,
    fabrics: [],
    layers: [],
  });
}