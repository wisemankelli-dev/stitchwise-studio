/**
 * OpenAI Image Service — text-to-image generation via DALL-E / gpt-image-1.
 *
 * Uses the OpenAI Images API to generate artwork from text prompts,
 * returning a buffer and URL suitable for the model-agnostic pipeline.
 *
 * Model: "gpt-image-1" (DALL-E successor).
 * Falls back gracefully when OPENAI_API_KEY is not configured.
 *
 * OpenAI API docs: https://platform.openai.com/docs/api-reference/images
 */

import OpenAI from "openai";
import axios from "axios";

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

/**
 * Generate an image from a text prompt using DALL-E / gpt-image-1.
 *
 * The prompt is enhanced with style hints for embroidery-suitable artwork:
 * flat colors, simple shapes, clean edges — ideal for pixel quantization.
 *
 * @param prompt - Text description of the desired image
 * @param styleHints - Optional additional style guidance appended to the prompt
 * @returns Object with `url` (data URL) and `buffer` (PNG bytes), or null if unavailable
 */
export async function generateImageWithDallE(
  prompt: string,
  styleHints?: string,
): Promise<{ url: string; buffer: Buffer } | null> {
  const client = getClient();
  if (!client) {
    console.error(JSON.stringify({
      event: "openai_no_key",
      message: "OPENAI_API_KEY not configured — DALL-E generation skipped",
    }));
    return null;
  }

  // Enhance prompt for embroidery-suitable artwork
  const enhancedPrompt = styleHints
    ? `${prompt}, ${styleHints}`
    : `${prompt}, flat vector art, solid flat colors, no gradients, no shading, clean simple shapes, white background, needlepoint style`;

  // Try model names in order: dall-e-3, gpt-image-1, dall-e-2
  const models = ["dall-e-3", "gpt-image-1", "dall-e-2"];
  let lastError: string | null = null;

  for (const model of models) {
    try {
      console.error(JSON.stringify({
        event: "openai_image_request",
        model,
        originalPrompt: prompt,
      }));

      // Use URL response (b64_json is deprecated for newer models)
      const response = await client.images.generate({
        model,
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) continue;

      // Download the image
      const dlResponse = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 30_000,
      });
      const buffer = Buffer.from(dlResponse.data);

      return { url: imageUrl, buffer };
    } catch (err: any) {
      lastError = err?.message || String(err);
      // Continue to next model
    }
  }

  console.error(JSON.stringify({
    event: "openai_all_models_failed",
    error: lastError,
  }));
  return null;
}

/**
 * Download an image from a URL as a Buffer.
 * Used when the AI service returns a URL instead of raw bytes.
 */
export async function downloadImage(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30_000,
  });
  return Buffer.from(response.data);
}
