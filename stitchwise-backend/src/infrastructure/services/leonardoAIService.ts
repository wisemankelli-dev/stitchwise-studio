/**
 * Leonardo AI Service — Integration with the Leonardo AI image generation API.
 *
 * Provides:
 * - generateImageFromText: text-to-image generation via Leonardo's API
 * - generateImageVariation: image-to-image variation
 *
 * Leonardo API docs: https://docs.leonardo.ai/reference/createsdgimage
 */

import axios, { AxiosError } from "axios";
import type { LeonardoGenerationResponse } from "../../domain/ai/embroideryAI";

/** Leonardo AI API base URL. */
const LEONARDO_API_BASE = "https://cloud.leonardo.ai/api/rest/v1";

/** Default generation model (Leonardo Kino XL). */
const DEFAULT_MODEL_ID = "6b645e3a-d64f-4541-a169-18177b1a9f11";

/** Timeout for image generation requests (seconds). */
const GENERATION_TIMEOUT_MS = 120_000;

/**
 * Get the Leonardo API key from environment.
 * Falls back gracefully in development/testing.
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
 * @param prompt - Text description of the desired image
 * @param negativePrompt - Things to avoid in the generation
 * @returns Promise resolving to generation response with image URL
 */
export async function generateImageFromText(
  prompt: string,
  negativePrompt?: string,
): Promise<LeonardoGenerationResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    // Return mock response in development when no API key is configured
    return getMockGenerationResponse(prompt);
  }

  const client = createClient();

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

    return {
      id: generationId,
      url: imageUrl,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 401) {
      throw new Error("Invalid Leonardo API key");
    }
    throw err;
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
 * @returns Promise resolving to generation response with image URL
 */
export async function generateImageVariation(
  imageUrl: string,
  prompt: string,
): Promise<LeonardoGenerationResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    // Return mock response
    return {
      id: `mock-var-${Date.now()}`,
      url: imageUrl, // Use original as mock
      createdAt: new Date().toISOString(),
    };
  }

  const client = createClient();

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

  return {
    id: generationId,
    url,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Mock generation response for development/testing without API key.
 * Generates a placeholder image URL using a public SVG/PNG service.
 */
function getMockGenerationResponse(prompt: string): LeonardoGenerationResponse {
  // Use a placeholder service that generates colored images
  const encodedPrompt = encodeURIComponent(prompt.substring(0, 50));
  return {
    id: `mock-${Date.now()}`,
    url: `https://placehold.co/512x512/EEE/999?text=${encodedPrompt}`,
    createdAt: new Date().toISOString(),
  };
}