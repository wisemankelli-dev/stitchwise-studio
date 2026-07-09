/**
 * Tests for the Thread & Fabric Usage Estimator.
 *
 * Covers:
 * - Domain types and constants
 * - Thread calculation per stitch type
 * - Fabric calculation per count
 * - Main calculation function
 * - API route validation
 */
import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { createApp } from "../app";
import {
  StitchType,
  THREAD_LENGTH_CM,
  FABRIC_COUNTS,
  FABRIC_MARGIN_IN,
  FABRIC_MARGIN_CM,
  CalculateEstimateSchema,
  cmToInches,
  inchesToCm,
} from "../domain/estimator/index";
import {
  calculateStitchThreadCm,
  calculateThreadUsage,
  calculateFabricUsage,
  calculateEstimate,
} from "../domain/estimator/calculator";

// ─── Domain Types / Constants ──────────────────────────────────────────────

describe("Estimator Constants", () => {
  it("has 5 fabric counts", () => {
    expect(FABRIC_COUNTS.length).toBe(5);
    expect(FABRIC_COUNTS).toEqual([11, 14, 16, 18, 22]);
  });

  it("has thread lengths for all stitch types", () => {
    expect(THREAD_LENGTH_CM[StitchType.CROSS]).toBe(0.5);
    expect(THREAD_LENGTH_CM[StitchType.BACK]).toBe(0.3);
    expect(THREAD_LENGTH_CM[StitchType.FRENCH_KNOT]).toBe(1.0);
  });

  it("satin stitch has 0 base length (calculated from area)", () => {
    expect(THREAD_LENGTH_CM[StitchType.SATIN]).toBe(0);
  });

  it("fabric margin is 3 inches", () => {
    expect(FABRIC_MARGIN_IN).toBe(3);
    expect(FABRIC_MARGIN_CM).toBeCloseTo(7.62, 1);
  });
});

describe("Unit Conversions", () => {
  it("converts cm to inches", () => {
    expect(cmToInches(2.54)).toBe(1);
    expect(cmToInches(0)).toBe(0);
  });

  it("converts inches to cm", () => {
    expect(inchesToCm(1)).toBeCloseTo(2.54, 0);
    expect(inchesToCm(0)).toBe(0);
  });
});

// ─── Thread Calculation ────────────────────────────────────────────────────

describe("calculateStitchThreadCm", () => {
  it("returns 0.5cm for cross stitch", () => {
    expect(calculateStitchThreadCm(StitchType.CROSS)).toBe(0.5);
  });

  it("returns 0.3cm for back stitch", () => {
    expect(calculateStitchThreadCm(StitchType.BACK)).toBe(0.3);
  });

  it("returns 1cm for french knot", () => {
    expect(calculateStitchThreadCm(StitchType.FRENCH_KNOT)).toBe(1.0);
  });

  it("calculates satin stitch as length × width", () => {
    expect(calculateStitchThreadCm(StitchType.SATIN, 2, 1.5)).toBe(3);
  });

  it("defaults to cross stitch for unknown type", () => {
    // @ts-expect-error - testing default fallback
    expect(calculateStitchThreadCm("unknown")).toBe(0.5);
  });
});

describe("calculateThreadUsage", () => {
  it("returns empty for empty stitches", () => {
    const result = calculateThreadUsage({});
    expect(result.estimates).toEqual([]);
    expect(result.totalMeters).toBe(0);
  });

  it("calculates thread for single cross stitch color", () => {
    const result = calculateThreadUsage({ "DMC 321": 100 });
    expect(result.estimates.length).toBe(1);
    expect(result.estimates[0].dmcCode).toBe("DMC 321");
    expect(result.estimates[0].stitchCount).toBe(100);
    expect(result.estimates[0].meters).toBe(0.5); // 100 * 0.5cm = 5000cm = 0.5m
    expect(result.totalMeters).toBe(0.5);
  });

  it("calculates satin stitch with area info", () => {
    const result = calculateThreadUsage(
      { "DMC 334": 10 },
      { "DMC 334": "satin" },
      [{ dmcCode: "DMC 334", lengthCm: 2, widthCm: 1.5 }],
    );
    expect(result.estimates[0].meters).toBe(0.3); // 10 * (2 * 1.5)cm = 3000cm = 0.3m... wait
    // 10 * 3cm = 30cm = 0.3m
    expect(result.estimates[0].meters).toBe(0.3);
  });

  it("sorts estimates by stitch count descending", () => {
    const result = calculateThreadUsage({
      "DMC 321": 50,
      "DMC 310": 200,
      "DMC 520": 100,
    });
    expect(result.estimates[0].dmcCode).toBe("DMC 310"); // 200 stitches
    expect(result.estimates[1].dmcCode).toBe("DMC 520"); // 100 stitches
    expect(result.estimates[2].dmcCode).toBe("DMC 321"); // 50 stitches
  });

  it("skips zero-count stitches", () => {
    const result = calculateThreadUsage({ "DMC 321": 0, "DMC 310": 100 });
    expect(result.estimates.length).toBe(1);
  });
});

// ─── Fabric Calculation ────────────────────────────────────────────────────

describe("calculateFabricUsage", () => {
  it("calculates 32×32 at 14-count correctly", () => {
    const result = calculateFabricUsage(32, 32, 14);
    expect(result.widthIn).toBeCloseTo(2.3, 0); // 32/14 = 2.29
    expect(result.heightIn).toBeCloseTo(2.3, 0);
    expect(result.fabricCount).toBe(14);
  });

  it("calculates 64×64 at 14-count correctly", () => {
    const result = calculateFabricUsage(64, 64, 14);
    expect(result.widthIn).toBeCloseTo(4.6, 0); // 64/14 = 4.57
    expect(result.heightIn).toBeCloseTo(4.6, 0);
  });

  it("adds margins to recommended size", () => {
    const result = calculateFabricUsage(32, 32, 14);
    expect(result.recommendedWidthIn).toBeGreaterThan(result.widthIn);
    expect(result.recommendedHeightIn).toBeGreaterThan(result.heightIn);
    // For 2.3" + 6" margins = 8.3", rounded up to nearest 0.25 = 8.5"
    expect(result.recommendedWidthIn).toBeGreaterThanOrEqual(8);
    expect(result.recommendedHeightIn).toBeGreaterThanOrEqual(8);
  });

  it("supports all fabric counts", () => {
    for (const count of FABRIC_COUNTS) {
      const result = calculateFabricUsage(32, 32, count);
      expect(result.widthIn).toBe(32 / count);
      expect(result.fabricCount).toBe(count);
    }
  });

  it("returns dimensions in both inches and cm", () => {
    const result = calculateFabricUsage(32, 32, 14);
    expect(result.widthCm).toBeGreaterThan(0);
    expect(result.heightCm).toBeGreaterThan(0);
    expect(result.recommendedWidthCm).toBeGreaterThan(0);
    expect(result.recommendedHeightCm).toBeGreaterThan(0);
  });
});

// ─── Main Calculation ──────────────────────────────────────────────────────

describe("calculateEstimate", () => {
  it("combines thread and fabric estimates", () => {
    const result = calculateEstimate(
      { "DMC 321": 100, "DMC 310": 50 },
      { gridWidth: 32, gridHeight: 32, fabricCount: 14 },
    );
    expect(result.threadEstimates.length).toBe(2);
    expect(result.totalThreadMeters).toBeGreaterThan(0);
    expect(result.fabricEstimate.fabricCount).toBe(14);
  });

  it("uses defaults when options are minimal", () => {
    const result = calculateEstimate({ "DMC 321": 100 });
    expect(result.fabricEstimate.fabricCount).toBe(14);
    expect(result.fabricEstimate.widthIn).toBeCloseTo(2.3, 0);
    expect(result.totalThreadMeters).toBe(0.5);
  });
});

// ─── Schema Validation ─────────────────────────────────────────────────────

describe("CalculateEstimateSchema", () => {
  it("accepts valid request", () => {
    const result = CalculateEstimateSchema.safeParse({
      stitches: { "DMC 321": 100 },
      fabricCount: 14,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing stitches", () => {
    const result = CalculateEstimateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid fabric count", () => {
    const result = CalculateEstimateSchema.safeParse({
      stitches: { "DMC 321": 100 },
      fabricCount: 20,
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid fabric counts", () => {
    for (const count of [11, 14, 16, 18, 22]) {
      const result = CalculateEstimateSchema.safeParse({
        stitches: { "DMC 321": 100 },
        fabricCount: count,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ─── API Route Tests ───────────────────────────────────────────────────────

describe("Estimator API Routes", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let authToken: string;

  beforeAll(async () => {
    app = await createApp();
    await request(app)
      .post("/api/auth/signup")
      .send({ email: "estimator-route@test.com", name: "Estimator Tester", password: "testpass123" });
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "estimator-route@test.com", password: "testpass123" });
    authToken = loginRes.body.token;
  });

  describe("POST /api/estimator/calculate", () => {
    it("rejects unauthenticated requests", async () => {
      const res = await request(app)
        .post("/api/estimator/calculate")
        .send({ stitches: { "DMC 321": 100 } });
      expect(res.status).toBe(401);
    });

    it("rejects missing stitches", async () => {
      const res = await request(app)
        .post("/api/estimator/calculate")
        .set("Authorization", `Bearer ${authToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("rejects invalid fabric count", async () => {
      const res = await request(app)
        .post("/api/estimator/calculate")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ stitches: { "DMC 321": 100 }, fabricCount: 20 });
      expect(res.status).toBe(400);
    });

    it("calculates estimate for valid request", async () => {
      const res = await request(app)
        .post("/api/estimator/calculate")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          stitches: { "DMC 321": 100, "DMC 310": 50 },
          gridWidth: 32,
          gridHeight: 32,
          fabricCount: 14,
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.threadEstimates).toBeDefined();
      expect(res.body.data.threadEstimates.length).toBe(2);
      expect(res.body.data.totalThreadMeters).toBeGreaterThan(0);
      expect(res.body.data.fabricEstimate).toBeDefined();
      expect(res.body.data.fabricEstimate.fabricCount).toBe(14);
      expect(res.body.data.fabricEstimate.widthIn).toBeCloseTo(2.3, 0);
    }, 15000);

    it("uses default fabric count when not provided", async () => {
      const res = await request(app)
        .post("/api/estimator/calculate")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ stitches: { "DMC 321": 100 } });
      expect(res.status).toBe(200);
      expect(res.body.data.fabricEstimate.fabricCount).toBe(14);
    }, 15000);

    it("handles satin stitch types", async () => {
      const res = await request(app)
        .post("/api/estimator/calculate")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          stitches: { "DMC 334": 50 },
          stitchTypes: { "DMC 334": "satin" },
          gridWidth: 32,
          gridHeight: 32,
        });
      expect(res.status).toBe(200);
      expect(res.body.data.threadEstimates[0].stitchType).toBe("satin");
    }, 15000);
  });
});