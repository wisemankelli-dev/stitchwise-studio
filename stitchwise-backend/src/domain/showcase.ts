import { z } from "zod";

// ─── Enums ─────────────────────────────────────────────────────────────────

export enum ShowcasePhotoStatus {
  PENDING = "PENDING",   // Awaiting moderation review
  APPROVED = "APPROVED", // Visible in the public gallery
  REJECTED = "REJECTED", // Rejected during moderation
}

// ─── Showcase Photo ────────────────────────────────────────────────────────

export interface ShowcasePhoto {
  id: string;
  userId: string;
  projectId: string | null;
  title: string;
  caption: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  status: ShowcasePhotoStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** A showcase photo visible in the public gallery (always approved). */
export interface GalleryPhoto {
  id: string;
  title: string;
  caption: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  userName: string;
  userTier: string;
  createdAt: Date;
}

// ─── Input DTOs ────────────────────────────────────────────────────────────

export interface CreateShowcasePhotoInput {
  userId: string;
  projectId?: string | null;
  title: string;
  caption?: string | null;
  imageUrl: string;
  thumbnailUrl?: string | null;
}

export interface UpdateShowcasePhotoInput {
  title?: string;
  caption?: string | null;
  status?: ShowcasePhotoStatus;
}

// ─── Zod Schemas ───────────────────────────────────────────────────────────

export const CreateShowcasePhotoSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  title: z.string().min(1, "Title is required").max(200),
  caption: z.string().max(1000).optional().nullable(),
});

export const UpdateShowcasePhotoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  caption: z.string().max(1000).optional().nullable(),
});