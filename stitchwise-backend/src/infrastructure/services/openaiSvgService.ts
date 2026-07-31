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
    "You are an illustrator creating clean SVG vector art for digital coloring.",
    "Generate an SVG of a SINGLE subject — drawn as a bold, graphic illustration — on a white background.",
    "RULES:",
    "- ONE centered subject only — no repeating tiles, no patterns, no borders, no grids",
    "- Use 6-10 BOLD, SATURATED flat colors (e.g. vivid yellow #FFD700, forest green #228B22, deep brown #5C3317)",
    "- Every region MUST be filled with a solid, vibrant color — no outlines-only shapes, no pastels",
    "- Use LARGE filled regions — petals should be broad, leaves should be substantial",
    "- Use color contrast between adjacent regions — no two adjacent regions the same color",
    "- The subject should fill roughly 60-80% of the canvas",
    "- White (#ffffff) background only — the subject itself must contain ZERO white regions",
    "- No text, no labels, no captions, no decorations",
    "- No gradients, no shading, no shadows",
    "- Use viewBox=\"0 0 500 500\" for the SVG root element",
    "Do NOT draw pixel art, needlepoint, or embroidery-style art.",
    "Think: a bold flat-color poster illustration with large filled shapes.",
    "Return ONLY valid SVG code between ```svg ... ``` markers. No explanation.",
  ].join("\n");

  const userPrompt = `Draw a single ${prompt} as a bold graphic illustration. Use 6-10 vivid saturated colors. Large filled regions — no white inside the subject.`;

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
