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
 * Generate an image from a text prompt using Stability AI.
 * Uses SD3 for superior prompt adherence and color accuracy.
 *
 * Returns null when:
 * - STABILITY_API_KEY is not configured
 * - API returns 401 (invalid key) — key is missing or incorrect
 * - API returns 402 (payment required) — key is out of credits
 * - API returns other 4xx/5xx errors or network failures
 *
 * All null returns are logged with specific error context so the caller
 * can fall back gracefully to the next provider in the chain.
 */
export async function generateImageWithStability(
  prompt: string,
  negativePrompt?: string,
): Promise<{ url: string; buffer: Buffer } | null> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    console.error(JSON.stringify({
      event: "stability_skipped",
      reason: "STABILITY_API_KEY not configured — skipping Stability AI",
    }));
    return null;
  }

  try {
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("output_format", "png");
    formData.append("mode", "text-to-image");
    if (negativePrompt) formData.append("negative_prompt", negativePrompt);

    const response = await axios.post(`${STABILITY_API_BASE}/core`, formData, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "image/*",
      },
      responseType: "arraybuffer",
      timeout: 90_000,
    });

    const buffer = Buffer.from(response.data);
    const base64 = buffer.toString("base64");
    const url = `data:image/png;base64,${base64}`;

    return { url, buffer };
  } catch (err: any) {
    const status = err.response?.status;
    const reason = status === 401 ? "invalid_api_key"
      : status === 402 ? "out_of_credits"
      : status === 403 ? "access_denied"
      : status === 429 ? "rate_limited"
      : err.code === "ECONNABORTED" ? "timeout"
      : "unknown";

    console.error(JSON.stringify({
      event: "stability_generation_error",
      status: status ?? "network_error",
      reason,
      message: err.message?.slice(0, 200),
    }));
    return null;
  }
}
