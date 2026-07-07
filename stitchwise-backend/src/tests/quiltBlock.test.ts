/**
 * Tests for the Quilt Block Studio API.
 *
 * Covers:
 * - Domain types and default data generation
 * - Block template presets
 * - CRUD operations via the repository
 * - Route handlers
 */

import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../app";

import {
  defaultQuiltBlockData,
  BLOCK_TEMPLATES,
  CreateQuiltBlockProjectSchema,
  UpdateQuiltBlockProjectSchema,
  PatchShape,
  GridSplit,
} from "../domain/quiltBlock";

// ─── Domain Tests ───────────────────────────────────────────────────────────

describe("Quilt Block — Domain", () => {
  describe("defaultQuiltBlockData", () => {
    it("produces valid JSON with default grid dimensions", () => {
      const data = defaultQuiltBlockData();
      const parsed = JSON.parse(data);
      expect(parsed.version).toBe(1);
      expect(parsed.blockSize).toBe(12);
      expect(parsed.gridRows).toBe(4);
      expect(parsed.gridCols).toBe(4);
      expect(parsed.fabrics).toHaveLength(3);
      expect(parsed.seamAllowance).toBe(0.25);
    });

    it("includes 3 default fabrics", () => {
      const data = defaultQuiltBlockData();
      const parsed = JSON.parse(data);
      expect(parsed.fabrics[0].name).toBe("Fabric A");
      expect(parsed.fabrics[1].name).toBe("Fabric B");
      expect(parsed.fabrics[2].name).toBe("Background");
    });
  });

  describe("Block Templates", () => {
    it("includes at least 4 preset templates", () => {
      expect(BLOCK_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    });

    it("Nine Patch template has 3x3 grid", () => {
      const ninePatch = BLOCK_TEMPLATES.find((t) => t.name === "Nine Patch");
      expect(ninePatch).toBeDefined();
      expect(ninePatch!.gridRows).toBe(3);
      expect(ninePatch!.gridCols).toBe(3);
    });

    it("Flying Geese template has 4x4 grid", () => {
      const flying = BLOCK_TEMPLATES.find((t) => t.name === "Flying Geese");
      expect(flying).toBeDefined();
      expect(flying!.gridRows).toBe(4);
    });

    it("All templates have grid splits matching dimensions", () => {
      for (const template of BLOCK_TEMPLATES) {
        expect(template.cellSplits.length).toBe(template.gridRows);
        for (const row of template.cellSplits) {
          expect(row.length).toBe(template.gridCols);
        }
      }
    });
  });

  describe("Enums", () => {
    it("PatchShape includes all expected shapes", () => {
      expect(PatchShape.SQUARE).toBe("square");
      expect(PatchShape.HALF_SQUARE_TRIANGLE).toBe("half_square_triangle");
      expect(PatchShape.FLYING_GEESE).toBe("flying_geese");
    });

    it("GridSplit includes all expected splits", () => {
      expect(GridSplit.HST_A).toBe("hst_a");
      expect(GridSplit.HST_B).toBe("hst_b");
      expect(GridSplit.FOUR_PATCH).toBe("four_patch");
    });
  });

  describe("Zod Schemas", () => {
    it("CreateQuiltBlockProjectSchema validates valid input", () => {
      const result = CreateQuiltBlockProjectSchema.safeParse({
        name: "My Block",
        blockSize: 12,
        gridRows: 4,
        gridCols: 4,
      });
      expect(result.success).toBe(true);
    });

    it("CreateQuiltBlockProjectSchema rejects empty name", () => {
      const result = CreateQuiltBlockProjectSchema.safeParse({
        name: "",
      });
      expect(result.success).toBe(false);
    });

    it("CreateQuiltBlockProjectSchema rejects invalid grid dimensions", () => {
      const result = CreateQuiltBlockProjectSchema.safeParse({
        name: "Test",
        gridRows: 20, // max is 16
      });
      expect(result.success).toBe(false);
    });

    it("CreateQuiltBlockProjectSchema provides defaults", () => {
      const result = CreateQuiltBlockProjectSchema.safeParse({
        name: "Test",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.blockSize).toBe(12);
        expect(result.data.gridRows).toBe(4);
        expect(result.data.gridCols).toBe(4);
      }
    });

    it("UpdateQuiltBlockProjectSchema allows partial updates", () => {
      const result = UpdateQuiltBlockProjectSchema.safeParse({
        name: "Renamed",
      });
      expect(result.success).toBe(true);
    });
  });
});

// ─── API Integration Tests ──────────────────────────────────────────────────

describe("Quilt Block — API Integration", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let authToken: string;
  let projectId: string;

  beforeAll(async () => {
    app = await createApp();
    // Sign up a test user
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ email: "quiltblock-test@test.com", name: "Quilt Tester", password: "testpass123" });

    // Sign in
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "quiltblock-test@test.com", password: "testpass123" });

    authToken = loginRes.body.token;
  });

  describe("GET /api/quilt-block/templates", () => {
    it("returns block templates without authentication", async () => {
      const res = await request(app).get("/api/quilt-block/templates");
      expect(res.status).toBe(200);
      expect(res.body.templates).toBeDefined();
      expect(res.body.templates.length).toBeGreaterThanOrEqual(4);
      expect(res.body.templates[0].name).toBeDefined();
    });
  });

  describe("POST /api/quilt-block/projects", () => {
    it("creates a new quilt block project", async () => {
      const res = await request(app)
        .post("/api/quilt-block/projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "Test Block", blockSize: 12, gridRows: 3, gridCols: 3 });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe("Test Block");
      expect(res.body.blockSize).toBe(12);
      expect(res.body.gridRows).toBe(3);
      expect(res.body.gridCols).toBe(3);
      projectId = res.body.id;
    });

    it("rejects invalid project data", async () => {
      const res = await request(app)
        .post("/api/quilt-block/projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "" });

      expect(res.status).toBe(400);
    });

    it("rejects unauthenticated requests", async () => {
      const res = await request(app)
        .post("/api/quilt-block/projects")
        .send({ name: "Should Fail" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/quilt-block/projects", () => {
    it("lists projects for the authenticated user", async () => {
      const res = await request(app)
        .get("/api/quilt-block/projects")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /api/quilt-block/projects/:id", () => {
    it("returns a project by ID", async () => {
      const res = await request(app)
        .get(`/api/quilt-block/projects/${projectId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(projectId);
      expect(res.body.name).toBe("Test Block");
    });

    it("returns 404 for non-existent project", async () => {
      const res = await request(app)
        .get("/api/quilt-block/projects/non-existent-id")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/quilt-block/projects/:id", () => {
    it("updates a project", async () => {
      const res = await request(app)
        .put(`/api/quilt-block/projects/${projectId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "Updated Block", blockSize: 16 });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated Block");
      expect(res.body.blockSize).toBe(16);
    });

    it("rejects updates from unauthenticated users", async () => {
      const res = await request(app)
        .put(`/api/quilt-block/projects/${projectId}`)
        .send({ name: "Hacked" });

      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/quilt-block/projects/:id", () => {
    it("deletes a project", async () => {
      const res = await request(app)
        .delete(`/api/quilt-block/projects/${projectId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(204);
    });

    it("returns 404 for deleted project", async () => {
      const res = await request(app)
        .get(`/api/quilt-block/projects/${projectId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("Authorization", () => {
    it("prevents access to other users' projects", async () => {
      // Create project as first user
      const ownRes = await request(app)
        .post("/api/quilt-block/projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "Secret Block" });

      const otherProjectId = ownRes.body.id;

      // Sign up a second user
      const signupRes = await request(app)
        .post("/api/auth/signup")
        .send({ email: "quiltblock-other@test.com", name: "Other User", password: "testpass123" });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "quiltblock-other@test.com", password: "testpass123" });

      const otherToken = loginRes.body.token;

      const res = await request(app)
        .get(`/api/quilt-block/projects/${otherProjectId}`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });
});

// ─── Default Data Integration ───────────────────────────────────────────────

describe("Quilt Block — Default Data", () => {
  it("creates project with default quilt block data when no data provided", async () => {
    const app = await createApp();

    // Sign up a user
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ email: "quiltblock-default@test.com", name: "Default Tester", password: "testpass123" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "quiltblock-default@test.com", password: "testpass123" });

    const token = loginRes.body.token;

    const res = await request(app)
      .post("/api/quilt-block/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Default Block" });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();

    const parsed = JSON.parse(res.body.data);
    expect(parsed.version).toBe(1);
    expect(parsed.fabrics).toHaveLength(3);
    expect(parsed.gridRows).toBe(4);
    expect(parsed.gridCols).toBe(4);
  });
});