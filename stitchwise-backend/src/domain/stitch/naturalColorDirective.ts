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
    re: /\bteddy ?bears?\b|\bbears?\b/i,
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
const COLOR_WORD_SET = new Set(UNAMBIGUOUS_COLOR_WORDS);
/** True when the prompt names at least one unambiguous color word ANYWHERE. */
export function promptNamesAnyColor(prompt: string): boolean {
  if (!prompt) return false;
  const lower = prompt.toLowerCase();
  return UNAMBIGUOUS_COLOR_WORDS.some((word) => new RegExp(`\\b${word}\\b`, "i").test(lower));
}
/**
 * True when a color word is glued to the SUBJECT's own noun phrase (the last
 * two tokens before the phrase or the token immediately after it). A prompt
 * like "teddybear with blue sweater" does NOT attach "blue" to the bear - the
 * sweater is its own noun - so the bear still needs its natural-color
 * directive. "blue teddy bear" / "white snowman" DO attach and win.
 */
function subjectHasAttachedColor(lower: string, matchIndex: number, matchText: string): boolean {
  const beforeTokens = lower
    .slice(Math.max(0, matchIndex - 24), matchIndex)
    .split(/[^a-z]+/)
    .filter(Boolean)
    .slice(-2);
  const afterToken = lower
    .slice(matchIndex + matchText.length, matchIndex + matchText.length + 24)
    .split(/[^a-z]+/)
    .filter(Boolean)[0];
  for (const t of [...beforeTokens, afterToken]) {
    if (t && COLOR_WORD_SET.has(t)) return true;
  }
  return false;
}
/**
 * For EVERY known subject whose noun phrase has NO attached user color,
 * return its canonical natural-color directive. A color word attached to a
 * DIFFERENT noun (e.g. "teddybear with blue sweater") no longer silences the
 * subject's own directive - the bear must be brown/tan while the sweater
 * keeps its blue (owner 10-09 charm verdict: whole-prompt color detection
 * silenced the directive and Gemini painted the bear ORANGE). Deterministic;
 * subject phrases with an attached color stay silent so the user wins.
 */
export function naturalColorDirectives(prompt: string): NaturalColorMatch[] {
  if (!prompt) return [];
  const lower = prompt.toLowerCase();
  const out: NaturalColorMatch[] = [];
  for (const { re, entry } of NATURAL_COLOR_SUBJECTS) {
    const m = re.exec(lower);
    if (!m) continue;
    if (subjectHasAttachedColor(lower, m.index, m[0])) continue;
    const directive = `Natural colors: ${entry.label} is ${entry.palette} — use only ${entry.palette} tones, ${entry.forbidden}.`;
    out.push({ subject: entry.label, directive });
  }
  return out;
}
/**
 * First matching subject's natural-color directive, or null (a backwards
 * compatible single-match view of naturalColorDirectives).
 */
export function naturalColorDirective(prompt: string): NaturalColorMatch | null {
  return naturalColorDirectives(prompt)[0] ?? null;
}

/**
 * Noun-phrase color attachment: true when ANY unambiguous color word sits
 * within 2 tokens before or 1 token after an occurrence of `nounRe`.
 */
function colorWordAttachedToNoun(lower: string, nounRe: RegExp): boolean {
  let m: RegExpExecArray | null;
  const re = new RegExp(nounRe.source, "i");
  let idx = 0;
  while ((m = re.exec(lower.slice(idx))) !== null) {
    const start = idx + m.index;
    const end = start + m[0].length;
    const before = lower.slice(Math.max(0, start - 24), start).split(/[^a-z]+/).filter(Boolean).slice(-2);
    const after = lower.slice(end, end + 24).split(/[^a-z]+/).filter(Boolean)[0];
    for (const t of [...before, after]) {
      if (t && COLOR_WORD_SET.has(t)) return true;
    }
    idx = end;
  }
  return false;
}
/**
 * Stocking BODY color re-anchoring (owner 10-09 17:30Z verdict: "blue
 * background with white top and white toe ... Add white snowflakes" painted a
 * WHITE stocking — the product mask clips the blue BACKGROUND away, leaving
 * a white-washed body and a thick white rim. The stocking shape IS the canvas
 * (fill-to-edge semantics): a color word attached to the BACKGROUND must be
 * re-anchored onto the STOCKING BODY, and an uncolored body gets the product
 * default deep blue. Only fires for shape === 'stocking' and only when the
 * user did NOT attach a color to the stocking/body nouns themselves.
 */
export function stockingBodyDirective(
  prompt: string,
  shape?: "stocking" | "ornament" | "pillow" | "square" | "rect" | string,
): string | null {
  if (shape !== "stocking" || !prompt) return null;
  const lower = prompt.toLowerCase();
  if (!lower) return null;
  const bodyNounRe = /\bstocking(s)?\b|\bsock(s)?\b|\bboot(s)?\b|\bthe stocking\b|\bbody of the stocking\b|\bthe body\b/;
  if (colorWordAttachedToNoun(lower, bodyNounRe)) return null; // user colored the body — their color wins
  return (
    "the STOCKING BODY itself is deep blue, NOT a blue background behind a white stocking: " +
    "paint the stocking body dark blue and draw the snowflakes WHITE directly ON the blue stocking body; " +
    "the cuff at the top and the toe at the bottom are white"
  );
}
