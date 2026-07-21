/**
 * Pattern Data Model — Type-safe serialization helpers.
 *
 * Converts between in-memory domain types (StitchGrid, DmcUsage[])
 * and JSON strings for database storage. Uses JSON.stringify/parse
 * with validation to ensure roundtrip integrity.
 */

import type { StitchCell, StitchGrid, DmcUsage } from "./types";

/**
 * Serialize a StitchGrid to a JSON string for database storage.
 */
export function serializeGrid(grid: StitchGrid): string {
  return JSON.stringify(grid);
}

/**
 * Deserialize a JSON string back to a StitchGrid.
 * Validates the structure before returning.
 */
export function deserializeGrid(json: string): StitchGrid {
  const parsed = JSON.parse(json);

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid grid JSON: not an array");
  }

  for (let r = 0; r < parsed.length; r++) {
    const row = parsed[r];
    if (!Array.isArray(row)) {
      throw new Error(`Invalid grid JSON: row ${r} is not an array`);
    }
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (typeof cell !== "object" || cell === null) {
        throw new Error(`Invalid grid JSON: cell at (${r},${c}) is not an object`);
      }
      if (typeof cell.color !== "string") {
        throw new Error(`Invalid grid JSON: cell at (${r},${c}) missing color`);
      }
    }
  }

  return parsed as StitchGrid;
}

/**
 * Serialize a DmcUsage array to a JSON string for database storage.
 */
export function serializePalette(palette: DmcUsage[]): string {
  return JSON.stringify(palette);
}

/**
 * Deserialize a JSON string back to a DmcUsage array.
 */
export function deserializePalette(json: string): DmcUsage[] {
  const parsed = JSON.parse(json);

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid palette JSON: not an array");
  }

  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i];
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`Invalid palette JSON: entry ${i} is not an object`);
    }
    if (typeof entry.code !== "string" || typeof entry.name !== "string") {
      throw new Error(`Invalid palette JSON: entry ${i} missing code or name`);
    }
  }

  return parsed as DmcUsage[];
}