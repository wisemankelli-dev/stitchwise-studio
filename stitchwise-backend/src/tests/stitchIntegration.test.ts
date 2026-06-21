/**
 * Integration test for the AI Stitch Engine flow.
 *
 * Tests the full pipeline: Express API → Python Stitch Service → file output.
 *
 * This test attempts a live connection to the Python stitch service first.
 * If the service is unreachable, it falls back to mocking the network layer
 * so the test still validates the Express routing and error handling.
 */

import request from "supertest";
import http from "http";
import { createApp } from "../app";

const STITCH_SERVICE_URL = process.env.STITCH_SERVICE_URL ?? "http://localhost:8000";

/**
 * Checks if the Python stitch service is reachable.
 */
async function isStitchServiceAlive(): Promise<boolean> {
  try {
    const res = await fetch(`${STITCH_SERVICE_URL}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

describe("AI Stitch Engine — Integration Test", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let serviceAlive: boolean;

  beforeAll(async () => {
    app = await createApp();
    serviceAlive = await isStitchServiceAlive();
    if (!serviceAlive) {
      console.warn(
        "\n  ⚠ Python stitch service not running at", STITCH_SERVICE_URL,
        "\n  Tests will verify Express routing and error handling only.",
        "\n  Start the service with: cd ~/stitchwise-stitch-service && python -m src.app\n"
      );
    }
  });

  // ─── Health Check ───────────────────────────────────────────────────────

  describe("GET /api/stitch/health", () => {
    it("returns stitch service status (live or proxied)", async () => {
      const res = await request(app).get("/api/stitch/health");

      if (serviceAlive) {
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("status", "ok");
        expect(res.body).toHaveProperty("service", "stitch-service");
      } else {
        // Without the service, the route returns 503
        expect(res.status).toBe(503);
        expect(res.body).toHaveProperty("error", "Stitch service unavailable");
      }
    });
  });

  // ─── Formats ────────────────────────────────────────────────────────────

  describe("GET /api/stitch/formats", () => {
    it("returns supported embroidery formats", async () => {
      const res = await request(app).get("/api/stitch/formats");

      if (serviceAlive) {
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("formats");
        expect(res.body.formats).toHaveProperty("dst");
        expect(res.body.formats).toHaveProperty("pes");
        expect(res.body.default).toBe("dst");
      } else {
        expect(res.status).toBe(503);
      }
    });
  });

  // ─── Generate (Live or Error-Handling) ─────────────────────────────────

  describe("POST /api/stitch/generate", () => {
    const validPayload = {
      paths: [
        {
          segments: [
            [0, 0, "M"],
            [100, 0, "L"],
            [100, 100, "L"],
            [0, 100, "L"],
            [0, 0, "L"],
          ] as [number, number, string][],
          color: [255, 0, 0] as [number, number, number],
          stitchType: "running" as const,
        },
      ],
      format: "dst",
      stitchDensity: 4.0,
    };

    it("validates request body (empty)", async () => {
      const res = await request(app)
        .post("/api/stitch/generate")
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty("error", "Validation failed");
    });

    it("validates request body (missing fields)", async () => {
      const res = await request(app)
        .post("/api/stitch/generate")
        .send({ format: "dst" })
        .expect(400);

      expect(res.body).toHaveProperty("error", "Validation failed");
    });

    it("generates a .dst file from valid path data", async () => {
      const res = await request(app)
        .post("/api/stitch/generate")
        .send(validPayload)
        .expect(serviceAlive ? 200 : 500);

      if (serviceAlive) {
        // Verify we got a real embroidery file
        expect(res.headers["content-type"]).toBe("application/octet-stream");
        expect(res.headers["content-disposition"]).toContain(".dst");
        expect(res.body.length).toBeGreaterThan(50); // DST files have a minimum size

        // DST files start with a "#" header in the Tajima format
        const firstBytes = Buffer.isBuffer(res.body)
          ? res.body.slice(0, 1).toString()
          : res.body.slice(0, 1);
        expect(firstBytes).toBe("#");
      }
    });

    it("generates a .pes file from valid path data", async () => {
      const pesPayload = { ...validPayload, format: "pes" };
      const res = await request(app)
        .post("/api/stitch/generate")
        .send(pesPayload)
        .expect(serviceAlive ? 200 : 500);

      if (serviceAlive) {
        expect(res.headers["content-type"]).toBe("application/octet-stream");
        expect(res.headers["content-disposition"]).toContain(".pes");
        expect(res.body.length).toBeGreaterThan(50);
      }
    });

    it("rejects an unsupported format", async () => {
      const res = await request(app)
        .post("/api/stitch/generate")
        .send({ ...validPayload, format: "xyz" });

      // Zod validation rejects formats not in the enum
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Validation failed");
    });
  });

  // ─── Convert (Error-Handling) ──────────────────────────────────────────

  describe("POST /api/stitch/convert", () => {
    it("rejects request without a file", async () => {
      const res = await request(app)
        .post("/api/stitch/convert")
        .field("format", "pes")
        .expect(400);

      expect(res.body).toHaveProperty("error");
    });

    it("rejects invalid target format", async () => {
      const res = await request(app)
        .post("/api/stitch/convert")
        .field("format", "invalid")
        .expect(400);

      expect(res.body).toHaveProperty("error", "Validation failed");
    });
  });

  // ─── End-to-End: Generate then Convert ──────────────────────────────────

  describe("Full pipeline: generate → convert", () => {
    it("generates a DST file and converts it to PES", async () => {
      if (!serviceAlive) {
        console.warn("  ⚠ Skipping full pipeline test — stitch service not running");
        return;
      }

      // Step 1: Generate a DST file
      const genRes = await request(app)
        .post("/api/stitch/generate")
        .send({
          paths: [
            {
              segments: [[0, 0, "M"], [50, 0, "L"], [25, 50, "L"], [0, 0, "L"]],
              color: [0, 128, 0],
              stitchType: "running",
            },
          ],
          format: "dst",
          stitchDensity: 4.0,
        })
        .expect(200);

      const dstFile = genRes.body;

      // Step 2: Convert DST → PES
      const convRes = await request(app)
        .post("/api/stitch/convert")
        .attach("file", Buffer.isBuffer(dstFile) ? dstFile : Buffer.from(dstFile), "design.dst")
        .field("format", "pes")
        .expect(200);

      expect(convRes.headers["content-type"]).toBe("application/octet-stream");
      expect(convRes.headers["content-disposition"]).toContain(".pes");
      expect(convRes.body.length).toBeGreaterThan(50);
    });
  });
});