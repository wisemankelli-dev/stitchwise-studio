import { z } from "zod";

// ─── Enums ─────────────────────────────────────────────────────────────────

export enum UserTier {
  HOBBYIST = "HOBBYIST",
  PRO = "PRO",
  STUDIO = "STUDIO",
}

export enum ProjectVisibility {
  PRIVATE = "PRIVATE",
  PUBLIC = "PUBLIC",
  SAMPLE = "SAMPLE",
}

// ─── User ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  tier: UserTier;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Project ───────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  data: string; // JSON: SVG paths, grid state, stitch params
  userId: string;
  visibility: ProjectVisibility;
  createdAt: Date;
  updatedAt: Date;
}

/** Represents a sample design visible in the Featured Gallery. */
export interface SampleProject {
  id: string;
  name: string;
  data: string;
  userId: string;
  visibility: ProjectVisibility.SAMPLE;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Input DTOs ────────────────────────────────────────────────────────────

export interface CreateProjectInput {
  name: string;
  data?: string;
  userId: string;
  visibility?: ProjectVisibility;
}

export interface UpdateProjectInput {
  name?: string;
  data?: string;
}

// ─── Zod Schemas ───────────────────────────────────────────────────────────

export const CreateProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  data: z.string().optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  data: z.string().optional(),
});