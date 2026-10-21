/**
 * Prompt→product-shape inference (owner 10-19 P0 c9f3e630).
 *
 * The geometric mask only ran when the request carried shape="stocking";
 * the client only sends a shape when a PRESET guide is active — so on the
 * default 100×100 custom canvas the "Red stock with snowflakes" save came
 * out FULL-BLEED (3,324 non-white cells outside the stocking silhouette).
 * These tests lock the inference + effective-shape resolution + frame
 * decision that feed isFrameCanvas / enrichAIPrompt / applyProductShapeMask.
 */
import { describe, it, expect } from "@jest/globals";
import {
  inferShapeFromPrompt,
  resolveEffectiveShape,
} from "../domain/ai/shapeInference";
import { isFrameCanvas } from "../infrastructure/routes/aiEmbroidery";

describe("inferShapeFromPrompt", () => {
  it("her exact prompt → stocking", () => {
    expect(
      inferShapeFromPrompt("Red stock with white top and white toe. Add white snowflakes in the design"),
    ).toBe("stocking");
  });
  it("stocking/stockings forms → stocking", () => {
    expect(inferShapeFromPrompt("a red Christmas stocking")).toBe("stocking");
    expect(inferShapeFromPrompt("blue snowflake stocking")).toBe("stocking");
    expect(inferShapeFromPrompt("stockings hung by the fire")).toBe("stocking");
  });
  it("bare 'stock' requires holiday/stocking-part context", () => {
    // has toe + snowflakes context → fires
    expect(inferShapeFromPrompt("red stock with white toe and snowflakes")).toBe("stocking");
    // stock-market false hit must NOT fire
    expect(inferShapeFromPrompt("stock market")).toBeUndefined();
    expect(inferShapeFromPrompt("take stock of the situation")).toBeUndefined();
    expect(inferShapeFromPrompt("the stockroom floor")).toBeUndefined();
  });
  it("ornament/bauble/bag charm → ornament", () => {
    expect(inferShapeFromPrompt("a blue ornament")).toBe("ornament");
    expect(inferShapeFromPrompt("red baubles")).toBe("ornament");
    expect(inferShapeFromPrompt("teddy bear bag charm")).toBe("ornament");
  });
  it("pillow/cushion → pillow", () => {
    expect(inferShapeFromPrompt("a heart pillow")).toBe("pillow");
    expect(inferShapeFromPrompt("yellow cushion")).toBe("pillow");
  });
  it("'ornamental frame' must NOT fire (word boundary)", () => {
    expect(inferShapeFromPrompt("ornamental frame with flowers")).toBeUndefined();
  });
  it("empty/undefined prompt → undefined", () => {
    expect(inferShapeFromPrompt("")).toBeUndefined();
    expect(inferShapeFromPrompt(undefined)).toBeUndefined();
  });
});

describe("resolveEffectiveShape", () => {
  it("explicit shape always wins over the prompt", () => {
    expect(resolveEffectiveShape("square", "red stocking with snowflakes")).toBe("square");
    expect(resolveEffectiveShape("ornament", "stock market")).toBe("ornament");
  });
  it("shape-less request with a stocking prompt resolves to stocking", () => {
    expect(resolveEffectiveShape(undefined, "Red stock with white top and white toe. Add white snowflakes in the design")).toBe("stocking");
  });
  it("shape-less request without a product noun stays undefined (frame)", () => {
    expect(resolveEffectiveShape(undefined, "a teddy bear")).toBeUndefined();
  });
});

describe("frame decision (the exact failure class)", () => {
  // 100×100 custom canvas: OLD behavior (no shape, no inference) = FRAME →
  // margin band, NO silhouette, full-bleed square. NEW behavior: effective
  // shape = stocking → never a frame → the geometric mask path fires.
  it("shape=undefined + her prompt: effective stocking is NEVER a frame on 100×100", () => {
    const effective = resolveEffectiveShape(undefined, "Red stock with white top and white toe. Add white snowflakes in the design");
    expect(effective).toBe("stocking");
    expect(isFrameCanvas(effective, 100, 100)).toBe(false);
  });
  it("shape=undefined + her prompt under the OLD path WAS a frame (control)", () => {
    expect(isFrameCanvas(undefined, 100, 100)).toBe(true);
  });
  it("explicit stocking preset stays a non-frame on 100×100 too", () => {
    expect(isFrameCanvas("stocking", 100, 100)).toBe(false);
  });
});
// ─── b133 additions (owner b132 retest P0 4dfb1359) ─────────────────────────
describe("b133: small-grid 'charm' widening", () => {
  it("routes a bare 'charm' noun to ornament on a small grid", () => {
    expect(inferShapeFromPrompt("teddy bear with blue sweater charm", { smallGrid: true })).toBe("ornament");
  });

  it("keeps frame behavior for a bare 'charm' noun on a large grid", () => {
    expect(inferShapeFromPrompt("yellow charm bracelet", { smallGrid: false })).toBeUndefined();
    expect(inferShapeFromPrompt("yellow charm bracelet")).toBeUndefined();
  });

  it("still detects existing ornament family nouns on large grids", () => {
    expect(inferShapeFromPrompt("a red bauble", { smallGrid: false })).toBe("ornament");
    expect(inferShapeFromPrompt("bag charm", { smallGrid: false })).toBe("ornament");
  });
});

describe("b133: name+prompt shape recovery for regenerate", () => {
  it("reconstructs ornament from the owner's saved pattern name", () => {
    expect(
      resolveEffectiveShape(undefined, "teddy bag charm update2 a teddy bear with a blue sweater", {
        smallGrid: true,
      }),
    ).toBe("ornament");
  });

  it("an explicit request shape always wins over the name+prompt", () => {
    expect(
      resolveEffectiveShape("stocking", "teddy bag charm update2 a teddy bear with a blue sweater", {
        smallGrid: true,
      }),
    ).toBe("stocking");
  });
});
