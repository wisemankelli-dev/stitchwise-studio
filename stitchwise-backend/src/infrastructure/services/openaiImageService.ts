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
 *
 * MODELS (2026-08-12, owner decision — AI cost revision):
 *   - DEFAULT: gemini-3.1-flash-image ($0.067/image) — all tiers by default.
 *   - PREMIUM: gemini-3-pro-image (~$0.13/image, est) — Design Studio tier
 *     only, via the client premium toggle. Gated server-side by tier; the
 *     premium flag is ignored for non-Studio tiers.
 *
 * The flat/posterized prompt constraints (tried 2026-08-12 with the flash
 * model) produced childish flat drawings — removed. Art prompts now ask for
 * rich, professional illustrations; the image-to-grid pipeline quantizes to
 * stitchable colors.
 *
 * Configurable via GEMINI_IMAGE_MODEL (overrides the default). Returns
 * { url, buffer } or null.
 */
const GEMINI_DEFAULT_MODEL = "gemini-3.1-flash-image";
const GEMINI_PREMIUM_MODEL = "gemini-3-pro-image";
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || GEMINI_DEFAULT_MODEL;
export async function generateImageWithGemini(
  prompt: string,
  styleHints?: string,
  userId?: string,
  premium = false,
  aspectRatio: "1:1" | "2:3" | "3:4" | "9:16" | "16:9" = "1:1",
): Promise<{ url: string; buffer: Buffer } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = premium ? GEMINI_PREMIUM_MODEL : GEMINI_IMAGE_MODEL;
  const defaultStyle = [
    "beautiful professional illustration, elegant refined artwork",
    "rich detail, soft painterly shading and depth",
    "graceful composition, one clear subject",
    "subject fills most of the frame",
    "clean white background",
    "no text, no watermark, no frame, no border",
  ].join(", ");
  const enhancedPrompt = styleHints
    ? `${prompt}, ${styleHints}`
    : `${prompt}, ${defaultStyle}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt === 1) await new Promise((r) => setTimeout(r, 2_000));
      console.error(JSON.stringify({
        event: "gemini_image_request",
        model,
        attempt,
        originalPrompt: prompt,
        aspectRatio,
      }));
      const res = await fetch(url, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: enhancedPrompt }] }],
          generationConfig: { imageConfig: { aspectRatio } },
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (res.status >= 400 && res.status < 500) {
        const body = await res.text();
        lastError = `Gemini ${res.status}: ${body.slice(0, 200)}`;
        console.error(JSON.stringify({ event: "gemini_model_error", model, attempt, error: lastError }));
        break; // hard provider error — retrying won't help
      }
      if (!res.ok) {
        lastError = `Gemini HTTP ${res.status}`;
        console.error(JSON.stringify({ event: "gemini_model_error", model, attempt, error: lastError }));
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
        model,
        status: "success",
        estimatedCost: getEstimatedCost(model),
        durationMs: 0,
        userId,
        promptPreview: prompt.slice(0, 100),
      });
      return { url: dataUrl, buffer };
    } catch (err: any) {
      lastError = err?.message || String(err);
      console.error(JSON.stringify({ event: "gemini_model_error", model, attempt, error: lastError }));
    }
  }
  console.error(JSON.stringify({ event: "gemini_all_attempts_failed", error: lastError }));
  logAICall({
    timestamp: new Date().toISOString(),
    provider: "gemini",
    model,
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
 * @param userId - Optional user id for cost attribution
 * @param premium - When true, use the premium pro model (Design Studio tier only)
 * @returns Object with `url` (data URL) and `buffer` (PNG bytes), or null if unavailable
 */
export async function generateImageWithDallE(
  prompt: string,
  styleHints?: string,
  userId?: string,
  premium = false,
  aspectRatio: "1:1" | "2:3" | "3:4" | "9:16" | "16:9" = "1:1",
): Promise<{ url: string; buffer: Buffer } | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.error(JSON.stringify({
      event: "gemini_no_key",
      message: "GEMINI_API_KEY not configured — AI image generation skipped",
    }));
    return null;
  }
  return generateImageWithGemini(prompt, styleHints, userId, premium, aspectRatio);
}
