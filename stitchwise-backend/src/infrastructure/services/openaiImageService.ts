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

  // Enhance prompt for hand-drawn needlepoint artwork, not clip art.
  // The goal is output that feels designed by a professional needlepoint artist:
  // recognizable subjects, strong composition, clean edges, thread-friendly palette.
  const defaultStyle = [
    "traditional counted cross-stitch design",
    "hand-drawn needlepoint artwork by a professional needlepoint designer",
    "elegant composition with clear focal point",
    "clean distinct shapes with well-defined edges",
    "balanced negative space for stitching clarity",
    "DMC-thread-friendly color palette",
    "timeless heirloom-quality needlepoint pattern",
    "white background",
  ].join(", ");

  const enhancedPrompt = styleHints
    ? `${prompt}, ${styleHints}`
    : `${prompt}, ${defaultStyle}`;

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
 * Generate a cross-stitch-suitable SVG line drawing using GPT-4o.
 *
 * GPT-4o outputs clean, single-subject vector art that avoids the
 * repeating-tile artifacts common with diffusion models like Stability AI.
 * The SVG is rasterized to a PNG buffer for downstream stitch-grid conversion.
 *
 * @param prompt - Text description of the desired subject (e.g. "a bird on a branch")
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
    "You are a professional needlepoint and cross-stitch pattern designer.",
    "Generate an SVG of a SINGLE subject with clean, well-defined outlines on a white background.",
    "RULES:",
    "- ONE centered subject only — no repeating tiles, no patterns, no borders",
    "- Draw ONLY black outlines (#000000 or #1a1a1a) on pure white background (#ffffff)",
    "- Use simple, bold shapes with clear edges — like a coloring book page",
    "- The subject should fill roughly 50-70% of the canvas",
    "- Leave generous negative space around the subject for stitching clarity",
    "- No text, no labels, no captions",
    "- No gradients, no shading, no shadows, no fills (outlines only)",
    "- Think: what a needlepoint artist would trace onto fabric",
    "Return ONLY valid SVG code between ```svg ... ``` markers. No explanation.",
  ].join("\n");

  const userPrompt = `Draw a single ${prompt}. Outlines only, white background, centered composition.`;

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
