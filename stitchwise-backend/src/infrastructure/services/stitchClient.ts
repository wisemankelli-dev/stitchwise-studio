/**
 * Service for communicating with the Python Stitch Engine microservice.
 *
 * This service acts as the bridge between the Express backend
 * and the FastAPI-based stitch generation service running on port 8000.
 */

import { Readable } from "stream";
import type {
  GenerateStitchResult,
  GenerateStitchInput,
  StitchServiceHealth,
  FormatInfo,
} from "../../domain/stitchEngine";

/** Base URL of the Python stitch microservice. */
const STITCH_SERVICE_URL = process.env.STITCH_SERVICE_URL ?? "http://localhost:8000";

/** Request timeout for stitch operations (ms). */
const REQUEST_TIMEOUT = 120_000; // 2 minutes for complex designs

/**
 * Calls the stitch service's health endpoint.
 */
export async function checkStitchServiceHealth(): Promise<StitchServiceHealth> {
  const url = `${STITCH_SERVICE_URL}/api/health`;
  console.error({ event: "stitch_service_ping", url });

  const response = await fetch(url, {
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`Stitch service health check failed: ${response.status}`);
  }

  return response.json() as Promise<StitchServiceHealth>;
}

/**
 * Calls the stitch service to list supported formats.
 */
export async function getStitchFormats(): Promise<Record<string, FormatInfo>> {
  const url = `${STITCH_SERVICE_URL}/api/formats`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch formats: ${response.status}`);
  }

  const data = (await response.json()) as { formats: Record<string, FormatInfo> };
  return data.formats;
}

/**
 * Generates an embroidery file from SVG path data by calling the Python stitch service.
 *
 * @param input - The design paths and generation parameters.
 * @returns The generated embroidery file as a buffer with metadata.
 */
export async function generateStitchFile(
  input: GenerateStitchInput,
): Promise<GenerateStitchResult> {
  const url = `${STITCH_SERVICE_URL}/api/generate`;

  const payload = {
    paths: input.paths.map((p) => ({
      segments: p.segments,
      color: p.color,
      stitch_type: p.stitchType,
    })),
    format: input.format,
    stitch_density: input.stitchDensity,
  };

  console.error({
    event: "stitch_generation_request",
    format: input.format,
    pathCount: input.paths.length,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Stitch generation failed (${response.status}): ${errorBody}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  // Parse metadata from response headers or content
  const outputFormat = input.format;
  const filename = `stitch_design.${outputFormat}`;

  return {
    fileBuffer,
    mimeType: "application/octet-stream",
    filename,
    metadata: {
      stitchCount: 0, // Would be parsed from .dst file in production
      colorChanges: input.paths.length,
      format: outputFormat,
    },
  };
}

/**
 * Converts an embroidery file to a different format via the Python service.
 */
export async function convertStitchFile(
  fileBuffer: Buffer,
  originalFilename: string,
  targetFormat: string,
): Promise<GenerateStitchResult> {
  const url = `${STITCH_SERVICE_URL}/api/convert`;

  // Build multipart form data
  const formData = new FormData();
  
  // Convert buffer to Blob
  const blob = new Blob([fileBuffer]);
  formData.append("file", blob, originalFilename);
  formData.append("format", targetFormat);

  console.error({
    event: "stitch_conversion_request",
    sourceFile: originalFilename,
    targetFormat,
  });

  const response = await fetch(url, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Stitch conversion failed (${response.status}): ${errorBody}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const resultBuffer = Buffer.from(arrayBuffer);

  return {
    fileBuffer: resultBuffer,
    mimeType: "application/octet-stream",
    filename: `converted.${targetFormat}`,
    metadata: {
      stitchCount: 0,
      colorChanges: 0,
      format: targetFormat,
    },
  };
}