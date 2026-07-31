/**
 * OpenAI SVG Service — GPT-4o chat completions for structured SVG generation.
 *
 * Uses GPT-4o to generate clean, single-subject SVG vector art with organic curves
 * and flat colors — like botanical field guide illustrations.
 * This avoids the repeating-tile artifacts common with diffusion models.
 *
 * Pattern: follows the OpenAI client setup from openaiImageService.ts but
 * uses the chat completions API (not the image generation API).
 */

import OpenAI from "openai";

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

/**
 * Generate a natural-illustration SVG using GPT-4o.
 *
 * GPT-4o produces clean, single-subject vector art with organic curves
 * and flat colors — like a botanical field guide plate. This avoids
 * the repeating-tile artifacts common with diffusion models.
 *
 * The returned SVG string is passed directly to svgToStitchGrid() in the
 * pipeline, which handles rasterization and color quantization.
 *
 * @param prompt - Text description of the desired subject (e.g. "a sunflower with green leaves")
 * @returns Raw SVG string ready for stitch-grid conversion, or null if unavailable
 */
export async function generateSvgFromPrompt(prompt: string): Promise<string | null> {
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
    "- ONE centered subject only — no repeating tiles, no patterns, no borders, no grids",
    "- Draw organic, natural shapes with CURVES — petals, leaves, stems should feel lifelike, not blocky",
    "- Use 5-12 distinct flat colors (solid fills, NO gradients, NO shading, NO shadows)",
    "- Every region MUST be filled with a solid color — no outlines-only shapes",
    "- Use color contrast between adjacent regions instead of black outlines",
    "- The subject should fill roughly 50-70% of the canvas",
    "- White (#ffffff) background with generous negative space",
    "- No text, no labels, no captions, no decorations",
    "- Use viewBox=\"0 0 500 500\" for the SVG root element",
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
      temperature: 0.3,
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

    return svg;
  } catch (err: any) {
    console.error(JSON.stringify({
      event: "gpt4o_svg_error",
      error: err?.message || String(err),
    }));
    return null;
  }
}
