/**
 * Domain types for the Thread & Fabric Usage Estimator.
 *
 * Calculates physical material requirements (thread length, fabric area)
 * from embroidery stitch pattern data.
 */
import { z } from "zod";

// ─── Constants ─────────────────────────────────────────────────────────────

/** Stitch type identifiers. */
export enum StitchType {
  CROSS = "cross",
  SATIN = "satin",
  BACK = "back",
  FRENCH_KNOT = "french_knot",
}

/** Standard fabric counts (stitches per inch) for Aida cloth. */
export const FABRIC_COUNTS = [11, 14, 16, 18, 22] as const;
export type FabricCount = (typeof FABRIC_COUNTS)[number];

/** Default fabric count if not specified. */
export const DEFAULT_FABRIC_COUNT = 14;

/**
 * Thread length per stitch type (in centimeters).
 * - Cross stitch: ~0.5cm per stitch (with 2 strands)
 * - Satin stitch: varies by area (stitch length × width)
 * - Back stitch: ~0.3cm per stitch
 * - French knot: ~1cm per knot (wrapped around needle)
 */
export const THREAD_LENGTH_CM: Record<StitchType, number> = {
  [StitchType.CROSS]: 0.5,
  [StitchType.SATIN]: 0, // Calculated from area
  [StitchType.BACK]: 0.3,
  [StitchType.FRENCH_KNOT]: 1.0,
};

/** Recommended fabric margin in inches (added to all sides). */
export const FABRIC_MARGIN_IN = 3; // 3 inches per side
export const FABRIC_MARGIN_CM = 7.62; // ~3 inches in cm

// ─── Estimate Types ────────────────────────────────────────────────────────

/** Thread estimate for a single DMC color. */
export interface ThreadEstimate {
  /** DMC color code (e.g. "DMC 321") */
  dmcCode: string;
  /** DMC color name */
  name: string;
  /** Hex color value */
  hex: string;
  /** Number of stitches of this color */
  stitchCount: number;
  /** Stitch type (cross, satin, back, french_knot) */
  stitchType: string;
  /** Estimated thread length in meters */
  meters: number;
}

/** Fabric size estimate. */
export interface FabricEstimate {
  /** Fabric width in inches (calculated from grid size and count) */
  widthIn: number;
  /** Fabric height in inches */
  heightIn: number;
  /** Fabric width in centimeters */
  widthCm: number;
  /** Fabric height in centimeters */
  heightCm: number;
  /** Recommended minimum fabric width in inches (with margins) */
  recommendedWidthIn: number;
  /** Recommended minimum fabric height in inches (with margins) */
  recommendedHeightIn: number;
  /** Recommended minimum fabric width in centimeters */
  recommendedWidthCm: number;
  /** Recommended minimum fabric height in centimeters */
  recommendedHeightCm: number;
  /** Fabric count used for calculation */
  fabricCount: number;
}

/** Complete calculation result. */
export interface EstimateResult {
  /** Thread estimates per DMC color */
  threadEstimates: ThreadEstimate[];
  /** Total thread length in meters */
  totalThreadMeters: number;
  /** Fabric size estimate */
  fabricEstimate: FabricEstimate;
}

// ─── Request Types ─────────────────────────────────────────────────────────

export interface CalculateEstimateRequest {
  /** Stitch counts per DMC code: { "DMC 321": 150, ... } */
  stitches: Record<string, number>;
  /** Stitch type per DMC code: { "DMC 321": "cross", ... } */
  stitchTypes?: Record<string, string>;
  /** Grid width in stitches (e.g. 32) */
  gridWidth?: number;
  /** Grid height in stitches (e.g. 32) */
  gridHeight?: number;
  /** Fabric count (stitches per inch), default 14 */
  fabricCount?: FabricCount;
}

export interface CalculateEstimateResponse {
  success: boolean;
  data?: EstimateResult;
  error?: string;
}

// ─── Input DTO ─────────────────────────────────────────────────────────────

/** Input for satin stitch area calculation. */
export interface SatinStitchArea {
  /** DMC code */
  dmcCode: string;
  /** Stitch length in cm */
  lengthCm: number;
  /** Width of the satin area in cm */
  widthCm: number;
}

// ─── Zod Schemas ───────────────────────────────────────────────────────────

export const CalculateEstimateSchema = z.object({
  stitches: z.record(z.string(), z.number().min(0)),
  stitchTypes: z.record(z.string(), z.string()).optional(),
  gridWidth: z.number().min(1).max(200).optional(),
  gridHeight: z.number().min(1).max(200).optional(),
  fabricCount: z
    .union([z.literal(11), z.literal(14), z.literal(16), z.literal(18), z.literal(22)])
    .optional()
    .default(DEFAULT_FABRIC_COUNT),
});

// ─── Helpers ───────────────────────────────────────────────────────────────

/** CM to inches conversion */
export function cmToInches(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}

/** Inches to CM conversion */
export function inchesToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}