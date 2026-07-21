/**
 * Pattern Repository — Prisma-based persistence layer for embroidery patterns.
 *
 * Provides CRUD operations for the EmbroideryPattern database model.
 * Handles JSON serialization/deserialization of grid and palette data
 * using the helpers from patternDataModel.
 */

import { PrismaClient } from "@prisma/client";
import type { PatternResult } from "./types";
import { serializeGrid, deserializeGrid, serializePalette, deserializePalette } from "./patternDataModel";

const prisma = new PrismaClient();

export interface EmbroideryPatternRecord {
  id: string;
  name: string;
  userId: string;
  gridData: string;
  gridSize: number;
  dmcPalette: string;
  stitchCount: number;
  previewUrl: string | null;
  prompt: string | null;
  sourceImage: string | null;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Save a new embroidery pattern to the database.
 */
export async function savePattern(
  userId: string,
  pattern: PatternResult,
  name: string,
  visibility: string = "PRIVATE",
): Promise<EmbroideryPatternRecord> {
  const record = await prisma.embroideryPattern.create({
    data: {
      name,
      userId,
      gridData: serializeGrid(pattern.grid),
      gridSize: pattern.gridSize,
      dmcPalette: serializePalette(pattern.dmcColors),
      stitchCount: pattern.stitchCount,
      previewUrl: pattern.previewUrl ?? null,
      prompt: pattern.prompt ?? null,
      sourceImage: pattern.originalImageData ?? pattern.originalImageUrl ?? null,
      visibility,
    },
  });
  return recordToResult(record);
}

/**
 * Retrieve a pattern by ID.
 */
export async function getPatternById(id: string): Promise<EmbroideryPatternRecord | null> {
  const record = await prisma.embroideryPattern.findUnique({ where: { id } });
  return record ? recordToResult(record) : null;
}

/**
 * List all patterns for a given user.
 */
export async function getPatternsByUser(userId: string): Promise<EmbroideryPatternRecord[]> {
  const records = await prisma.embroideryPattern.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  return records.map(recordToResult);
}

/**
 * List public patterns with optional pagination.
 */
export async function getPublicPatterns(
  limit: number = 20,
  offset: number = 0,
): Promise<EmbroideryPatternRecord[]> {
  const records = await prisma.embroideryPattern.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
  return records.map(recordToResult);
}

/**
 * Update a pattern's metadata (name, visibility).
 */
export async function updatePattern(
  id: string,
  updates: { name?: string; visibility?: string },
): Promise<EmbroideryPatternRecord> {
  const record = await prisma.embroideryPattern.update({
    where: { id },
    data: updates,
  });
  return recordToResult(record);
}

/**
 * Delete a pattern by ID.
 */
export async function deletePattern(id: string): Promise<void> {
  await prisma.embroideryPattern.delete({ where: { id } });
}

/**
 * Helper: deserialize JSON fields into their domain types.
 * Returns the raw Prisma record with deserialized grid and palette.
 * The grid and palette are left as JSON strings — callers use
 * deserializeGrid/deserializePalette when they need the actual data.
 */
function recordToResult(record: EmbroideryPatternRecord): EmbroideryPatternRecord {
  return record;
}
