/**
 * AI Image Service — text-to-image generation.
 *
 * Provider (2026-08-12): Google Gemini image generation is the SOLE provider.
 * ~$0.067 per 1024x1024 image (1,120 image tokens at $60/1M tokens), 1:1
 * aspect ratio, subject-fills-frame prompt, 90s request timeout, fail-fast on
 * hard provider errors (4xx).
 *
 * OpenAI was fully removed (gpt-image-1/2 image path AND the GPT-4o SVG path)
 * after the 2026-08-12 billing incident (429 no-credits). One provider = one
 * failure mode, one cost log, one key — no fallback chains, no redundancy
 * surprises.
 *
 * Google API docs: https://ai.google.dev/api/generate-content
 */
import { logAICall, getEstimatedCost } from "./aiCostLogger";

/**
 * Google Gemini image generation (REST, no SDK dependency).
 * ~$0.067 per 1024x1024 image (1120 output tokens at $60/1M tokens) per
 * Google's published pricing. Returns { url (data URL), buffer } or null.
 */
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
export async function generateImageWithGemini(
  prompt: string,
  styleHints?: string,
  userId?: string,
): Promise<{ url: string; buffer: Buffer } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const defaultStyle = [
    "a single flat illustration, one complete composition",
    "not tiled, not repeating, not a pattern, not a fabric swatch, not a wallpaper",
    "clean flat illustration style, posterized, solid color regions, no gradients",
    "the subject is the single clear focus and fills at least 70 percent of the frame",
    "clean well-defined shapes, limited palette of distinct colors",
    "white background, no borders, no frames, no text, no labels",
  ].join(", ");
  const enhancedPrompt = styleHints
    ? `${prompt}, ${styleHints}`
    : `${prompt}, ${defaultStyle}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt === 1) await new Promise((r) => setTimeout(r, 2_000));
      console.error(JSON.stringify({
        event: "gemini_image_request",
        model: GEMINI_IMAGE_MODEL,
        attempt,
        originalPrompt: prompt,
      }));
      const res = await fetch(url, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: enhancedPrompt }] }],
          generationConfig: { imageConfig: { aspectRatio: "1:1" } },
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (res.status >= 400 && res.status < 500) {
        const body = await res.text();
        lastError = `Gemini ${res.status}: ${body.slice(0, 200)}`;
        console.error(JSON.stringify({ event: "gemini_model_error", model: GEMINI_IMAGE_MODEL, attempt, error: lastError }));
        break; // hard provider error — retrying won't help
      }
      if (!res.ok) {
        lastError = `Gemini HTTP ${res.status}`;
        console.error(JSON.stringify({ event: "gemini_model_error", model: GEMINI_IMAGE_MODEL, attempt, error: lastError }));
        continue;
      }
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const inline = parts.find((p: any) => p?.inlineData?.data);
      if (!inline?.inlineData) {
        lastError = "Gemini returned no inline image";
        continue;
      }
      const { mimeType, data: b64 } = inline.inlineData;
      const buffer = Buffer.from(b64, "base64");
      const dataUrl = `data:${mimeType};base64,${b64}`;
      logAICall({
        timestamp: new Date().toISOString(),
        provider: "gemini",
        model: GEMINI_IMAGE_MODEL,
        status: "success",
        estimatedCost: getEstimatedCost(GEMINI_IMAGE_MODEL),
        durationMs: 0,
        userId,
        promptPreview: prompt.slice(0, 100),
      });
      return { url: dataUrl, buffer };
    } catch (err: any) {
      lastError = err?.message || String(err);
      console.error(JSON.stringify({ event: "gemini_model_error", model: GEMINI_IMAGE_MODEL, attempt, error: lastError }));
    }
  }
  console.error(JSON.stringify({ event: "gemini_all_attempts_failed", error: lastError }));
  logAICall({
    timestamp: new Date().toISOString(),
    provider: "gemini",
    model: GEMINI_IMAGE_MODEL,
    status: "error",
    estimatedCost: 0,
    durationMs: 0,
    userId,
    promptPreview: prompt.slice(0, 100),
    error: lastError || undefined,
  });
  return null;
}

/**
 * Generate a stitch-friendly image from a text prompt.
 *
 * Gemini-only dispatch (kept under the historical export name so all callers
 * — embroidery, collage, line-art, text-to-image — stay unchanged). Returns
 * { url (data URL), buffer } or null when unavailable.
 *
 * @param prompt - Text description of the desired image
 * @param styleHints - Optional additional style guidance appended to the prompt
 * @returns Object with `url` (data URL) and `buffer` (PNG bytes), or null if unavailable
 */
export async function generateImageWithDallE(
  prompt: string,
  styleHints?: string,
  userId?: string,
): Promise<{ url: string; buffer: Buffer } | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.error(JSON.stringify({
      event: "gemini_no_key",
      message: "GEMINI_API_KEY not configured — AI image generation skipped",
    }));
    return null;
  }
  return generateImageWithGemini(prompt, styleHints, userId);
}
