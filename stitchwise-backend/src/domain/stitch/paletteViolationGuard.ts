/**
 * Deterministic palette-violation guard for AI→pattern conversion.
 *
 * Owner-conclusive (10-09 gap #41 retest #3 — "blue stocking- snowflake
 * design", id ab01992a, 154×238): after the subject-anchored scatter fix the
 * stocking mask and figure classifier were correct, but the FINAL grid still
 * contained GREEN #276632 (1223 st), RED #c9262d (616 st) and BROWN/ORANGE
 * #bf5816/#70503c (1261 st) — 23% of the fill in hues the stored prompt
 * ("blue background with white snowflakes.  White top and white toe") never
 * named. The model silently painted a generic Christmas scene instead of the
 * asked-for motif. No warning fired because no deterministic palette check
 * existed.
 *
 * This guard is deterministic end-to-end:
 *   1. Parse the NAMED colors out of the prompt (same word-level approach as
 *      the #184/#185 prompt color fidelity sentence) into hue families.
 *   2. Classify every color in the final grid palette (hex → hue family
 *      through a fixed hue-slice rule — no AI, no tolerance knobs).
 *   3. Scatter/pattern prompts ONLY: if a grid hue family that the prompt
 *      never named covers ≥ 2% of the filled (non-background) cells, push
 *      conversionWarning "The AI used colors you didn't ask for — please
 *      regenerate" listing the prompt colors.
 *
 * Gated on scatter/pattern prompts so single-subject designs keep "natural
 * colors" (a yellow sunflower legitimately has a brown center + green stem,
 * and the #185 color-fidelity sentence EXPLICITLY allows "the subject's
 * natural colors") and so the animal/face paths stay byte-identical. The
 * owner's failing case is exactly a scatter prompt whose pattern fill
 * invented seasonal hues — snowflakes/stars/dots have no natural adjacent
 * red/green/brown, so any off-prompt hue there is the model's invention.
 */
export type ColorFamily =
  | "white"
  | "black"
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink"
  | "brown"
  | "tan";

/** Prompt color words → hue family. Order matters: longer synonyms first. */
const PROMPT_COLOR_WORDS: Record<string, ColorFamily> = {
  magenta: "pink",
  crimson: "red",
  scarlet: "red",
  emerald: "green",
  turquoise: "teal",
  lavender: "purple",
  charcoal: "black",
  ivory: "white",
  cream: "white",
  beige: "tan",
  khaki: "tan",
  olive: "green",
  coral: "orange",
  silver: "gray",
  violet: "purple",
  azure: "blue",
  navy: "blue",
  rose: "pink",
  gold: "yellow",
  grey: "gray",
  white: "white",
  black: "black",
  gray: "gray",
  red: "red",
  orange: "orange",
  yellow: "yellow",
  green: "green",
  teal: "teal",
  blue: "blue",
  sky: "blue",
  purple: "purple",
  pink: "pink",
  brown: "brown",
  tan: "tan",
};

export interface NamedPromptColors {
  /** Hue families named (or clearly implied) by the prompt. */
  families: Set<ColorFamily>;
  /** The prompt's own color words, for the warning message. */
  words: string[];
}

/** Parse the prompt's NAMED colors into hue families (deterministic word match). */
export function namedPromptColorFamilies(prompt: string): NamedPromptColors {
  const lower = (prompt || "").toLowerCase();
  const families = new Set<ColorFamily>();
  const words: string[] = [];
  for (const [word, family] of Object.entries(PROMPT_COLOR_WORDS)) {
    // Whole-word match, so "blue" does not fire inside "bluebird" — but keep
    // multi-word contexts ("white snowflakes") working via word boundaries.
    const re = new RegExp(`\\b${word}\\b`, "i");
    if (re.test(lower) && !families.has(family)) {
      families.add(family);
      words.push(word);
    }
  }
  return { families, words };
}

/** Fixed hue-slice classifier: hex color → canonical family (deterministic). */
export function hexFamily(hex: string): ColorFamily {
  const h = (hex || "").toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(h)) return "gray";
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const value = max;
  // Achromatic: lightness/low-saturation tones (handled before hue so cream,
  // dark navy-outlined "black" et al. don't wander into hue buckets).
  if (max - min < 24) {
    if (value >= 230) return "white";
    if (value <= 50) return "black";
    return "gray";
  }
  // Chromatic: hue-wheel slices (0..360).
  const delta = max - min;
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = ((hue * 60) + 360) % 360;
  if (hue < 15 || hue >= 345) return value < 170 ? "brown" : "red";
  if (hue < 40) return value < 185 ? "brown" : "orange";
  if (hue < 70) return value < 150 ? "tan" : "yellow";
  if (hue < 160) return "green";
  if (hue < 200) return "teal";
  if (hue < 255) return "blue";
  if (hue < 290) return "purple";
  return "pink";
}

/**
 * Deterministic palette-violation check against the FINAL grid palette.
 * Returns a conversionWarning string, or null when the palette is clean.
 *
 * Background colors (the dominant palette color + near-white/low-saturation
 * light tones, mirroring qualityGate's isBackground) never count as
 * violations — a cream fabric background is not "an unprompted color".
 * An off-prompt family must cover ≥ 2% of the filled cells before it
 * triggers, so single-cell antialiasing remnants stay silent.
 */
export function paletteViolationWarning(
  dmcColors: { hex: string; count: number }[],
  prompt: string,
): string | null {
  // Scatter/pattern prompts ONLY — single-subject and animal paths stay
  // byte-identical (see module header: natural colors are legitimate there).
  if (!/\b(snowflakes?|snow flakes|flakes?|stars|dots|polka|candy canes|snowmen|confetti|bunting|sparkles|motifs?|chevrons|sprinkles|scatter|scattered|repeating|repeated|repeats?|pattern|patterns|many small|all over|patchwork of|field of|swarm of|banner of)\b/i.test(prompt || "")) {
    return null;
  }
  const { families, words } = namedPromptColorFamilies(prompt);
  if (families.size === 0 || words.length === 0) return null;
  const total = dmcColors.reduce((sum, c) => sum + (c.count || 0), 0);
  if (total === 0) return null;
  // Background rule mirrors qualityGate: dominant color + near-white /
  // low-saturation light tones are fabric, never violations.
  const sorted = [...dmcColors].sort((a, b) => (b.count || 0) - (a.count || 0));
  const dominantHex = sorted[0]?.hex?.toLowerCase() || "";
  const isBackground = (hex: string): boolean => {
    const h = (hex || "").toLowerCase();
    if (!h) return true;
    if (h === dominantHex) return true;
    if (!/^#[0-9a-f]{6}$/.test(h)) return true;
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return (r > 245 && g > 245 && b > 245) || (max >= 190 && (max - min) / max <= 0.2);
  };
  const familyCounts = new Map<ColorFamily, number>();
  for (const c of dmcColors) {
    if (!c?.hex || (c.count || 0) <= 0 || isBackground(c.hex)) continue;
    const fam = hexFamily(c.hex);
    familyCounts.set(fam, (familyCounts.get(fam) || 0) + c.count);
  }
  const filled = [...familyCounts.values()].reduce((a, b) => a + b, 0);
  if (filled === 0) return null;
  const offFamilies: string[] = [];
  for (const [fam, count] of familyCounts) {
    if (!families.has(fam) && count / filled >= 0.02) {
      offFamilies.push(fam);
    }
  }
  if (offFamilies.length === 0) return null;
  const sortedOff = offFamilies.sort();
  return `The AI used colors you didn't ask for (asked for: ${words.join(", ")}, but found ${sortedOff.join(", ")}) — please regenerate`;
}