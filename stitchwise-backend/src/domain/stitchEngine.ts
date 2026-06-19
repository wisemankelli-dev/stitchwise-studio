import { z } from "zod";

// ─── Enums ─────────────────────────────────────────────────────────────────

export type StitchFormat = "dst" | "pes" | "exp" | "jef" | "vp3";

export const STITCH_FORMATS: StitchFormat[] = ["dst", "pes", "exp", "jef", "vp3"];

// ─── Input DTOs ────────────────────────────────────────────────────────────

export interface GenerateStitchInput {
  /** SVG path segments: [[x, y, cmd], ...] */
  paths: DesignPathInput[];
  /** Target format */
  format: StitchFormat;
  /** Stitches per mm (1-20) */
  stitchDensity: number;
}

export interface DesignPathInput {
  segments: Array<[number, number, string]>;
  color: [number, number, number];
  stitchType: "running" | "fill";
}

export interface ConvertFileInput {
  /** File buffer to convert */
  fileBuffer: Buffer;
  /** Original filename to detect source format */
  originalFilename: string;
  /** Target format */
  targetFormat: StitchFormat;
}

// ─── Output Types ──────────────────────────────────────────────────────────

export interface GenerateStitchResult {
  /** Generated file bytes */
  fileBuffer: Buffer;
  /** MIME type for response */
  mimeType: string;
  /** Suggested filename */
  filename: string;
  /** Metadata about the generated design */
  metadata: {
    stitchCount: number;
    colorChanges: number;
    format: string;
  };
}

export interface StitchServiceHealth {
  status: string;
  service: string;
}

export interface FormatInfo {
  extension: string;
  description: string;
}

// ─── Zod Schemas ───────────────────────────────────────────────────────────

export const GenerateStitchSchema = z.object({
  paths: z.array(
    z.object({
      segments: z.array(
        z.tuple([z.number(), z.number(), z.string()])
      ).min(1, "At least one segment is required"),
      color: z.tuple([z.number(), z.number(), z.number()]),
      stitchType: z.enum(["running", "fill"]),
    })
  ).min(1, "At least one path is required"),
  format: z.enum(["dst", "pes", "exp", "jef", "vp3"]).default("dst"),
  stitchDensity: z.number().min(1).max(20).default(4.0),
});

export const ConvertFileSchema = z.object({
  targetFormat: z.enum(["dst", "pes", "exp", "jef", "vp3"]),
});