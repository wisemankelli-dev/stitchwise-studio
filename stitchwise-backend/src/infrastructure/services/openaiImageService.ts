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

  // Clean flat illustration — no needlepoint/embroidery language.
  // One recognizable subject, centered, filling the frame.
  const defaultStyle = [
    "a single flat illustration, one complete composition",
    "not tiled, not repeating, not a pattern, not a fabric swatch, not a wallpaper",
    "clean flat illustration style, posterized, solid color regions, no gradients",
    "one clear subject centered and filling the entire frame",
    "clean well-defined shapes, limited palette of distinct colors",
    "white background, no borders, no frames, no text, no labels",
  ].join(", ");

  const enhancedPrompt = styleHints
    ? `${prompt}, ${styleHints}`
    : `${prompt}, ${defaultStyle}`;

  // Single model — gpt-image-1 (no fallback loop to avoid wasted credits)
  const model = "gpt-image-1";

  try {
    console.error(JSON.stringify({
      event: "openai_image_request",
      model,
      originalPrompt: prompt,
    }));

    const response = await client.images.generate({
      model,
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      console.error(JSON.stringify({
        event: "openai_empty_response",
        model,
      }));
      return null;
    }

    const dlResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 30_000,
    });
    const buffer = Buffer.from(dlResponse.data);

    return { url: imageUrl, buffer };
  } catch (err: any) {
    console.error(JSON.stringify({
      event: "openai_model_error",
      model,
      error: err?.message || String(err),
      details: String(err?.response?.data || err?.error || '').substring(0, 300),
    }));
    return null;
  }
}

/**
 * Generate a natural-illustration SVG using GPT-4o.
 *
 * GPT-4o outputs clean, single-subject vector art with organic curves —
 * like a botanical field guide plate — that avoids the repeating-tile
 * artifacts common with diffusion models.
 * The SVG is rasterized to a PNG buffer for downstream stitch-grid conversion.
 *
 * @param prompt - Text description of the desired subject (e.g. "a sunflower with leaves")
 * @returns PNG Buffer ready for stitch-grid conversion, or null if unavailable
 */
export async function generateSVGWithGPT4o(prompt: string): Promise<Buffer | null> {
  const client = getClient();
  if (!client) {
    console.error(JSON.stringify({
      event: "gpt4o_svg_no_key",
      message: "OPENAI_API_KEY not configured — GPT-4o SVG generation skipped",
    }));
    return null;
  }

  const systemPrompt = [
    "You are a botanical and nature illustrator who creates clean SVG vector art.",
    "Generate an SVG of a SINGLE subject — drawn as a natural, recognizable illustration — on a white background.",
    "RULES:",
    "- ONE centered subject only — no repeating tiles, no patterns, no borders",
    "- Draw organic, natural shapes with CURVES — petals, leaves, stems should feel lifelike, not blocky",
    "- Fill each region with a SOLID flat color — use 5-12 distinct, natural colors",
    "- Use color contrast between adjacent regions instead of black outlines",
    "- The subject should fill roughly 50-70% of the canvas",
    "- White (#ffffff) background only behind the subject — no colored background",
    "- No text, no labels, no captions",
    "- No gradients, no shading, no shadows",
    "IMPORTANT: This is a NATURAL ILLUSTRATION. Use curved paths, not rectangles.",
    "Do NOT draw pixel art, needlepoint, cross-stitch, or embroidery-style art.",
    "Think: a simple flat-color botanical plate illustration from a field guide.",
    "Return ONLY valid SVG code between ```svg ... ``` markers. No explanation.",
  ].join("\n");

  const userPrompt = `Draw a single ${prompt} as a natural botanical illustration. Use 5-12 solid flat colors on white background. Organic curved shapes — no pixel art, no embroidery style.`;

  try {
    console.error(JSON.stringify({
      event: "gpt4o_svg_request",
      prompt: userPrompt.slice(0, 200),
    }));

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4096,
      temperature: 0.3, // Low temperature for consistent, clean output
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      console.error(JSON.stringify({ event: "gpt4o_svg_empty_response" }));
      return null;
    }

    // Extract SVG from markdown code fence or direct output
    let svg = content;
    const svgMatch = content.match(/```(?:svg|xml)?\s*([\s\S]*?)```/);
    if (svgMatch) {
      svg = svgMatch[1].trim();
    }

    // Validate it looks like SVG
    if (!svg.includes("<svg") || !svg.includes("</svg>")) {
      console.error(JSON.stringify({
        event: "gpt4o_svg_invalid",
        preview: svg.slice(0, 200),
      }));
      return null;
    }

    // Ensure SVG has a white background rect
    if (!svg.includes("<rect")) {
      svg = svg.replace(
        /(<svg[^>]*>)/,
        '$1\n<rect width="100%" height="100%" fill="#ffffff"/>',
      );
    }

    console.error(JSON.stringify({
      event: "gpt4o_svg_success",
      svgLength: svg.length,
    }));

    // Rasterize SVG → PNG using sharp
    try {
      const sharp = (await import("sharp")).default;
      const pngBuffer = await sharp(Buffer.from(svg))
        .resize(1024, 1024, { fit: "contain", background: "#ffffff" })
        .png()
        .toBuffer();

      return pngBuffer;
    } catch (rasterErr: any) {
      console.error(JSON.stringify({
        event: "gpt4o_svg_raster_error",
        error: rasterErr?.message || String(rasterErr),
      }));
      return null;
    }
  } catch (err: any) {
    console.error(JSON.stringify({
      event: "gpt4o_svg_error",
      error: err?.message || String(err),
    }));
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
