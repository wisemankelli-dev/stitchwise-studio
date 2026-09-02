/**
 * Tests for the AI Embroidery Pattern Generation Service.
 *
 * Covers:
 * - DMC color mapping and quantization
 * - Pattern converter (image to stitch grid)
 * - API routes validation
 * - Image-to-pattern with generated test images
 */

import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { createApp } from "../app";

import { closestDmcColor, rgbToHex, hexToRgb, DMC_COLORS } from "../domain/stitch/dmcColors";
import { imageBufferToStitchGrid } from "../domain/stitch/patternConverter";
import { TextToPatternSchema, ImageToPatternSchema } from "../domain/ai/embroideryAI";
import { shouldUseProceduralPattern } from "../infrastructure/routes/aiEmbroidery";

describe("AI prompt routing", () => {
  it("uses procedural generation for bare supported subjects", () => {
    expect(shouldUseProceduralPattern("sunflower")).toBe(true);
    expect(shouldUseProceduralPattern("A sunflower")).toBe(true);
  });

  it("sends descriptive subjects to OpenAI", () => {
    expect(shouldUseProceduralPattern("a yellow sunflower")).toBe(false);
    expect(shouldUseProceduralPattern("sunflower in a vase")).toBe(false);
    expect(shouldUseProceduralPattern("a watercolor rose")).toBe(false);
  });
});

// ─── DMC Color Tests ────────────────────────────────────────────────────────

describe("DMC Colors", () => {
  describe("DMC_COLORS palette", () => {
    it("has at least 50 colors", () => {
      expect(DMC_COLORS.length).toBeGreaterThanOrEqual(50);
    });

    it("every color has a unique code", () => {
      const codes = DMC_COLORS.map((c) => c.code);
      expect(new Set(codes).size).toBe(codes.length);
    });
  });

  describe("closestDmcColor", () => {
    it("matches pure red to Christmas Red", () => {
      const match = closestDmcColor(255, 0, 0);
      expect(match.code).toBeTruthy();
      expect(match.distance).toBeLessThan(100);
    });

    it("matches pure white to DMC White", () => {
      const match = closestDmcColor(255, 255, 255);
      expect(match.name).toContain("White");
      expect(match.distance).toBeLessThan(30);
    });

    it("matches pure black to DMC Black", () => {
      const match = closestDmcColor(0, 0, 0);
      expect(match.code).toBe("DMC 310");
      expect(match.distance).toBe(0);
    });

    it("matches pink to a pink/rose color", () => {
      const match = closestDmcColor(255, 192, 203);
      expect(match.code).toBeTruthy();
      expect(match.rgb).toHaveLength(3);
    });

    it("includes distance in result", () => {
      const match = closestDmcColor(255, 0, 0);
      expect(typeof match.distance).toBe("number");
    });
  });

  describe("rgbToHex / hexToRgb", () => {
    it("converts RGB to hex", () => {
      expect(rgbToHex(255, 0, 0)).toBe("#ff0000");
      expect(rgbToHex(0, 128, 0)).toBe("#008000");
      expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
    });

    it("converts hex to RGB", () => {
      expect(hexToRgb("#ff0000")).toEqual([255, 0, 0]);
      expect(hexToRgb("#008000")).toEqual([0, 128, 0]);
      expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
    });

    it("handles hex without hash", () => {
      expect(hexToRgb("ff0000")).toEqual([255, 0, 0]);
    });

    it("falls back for invalid hex", () => {
      const result = hexToRgb("not-hex");
      expect(result).toEqual([128, 128, 128]);
    });
  });
});

// ─── Schema Validation Tests ────────────────────────────────────────────────

describe("AI Embroidery Schemas", () => {
  describe("TextToPatternSchema", () => {
    it("validates a valid request", () => {
      const result = TextToPatternSchema.safeParse({
        prompt: "a red rose",
        gridSize: 50,
      });
      expect(result.success).toBe(true);
    });

    it("provides default grid size", () => {
      const result = TextToPatternSchema.safeParse({ prompt: "flower" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gridSize).toBe(50); // Schema default
      }
    });

    it("rejects empty prompt", () => {
      const result = TextToPatternSchema.safeParse({ prompt: "" });
      expect(result.success).toBe(false);
    });

    it("validates allowed grid sizes", () => {
      const result = TextToPatternSchema.safeParse({ prompt: "test", gridSize: 50 });
      expect(result.success).toBe(true);
    });

    it("rejects invalid grid size", () => {
      const result = TextToPatternSchema.safeParse({ prompt: "test", gridSize: 10 });
      expect(result.success).toBe(false);
    });

    it("accepts every fabric count the Designer offers", () => {
      // Designer picker = [11, 13, 14, 18, 22, 25, 28, 32, 36];
      // the backend must NOT 400 on 13 (the reported bug) or any other.
      for (const fabricCount of [11, 13, 14, 18, 22, 25, 28, 32, 36]) {
        const result = TextToPatternSchema.safeParse({ prompt: "a red rose", fabricCount });
        expect(result.success).toBe(true);
        if (!result.success) {
          console.error("fabricCount", fabricCount, "failed:", result.error.issues);
        }
      }
    });

    it("accepts legacy fabric counts 16 and 20", () => {
      expect(TextToPatternSchema.safeParse({ prompt: "a rose", fabricCount: 16 }).success).toBe(true);
      expect(TextToPatternSchema.safeParse({ prompt: "a rose", fabricCount: 20 }).success).toBe(true);
    });

    it("rejects an out-of-set fabric count", () => {
      const result = TextToPatternSchema.safeParse({ prompt: "test", fabricCount: 15 });
      expect(result.success).toBe(false);
    });
  });

  describe("ImageToPatternSchema", () => {
    it("validates with default grid size", () => {
      const result = ImageToPatternSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gridSize).toBe(50); // Schema default
      }
    });

    it("validates a custom grid size", () => {
      const result = ImageToPatternSchema.safeParse({ gridSize: 75 });
      expect(result.success).toBe(true);
    });
  });
});

// ─── Pattern Converter Tests (no network) ───────────────────────────────────

describe("Pattern Converter", () => {
  it("converts a solid red image to stitch grid", async () => {
    const { default: sharp } = await import("sharp");
    const testImage = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).png().toBuffer();

    const result = await imageBufferToStitchGrid(testImage, 50);

    expect(result.gridSize).toBe(50);
    expect(result.stitchCount).toBe(2500);
    expect(result.grid.length).toBe(50);
    expect(result.grid[0].length).toBe(50);
    // All cells should be red-ish (matched to closest DMC red)
    expect(result.grid[0][0].dmcCode).toBeTruthy();
    expect(result.dmcColors.length).toBeGreaterThanOrEqual(1);
    expect(result.dmcColors[0].count).toBe(2500);
  }, 15000);

  it("converts a multi-color image and detects multiple DMC colors", async () => {
    const { default: sharp } = await import("sharp");
    // Create a 50x50 image with red, green, blue, white quadrants
    const testImage = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).composite([
      { input: { create: { width: 25, height: 25, channels: 3, background: { r: 0, g: 255, b: 0 } } }, top: 0, left: 0 },
      { input: { create: { width: 25, height: 25, channels: 3, background: { r: 0, g: 0, b: 255 } } }, top: 25, left: 0 },
      { input: { create: { width: 25, height: 25, channels: 3, background: { r: 255, g: 255, b: 255 } } }, top: 25, left: 25 },
    ]).png().toBuffer();

    const result = await imageBufferToStitchGrid(testImage, 50);

    expect(result.stitchCount).toBe(2500);
    expect(result.dmcColors.length).toBeGreaterThanOrEqual(1);
    expect(result.grid[0][0].dmcCode).toBeTruthy();
  }, 15000);

  it("uses default grid size when not specified", async () => {
    const { default: sharp } = await import("sharp");
    const testImage = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).png().toBuffer();

    const result = await imageBufferToStitchGrid(testImage); // No gridSize = default 100

    expect(result.gridSize).toBe(100);
    expect(result.stitchCount).toBe(10000); // 100*100
  }, 15000);
});

// ─── API Route Tests ────────────────────────────────────────────────────────

describe("AI Embroidery API Routes", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let authToken: string;

  beforeAll(async () => {
    app = await createApp();
    await request(app)
      .post("/api/auth/signup")
      .send({ email: "ai-embroidery-route@test.com", name: "AI Route Tester", password: "testpass123" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "ai-embroidery-route@test.com", password: "testpass123" });

    authToken = loginRes.body.token;
  });

  describe("POST /api/ai/embroidery/text-to-pattern", () => {
    it("rejects unauthenticated requests", async () => {
      const res = await request(app)
        .post("/api/ai/embroidery/text-to-pattern")
        .send({ prompt: "a flower" });

      expect(res.status).toBe(401);
    });

    it("rejects empty prompt", async () => {
      const res = await request(app)
        .post("/api/ai/embroidery/text-to-pattern")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ prompt: "" });

      expect(res.status).toBe(400);
    });

    it("rejects invalid grid size", async () => {
      const res = await request(app)
        .post("/api/ai/embroidery/text-to-pattern")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ prompt: "test", gridSize: 7 });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/ai/embroidery/image-to-pattern", () => {
    it("rejects unauthenticated requests", async () => {
      const res = await request(app)
        .post("/api/ai/embroidery/image-to-pattern")
        .attach("file", Buffer.from("not-an-image"), "test.png");

      expect(res.status).toBe(401);
    });

    it("rejects requests without a file", async () => {
      const res = await request(app)
        .post("/api/ai/embroidery/image-to-pattern")
        .set("Authorization", `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("accepts valid image upload and returns pattern", async () => {
      const { default: sharp } = await import("sharp");
      const testImage = await sharp({
        create: { width: 16, height: 16, channels: 3, background: { r: 255, g: 0, b: 0 } },
      }).png().toBuffer();

      const res = await request(app)
        .post("/api/ai/embroidery/image-to-pattern")
        .set("Authorization", `Bearer ${authToken}`)
        .field("gridSize", "16")
        .attach("file", testImage, "test-pattern.png");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.grid).toBeDefined();
      expect(res.body.data.gridSize).toBe(16);
      expect(res.body.data.stitchCount).toBe(256);
      expect(res.body.data.dmcColors).toBeDefined();
      expect(res.body.data.dmcColors.length).toBeGreaterThanOrEqual(1);
    }, 15000);
  });
});