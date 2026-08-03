/**
 * Leonardo AI Service — Integration with the Leonardo AI image generation API.
 *
 * PRIMARY image generator for StitchWise. Leonardo is preferred because:
 * - Bills per successful generation only (no credit burn on failures)
 * - ~$0.005 per generation with Kino XL (half Stability's cost)
 * - Generates 512x512 images ideal for embroidery pattern conversion
 *
 * Leonardo API docs: https://docs.leonardo.ai/reference/createsdgimage
 */

import axios, { AxiosError } from "axios";
import type { LeonardoGenerationResponse } from "../../domain/ai/embroideryAI";
import { logAICall, ESTIMATED_COSTS } from "./aiCostLogger";

/** Leonardo AI API base URL. */
const LEONARDO_API_BASE = "https://cloud.leonardo.ai/api/rest/v1";

/** Default generation model (Leonardo Kino XL). */
const DEFAULT_MODEL_ID = "6b645e3a-d64f-4541-a169-18177b1a9f11";

/** Timeout for image generation requests (seconds). */
const GENERATION_TIMEOUT_MS = 120_000;

/**
 * Get the Leonardo API key from environment.
 * Returns null if not configured — caller should fall back.
 */
function getApiKey(): string | null {
  return process.env.LEONARDO_API_KEY || null;
}

/**
 * Create an authenticated axios instance for Leonardo API.
 */
function createClient() {
  const apiKey = getApiKey();
  return axios.create({
    baseURL: LEONARDO_API_BASE,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
}

/**
 * Generate an image from a text prompt using Leonardo AI.
 *
 * Returns null if LEONARDO_API_KEY is not configured (caller should fall back).
 *
 * @param prompt - Text description of the desired image
 * @param negativePrompt - Things to avoid in the generation
 * @param userId - Optional user ID for cost tracking
 * @returns Promise resolving to generation response with image URL, or null
 */
export async function generateImageFromText(
  prompt: string,
  negativePrompt?: string,
  userId?: string,
): Promise<LeonardoGenerationResponse | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    logAICall({
      provider: "leonardo",
      prompt,
      status: "skipped",
      estimatedCostUsd: 0,
      durationMs: 0,
      error: "LEONARDO_API_KEY not configured",
      userId,
    });
    return null;
  }

  const client = createClient();
  const start = Date.now();

  try {
    const payload: Record<string, unknown> = {
      height: 512,
      width: 512,
      modelId: DEFAULT_MODEL_ID,
      prompt,
      num_images: 1,
      sd_version: "v2",
      presetStyle: "DYNAMIC",
      scheduler: "DPMSolverMultistep",
      guidance_scale: 7,
    };

    if (negativePrompt) {
      payload.negative_prompt = negativePrompt;
    }

    const response = await client.post("/generations", payload, {
      timeout: GENERATION_TIMEOUT_MS,
    });

    const generationId = response.data.sdGenerationJob?.generationId;
    if (!generationId) {
      throw new Error("No generationId in Leonardo response");
    }

    // Poll for completion (Leonardo generates asynchronously)
    const imageUrl = await pollForGeneration(client, generationId);

    logAICall({
      provider: "leonardo",
      prompt,
      status: "success",
      estimatedCostUsd: ESTIMATED_COSTS.leonardo,
      durationMs: Date.now() - start,
      userId,
    });

    return {
      id: generationId,
      url: imageUrl,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    const isCreditError = err instanceof AxiosError && (err.response?.status === 402 || err.response?.status === 429);

    logAICall({
      provider: "leonardo",
      prompt,
      status: isCreditError ? "credit_error" : "error",
      estimatedCostUsd: 0, // Leonardo only bills successful generations
      durationMs: Date.now() - start,
      error: String(err).slice(0, 200),
      userId,
    });

    if (err instanceof AxiosError && err.response?.status === 401) {
      return null; // Invalid key — fall back
    }
    return null; // All errors return null for graceful fallback
  }
}

/**
 * Poll Leonardo API until the generation is complete.
 *
 * @param client - Axios client
 * @param generationId - Generation job ID
 * @param maxAttempts - Maximum polling attempts (default 30 = ~60s)
 * @returns URL of the generated image
 */
async function pollForGeneration(
  client: ReturnType<typeof createClient>,
  generationId: string,
  maxAttempts: number = 30,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait 2 seconds between polls
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const response = await client.get(`/generations/${generationId}`);
    const images = response.data.generations_by_pk?.generated_images;

    if (images && images.length > 0) {
      const url = images[0].url;
      if (url) return url;
    }
  }

  throw new Error("Leonardo generation timed out");
}

/**
 * Generate an image variation from an existing image.
 *
 * @param imageUrl - URL of the source image
 * @param prompt - Variation prompt
 * @param userId - Optional user ID for cost tracking
 * @returns Promise resolving to generation response with image URL, or null
 */
export async function generateImageVariation(
  imageUrl: string,
  prompt: string,
  userId?: string,
): Promise<LeonardoGenerationResponse | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    logAICall({
      provider: "leonardo",
      prompt,
      status: "skipped",
      estimatedCostUsd: 0,
      durationMs: 0,
      error: "LEONARDO_API_KEY not configured",
      userId,
    });
    return null;
  }

  const client = createClient();
  const start = Date.now();

  try {
    const payload = {
      prompt,
      modelId: DEFAULT_MODEL_ID,
      init_image_url: imageUrl,
      init_strength: 0.6,
      num_images: 1,
      sd_version: "v2",
      presetStyle: "DYNAMIC",
      scheduler: "DPMSolverMultistep",
      guidance_scale: 7,
    };

    const response = await client.post("/generations", payload, {
      timeout: GENERATION_TIMEOUT_MS,
    });

    const generationId = response.data.sdGenerationJob?.generationId;
    if (!generationId) {
      throw new Error("No generationId in Leonardo response");
    }

    const url = await pollForGeneration(client, generationId);

    logAICall({
      provider: "leonardo",
      prompt,
      status: "success",
      estimatedCostUsd: ESTIMATED_COSTS.leonardo,
      durationMs: Date.now() - start,
      userId,
    });

    return {
      id: generationId,
      url,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    logAICall({
      provider: "leonardo",
      prompt,
      status: "error",
      estimatedCostUsd: 0,
      durationMs: Date.now() - start,
      error: String(err).slice(0, 200),
      userId,
    });
    return null;
  }
}