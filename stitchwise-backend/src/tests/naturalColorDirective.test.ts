/**
 * Deterministic subject natural-color directive tests (owner 10-09 charm
 * verdict: prompt 'teddy bear', no color word, came out red/orange — the
 * model must be forced to the subject's canonical natural colors).
 */
import { describe, it, expect } from "@jest/globals";
import { naturalColorDirective, naturalColorDirectives, promptNamesAnyColor } from "../domain/stitch/naturalColorDirective";

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