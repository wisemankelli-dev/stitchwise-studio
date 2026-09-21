/**
 * AI Embroidery Pattern Generation API Routes.
 *
 * Endpoints:
 *   POST /api/ai/embroidery/text-to-pattern  — Generate a pattern from a text prompt
 *   POST /api/ai/embroidery/image-to-pattern — Convert an uploaded image to a pattern
 *   POST /api/ai/embroidery/resize-pattern   — Re-process an existing grid at a different size
 *   POST /api/ai/embroidery/shape-to-pattern  — Generate a pattern from a predefined shape
 */

import { Router, type Request, type Response } from "express";
import multer from "multer";
import {
  TextToPatternSchema,
  ImageToPatternSchema,
  ResizePatternSchema,
  AVAILABLE_GRID_SIZES,
  DEFAULT_GRID_SIZE,
  type PatternResult,
  type StitchCell,
} from "../../domain/ai/embroideryAI";
import { CROSS_STITCH_SYMBOLS } from "../../domain/stitch/types";
import { generateImageWithDallE } from "../services/openaiImageService";
import {
  imageUrlToStitchGrid,
  imageBufferToStitchGrid,
  resizeStitchGrid,
  frameMarginCellCount,
} from "../../domain/stitch/patternConverter";
import { recenterGrid } from "../../domain/stitch/recenterGrid";
import { applyProductShapeMask } from "../../domain/stitch/productShapeMask";
import { applyFaceFeatureGuard, countDarkCells, isAnimalFacePrompt } from "../../domain/stitch/faceFeatureGuard";
import { generateShape } from "../../domain/ai/shapeLibrary";
import { optionalAuth } from "../middleware/auth";
import {
  DEFAULT_FABRIC_COUNT,
  AVAILABLE_FABRIC_COUNTS,
  getMaxColors,
} from "../../domain/stitch/fabricCounts";
import { aiRateLimit, isPremiumTier } from "../middleware/aiRateLimit";
import { createAIJob } from "../services/aiJobStore";


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Allowed: PNG, JPEG, WebP, GIF"));
    }
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a StitchCell[][] grid to a flat string[][] of hex colors for the frontend.
 */
function flattenGrid(grid: StitchCell[][]): string[][] {
  return grid.map(row => row.map(cell => cell.color));
}

/**
 * Build the standard pattern response body shared across endpoints.
 */
function buildPatternResponse(pattern: PatternResult, extra: Record<string, unknown> = {}) {
  const flatGrid = flattenGrid(pattern.grid);
  const gridH = flatGrid.length;
  const gridW = flatGrid[0]?.length || 0;
  return {
    success: true,
    grid: flatGrid,
    stitchTypes: flatGrid.map(row => row.map(() => "cross")),
    width: gridW || pattern.gridSize,
    height: gridH || pattern.gridSize,
    dmcPalette: pattern.dmcColors.map((c, i) => ({
      code: c.code,
      name: c.name,
      hex: c.hex,
      count: c.count,
      symbol: CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length],
    })),
    totalStitches: pattern.stitchCount,
    gridSizes: [...AVAILABLE_GRID_SIZES],
    ...extra,
  };
}

/** Clamp a raw stitch count to the nearest valid grid size. */
function clampToGridSize(raw: number): number {
  const sizes = AVAILABLE_GRID_SIZES as readonly number[];
  let closest = sizes[0];
  let minDiff = Math.abs(raw - closest);
  for (const s of sizes) {
    const diff = Math.abs(raw - s);
    if (diff < minDiff) { minDiff = diff; closest = s; }
  }
  return closest;
}

/**
 * Aspect-aware, vibrant prompt enrichment.
 *
 * Fixes (owner 09-03): "colorful floral stocking" came out 27% filled / 5
 * browns, and "sunset beach scene → ornament" came out a blob. Root causes
 * handled here:
 *  1. NO color-draining hints — "flat vector art, solid flat colors only, no
 *     gradients, no shading, white background" gutted vibrant asks. We append
 *     VIBRANT, color-rich, subject-fills-shape guidance instead.
 *  2. Product-shape fill — when a stocking/ornament/canvas shape is active,
 *     we tell the model to fill that silhouette with the subject so coverage
 *     stays dense (no large blank fabric).
 *  3. Padding (owner 09-03 #2): a SQUARE or LANDSCAPE canvas is a FRAME, not
 *     a cutout — the subject must stay fully inside with margins on every
 *     side (5–10%), never bleeding to the edge ("teddy bear cut off top and
 *     bottom"). PORTRAIT/tall canvases and explicit product shapes keep the
 *     edge-to-edge fill phrase (that's what fixed the 27%-filled stocking).
 *  4. Scene guard — "scene"/"beach"/"landscape"/"sunset" prompts get a
 *     "landscape scene only, no people, no text" guard so a sunset becomes a
 *     scene, not a person-blob.
 */

/** True when the canvas should be treated as a frame with margins (square or
 * landscape), as opposed to a product shape / tall canvas that fills. */
export function isSquareOrLandscape(
  canvasWidth?: number,
  canvasHeight?: number,
): boolean {
  if (!canvasWidth || !canvasHeight) return true; // default square canvas → frame
  return canvasWidth >= canvasHeight;               // 1:1 or wider
}
/**
 * True when this request is a PICTURE FRAME (needs margins) rather than a
 * product shape (stocking/ornament/pillow — meant to fill edge-to-edge).
 * A canvas is a frame ONLY for the explicit 'rect'/'square' shape on a
 * square/landscape canvas, or for NO shape on a square/landscape canvas.
 * Explicit product shapes are NEVER frames even when the canvas is square
 * (e.g. a 3″×3″ ornament preset is 42×42 → NOT a frame; it fills the bauble).
 * This is the SINGLE source of truth used by enrichAIPrompt, the converter
 * margin band, and the quality gate so they cannot drift apart (owner 09-03
 * #4: ornament was misclassified as a frame → contain margins shrunk the
 * subject at 42 cells → frontend circle clip → unrecognisable blob).
 */
export function isFrameCanvas(
  shape?: "stocking" | "ornament" | "pillow" | "square" | "rect",
  canvasWidth?: number,
  canvasHeight?: number,
): boolean {
  const isExplicitRect = shape === "square" || shape === "rect";
  return (isExplicitRect && isSquareOrLandscape(canvasWidth, canvasHeight)) ||
    (!shape && isSquareOrLandscape(canvasWidth, canvasHeight));
}

/**
 * Small-grid threshold. Under it the stitch grid is so coarse (e.g. a 3″
 * ornament at 14ct = 42×42 cells) that photorealistic shading quantizes into
 * tiny muddy regions — the "busy design" complaint (owner 09-11, ornament).
 * When the target grid is this small, we additionally ask the model for bold
 * flat cartoon/sticker art instead of realistic detail (which can never
 * survive a ≤60-cell grid).
 */
export const SMALL_GRID_MAX_DIM = 60;

/** True when the target canvas is small enough to need the simplified style. */
export function isSmallGrid(canvasWidth?: number, canvasHeight?: number): boolean {
  if (!canvasWidth || !canvasHeight) return false;
  return Math.min(canvasWidth, canvasHeight) <= SMALL_GRID_MAX_DIM;
}

/**
 * Tokens that mark a prompt as ALREADY descriptive. If the user prompt
 * contains any of these (colors, materials/textures, styles, sizes, outfit
 * hints), it is treated as "specified enough" and left verbatim. Bare prompts
 * like "teddy bear" get none of these → they are auto-padded below.
 */
const PROMPT_DESCRIPTOR_TOKENS = new Set([
  // colors
  "red", "orange", "yellow", "green", "blue", "purple", "pink", "brown",
  "black", "white", "grey", "gray", "gold", "silver", "teal", "navy",
  "maroon", "beige", "cream", "coral", "turquoise", "lavender", "magenta",
  "aqua", "tan", "rust", "amber", "indigo", "violet", "rainbow",
  // materials / textures / styles
  "soft", "fluffy", "fuzzy", "furry", "plush", "cuddly", "cute", "adorable",
  "charming", "cozy", "knitted", "knit", "crocheted", "wool", "woolen",
  "fleece", "velvet", "satin", "denim", "plaid", "striped", "spotted",
  "polka", "gingham", "checked", "patchwork", "quilted", "embroidered",
  "beaded", "glitter", "sparkly", "shiny", "glossy", "matte", "pastel",
  "bright", "dark", "pale", "bold", "vibrant", "colorful", "sweet", "dainty",
  "elegant", "rustic", "modern", "vintage", "retro", "cartoon", "realistic",
  // sizes / attributes / poses
  "big", "small", "large", "tiny", "little", "huge", "giant", "tall",
  "short", "fat", "slim", "skinny", "chubby", "round", "square", "oval",
  "long", "sleeping", "sitting", "standing", "flying", "smiling", "wearing",
  "holding", "carrying",
  // nouns that imply a fuller description
  "sweater", "scarf", "hat", "bow", "dress", "jacket", "boots", "flowers",
  "daisy", "roses", "butterfly", "heart", "star", "face", "eyes", "fur",
]);
/** Scene keywords — an intentional landscape/scene prompt must NOT be padded
 * (auto-adding character detail would distort a sunset/seascape ask). */
export const SCENE_KEYWORDS_REGEX = /\b(scene|beach|landscape|sunset|sunrise|seascape|mountain|forest|garden|street|city)\b/;
/**
 * Descriptive padding for UNDER-SPECIFIED prompts (owner 09-14: a bare
 * "teddy bear" came back as generic ugly clip art, while "teddy bear with
 * a brown sweater" drew a rich subject). Appended once (idempotent via the
 * marker check below) so Gemini has concrete detail to latch onto. Deliberately
 * subject-flexible (works for animals, characters and objects) and safe to
 * concatenate with the comma-joined style directives.
 */
/**
 * Descriptive padding for UNDER-SPECIFIED or bare prompts (owner 09-14: a
 * bare "teddy bear" came back as generic ugly clip art, while "teddy bear
 * with a brown sweater" drew a rich subject). Two deterministic layers:
 *  1. SUBJECT_RICH_DESCRIPTORS lexicon — known craft subjects get a vivid
 *     10-15 word descriptor (texture/colors/expression/details); color+noun
 *     prompts ("blue bird", "pink cat") merge the user's color into the
 *     descriptor.
 *  2. Generic fallback for any other very short prompt (no adjectives).
 * Everything is appended once (idempotent marker below) so Gemini has
 * concrete detail to latch onto, and it is safe to concatenate with the
 * comma-joined style directives at ANY grid size and shape.
 */
const PROMPT_COLOR_TOKENS = new Set([
  "red", "orange", "yellow", "green", "blue", "purple", "pink", "brown",
  "black", "white", "grey", "gray", "gold", "silver", "teal", "navy",
  "maroon", "beige", "cream", "coral", "turquoise", "lavender", "magenta",
  "aqua", "tan", "rust", "amber", "indigo", "violet",
]);
/** Colors that appear in lexicon descriptors; the first one found in a
 * descriptor is replaced with the user's color ("pink bird" → descriptor
 * recolored to pink). */
const DEFAULT_DESCRIPTOR_COLORS = [
  "blue", "red", "green", "yellow", "white", "black", "brown", "orange",
  "pink", "gold",
];
/**
 * SUBJECT → RICH-DESCRIPTOR LEXICON for common simple craft subjects. Every
 * descriptor is 10-15 words of texture/color/expression/detail that Gemini
 * can latch onto. Lookup is exact on the normalized prompt first ("blue
 * bird"), then on the color-stripped noun with a color merge ("pink bird").
 */
export const SUBJECT_RICH_DESCRIPTORS: Record<string, string> = {
  "teddy bear": "with soft brown fur, round ears, LARGE dark button eyes and a dark nose, a sweet muzzle, a cozy knitted sweater, a plump cuddly body",
  "teddy": "with soft brown fur, round ears, LARGE dark button eyes and a dark nose, a sweet muzzle, a cozy knitted sweater, a plump cuddly body",
  "bear": "a brown fluffy bear with round ears, LARGE dark button eyes and a dark nose, a sweet muzzle and a sturdy plump body",
  "bird": "with soft blue feathers, a bright orange beak, a round dark eye, a smooth rounded body and tiny feet",
  "blue bird": "with soft blue feathers, a bright orange beak, a round dark eye, a smooth rounded body and tiny feet",
  "red bird": "with vivid red feathers, a bright orange beak, a round dark eye, a smooth rounded body and tiny feet",
  "house": "a cozy storybook house with bright warm windows, a cheerful front door, a steep roof and flowers at the base",
  "fish": "with smooth shiny scales, a flowing tail, a big friendly eye, rounded fins and cheerful bright colors",
  "cat": "with soft fur, round green eyes, a tiny pink nose, whiskers and a fluffy curled tail",
  "dog": "with soft floppy ears, a wet black nose, a happy lolling tongue, a wagging tail and warm friendly eyes",
  "butterfly": "with large colorful wings covered in delicate symmetrical patterns, a slender body and curly antennae",
  "flower": "with layered colorful petals, a sunny yellow center, a gentle green stem and fresh green leaves",
  "heart": "a plump rounded heart in warm red with a soft glossy highlight and a cute outline",
  "star": "a bright golden star with rounded points, a gentle warm glow and a cheerful face",
  "bunny": "with long soft ears, a fluffy white tail, a round pink nose, gentle eyes and a tiny mouth",
  "rabbit": "with long soft ears, a fluffy white tail, a round pink nose, gentle eyes and a tiny mouth",
  "snowman": "a round white snowman with a carrot nose, coal eyes, a striped scarf and a top hat, cheerful and jolly",
  "tree": "a friendly tree with a sturdy brown trunk, lush round green foliage and a few red apples",
  "mushroom": "a cute mushroom with a rounded red cap dotted with white spots, a cream stem and soft grass at its base",
  "sunflower": "a big sunny sunflower with bright yellow petals around a dark brown center, a green stem and leaves",
  "rose": "a full blooming rose with layered soft red petals, a gentle green stem and one small leaf",
  "penguin": "a plump penguin with a white belly, a black back, an orange beak and feet, and bright round eyes",
  "owl": "a wise owl with big round golden eyes, soft brown feathery wings and tiny tufted ears",
  "frog": "a cheerful green frog with big round eyes, smooth shiny skin and little webbed feet",
  "duck": "a soft yellow duckling with an orange bill, tiny wings and bright round eyes",
  "bee": "a fuzzy striped bee with big friendly eyes, delicate translucent wings and a tiny stinger",
  "ladybug": "a round red ladybug with black spots, a friendly smile and six tiny legs",
  "turtle": "a gentle turtle with a rounded green shell, a sweet face and sturdy little flippers",
  "fox": "a fluffy orange fox with a white chest, big pointy ears, a bushy tail and clever bright eyes",
  "deer": "a graceful fawn with soft brown fur, big gentle eyes, long slender legs and small round ears",
  "horse": "a friendly horse with a flowing mane, a soft muzzle, kind eyes and sturdy legs",
  "puppy": "a playful puppy with big floppy ears, a wet nose, floppy paws and a wagging tail",
  "kitten": "a tiny kitten with soft fur, big round eyes, tiny whiskers and a curled tail",
  "pig": "a rosy pig with a round snout, floppy ears, a curly tail and a cheerful smile",
  "cow": "a friendly spotted cow with big gentle eyes, soft ears and a sweet muzzle",
  "sheep": "a fluffy white sheep with a round woolly body, a black face and legs, and gentle eyes",
};
/** Universal rich-detail tail appended to EVERY padded prompt. Its words
 * serve as the idempotency marker (a padded prompt is never padded twice). */
export const RICHNESS_TAIL = ", polished children's-book illustration style, rich in character and detail";
/** Generic fallback for an under-specified prompt that is not in the lexicon. */
export const GENERIC_RICHNESS_PHRASE = "soft detailed textures, rich colors, clear simple shapes";

/** Lowercase, drop punctuation, collapse whitespace, strip a leading article. */
function normalizePromptKey(raw: string): string {
  return raw.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:a|an|the|my)\s+/, "");
}

/**
 * Lexicon lookup: exact normalized phrase first ("blue bird"), then the
 * color-stripped noun with the user's colors ("pink bird" → bird descriptor,
 * recolored). Null when the prompt is not a known craft subject.
 */
function lookupLexiconDescriptor(raw: string): { descriptor: string; colors: string[] } | null {
  const norm = normalizePromptKey(raw);
  if (SUBJECT_RICH_DESCRIPTORS[norm]) return { descriptor: SUBJECT_RICH_DESCRIPTORS[norm], colors: [] };
  const words = norm.split(" ").filter(Boolean);
  const colors = words.filter((w) => PROMPT_COLOR_TOKENS.has(w));
  if (colors.length === 0) return null;
  const bare = words.filter((w) => !PROMPT_COLOR_TOKENS.has(w)).join(" ");
  if (!SUBJECT_RICH_DESCRIPTORS[bare]) return null;
  let descriptor = SUBJECT_RICH_DESCRIPTORS[bare];
  for (const def of DEFAULT_DESCRIPTOR_COLORS) {
    const re = new RegExp(`\\b${def}\\b`);
    if (re.test(descriptor)) {
      descriptor = descriptor.replace(re, colors[0]);
      break;
    }
  }
  return { descriptor, colors };
}

/** True when a color+noun phrase (≤5 words) matches the lexicon — these get
 * the lexicon descriptor even though the color alone would look "specified". */
export function isColorNounLexiconPrompt(rawPrompt: string): boolean {
  const words = normalizePromptKey(rawPrompt).split(" ").filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;
  const colors = words.filter((w) => PROMPT_COLOR_TOKENS.has(w));
  if (colors.length === 0) return false;
  const bare = words.filter((w) => !PROMPT_COLOR_TOKENS.has(w)).join(" ");
  return !!SUBJECT_RICH_DESCRIPTORS[bare];
}

/**
 * True when the user prompt is too bare to guide image generation: very
 * short (≤5 real words) and carries NO descriptive tokens. Deterministic —
 * no LLM call, no randomness. Excluded by design: scene/landscape prompts
 * (intentional) and anything that already received the padding.
 */
export function isUnderSpecifiedPrompt(rawPrompt: string): boolean {
  const normalized = rawPrompt.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const withoutArticle = normalized.replace(/^(?:a|an|the)\s+/, "");
  const words = withoutArticle.split(" ").filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;
  if (SCENE_KEYWORDS_REGEX.test(normalized)) return false;
  if (words.some((w) => PROMPT_DESCRIPTOR_TOKENS.has(w))) return false;
  return true;
}

/** @deprecated Owner 09-14: ALL prompt requests go to the AI image path — this
 * fast path is no longer wired into the text-to-pattern route. Kept exported
 * only because existing tests still reference it. Do not use for new code. */
export const PROCEDURAL_SUBJECT_NAMES = new Set([
  "sunflower", "bird", "bird on branch", "branch bird", "lunar moth",
  "luna moth", "butterfly", "rose", "heart", "love", "star", "stars",
  "peony", "bouquet", "flower bouquet", "pink flower",
]);
/** @deprecated — see PROCEDURAL_SUBJECT_NAMES. */
export function shouldUseProceduralPattern(prompt: string): boolean {
  const normalized = prompt.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const withoutArticle = normalized.replace(/^(?:a|an|the)\s+/, "");
  return PROCEDURAL_SUBJECT_NAMES.has(withoutArticle);
}

/**
 * Idempotent prompt normalizer: pads a bare/under-specified prompt with
 * either its lexicon descriptor (color-merged when the user gave a color) or
 * the generic richness phrase — exactly once (marker check below). Detailed
 * prompts — and anything already padded — pass through untouched. Applied
 * inside enrichAIPrompt so the client keeps sending prompts unchanged; works
 * for every shape and grid size.
 */
export function padUnderSpecifiedPrompt(rawPrompt: string): string {
  if (rawPrompt.includes("polished children's-book illustration style, rich in character and detail")) return rawPrompt;
  const lexicon = lookupLexiconDescriptor(rawPrompt);
  if (lexicon) {
    // For color+noun prompts, the descriptor has already been recolored to
    // the user's color ("pink bird" → "soft pink feathers …").
    return `${rawPrompt.trim()}, ${lexicon.descriptor}${RICHNESS_TAIL}`;
  }
  if (isUnderSpecifiedPrompt(rawPrompt)) {
    return `${rawPrompt.trim()}, ${GENERIC_RICHNESS_PHRASE}${RICHNESS_TAIL}`;
  }
  return rawPrompt;
}
export function enrichAIPrompt(
  prompt: string,
  shape?: "stocking" | "ornament" | "pillow" | "square" | "rect",
  opts?: { canvasWidth?: number; canvasHeight?: number },
): { prompt: string; sceneGuardApplied: boolean; shapeHintApplied: boolean; smallGrid: boolean } {
  const subjectPrompt = padUnderSpecifiedPrompt(prompt);
  const enriched: string[] = [subjectPrompt];
  const lower = prompt.toLowerCase();
  let sceneGuardApplied = false;
  let shapeHintApplied = false;
  const smallGrid = isSmallGrid(opts?.canvasWidth, opts?.canvasHeight);

  // Vibrant / color-rich guidance (replaces the old color-draining hints).
  // NOTE: this deliberately stays in EVERY enriched prompt — including the
  // small-grid path below — so "flat/simple" never turns into dull/muddy
  // color (owner 09-03: the old "flat vector art, solid flat colors only"
  // hints gutted colorful asks into 5 browns).
  enriched.push(
    "vibrant, saturated, colorful illustration",
    "bold rich colors in every area, no dull muddy tones",
  );

  // Product-shape fill — the art must cover the shape, not float on white.
  // Tall/narrow canvases (stocking etc.) also fill edge-to-edge. But a
  // SQUARE / LANDSCAPE canvas is a picture frame: keep the subject inside
  // with comfortable margins so nothing gets cropped (owner: teddy bear cut
  // off at top/bottom).
  //
  // CIRCLE-CLIP phrasing (owner 09-11 "ornament is busy / doesn't translate"):
  // the client clips the final grid to a circle (ornament) or rounded square
  // (pillow) mask. "Fill edge to edge" makes Gemini draw SQUARE full-bleed
  // compositions whose corners are then clipped by the mask — the subject
  // gets cut at the circle boundary and reads as broken mush (saved 42×42
  // ornament: bbox touches all four square edges, 5 browns + 2 blues in
  // 1-cell regions). Telling the model the art is CLIPPED to the silhouette
  // keeps the subject inside the visible shape, corners empty.
  const isExplicitRect = shape === "square" || shape === "rect";
  const isFrame = isFrameCanvas(shape, opts?.canvasWidth, opts?.canvasHeight);

  if (shape === "stocking") {
    // Owner 09-11 ("stocking inside a stocking"): 'stocking shape filled with
    // the subject' made Gemini draw an actual STOCKING OBJECT with the teddy
    // inside it — a scene. The subject itself must BE the stocking silhouette:
    // its own body takes the stocking shape (head at the cuff, body tapering
    // to the toe), with NO separate stocking drawn around it.
    enriched.push(
      "the subject itself must take the exact shape of a tall Christmas stocking: the subject's own body IS the stocking silhouette — head near the top cuff, torso widening then tapering into a pointed toe at the bottom, no separate stocking object wrapped around the subject, no scene inside; the subject fills the whole tall stocking shape edge to edge, no blank space",
    );
    shapeHintApplied = true;
  } else if (shape === "ornament") {
    enriched.push(
      "perfectly fill a circular ornament bauble: the artwork will be clipped to a CIRCLE, so draw the subject centered inside a circle inscribed in the square canvas, filling that circle from top to bottom and side to side; the four corners of the square stay empty; keep the whole subject inside the circle, nothing important touches the circle edge, and the subject should be LARGE and fill most of the circle",
    );
    shapeHintApplied = true;
  } else if (shape === "pillow") {
    // Owner 09-11 (same rule as stocking): the subject must FILL the mask, not
    // sit inside a drawn pillow. The subject's own body spreads to take the
    // full rounded-square pillow silhouette; no pillow object is drawn around it.
    enriched.push(
      "the artwork will be clipped to a ROUNDED SQUARE silhouette, and the subject itself must fill that silhouette: the subject's own body spreads to take the pillow's shape edge to edge (corners slightly rounded), no separate pillow object drawn around the subject, no scene inside; the outer corners of the canvas stay empty; nothing important touches the rounded edge",
    );
    shapeHintApplied = true;
  } else if (isFrame) {
    // Square/landscape canvas → frame with padding, never crop the subject.
    enriched.push(
      "subject fills the frame with comfortable padding and margins on all sides, the entire subject stays fully inside the canvas, nothing touches the edges, leave 5-10% margin around the subject, head not cropped at top, feet and hands not cropped at bottom",
    );
    shapeHintApplied = true;
  } else if (shape === "square" || shape === "rect") {
    // Explicit square/rect shape with a TALL canvas → keep old fill behavior.
    enriched.push("subject fills the whole rectangular frame, edge to edge, no empty margins");
    shapeHintApplied = true;
  } else {
    enriched.push("subject fills most of the frame");
  }

  // Scene guard — a beach/sunset/landscape is a SCENE, not a person portrait.
  if (SCENE_KEYWORDS_REGEX.test(lower)) {
    enriched.push("landscape scene only, no people, no faces, no text, no watermark");
    sceneGuardApplied = true;
  }

  // Small-grid simplification (owner 09-11 "ornament is busy"): at ≤60 cells
  // photorealistic shading can never survive — it quantizes into scattered
  // 1-cell regions across 8-10 thread colors. Ask for bold flat art instead.
  // Deliberately keeps the vibrant/color-rich hints above so the result is a
  // clean, colorful design — NOT the dull 5-brown result of the old
  // "flat vector art / solid flat colors only / white background" phrasing.
  // Follow-up (owner 09-11 "collapsed to a solid block"): the uncluttered
  // wording swung too far and dropped the bear's features entirely (one tan
  // blob, 3 dark cells). Rebalance: keep the flat style but REQUIRE a thick
  // dark outline + simple readable features + a large subject.
  if (smallGrid) {
    enriched.push(
      "bold flat cartoon-sticker style with big simple shapes and minimal shading, plus a THICK dark outline around the whole subject and simple readable features with LARGE clearly-visible dark eyes and a dark nose (for animals: a face with large dark button eyes, a dark nose, a muzzle, round ears, distinct head and body); the subject should fill most of the circle; no photo texture, no fine fur or fabric detail — the outline and features must stay visible at a very small stitch count",
    );
    // Small-grid head roundness (owner 09-21 "bag charm update 2", 28×28):
    // Gemini draw variance produced a lopsided head — a single off-center ear
    // nub at row 2, flat banded top, asymmetric left/right sides — even though
    // the face-absence guard added the eyes/nose/outline. The subject shape is
    // untouched by the guard (it only repaints border cells + adds face
    // feature cells), so the fix must demand a SYMMETRIC round head from the
    // model at the source. Only for animal/face prompts — non-animal subjects
    // (snowflake/heart/flower) must stay exactly as-is.
    if (isAnimalFacePrompt(prompt)) {
      enriched.push(
        "perfectly symmetric head with a perfectly round crown centered on the canvas: mirror-image left and right sides of the head, two identical round ears sticking up at the top corners of the head, front-facing, no tilted or lopsided head",
      );
    }
  }

  return { prompt: enriched.join(", "), sceneGuardApplied, shapeHintApplied, smallGrid };
}

/** Map canvas dims to the closest Gemini-supported aspect ratio. */
export function aspectFromCanvas(canvasWidth?: number, canvasHeight?: number): "1:1" | "2:3" | "3:4" | "9:16" | "16:9" {
  if (!canvasWidth || !canvasHeight) return "1:1";
  const ratio = canvasWidth / canvasHeight;
  if (ratio < 0.6) return "9:16";       // very tall (stocking)
  if (ratio < 0.8) return "2:3";        // tall
  if (ratio < 1.3) return "1:1";        // roughly square
  if (ratio < 1.8) return "3:4";        // wide-ish
  return "16:9";                         // very wide
}

/**
 * True when the subject of a SQUARE/LANDSCAPE (frame) canvas touches any
 * canvas edge — the classic "cut off on the page" symptom (owner 09-03:
 * teddy bear had 0px top/bottom margin). Only meaningful for frame canvases:
 * product shapes (stocking/ornament/pillow) are SUPPOSED to fill edge-to-edge.
 *
 * Returns the touched edge(s) or null when the subject has margin everywhere.
 */
export function subjectTouchesEdge(
  grid: StitchCell[][],
  dmcColors: { hex: string; count: number }[],
): "top" | "bottom" | "left" | "right" | null {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  if (rows < 3 || cols < 3) return null; // too small to judge
  const bgHex = [...dmcColors].sort((a, b) => b.count - a.count)[0]?.hex?.toLowerCase() || "";
  const isBackground = (hex: string) => {
    const h = (hex || "").toLowerCase();
    if (!h) return false;
    if (h === bgHex) return true;
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    // Near-white / near-fabric tones count as background. Deliberately the SAME
    // halo rule the converter uses to define foreground (pipeline.ts merges
    // max>=190 && (max-min)/max<=0.2 into DMC White 520) so the edge gate can
    // never false-fire on cream/near-white background halo (owner 09-11: the
    // bbox "overlap" check counted cream as subject and hid the cut).
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return (r > 245 && g > 245 && b > 245) || (max >= 190 && (max - min) / max <= 0.2);
  };
  const nonBg = (r: number, c: number) => {
    const cell = grid[r]?.[c];
    return !!cell?.color && !isBackground(cell.color);
  };
  // Check vertical edges (left/right) first, excluding corners so a fill
  // that reaches a corner is still classified by its dominant edge.
  for (let r = 1; r < rows - 1; r++) if (nonBg(r, 0)) return "left";
  for (let r = 1; r < rows - 1; r++) if (nonBg(r, cols - 1)) return "right";
  for (let c = 1; c < cols - 1; c++) if (nonBg(0, c)) return "top";
  for (let c = 1; c < cols - 1; c++) if (nonBg(rows - 1, c)) return "bottom";
  // Corner-only touches (rare): fall back to any edge.
  if (nonBg(0, 0) || nonBg(0, cols - 1) || nonBg(rows - 1, 0) || nonBg(rows - 1, cols - 1)) return "top";
  return null;
}

/**
 * Quality gate for AI→pattern conversion (owner 09-03: mud/sparse grids were
 * silently saved). Validates coverage (fill%) and color diversity after
 * conversion. Returns a warning string when the conversion did NOT come out
 * clean so the frontend can show it instead of silently saving a blob.
 */
export function qualityGate(
  grid: StitchCell[][],
  dmcColors: { hex: string; count: number }[],
  prompt: string,
  opts?: { frame?: boolean; canvasWidth?: number; canvasHeight?: number },
): string | null {
  const total = grid.length * (grid[0]?.length || 0);
  if (total === 0) return "AI image did not convert to any stitches — try a more specific prompt";
  // Count filled cells: a cell is "filled" when it has a color that is NOT the
  // dominant background (light/white fabric reads as blank).
  const bgHex = [...dmcColors].sort((a, b) => b.count - a.count)[0]?.hex?.toLowerCase() || "";
  const isBackground = (hex: string) => {
    const h = (hex || "").toLowerCase();
    if (!h) return false;
    if (h === bgHex) return true;
    // Near-white / near-fabric tones count as background (DMC B5200 / 520 /
    // white). Same halo rule as the converter's foreground definition (owner
    // 09-11): cream/near-white background must not count as subject.
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return (r > 245 && g > 245 && b > 245) || (max >= 190 && (max - min) / max <= 0.2);
  };
  let filled = 0;
  for (const row of grid) for (const cell of row) if (cell?.color && !isBackground(cell.color)) filled++;
  const fillPct = (filled / total) * 100;
  const nonBgColors = [...new Set(grid.flat().map(c => c?.color).filter(c => c && !isBackground(c)))].length;
  const warnings: string[] = [];
  if (fillPct < 30) {
    warnings.push(`only ${Math.round(fillPct)}% of the canvas is filled — the AI image did not cover the shape; try a more specific prompt`);
  }
  if (nonBgColors < 5) {
    warnings.push(`only ${nonBgColors} distinct colors came through — the image may have converted muddy; try naming 2–3 key colors`);
  }
  // Frame-canvas margin check — this is the "cut off on the page" symptom
  // (owner 09-03: teddy bear at 0px top/bottom). Only when opts.frame is
  // true so product shapes (stocking/ornament/pillow, meant to fill) don't warn.
  if (opts?.frame) {
    const touched = subjectTouchesEdge(grid, dmcColors);
    if (touched) {
      warnings.push(`the subject touches the ${touched} edge of the canvas — it may look cut off in the pattern; try including a little margin around the subject`);
    }
  }
  // Small-grid outline/features check (owner 09-11 "collapsed to a solid
  // block"): at ≤60 cells a design with a solid fill but ZERO dark cells has
  // no outline or features — it will stitch as a flat shape (e.g. one tan
  // blob). Warn so the user can add detail to the prompt instead of silently
  // saving a featureless block. The outline-preservation pass in the
  // converter repaints dark outline cells, so this fires only when the
  // MODEL itself drew no dark outline/features at all.
  const smallGrid =
    opts?.canvasWidth !== undefined &&
    opts?.canvasHeight !== undefined &&
    Math.min(opts.canvasWidth, opts.canvasHeight) <= SMALL_GRID_MAX_DIM;
  if (smallGrid && fillPct >= 25 && nonBgColors >= 2 && filled > 0) {
    const darkCells = countDarkCells(grid);
    // A small flat design whose DARK cells are < 1% of the fill has no real
    // outline or features (owner's 09-11 block: 3 dark of 456 filled = 0.7%).
    // The converter's outline-preservation pass repaints dark outline cells,
    // so this fires mainly when the MODEL itself drew no dark detail at all.
    if ((darkCells * 100) / filled < 1) {
      warnings.push(`the design has no dark outline or features — on a small canvas it will stitch as a flat shape; add details to the prompt (e.g. "with a face, eyes and a dark outline")`);
    }
  }
  return warnings.length ? warnings.join(" · ") : null;
}

/**
 * Creates a router for AI Embroidery pattern generation endpoints.
 */
export function createAIEmbroideryRouter(): Router {
  const router = Router();

  /**
   * POST /api/ai/embroidery/text-to-pattern
   *
   * Generate an embroidery pattern from a text description.
   * Uses OpenAI DALL-E to generate an image, then converts it to a stitch grid.
   *
   * Request body: { prompt: string, gridSize?: 50|75|100|150|200, negativePrompt?: string }
   * Response: { success: true, grid, stitchTypes, width, height, dmcPalette, totalStitches, gridSizes, ... }
   */
  router.post(
    "/ai/embroidery/text-to-pattern",
    optionalAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const parsed = TextToPatternSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: "Validation failed",
            details: parsed.error.issues,
          });
          return;
        }

        const { prompt, gridSize: rawGridSize, negativePrompt, fabricCount, desiredInches, premiumModel, canvasWidth, canvasHeight, aspectRatio: aspectRatioOpt, shape } = parsed.data;
        const premium = premiumModel === true && isPremiumTier((req as any).user?.tier);

        // Resolve fabric-aware grid size and color limit
        const fc = fabricCount || DEFAULT_FABRIC_COUNT;
        const maxColors = getMaxColors(fc);
        let gridSize = rawGridSize;
        if (desiredInches && desiredInches > 0) {
          const rawStitches = Math.round(desiredInches * fc);
          gridSize = clampToGridSize(rawStitches) as typeof rawGridSize;
        }
        const fabricInches = (gridSize || DEFAULT_GRID_SIZE) / fc;

        // Aspect-aware generation: prefer the caller's canvas dims. When the
        // canvas is tall (stocking 154×238) we generate TALL art instead of a
        // square that gets framed into a narrow canvas (27% fill bug).
        const aspect = aspectRatioOpt ?? aspectFromCanvas(canvasWidth, canvasHeight);
        const genW = canvasWidth ?? gridSize ?? DEFAULT_GRID_SIZE;
        const genH = canvasHeight ?? gridSize ?? DEFAULT_GRID_SIZE;

        // Owner 09-14: ALL prompt requests → AI artwork ALWAYS. The procedural
        // fast path and the Shape Library are no longer usable from this route
        // (no clip art for bare subjects). The under-specified flag below is
        // logged for observability only — the prompt padding itself lives in
        // enrichAIPrompt and applies to every shape and grid size.
        const underSpecified = isUnderSpecifiedPrompt(prompt);
        // Slow AI path (Gemini routinely takes 30-60s). Return 202 + jobId
        // immediately and run the pipeline in the background so the platform
        // gateway's ~30s upstream timeout is never hit.
        const jobId = createAIJob(async () => {
          const userId = (req as any).user?.userId;
          // Enrich the prompt: vibrant + shape-fill + scene guard, NO
          // color-draining hints (owner 09-03: "flat colors/no gradients/
          // white background" gutted colorful asks into 5 browns).
          // Square/landscape canvases become a PADDED FRAME so the subject
          // never bleeds to the edge (owner 09-03 #2: teddy bear cut off).
          // Explicit product shapes (shoes/ornament/pillow) are NEVER frames
          // even on square canvases — they fill edge-to-edge (owner 09-03 #4:
          // the 42×42 ornament was wrongly framed → blob after circle clip).
          const isFrameCanvasResult = isFrameCanvas(shape, genW, genH);
          const { prompt: finalPrompt, sceneGuardApplied, shapeHintApplied, smallGrid } = enrichAIPrompt(
            prompt,
            shape,
            { canvasWidth: genW, canvasHeight: genH },
          );
          console.error(JSON.stringify({
            event: "ai_prompt_sent",
            originalPrompt: prompt,
            finalPrompt,
            enrichment: { sceneGuardApplied, shapeHintApplied, smallGrid, shape, aspect, frame: isFrameCanvasResult, underSpecified },
          }));
          // Gemini (sole provider) — aspect-aware art (tall for stocking).
          const dalleResult = await generateImageWithDallE(finalPrompt, undefined, userId, premium, aspect);
          if (!dalleResult?.buffer) {
            throw new Error("AI generation returned no image");
          }
          const preview = `data:image/png;base64,${dalleResult.buffer.toString("base64")}`;
          // Color cap: floor higher than before so vibrant scenes keep
          // enough colors (owner: sunset scene collapsed to 4 muddy colors
          // at cap 6). Raise the floor to 16 so painterly shading collapses
          // into identity colors instead of gray-beige mud.
          const aiColorCap = Math.max(16, Math.round(maxColors * 0.9));
          // Convert at the CANVAS aspect/size, not always square 200.
          // Frame canvases (square/landscape) get the deterministic margin
          // band so the subject always sits inside a visible border — the
          // model may ignore the margin prompt, so we enforce it in the grid.
          const grid = await imageBufferToStitchGrid(
            dalleResult.buffer,
            gridSize,
            Math.min(maxColors, aiColorCap),
            { width: genW, height: genH },
            { margin: isFrameCanvasResult, outlinePreserve: isSmallGrid(genW, genH) },
          );
          // Deterministic content recenter (owner 09-15 — snowflake ornament "is
          // not centered and left white edge"): Gemini can draw the subject
          // off-center in the canvas, and the pixel→grid conversion carries the
          // offset through (white band on one side). Shift the whole grid so the
          // content bbox centers on the canvas. FRAME canvases keep the subject
          // inside the deterministic margin band (the band is sacred — the
          // recenter must never push content into it); product shapes get pure
          // centering. Already-centered content is returned unchanged, so
          // existing symmetric margins are preserved. Fix applies to NEW
          // generations only — saved patterns keep their baked grids.
          const recentered = recenterGrid(
            grid.grid,
            isFrameCanvasResult ? { frameMargin: frameMarginCellCount(genW, genH) } : undefined,
          );
          // Geometric shape-mask enforcement (owner 09-15 pillow repro "over
          // filled mask, cut off heart"): the silhouette is enforced at the
          // grid level so nothing bleeds past the stocking/ornament/pillow
          // boundary — the prompt alone can't guarantee Gemini respects the
          // shape outline. Clears cells outside the silhouette and fills
          // enclosed background holes with the nearest subject color for a
          // coherent solid subject with true cut-out edges.
          const masked =
            shape === "stocking" || shape === "ornament" || shape === "pillow"
              ? applyProductShapeMask(recentered, shape, genW, genH)
              : recentered;
          // Deterministic face-feature guard (owner 09-15, 3rd report: bag
          // charm 4 "teddy bear" 28×28 → featureless orange blob, 0 dark
          // cells). The prompt can't guarantee the model draws features and
          // the converter can only repaint dark pixels the source contained —
          // so on the small-grid path (≤60 cells, outlinePreserve already on)
          // rescue the subject geometrically: dark silhouette outline for ANY
          // subject, plus eyes+nose for animal/face prompts. Runs AFTER the
          // shape mask, so synthesized eyes land inside the silhouette.
          const guarded = isSmallGrid(genW, genH)
            ? applyFaceFeatureGuard(masked, grid.dmcColors, prompt)
            : { grid: masked, dmcColors: grid.dmcColors };
          // Quality gate — warn (don't silently save) when the conversion
          // came out sparse/muddy, OR (on frame canvases) the subject
          // bleeds to an edge.
          const qualityWarning = qualityGate(guarded.grid, guarded.dmcColors, prompt, {
            frame: isFrameCanvasResult,
            canvasWidth: genW,
            canvasHeight: genH,
          });
          return buildPatternResponse({ ...grid, grid: guarded.grid, dmcColors: guarded.dmcColors }, {
            promptUsed: finalPrompt,
            processingTimeMs: 0,
            fabric: { count: fc, inches: +fabricInches.toFixed(2) },
            previewUrl: preview,
            ...(qualityWarning ? { qualityWarning } : {}),
          });
        });
        res.status(202).json({ jobId });
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "text_to_pattern_error", error: message });
        res.status(500).json({ success: false, error: message });
      }
    },
  );

  /**
   * POST /api/ai/embroidery/image-to-pattern
   *
   * Convert an uploaded image (PNG, JPEG, WebP, GIF) to an embroidery pattern.
   * Returns the clean stitch grid plus the original image as a base64 data URL
   * so the frontend can display both side by side.
   *
   * Multipart form: file (image) + gridSize (optional)
   *
   * Response: { success: true, grid, stitchTypes, width, height, dmcPalette, totalStitches, gridSizes, originalImageData }
   */
  router.post(
    "/ai/embroidery/image-to-pattern",
    optionalAuth,
    aiRateLimit,
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const parsed = ImageToPatternSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: "Validation failed",
            details: parsed.error.issues,
          });
          return;
        }

        if (!req.file) {
          res.status(400).json({
            success: false,
            error: "No image file provided. Upload a file with field name 'file'",
          });
          return;
        }

        const { gridSize, maxColors } = parsed.data;

        // Convert the uploaded image buffer to stitch grid
        const pattern = await imageBufferToStitchGrid(req.file.buffer, gridSize, maxColors);

        // Convert the original uploaded image to a base64 data URL
        const mimeType = req.file.mimetype || "image/png";
        const originalImageData = `data:${mimeType};base64,${req.file.buffer.toString("base64")}`;

        res.json(buildPatternResponse(pattern, {
          promptUsed: `Image: ${req.file!.originalname}`,
          originalImageData,
          processingTimeMs: 0,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "image_to_pattern_error", error: message });
        res.status(500).json({ success: false, error: message });
      }
    },
  );

  /**
   * POST /api/ai/embroidery/resize-pattern
   *
   * Re-process an existing grid at a different size.
   * Takes the current stitch grid and a target grid size, then re-samples
   * using nearest-neighbor scaling. This lets the user switch sizes without
   * re-uploading the source image or re-running the AI.
   *
   * Request body: { grid: string[][], gridSize: 50|75|100|150|200 }
   * Response: { success: true, grid, stitchTypes, width, height, dmcPalette, totalStitches, gridSizes }
   */
  router.post(
    "/ai/embroidery/resize-pattern",
    (req: Request, res: Response) => {
      try {
        const parsed = ResizePatternSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: "Validation failed",
            details: parsed.error.issues,
          });
          return;
        }

        const { grid, gridSize, maxColors } = parsed.data;

        // Convert the flat string[][] grid back to StitchCell[][]
        const stitchGrid: StitchCell[][] = grid.map(row =>
          row.map(color => ({ color }))
        );

        resizeStitchGrid(stitchGrid, gridSize, maxColors).then(pattern => {
          res.json(buildPatternResponse(pattern, { processingTimeMs: 0 }));
        }).catch(err => {
          const message = err instanceof Error ? err.message : String(err);
          console.error({ event: "resize_pattern_error", error: message });
          res.status(500).json({ success: false, error: message });
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "resize_pattern_error", error: message });
        res.status(500).json({ success: false, error: message });
      }
    },
  );

  /**
   * POST /api/ai/embroidery/shape-to-pattern
   *
   * Generate a pattern from a predefined shape (no AI needed).
   * Shapes are drawn directly on the grid at the target resolution.
   *
   * Request body: { shape: string, gridSize?: 50|75|100|150|200 }
   * Available shapes: rabbit, cat, dog, bird, butterfly, heart, flower, star, geometric
   * Response: { success: true, grid, stitchTypes, width, height, dmcPalette, totalStitches, gridSizes }
   */
  router.post(
    "/ai/embroidery/shape-to-pattern",
    (req: Request, res: Response) => {
      const { shape, gridSize } = req.body;
      const validSizes = AVAILABLE_GRID_SIZES as readonly number[];
      const gs = Number(gridSize) >= 8 && Number(gridSize) <= 200 ? Number(gridSize) : DEFAULT_GRID_SIZE;

      try {
        const pattern = generateShape(shape || "", gs);
        res.json(buildPatternResponse(pattern, { shape, processingTimeMs: 0 }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "shape_to_pattern_error", error: message });
        res.status(500).json({ success: false, error: message });
      }
    },
  );

  return router;
}