/**
 * Prompt→product-shape inference (owner 10-19 P0 c9f3e630).
 *
 * When the request carries NO shape (the client only sends one when a PRESET
 * with a product guide is active), the server treated the canvas as a FRAME
 * (`isFrameCanvas` → square margin band) and never ran `applyProductShapeMask`
 * — so on the default 100×100 custom canvas the prompt "Red stock with white
 * top and white toe…" produced FULL-BLEED square art (owner save 533db2d2:
 * all 10,000 cells colored, 3,324 non-white cells outside the stocking
 * silhouette). This module recovers the product shape from STRONG prompt
 * nouns so BOTH the client (canvas clip + dashed overlay) and the server
 * safety net (geometric mask) clip to the real silhouette even without a
 * preset.
 *
 * Conservative by design — a false positive is worse than none: bare "stock"
 * only counts when a holiday/stocking-part noun sits in the prompt
 * (toe/top/cuff/sock/snowflake/Christmas…) so "stock market" never fires.
 */
export type InferredProductShape = "stocking" | "ornament" | "pillow";

/** Accepted values of the text-to-pattern `shape` field. */
export type ProductShapeParam = "stocking" | "ornament" | "pillow" | "square" | "rect";

const STOCKING_EXPLICIT = /\bstockings?\b/i;
// Bare "stock" alone is ambiguous ("stock market", "take stock", "stock
// option") — require a stocking-part / holiday noun nearby.
const STOCKING_BARE = /\bstock\b/i;
const STOCKING_CONTEXT = /\b(toes?|tops?|cuffs?|socks?|snowflakes?|christmas|holiday|xmas)\b/i;
// Widened 10-19 (owner P0 1c6d2de8, Appendix C): her real prompts carried NO
// product noun — "Red background with a christmas tree and snowflakes" and
// "christmas tree" on a 70×70 SQUARE canvas. A holiday-decoration noun on a
// square canvas is overwhelmingly an ORNAMENT intent. Keep the conservative
// list: tree/snowflake/holiday-decoration nouns only when the prompt itself
// does not name another product shape (checked in inferShapeFromPrompt via
// the explicit stocking/pillow tests ABOVE this line run first).
const ORNAMENT_RE =
  /\b(ornaments?|baubles?|bag\s+charms?|christmas\s+trees?|xmas\s+trees?|holiday\s+trees?|snow\s?flakes?|holiday\s+decorations?|christmas\s+decorations?)\b/i;
const PILLOW_RE = /\b(pillows?|cushions?)\b/i;
// 10-21 (owner b132 retest, P0 4dfb1359): her charm prompt was "teddy bear with
// blue sweater" — no product noun at all, yet the canvas was a 28×28 charm. The
// frame path (no shape) silently bypassed mask/clip/face and saved an unmasked
// small centered subject. "charm" alone is ambiguous on big canvases (a charm
// BRACELET pattern), but on a SMALL grid (≤60 cells) it is overwhelmingly a
// bag-charm product intent — route it to ornament deterministically.
const CHARM_RE = /\bcharms?\b/i;

/**
 * Infer the product shape named by the prompt, or undefined when no strong
 * product noun is present. Only product shapes are ever returned — "square"
 * / "rect" (frame shapes) are never inferred; a shape-less prompt without a
 * product noun keeps the current frame behavior.
 */
export function inferShapeFromPrompt(
  prompt: string | undefined,
  opts?: { smallGrid?: boolean },
): InferredProductShape | undefined {
  if (!prompt) return undefined;
  if (STOCKING_EXPLICIT.test(prompt) || (STOCKING_BARE.test(prompt) && STOCKING_CONTEXT.test(prompt))) {
    return "stocking";
  }
  if (ORNAMENT_RE.test(prompt)) return "ornament";
  if (opts?.smallGrid && CHARM_RE.test(prompt)) return "ornament";
  if (PILLOW_RE.test(prompt)) return "pillow";
  return undefined;
}

/**
 * Single source of truth for the EFFECTIVE shape of a text-to-pattern
 * request: an explicit schema shape always wins; otherwise the prompt noun
 * decides. The route uses this so a broken/forgotten client can never produce
 * an unmasked stocking again.
 */
export function resolveEffectiveShape(
  shape: ProductShapeParam | undefined,
  prompt: string | undefined,
  opts?: { smallGrid?: boolean },
): ProductShapeParam | undefined {
  return shape ?? inferShapeFromPrompt(prompt, opts);
}