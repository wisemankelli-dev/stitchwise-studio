import { z } from "zod";

// ─── Enums ─────────────────────────────────────────────────────────────────

export enum UserTier {
  HOBBYIST = "HOBBYIST",
  PRO = "PRO",
  STUDIO = "STUDIO",
}

export enum SharePermission {
  VIEWER = "VIEWER",
  EDITOR = "EDITOR",
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

export interface ProjectShare {
  id: string;
  projectId: string;
  token: string;
  permission: SharePermission;
  isActive: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectCollaborator {
  id: string;
  projectId: string;
  email: string;
  permission: SharePermission;
  acceptedAt: Date | null;
  invitedAt: Date;
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

export interface CreateShareLinkInput {
  projectId: string;
  permission?: SharePermission;
  expiresInHours?: number;
}

export interface InviteCollaboratorInput {
  projectId: string;
  email: string;
  permission?: SharePermission;
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

export const CreateShareLinkSchema = z.object({
  projectId: z.string().uuid("Valid project ID is required"),
  permission: z.nativeEnum(SharePermission).optional().default(SharePermission.VIEWER),
  expiresInHours: z.number().int().min(1).max(720).optional(),
});

export const InviteCollaboratorSchema = z.object({
  projectId: z.string().uuid("Valid project ID is required"),
  email: z.string().email("Valid email is required"),
  permission: z.nativeEnum(SharePermission).optional().default(SharePermission.EDITOR),
});