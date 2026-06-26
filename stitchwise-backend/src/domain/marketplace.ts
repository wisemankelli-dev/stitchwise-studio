import { z } from "zod";

// ─── Types ─────────────────────────────────────────────────────────────────

export type ListingVisibility = "PUBLIC" | "PRIVATE" | "UNLISTED";

export interface MarketplaceListing {
  id: string;
  designerId: string;
  name: string;
  description: string;
  price: number; // cents
  visibility: ListingVisibility;
  tags: string[];
  stitchFile: string | null;
  thumbnail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateListingInput {
  designerId: string;
  name: string;
  description?: string;
  price?: number;
  visibility?: ListingVisibility;
  tags?: string[];
  stitchFile?: string;
  thumbnail?: string;
}

export interface UpdateListingInput {
  name?: string;
  description?: string;
  price?: number;
  visibility?: ListingVisibility;
  tags?: string[];
  stitchFile?: string;
  thumbnail?: string;
}

// ─── Zod Schemas ───────────────────────────────────────────────────────────

export const CreateListingSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(5000).optional().default(""),
  price: z.number().int().min(0).max(99999).optional().default(0),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).optional().default("PUBLIC"),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  stitchFile: z.string().optional(),
  thumbnail: z.string().optional(),
});

export const UpdateListingSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  price: z.number().int().min(0).max(99999).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  stitchFile: z.string().optional(),
  thumbnail: z.string().optional(),
});