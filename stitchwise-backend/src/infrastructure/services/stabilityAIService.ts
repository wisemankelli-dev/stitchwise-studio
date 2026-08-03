/**
 * Stability AI Service — text-to-image generation via Stability AI REST API.
 *
 * Used as a SECONDARY image generator (Leonardo is now primary).
 * STABILITY_API_KEY must be configured and have credits for this to work.
 *
 * Stability API docs: https://platform.stability.ai/docs/api-reference
 *
 * Cost: ~$0.01 per generation (SD3, ~1MP output).
 * CREDIT BURN WARNING: Stability bills per API call, even failed ones.
 * A 402 (out of credits) still costs credits. This is why Leonardo is
 * now the primary provider — Leonardo only bills successful generations.
 */

import axios from "axios";
import { logAICall, ESTIMATED_COSTS } from "./aiCostLogger";

const STABILITY_API_BASE = "https://api.stability.ai/v2beta/stable-image/generate";

/**
 * Generate an image from a text prompt using Stability AI.
 * Uses SD3 for superior prompt adherence and color accuracy.
 *
 * Returns null when:
 * - STABILITY_API_KEY is not configured
 * - API returns 401 (invalid key)
 * - API returns 402 (out of credits)
 * - API returns other 4xx/5xx errors or network failures
 *
 * All null returns are logged via aiCostLogger so the caller
 * can fall back gracefully to the next provider in the chain.
 */
export async function generateImageWithStability(
  prompt: string,
  negativePrompt?: string,
  userId?: string,
): Promise<{ url: string; buffer: Buffer } | null> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    logAICall({
      provider: "stability",
      prompt,
      status: "skipped",
      estimatedCostUsd: 0,
      durationMs: 0,
      error: "STABILITY_API_KEY not configured",
      userId,
    });
    return null;
  }

  const start = Date.now();

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

    logAICall({
      provider: "stability",
      prompt,
      status: "success",
      estimatedCostUsd: ESTIMATED_COSTS.stability,
      durationMs: Date.now() - start,
      userId,
    });

    return { url, buffer };
  } catch (err: any) {
    const status = err.response?.status;
    const isCreditError = status === 402;

    logAICall({
      provider: "stability",
      prompt,
      status: isCreditError ? "credit_error" : "error",
      estimatedCostUsd: ESTIMATED_COSTS.stability, // Stability bills even on errors
      durationMs: Date.now() - start,
      error: `${status ?? "network_error"}: ${err.message?.slice(0, 200)}`,
      userId,
    });

    return null;
  }
}
