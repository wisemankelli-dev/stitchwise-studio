/**
 * Deterministic subject natural-color directive for AI→pattern conversion.
 *
 * Owner-conclusive (10-09 bag-charm verdict — same P0 color-fidelity line as
 * gap #41 retest #3): her charm save "teddy bear bag charm- no detail" (id
 * c04566a1-ebec-4e13-a710-b4712c63dfea, 28×28) has stored prompt exactly
 * 'teddy bear' — NO color word — yet the FINAL grid reads RED/ORANGE:
 * #bf5816 151 st, #d2785a 32, #f3932b 20 (203 st reddish) vs brown/tan
 * #5d3c2e 120 + #8a6c54 56 (176 st). Owner: "Bear should have been brown and
 * came out red." A named-color palette guard can NOT catch this (nothing was
 * named) — the model guessed a hue family on its own, so this module forces
 * the canonical natural colors of a KNOWN subject when the user names none.
 *
 * Deterministic end-to-end:
 *   1. If the prompt names ANY unambiguous color, the directive stays silent
 *      (the user's own color wins — "brown teddy bear" keeps brown).
 *   2. Match the prompt against a small canonical subject table (teddy bear,
 *      snowman, rose, leaf, sun, heart — common embroidery subjects whose
 *      natural color is well-defined). First match wins, so "teddy bear"
 *      precedes "bear".
 *   3. Inject "Natural colors: <subject> is <palette> — use only <palette>
 *      tones, <forbidden>." into the enriched prompt so the model cannot pick
 *      a wrong hue family for an un-named subject.
 *
 * Deliberately does NOT reuse paletteViolationGuard's PROMPT_COLOR_WORDS:
 * that map treats "rose" as the color pink, which would wrongly suppress the
 * directive for the FLOWER "a rose". Here "rose" is a subject, not a color.
 */
export interface NaturalColorMatch {
  /** Canonical noun phrase used in the directive ("a teddy bear"). */
  subject: string;
  /** Full directive sentence to append to the enriched prompt. */
  directive: string;
}

interface NaturalColorEntry {
  label: string;
  palette: string;
  forbidden: string;
}

const NATURAL_COLOR_SUBJECTS: { re: RegExp; entry: NaturalColorEntry }[] = [
  {
    re: /\bteddy bears?\b|\bbears?\b/i,
    entry: {
      label: "a teddy bear",
      palette: "brown and tan",
      forbidden: "no red, no orange, no pink",
    },
  },
  {
    re: /\bsnowman\b|\bsnow men\b/i,
    entry: {
      label: "a snowman",
      palette: "white",
      forbidden: "no red, no orange, no green",
    },
  },
  {
    re: /\brose(s)?\b/i,
    entry: {
      label: "a rose",
      palette: "red and pink",
      forbidden: "no blue, no purple, no yellow",
    },
  },
  {
    re: /\bleaf\b|\bleaves\b/i,
    entry: {
      label: "a leaf",
      palette: "green",
      forbidden: "no red, no blue, no yellow",
    },
  },
  {
    re: /\bsun\b/i,
    entry: {
      label: "the sun",
      palette: "warm yellow and orange",
      forbidden: "no blue, no green, no purple",
    },
  },
  {
    re: /\bhearts?\b/i,
    entry: {
      label: "a heart",
      palette: "red and pink",
      forbidden: "no blue, no purple, no green",
    },
  },
];

/**
 * Color words that unambiguously name a color when used in a prompt. Kept
 * deliberately separate from paletteViolationGuard.PROMPT_COLOR_WORDS: that
 * map includes "rose" (→ pink) and "coral" (→ orange), which are ALSO common
 * subjects ("a rose" is the flower). Any word here suppresses the directive —
 * the user picked the color, the directive must not override it.
 */
const UNAMBIGUOUS_COLOR_WORDS = [
  "white",
  "black",
  "gray",
  "grey",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "sky",
  "purple",
  "pink",
  "brown",
  "tan",
  "navy",
  "gold",
  "silver",
  "beige",
  "cream",
  "ivory",
  "emerald",
  "crimson",
  "scarlet",
  "magenta",
  "violet",
  "lavender",
  "turquoise",
  "charcoal",
  "khaki",
  "olive",
  "azure",
];

/** True when the prompt names at least one unambiguous color word. */
export function promptNamesAnyColor(prompt: string): boolean {
  if (!prompt) return false;
  const lower = prompt.toLowerCase();
  return UNAMBIGUOUS_COLOR_WORDS.some((word) => new RegExp(`\\b${word}\\b`, "i").test(lower));
}

/**
 * For a KNOWN subject with no user-named color, return its canonical
 * natural-color directive; otherwise null. Non-table subjects and any prompt
 * that names a color both stay silent so the user's own wording wins.
 */
export function naturalColorDirective(prompt: string): NaturalColorMatch | null {
  if (!prompt) return null;
  if (promptNamesAnyColor(prompt)) return null;
  const lower = prompt.toLowerCase();
  for (const { re, entry } of NATURAL_COLOR_SUBJECTS) {
    if (re.test(lower)) {
      const directive = `Natural colors: ${entry.label} is ${entry.palette} — use only ${entry.palette} tones, ${entry.forbidden}.`;
      return { subject: entry.label, directive };
    }
  }
  return null;
}