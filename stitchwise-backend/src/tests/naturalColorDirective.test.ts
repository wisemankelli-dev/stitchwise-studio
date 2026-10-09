/**
 * Deterministic subject natural-color directive tests (owner 10-09 charm
 * verdict: prompt 'teddy bear', no color word, came out red/orange — the
 * model must be forced to the subject's canonical natural colors).
 */
import { describe, it, expect } from "@jest/globals";
import { naturalColorDirective, naturalColorDirectives, promptNamesAnyColor, stockingBodyDirective } from "../domain/stitch/naturalColorDirective";

describe("naturalColorDirective", () => {
  it("OWNER 10-09 charm: 'teddy bear' (no color) → brown and tan, no red/orange/pink", () => {
    const match = naturalColorDirective("teddy bear");
    expect(match).not.toBeNull();
    expect(match?.subject).toBe("a teddy bear");
    expect(match?.directive).toContain("brown");
    expect(match?.directive).toContain("tan");
    expect(match?.directive).toContain("no red");
    expect(match?.directive).toContain("no orange");
    expect(match?.directive).toContain("no pink");
  });

  it("matches the plural 'teddy bears' via the same entry", () => {
    expect(naturalColorDirective("teddy bears")?.subject).toBe("a teddy bear");
  });

  it("user-named color WINS: 'brown teddy bear' gets no directive", () => {
    expect(naturalColorDirective("brown teddy bear")).toBeNull();
    expect(naturalColorDirective("a brown bear")).toBeNull();
    expect(naturalColorDirective("blue teddy bear")).toBeNull();
    expect(naturalColorDirective("white snowman")).toBeNull();
  });
  it("OWNER 10-09 charm: 'teddybear with blue sweater' — color on ANOTHER noun must not silence the bear's directive", () => {
    // Whole-prompt color detection silenced the directive; Gemini painted the
    // bear ORANGE. The sweater's blue stays, but the bear must be forced
    // brown/tan (per-noun scoping).
    const m = naturalColorDirective("teddybear with blue sweater");
    expect(m).not.toBeNull();
    expect(m?.subject).toBe("a teddy bear");
    expect(m?.directive).toContain("brown");
    expect(m?.directive).toContain("no red");
    expect(m?.directive).toContain("no orange");
    expect(m?.directive).toContain("no pink");
    expect(naturalColorDirective("teddy bear with a blue sweater")?.subject).toBe("a teddy bear");
    expect(naturalColorDirective("Teddy bear with a blue sweater")?.subject).toBe("a teddy bear");
    expect(naturalColorDirective("teddybear in a blue sweater")?.subject).toBe("a teddy bear");
  });
  it("no-space 'teddybear' still matches the subject table (owner's actual prompt form)", () => {
    expect(naturalColorDirective("teddybear")?.subject).toBe("a teddy bear");
    expect(naturalColorDirective("teddybear with blue sweater")).not.toBeNull();
  });
  it("multiple subjects: every uncolored known subject gets its own directive", () => {
    const all = naturalColorDirectives("a snowman holding a rose");
    expect(all.length).toBeGreaterThanOrEqual(2);
    const subs = all.map((m) => m.subject);
    expect(subs).toContain("a snowman");
    expect(subs).toContain("a rose");
  });

  it("does not fire for words that merely CONTAIN a color word", () => {
    // "blue" inside "bluebird" must not be read as a named color.
    expect(promptNamesAnyColor("bluebird")).toBe(false);
    // "gold" inside "golden" is not "gold".
    expect(promptNamesAnyColor("a golden sun")).toBe(false);
  });

  it("snowman → white, no red/orange/green", () => {
    const match = naturalColorDirective("snowman");
    expect(match?.directive).toContain("white");
    expect(match?.directive).toContain("no red");
    expect(match?.directive).toContain("no orange");
    expect(match?.directive).toContain("no green");
  });

  it("rose is a SUBJECT, not the color pink: 'a rose' still gets the directive", () => {
    const match = naturalColorDirective("a rose");
    expect(match).not.toBeNull();
    expect(match?.subject).toBe("a rose");
    expect(match?.directive).toContain("red and pink");
  });

  it("leaf → green, sun → warm yellow/orange, heart → red/pink", () => {
    expect(naturalColorDirective("leaf")?.directive).toContain("green");
    expect(naturalColorDirective("leaves")?.directive).toContain("green");
    expect(naturalColorDirective("sun")?.directive).toContain("yellow");
    expect(naturalColorDirective("sun")?.directive).toContain("no blue");
    expect(naturalColorDirective("heart")?.directive).toContain("red and pink");
  });

  it("non-table subjects stay silent (truck, fox, cat, sunflower, cloud)", () => {
    for (const p of ["a truck", "a red truck", "fox", "cat", "sunflower", "cloud"]) {
      expect(naturalColorDirective(p)).toBeNull();
    }
  });

  it("word boundaries: 'beard' does not match 'bear'; 'a rose garden' still matches rose", () => {
    expect(naturalColorDirective("beard")).toBeNull();
    expect(naturalColorDirective("a rose garden")?.subject).toBe("a rose");
  });

  it("empty/null prompt → null", () => {
    expect(naturalColorDirective("")).toBeNull();
    expect(naturalColorDirective(null as unknown as string)).toBeNull();
  });
});

describe("stockingBodyDirective (owner 10-09 17:30Z verdict #2 — 'blue background ... white top and white toe' paints a WHITE stocking)", () => {
  const DIRECTIVE_SUBSTRINGS = ["STOCKING BODY itself is deep blue", "snowflakes WHITE directly ON the blue stocking body", "cuff at the top and the toe at the bottom are white"];
  const hasAll = (d: string | null) => d !== null && DIRECTIVE_SUBSTRINGS.every((sub) => d.includes(sub));
  it("fires for her exact prompt (color attached to BACKGROUND, body uncolored)", () => {
    const d = stockingBodyDirective("blue background with white top and white toe. Add white snowflakes to the design.", "stocking");
    expect(hasAll(d)).toBe(true);
  });
  it("fires for a background-agnostic uncolored body ('snowflake stocking')", () => {
    expect(hasAll(stockingBodyDirective("snowflake stocking", "stocking"))).toBe(true);
  });
  it("fires when ONLY the top/toe are colored (white top, white toe — body uncolored)", () => {
    expect(hasAll(stockingBodyDirective("white top and white toe with snowflakes", "stocking"))).toBe(true);
  });
  it("does NOT fire when the user colored the stocking itself (their color wins)", () => {
    expect(stockingBodyDirective("a red stocking with white snowflakes", "stocking")).toBeNull();
    expect(stockingBodyDirective("white stocking with blue snowflakes", "stocking")).toBeNull();
    expect(stockingBodyDirective("green stocking on a red background", "stocking")).toBeNull();
  });
  it("does NOT fire for non-stocking shapes (charm paths byte-identical)", () => {
    expect(stockingBodyDirective("blue background with white top and white toe. Add white snowflakes to the design.", "ornament")).toBeNull();
    expect(stockingBodyDirective("blue background with white top and white toe. Add white snowflakes to the design.", undefined)).toBeNull();
  });
  it("returns null for empty prompts and case-insensitively matches nouns", () => {
    expect(stockingBodyDirective("", "stocking")).toBeNull();
    expect(hasAll(stockingBodyDirective("BLUE BACKGROUND WITH WHITE TOP AND WHITE TOE. ADD WHITE SNOWFLAKES.", "stocking"))).toBe(true);
    expect(hasAll(stockingBodyDirective("sock with snowflakes", "stocking"))).toBe(true);
  });
});
