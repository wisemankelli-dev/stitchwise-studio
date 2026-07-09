/**
 * Tests for the AI Collage Generation Service.
 *
 * Covers:
 * - Fabric color matching and quantization
 * - Collage layer generation from mock prompts
 * - API routes validation
 * - Image-to-collage with generated test images
 */
import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { createApp } from "../app";
import { FABRIC_COLORS, closestFabricColor, closestFabricColorFromHex } from "../domain/collage/fabricColors";
import { FABRIC_TEXTURES, getRandomTexture } from "../domain/collage/fabricTextures";
import { TextToCollageSchema, ImageToCollageSchema, DEFAULT_GRID_SIZE } from "../domain/ai/collageAI";
import { generateCollageLayoutFromPrompt, generateMockCollageLayout } from "../infrastructure/services/leonardoCollageService";

// ─── Fabric Color Tests ─────────────────────────────────────────────────────

describe("Fabric Colors", () => {
  describe("FABRIC_COLORS palette", () => {
    it("has exactly 15 colors", () => {
      expect(FABRIC_COLORS.length).toBe(15);
    });

    it("every color has a unique hex", () => {
      const hexes = FABRIC_COLORS.map((c) => c.hex);
      expect(new Set(hexes).size).toBe(hexes.length);
    });

    it("every color has a non-empty name", () => {
      for (const c of FABRIC_COLORS) {
        expect(c.name.length).toBeGreaterThan(0);
      }
    });
  });

  describe("closestFabricColor", () => {
    it("matches pure white to White", () => {
      const match = closestFabricColor(255, 255, 255);
      expect(match.hex).toBe("#ffffff");
      expect(match.name).toBe("White");
    });

    it("matches pure black to a color (closest)", () => {
      const match = closestFabricColor(0, 0, 0);
      // Black is not in the palette, so closest should be the darkest color
      expect(match.hex).toBeTruthy();
      expect(match.distance).toBeGreaterThan(0);
    });

    it("matches hot pink to Hot Pink", () => {
      const match = closestFabricColor(236, 72, 153);
      expect(match.hex).toBe("#ec4899");
      expect(match.name).toBe("Hot Pink");
    });

    it("returns distance value", () => {
      const match = closestFabricColor(255, 0, 0);
      expect(match.distance).toBeGreaterThanOrEqual(0);
    });
  });

  describe("closestFabricColorFromHex", () => {
    it("converts hex to RGB and matches", () => {
      const match = closestFabricColorFromHex("#ffffff");
      expect(match.hex).toBe("#ffffff");
    });

    it("handles lowercase hex", () => {
      const match = closestFabricColorFromHex("#fce7f3");
      expect(match.name).toBe("Petal Pink");
    });
  });
});

// ─── Fabric Texture Tests ───────────────────────────────────────────────────

describe("Fabric Textures", () => {
  it("has 5 textures", () => {
    expect(FABRIC_TEXTURES.length).toBe(5);
  });

  it("includes solid texture", () => {
    const solid = FABRIC_TEXTURES.find((t) => t.id === "solid");
    expect(solid).toBeDefined();
    expect(solid!.name).toBe("Solid");
  });

  it("includes all required textures", () => {
    const ids = FABRIC_TEXTURES.map((t) => t.id);
    expect(ids).toContain("solid");
    expect(ids).toContain("linen");
    expect(ids).toContain("polka");
    expect(ids).toContain("stripe");
    expect(ids).toContain("plaid");
  });

  it("getRandomTexture returns a valid texture", () => {
    const texture = getRandomTexture();
    expect(texture.id).toBeTruthy();
    expect(texture.name).toBeTruthy();
    expect(texture.cssClass).toBeTruthy();
  });
});

// ─── Schema Validation Tests ────────────────────────────────────────────────

describe("TextToCollageSchema", () => {
  it("accepts valid prompt", () => {
    const result = TextToCollageSchema.safeParse({ prompt: "a floral collage" });
    expect(result.success).toBe(true);
  });

  it("rejects empty prompt", () => {
    const result = TextToCollageSchema.safeParse({ prompt: "" });
    expect(result.success).toBe(false);
  });

  it("accepts valid grid size", () => {
    const result = TextToCollageSchema.safeParse({ prompt: "test", gridSize: 48 });
    expect(result.success).toBe(true);
    expect(result.data?.gridSize).toBe(48);
  });

  it("rejects invalid grid size", () => {
    const result = TextToCollageSchema.safeParse({ prompt: "test", gridSize: 7 });
    expect(result.success).toBe(false);
  });

  it("defaults gridSize to 32", () => {
    const result = TextToCollageSchema.safeParse({ prompt: "test" });
    expect(result.success).toBe(true);
    expect(result.data?.gridSize).toBe(32);
  });

  it("rejects prompt over 1000 chars", () => {
    const result = TextToCollageSchema.safeParse({ prompt: "x".repeat(1001) });
    expect(result.success).toBe(false);
  });
});

describe("ImageToCollageSchema", () => {
  it("accepts empty body with defaults", () => {
    const result = ImageToCollageSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.gridSize).toBe(32);
  });
});

// ─── Mock Collage Generation Tests ──────────────────────────────────────────

describe("Mock Collage Generation", () => {
  it("generateMockCollageLayout returns layers", () => {
    const result = generateMockCollageLayout(32);
    expect(result.layers).toBeDefined();
    expect(result.layers.length).toBeGreaterThanOrEqual(3);
    expect(result.gridSize).toBe(32);
    expect(result.layerCount).toBe(result.layers.length);
  });

  it("generateMockCollageLayout uses specified grid size", () => {
    const result = generateMockCollageLayout(16);
    expect(result.gridSize).toBe(16);
  });

  it("generateCollageLayoutFromPrompt returns floral layout", () => {
    const result = generateCollageLayoutFromPrompt("a floral garden with roses");
    expect(result.layers.length).toBeGreaterThanOrEqual(3);
    expect(result.prompt).toBe("a floral garden with roses");
  });

  it("generateCollageLayoutFromPrompt returns geometric layout", () => {
    const result = generateCollageLayoutFromPrompt("geometric abstract pattern");
    expect(result.layers.length).toBeGreaterThanOrEqual(3);
  });

  it("generateCollageLayoutFromPrompt returns nature layout", () => {
    const result = generateCollageLayoutFromPrompt("nature landscape with trees");
    expect(result.layers.length).toBeGreaterThanOrEqual(3);
  });

  it("generateCollageLayoutFromPrompt returns vintage layout", () => {
    const result = generateCollageLayoutFromPrompt("vintage retro design");
    expect(result.layers.length).toBeGreaterThanOrEqual(3);
  });

  it("all generated layers have valid structure", () => {
    const result = generateCollageLayoutFromPrompt("test");
    for (const layer of result.layers) {
      expect(layer.id).toBeTruthy();
      expect(layer.name).toBeTruthy();
      expect(layer.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(layer.pattern).toBeTruthy();
      expect(typeof layer.x).toBe("number");
      expect(typeof layer.y).toBe("number");
      expect(typeof layer.width).toBe("number");
      expect(typeof layer.height).toBe("number");
      expect(typeof layer.rotation).toBe("number");
      expect(layer.opacity).toBeGreaterThanOrEqual(0);
      expect(layer.opacity).toBeLessThanOrEqual(1);
      expect(typeof layer.zIndex).toBe("number");
    }
  });
});

// ─── API Route Tests ────────────────────────────────────────────────────────

describe("AI Collage API Routes", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let authToken: string;

  beforeAll(async () => {
    app = await createApp();
    await request(app)
      .post("/api/auth/signup")
      .send({ email: "ai-collage-route@test.com", name: "AI Collage Tester", password: "testpass123" });
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "ai-collage-route@test.com", password: "testpass123" });
    authToken = loginRes.body.token;
  });

  describe("POST /api/ai/collage/text-to-collage", () => {
    it("rejects unauthenticated requests", async () => {
      const res = await request(app)
        .post("/api/ai/collage/text-to-collage")
        .send({ prompt: "a floral collage" });
      expect(res.status).toBe(401);
    });

    it("rejects empty prompt", async () => {
      const res = await request(app)
        .post("/api/ai/collage/text-to-collage")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ prompt: "" });
      expect(res.status).toBe(400);
    });

    it("rejects invalid grid size", async () => {
      const res = await request(app)
        .post("/api/ai/collage/text-to-collage")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ prompt: "test", gridSize: 7 });
      expect(res.status).toBe(400);
    });

    it("returns mock collage for valid prompt (no API key)", async () => {
      const res = await request(app)
        .post("/api/ai/collage/text-to-collage")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ prompt: "floral garden with roses" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.layers).toBeDefined();
      expect(res.body.data.layers.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.gridSize).toBe(32);
      expect(res.body.data.layerCount).toBe(res.body.data.layers.length);
      expect(res.body.data.prompt).toBe("floral garden with roses");
    }, 15000);
  });

  describe("POST /api/ai/collage/image-to-collage", () => {
    it("rejects unauthenticated requests", async () => {
      const res = await request(app)
        .post("/api/ai/collage/image-to-collage")
        .attach("file", Buffer.from("not-an-image"), "test.png");
      expect(res.status).toBe(401);
    });

    it("rejects requests without a file", async () => {
      const res = await request(app)
        .post("/api/ai/collage/image-to-collage")
        .set("Authorization", `Bearer ${authToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("accepts valid image upload and returns collage layers", async () => {
      const { default: sharp } = await import("sharp");
      const testImage = await sharp({
        create: { width: 16, height: 16, channels: 3, background: { r: 255, g: 200, b: 220 } },
      }).png().toBuffer();
      const res = await request(app)
        .post("/api/ai/collage/image-to-collage")
        .set("Authorization", `Bearer ${authToken}`)
        .field("gridSize", "16")
        .attach("file", testImage, "test-collage.png");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.layers).toBeDefined();
      expect(res.body.data.gridSize).toBe(16);
      expect(res.body.data.layerCount).toBe(res.body.data.layers.length);
      expect(res.body.data.fabricColors).toBeDefined();
      expect(res.body.data.fabricColors.length).toBeGreaterThanOrEqual(1);
    }, 15000);
  });
});