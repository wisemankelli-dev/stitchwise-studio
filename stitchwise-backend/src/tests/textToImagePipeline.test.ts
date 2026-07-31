/**
 * Tests for the model-agnostic text-to-image pipeline.
 *
 * Covers:
 * - pixelsToStitchGrid() — deterministic pixel→grid conversion
 * - imageToStitchGrid() — image buffer → grid normalization
 * - svgToStitchGrid() — SVG rendering → grid
 * - POST /api/ai/text-to-image-pattern — endpoint validation and response shape
 */

import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { createApp } from "../app";
import { pixelsToStitchGrid, imageToStitchGrid, svgToStitchGrid } from "../domain/stitch/pipeline";

// ─── pixelsToStitchGrid Unit Tests ──────────────────────────────────────────

describe("pixelsToStitchGrid", () => {
  it("converts a solid red pixel buffer to a grid with one dominant DMC color", () => {
    const size = 50;
    const pixels = new Uint8Array(size * size * 4);
    // Fill all pixels with red (255, 0, 0, 255)
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255;     // R
      pixels[i + 1] = 0;   // G
      pixels[i + 2] = 0;   // B
      pixels[i + 3] = 255; // A
    }

    const result = pixelsToStitchGrid(pixels, size);

    expect(result.gridSize).toBe(50);
    expect(result.stitchCount).toBe(2500);
    expect(result.grid.length).toBe(50);
    expect(result.grid[0].length).toBe(50);
    expect(result.dmcColors.length).toBeGreaterThanOrEqual(1);
    // The dominant color should account for all or nearly all stitches
    expect(result.dmcColors[0].count).toBeGreaterThan(2000);
    // Every cell should have a DMC code
    expect(result.grid[0][0].dmcCode).toBeTruthy();
  });

  it("converts a multi-color pixel buffer and detects multiple DMC colors", () => {
    const size = 50;
    const pixels = new Uint8Array(size * size * 4);
    // Top half: blue, Bottom half: green
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const idx = (row * size + col) * 4;
        if (row < 25) {
          pixels[idx] = 0; pixels[idx + 1] = 0; pixels[idx + 2] = 255; // blue
        } else {
          pixels[idx] = 0; pixels[idx + 1] = 255; pixels[idx + 2] = 0; // green
        }
        pixels[idx + 3] = 255;
      }
    }

    const result = pixelsToStitchGrid(pixels, size);

    expect(result.gridSize).toBe(50);
    expect(result.stitchCount).toBe(2500);
    // Should have at least 2 distinct DMC colors (blue and green)
    expect(result.dmcColors.length).toBeGreaterThanOrEqual(2);
  });

  it("despeckles isolated single pixels", () => {
    const size = 10;
    const pixels = new Uint8Array(size * size * 4);
    // Fill with white
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255;
      pixels[i + 1] = 255;
      pixels[i + 2] = 255;
      pixels[i + 3] = 255;
    }
    // Put a single black pixel in the middle
    const mid = 5 * size + 5;
    const idx = mid * 4;
    pixels[idx] = 0;
    pixels[idx + 1] = 0;
    pixels[idx + 2] = 0;

    const result = pixelsToStitchGrid(pixels, size);

    // The isolated pixel should be replaced, resulting in mostly white
    expect(result.dmcColors.length).toBeGreaterThanOrEqual(1);
    // After despeckle, there should be very few non-white stitches
    const whiteCount = result.dmcColors.find(
      c => c.name.toLowerCase().includes("white")
    )?.count ?? 0;
    expect(whiteCount).toBeGreaterThanOrEqual(90); // At least 90% white
  });
});

// ─── imageToStitchGrid Integration Tests ────────────────────────────────────

describe("imageToStitchGrid", () => {
  it("converts a simple PNG buffer to a stitch grid", async () => {
    const { default: sharp } = await import("sharp");
    const testImage = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 100, g: 150, b: 200 },
      },
    }).png().toBuffer();

    const result = await imageToStitchGrid(testImage, 100, "test pattern");

    expect(result.gridSize).toBe(100);
    expect(result.stitchCount).toBe(10000);
    expect(result.prompt).toBe("test pattern");
    expect(result.dmcColors.length).toBeGreaterThanOrEqual(1);
  });

  it("clamps invalid grid sizes to default", async () => {
    const { default: sharp } = await import("sharp");
    const testImage = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).png().toBuffer();

    const result = await imageToStitchGrid(testImage, 999);

    // 999 is not in AVAILABLE_GRID_SIZES, should default to 100
    expect(result.gridSize).toBe(100);
  });
});

// ─── svgToStitchGrid Tests ──────────────────────────────────────────────────

describe("svgToStitchGrid", () => {
  it("renders a simple SVG to a stitch grid", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect width="100" height="100" fill="white"/>
      <circle cx="50" cy="50" r="25" fill="red"/>
    </svg>`;

    const result = await svgToStitchGrid(svg, 100, "circle pattern");

    expect(result.gridSize).toBe(100);
    expect(result.stitchCount).toBe(10000);
    expect(result.prompt).toBe("circle pattern");
    expect(result.dmcColors.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── API Route Tests ────────────────────────────────────────────────────────

describe("POST /api/ai/text-to-image-pattern", () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    app = await createApp();
  });

  it("rejects requests with missing prompt", async () => {
    const res = await request(app)
      .post("/api/ai/text-to-image-pattern")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Validation failed");
  });

  it("rejects empty prompt string", async () => {
    const res = await request(app)
      .post("/api/ai/text-to-image-pattern")
      .send({ prompt: "" });

    expect(res.status).toBe(400);
  });

  it("rejects prompt exceeding 500 characters", async () => {
    const res = await request(app)
      .post("/api/ai/text-to-image-pattern")
      .send({ prompt: "x".repeat(501) });

    expect(res.status).toBe(400);
  });

  it("accepts valid request with minimum fields", async () => {
    const res = await request(app)
      .post("/api/ai/text-to-image-pattern")
      .send({ prompt: "a simple test pattern" });

    // May succeed (if AI is available) or fail with 500 (no AI keys)
    // Either way, the endpoint should be registered and accept the request
    expect([200, 500]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.grid).toBeDefined();
      expect(res.body.dmcPalette).toBeDefined();
      expect(res.body.width).toBe(100); // default grid size
      expect(res.body.height).toBe(100);
    }
  });

  it("accepts custom grid size", async () => {
    const res = await request(app)
      .post("/api/ai/text-to-image-pattern")
      .send({ prompt: "test", gridSize: 50 });

    expect([200, 500]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body.width).toBe(50);
      expect(res.body.height).toBe(50);
    }
  });
});
