/**
 * Stability AI Service — text-to-image generation via Stability AI REST API.
 *
 * Used as the primary image generator when STABILITY_API_KEY is configured.
 * Falls back to Leonardo AI or mock if unavailable.
 *
 * Stability API docs: https://platform.stability.ai/docs/api-reference
 */

import axios from "axios";
import type { LeonardoGenerationResponse } from "../../domain/ai/embroideryAI";

const STABILITY_API_BASE = "https://api.stability.ai/v2beta/stable-image/generate";

/**
 * Generate a line-art image from a text prompt using Stability AI Core.
 * Uses strong prompt engineering for clean black outlines on pure white.
 * Color fills are applied later by the user — the AI only draws the lines.
 */
export async function generateImageWithStability(
  prompt: string,
  negativePrompt?: string,
): Promise<{ url: string; buffer: Buffer } | null> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) return null;

  try {
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("output_format", "png");
    if (negativePrompt) formData.append("negative_prompt", negativePrompt);

    const response = await axios.post(`${STABILITY_API_BASE}/core`, formData, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "image/*",
      },
      responseType: "arraybuffer",
      timeout: 60_000,
    });

    const buffer = Buffer.from(response.data);
    // Convert buffer to a data URL for the existing pipeline
    const base64 = buffer.toString("base64");
    const url = `data:image/png;base64,${base64}`;

    return { url, buffer };
  } catch (err) {
    console.error({ event: "stability_generation_error", error: String(err) });
    return null;
  }
}
