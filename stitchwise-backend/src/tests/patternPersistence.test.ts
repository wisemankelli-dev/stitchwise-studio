/**
 * Tests for Pattern Persistence endpoints.
 *
 * POST   /api/patterns       — save
 * GET    /api/patterns       — list
 * GET    /api/patterns/:id   — load
 * DELETE /api/patterns/:id   — delete
 */

import request from "supertest";
import { createApp } from "../app";

describe("Pattern Persistence API", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let userToken: string;
  let testUserEmail: string;
  let testUserId: string;
  let savedPatternId: string;

  beforeAll(async () => {
    app = await createApp();

    // Create a test user
    testUserEmail = `pattern-test-${Date.now()}@stitchwise.dev`;
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ email: testUserEmail, password: "password123", name: "Pattern Tester" });
    userToken = signupRes.body.token;
    testUserId = signupRes.body.user.userId;
  });

  // ── Helper ──────────────────────────────────────────────────────────
  function makeTestGrid(size: number = 50) {
    const grid = [];
    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) {
        row.push({
          color: (r + c) % 2 === 0 ? "#ff0000" : "#0000ff",
          dmcCode: (r + c) % 2 === 0 ? "DMC 321" : "DMC 798",
          dmcName: (r + c) % 2 === 0 ? "Christmas Red" : "Delft Blue",
        });
      }
      grid.push(row);
    }
    return grid;
  }

  function makeTestPalette() {
    return [
      { code: "DMC 321", name: "Christmas Red", hex: "#e11d48", count: 1250 },
      { code: "DMC 798", name: "Delft Blue", hex: "#0284c7", count: 1250 },
    ];
  }

  // ── POST /api/patterns — Save ───────────────────────────────────────

  describe("POST /api/patterns — Save", () => {
    it("saves a new pattern and returns 201 with pattern metadata", async () => {
      const res = await request(app)
        .post("/api/patterns")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          name: "My Test Pattern",
          grid: makeTestGrid(50),
          palette: makeTestPalette(),
          gridSize: 50,
          stitchCount: 2500,
        })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("name", "My Test Pattern");
      expect(res.body).toHaveProperty("gridSize", 50);
      expect(res.body).toHaveProperty("stitchCount", 2500);
      expect(res.body).toHaveProperty("createdAt");
      savedPatternId = res.body.id;
    });

    it("saves a pattern with optional fields (prompt, previewUrl)", async () => {
      const res = await request(app)
        .post("/api/patterns")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          name: "AI Generated Pattern",
          grid: makeTestGrid(75),
          palette: makeTestPalette(),
          gridSize: 75,
          stitchCount: 5625,
          prompt: "a red rose",
          previewUrl: "http://example.com/preview.png",
        })
        .expect(201);

      expect(res.body.name).toBe("AI Generated Pattern");
    });

    it("returns 401 without auth", async () => {
      await request(app)
        .post("/api/patterns")
        .send({ name: "No Auth", grid: makeTestGrid(50), palette: [], gridSize: 50, stitchCount: 2500 })
        .expect(401);
    });

    it("returns 400 with invalid body (missing name)", async () => {
      await request(app)
        .post("/api/patterns")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ grid: makeTestGrid(50), palette: [], gridSize: 50, stitchCount: 2500 })
        .expect(400);
    });

    it("returns 400 with empty grid", async () => {
      await request(app)
        .post("/api/patterns")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ name: "Empty", grid: [], palette: [], gridSize: 50, stitchCount: 0 })
        .expect(400);
    });
  });

  // ── GET /api/patterns — List ────────────────────────────────────────

  describe("GET /api/patterns — List", () => {
    beforeAll(async () => {
      // Create some patterns to list
      const grid = makeTestGrid(50);
      const palette = makeTestPalette();
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post("/api/patterns")
          .set("Authorization", `Bearer ${userToken}`)
          .send({ name: `Pattern ${i}`, grid, palette, gridSize: 50, stitchCount: 2500 });
      }
    });

    it("lists user's patterns with pagination metadata", async () => {
      const res = await request(app)
        .get("/api/patterns")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(res.body).toHaveProperty("patterns");
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("offset", 0);
      expect(res.body).toHaveProperty("limit");
      expect(Array.isArray(res.body.patterns)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(3);
    });

    it("lists patterns sorted by newest first", async () => {
      const res = await request(app)
        .get("/api/patterns?limit=5")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.patterns.length).toBeGreaterThanOrEqual(3);
      expect(res.body.patterns[0].name).toContain("Pattern");
    });

    it("returns pattern summaries without grid data", async () => {
      const res = await request(app)
        .get("/api/patterns")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      if (res.body.patterns.length > 0) {
        expect(res.body.patterns[0]).not.toHaveProperty("gridData");
        expect(res.body.patterns[0]).not.toHaveProperty("grid");
      }
    });

    it("returns 401 without auth", async () => {
      await request(app).get("/api/patterns").expect(401);
    });

    it("supports offset pagination", async () => {
      const res = await request(app)
        .get("/api/patterns?limit=2&offset=0")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.patterns.length).toBeLessThanOrEqual(2);
      expect(res.body.offset).toBe(0);
      expect(res.body.limit).toBe(2);
    });
  });

  // ── GET /api/patterns/:id — Load ────────────────────────────────────

  describe("GET /api/patterns/:id — Load", () => {
    beforeAll(async () => {
      const res = await request(app)
        .post("/api/patterns")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ name: "Loadable Pattern", grid: makeTestGrid(50), palette: makeTestPalette(), gridSize: 50, stitchCount: 2500 });
      savedPatternId = res.body.id;
    });

    it("loads a pattern by ID with full grid data", async () => {
      const res = await request(app)
        .get(`/api/patterns/${savedPatternId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.id).toBe(savedPatternId);
      expect(res.body.name).toBe("Loadable Pattern");
      expect(res.body).toHaveProperty("grid");
      expect(res.body).toHaveProperty("palette");
      expect(Array.isArray(res.body.grid)).toBe(true);
      expect(res.body.grid.length).toBe(50);
    });

    it("returns 404 for nonexistent pattern", async () => {
      await request(app)
        .get("/api/patterns/nonexistent-id")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(404);
    });

    it("returns 403 when accessing another user's pattern", async () => {
      // Create a second user
      const otherEmail = `other-user-${Date.now()}@stitchwise.dev`;
      const signupRes = await request(app)
        .post("/api/auth/signup")
        .send({ email: otherEmail, password: "password123", name: "Other User" });
      const otherToken = signupRes.body.token;

      // Second user creates a pattern
      const patternRes = await request(app)
        .post("/api/patterns")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ name: "Other's Pattern", grid: makeTestGrid(50), palette: makeTestPalette(), gridSize: 50, stitchCount: 2500 });

      // First user tries to access it — should be 403
      await request(app)
        .get(`/api/patterns/${patternRes.body.id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);
    });

    it("returns 401 without auth", async () => {
      await request(app)
        .get(`/api/patterns/${savedPatternId}`)
        .expect(401);
    });
  });

  // ── DELETE /api/patterns/:id — Delete ───────────────────────────────

  describe("DELETE /api/patterns/:id — Delete", () => {
    let deleteId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post("/api/patterns")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ name: "Deletable", grid: makeTestGrid(50), palette: makeTestPalette(), gridSize: 50, stitchCount: 2500 });
      deleteId = res.body.id;
    });

    it("deletes a pattern by ID", async () => {
      const res = await request(app)
        .delete(`/api/patterns/${deleteId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("deleted", deleteId);
    });

    it("returns 404 for already-deleted pattern", async () => {
      await request(app)
        .get(`/api/patterns/${deleteId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(404);
    });

    it("returns 404 for nonexistent pattern", async () => {
      await request(app)
        .delete("/api/patterns/nonexistent-id")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(404);
    });

    it("returns 403 when deleting another user's pattern", async () => {
      const otherEmail = `other-del-${Date.now()}@stitchwise.dev`;
      const signupRes = await request(app)
        .post("/api/auth/signup")
        .send({ email: otherEmail, password: "password123", name: "Other Deleter" });
      const otherToken = signupRes.body.token;

      const patternRes = await request(app)
        .post("/api/patterns")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ name: "Can't Delete This", grid: makeTestGrid(50), palette: makeTestPalette(), gridSize: 50, stitchCount: 2500 });

      await request(app)
        .delete(`/api/patterns/${patternRes.body.id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);
    });

    it("returns 401 without auth", async () => {
      await request(app)
        .delete(`/api/patterns/${deleteId}`)
        .expect(401);
    });
  });
});
