/**
 * Stability AI Service — Integration with Stability AI's image generation API.
 *
 * Provides:
 * - generateImageFromText: text-to-image via Stability REST API
 *
 * Stability API docs: https://platform.stability.ai/docs/api-reference#tag/Generate/paths/~1v2beta~1stable-image~1generate~1core/post
 *
 * Returns images as buffers (not URLs), enabling direct use in the pattern
 * conversion pipeline without an intermediate download.
 */

import axios, { AxiosError } from "axios";
import type { LeonardoGenerationResponse } from "../../domain/ai/embroideryAI";

/** Stability AI v2beta stable image generation endpoint. */
const STABILITY_API_URL = "https://api.stability.ai/v2beta/stable-image/generate/core";

/** Default generation timeout (seconds). */
const GENERATION_TIMEOUT_MS = 120_000;

/** Extended response type that includes the raw image buffer. */
export interface StabilityGenerationResponse extends LeonardoGenerationResponse {
  /** Raw PNG image buffer for direct use in pattern conversion. */
  buffer: Buffer;
}

/**
 * Get the Stability API key from environment.
 */
function getApiKey(): string | null {
  return process.env.STABILITY_API_KEY || null;
}

/**
 * Generate an image from a text prompt using Stability AI.
 *
 * Sends a multipart/form-data request to Stability's v2beta endpoint.
 * Returns the image as a buffer and a generated ID.
 *
 * @param prompt - Text description of the desired image
 * @param negativePrompt - Things to avoid in the generation
 * @returns Promise resolving to generated image with buffer
 */
export async function generateImageFromText(
  prompt: string,
  negativePrompt?: string,
): Promise<StabilityGenerationResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("STABILITY_API_KEY environment variable is not set");
  }

  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("aspect_ratio", "1:1");
  formData.append("output_format", "png");

  if (negativePrompt) {
    formData.append("negative_prompt", negativePrompt);
  }

  try {
    const response = await axios.post(STABILITY_API_URL, formData, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "image/*",
      },
      responseType: "arraybuffer",
      timeout: GENERATION_TIMEOUT_MS,
    });

    const buffer = Buffer.from(response.data);
    const generationId = `stability-${Date.now()}`;

    return {
      id: generationId,
      url: "", // Stability returns raw image data, no URL
      createdAt: new Date().toISOString(),
      buffer,
    };
  } catch (err) {
    if (err instanceof AxiosError) {
      const status = err.response?.status;
      const body = err.response?.data
        ? Buffer.from(err.response.data).toString()
        : "";
      if (status === 401 || status === 403) {
        throw new Error("Invalid Stability API key or unauthorized");
      }
      if (status === 402) {
        throw new Error("Stability API: insufficient credits");
      }
      throw new Error(
        `Stability API error (${status}): ${body.substring(0, 200)}`,
      );
    }
    throw err;
  }
}
