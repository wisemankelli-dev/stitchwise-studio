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

  try {
    // Enhance prompt for embroidery-suitable artwork
    const enhancedPrompt = styleHints
      ? `${prompt}, ${styleHints}`
      : `${prompt}, flat vector art, solid flat colors, no gradients, no shading, clean simple shapes, white background, needlepoint style`;

    console.error(JSON.stringify({
      event: "openai_image_request",
      model: "gpt-image-1",
      originalPrompt: prompt,
    }));

    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    });

    const b64Json = response.data?.[0]?.b64_json;
    if (!b64Json) {
      console.error(JSON.stringify({
        event: "openai_empty_response",
        message: "No image data in OpenAI response",
      }));
      return null;
    }

    const buffer = Buffer.from(b64Json, "base64");
    const url = `data:image/png;base64,${b64Json}`;

    return { url, buffer };
  } catch (err: any) {
    // Handle specific OpenAI errors
    if (err?.status === 401 || err?.status === 403) {
      console.error(JSON.stringify({
        event: "openai_auth_error",
        message: "Invalid or expired OPENAI_API_KEY",
      }));
    } else if (err?.status === 429) {
      console.error(JSON.stringify({
        event: "openai_rate_limit",
        message: "OpenAI rate limit exceeded",
      }));
    } else {
      console.error(JSON.stringify({
        event: "openai_generation_error",
        error: err?.message || String(err),
      }));
    }
    return null;
  }
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
