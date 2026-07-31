/**
 * Tests for the Collage Studio API.
 *
 * Covers:
 * - Domain types and default data generation
 * - CRUD operations via the repository
 * - Route handlers
 */
 
import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { createApp } from "../app";

import {
  defaultCollageCanvas,
  CreateCollageProjectSchema,
  UpdateCollageProjectSchema,
} from "../domain/collage";

// ─── Domain Tests ───────────────────────────────────────────────────────────

describe("Collage — Domain", () => {
  describe("defaultCollageCanvas", () => {
    it("produces valid JSON with default canvas dimensions", () => {
      const data = defaultCollageCanvas();
      const parsed = JSON.parse(data);
      expect(parsed.version).toBe(1);
      expect(parsed.width).toBe(300);
      expect(parsed.height).toBe(300);
      expect(parsed.gridSize).toBe(10);
      expect(parsed.fabrics).toEqual([]);
      expect(parsed.layers).toEqual([]);
    });
  });

  describe("Zod Schemas", () => {
    it("CreateCollageProjectSchema validates valid input", () => {
      const result = CreateCollageProjectSchema.safeParse({
        name: "My Collage",
        width: 400,
        height: 400,
      });
      expect(result.success).toBe(true);
    });

    it("CreateCollageProjectSchema rejects empty name", () => {
      const result = CreateCollageProjectSchema.safeParse({
        name: "",
      });
      expect(result.success).toBe(false);
    });

    it("CreateCollageProjectSchema rejects name over 200 chars", () => {
      const result = CreateCollageProjectSchema.safeParse({
        name: "x".repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it("CreateCollageProjectSchema rejects invalid width", () => {
      const result = CreateCollageProjectSchema.safeParse({
        name: "Test",
        width: 30, // min is 50
      });
      expect(result.success).toBe(false);
    });

    it("CreateCollageProjectSchema rejects width over 2000", () => {
      const result = CreateCollageProjectSchema.safeParse({
        name: "Test",
        width: 2001,
      });
      expect(result.success).toBe(false);
    });

    it("CreateCollageProjectSchema provides defaults", () => {
      const result = CreateCollageProjectSchema.safeParse({
        name: "Test",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.width).toBe(300);
        expect(result.data.height).toBe(300);
      }
    });

    it("UpdateCollageProjectSchema allows partial updates", () => {
      const result = UpdateCollageProjectSchema.safeParse({
        name: "Renamed",
      });
      expect(result.success).toBe(true);
    });

    it("UpdateCollageProjectSchema allows setting thumbnail to null", () => {
      const result = UpdateCollageProjectSchema.safeParse({
        thumbnail: null,
      });
      expect(result.success).toBe(true);
    });
  });
});

// ─── API Integration Tests ──────────────────────────────────────────────────

describe("Collage — API Integration", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let authToken: string;
  let projectId: string;

  beforeAll(async () => {
    app = await createApp();
    // Sign up a test user
    await request(app)
      .post("/api/auth/signup")
      .send({ email: "collage-test@test.com", name: "Collage Tester", password: "testpass123" });

    // Sign in
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "collage-test@test.com", password: "testpass123" });

    authToken = loginRes.body.token;
  });

  describe("POST /api/collage/projects", () => {
    it("creates a new collage project", async () => {
      const res = await request(app)
        .post("/api/collage/projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "Test Collage", width: 400, height: 400 });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe("Test Collage");
      expect(res.body.width).toBe(400);
      expect(res.body.height).toBe(400);
      projectId = res.body.id;
    });

    it("creates project with default canvas when no data provided", async () => {
      const res = await request(app)
        .post("/api/collage/projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "Default Collage" });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();

      const parsed = JSON.parse(res.body.data);
      expect(parsed.version).toBe(1);
      expect(parsed.layers).toEqual([]);
      expect(parsed.fabrics).toEqual([]);
    });

    it("accepts custom JSON data", async () => {
      const customData = JSON.stringify({
        version: 1,
        width: 300,
        height: 300,
        gridSize: 10,
        fabrics: [],
        layers: [
          { id: "l1", name: "Test Layer", color: "#f472b6", pattern: "solid",
            x: 100, y: 100, width: 50, height: 50, rotation: 0, opacity: 1, zIndex: 1 },
        ],
      });

      const res = await request(app)
        .post("/api/collage/projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "Custom Data", data: customData });

      expect(res.status).toBe(201);
      const parsed = JSON.parse(res.body.data);
      expect(parsed.layers).toHaveLength(1);
      expect(parsed.layers[0].name).toBe("Test Layer");
    });

    it("rejects invalid project data", async () => {
      const res = await request(app)
        .post("/api/collage/projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "" });

      expect(res.status).toBe(400);
    });

    it("rejects unauthenticated requests", async () => {
      const res = await request(app)
        .post("/api/collage/projects")
        .send({ name: "Should Fail" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/collage/projects", () => {
    it("lists projects for the authenticated user", async () => {
      const res = await request(app)
        .get("/api/collage/projects")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it("returns projects ordered by updatedAt desc", async () => {
      // Create two more projects
      await request(app)
        .post("/api/collage/projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "Older Project" });

      await request(app)
        .post("/api/collage/projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "Newer Project" });

      const res = await request(app)
        .get("/api/collage/projects")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      // Should be sorted by updatedAt desc (newest first)
      const names = res.body.map((p: any) => p.name);
      expect(names).toContain("Newer Project");
      expect(names).toContain("Test Collage");
    });

    it("rejects unauthenticated list requests", async () => {
      const res = await request(app)
        .get("/api/collage/projects");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/collage/projects/:id", () => {
    it("returns a project by ID", async () => {
      const res = await request(app)
        .get(`/api/collage/projects/${projectId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(projectId);
      expect(res.body.name).toBe("Test Collage");
    });

    it("returns 404 for non-existent project", async () => {
      const res = await request(app)
        .get("/api/collage/projects/non-existent-id")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it("rejects unauthenticated access", async () => {
      const res = await request(app)
        .get(`/api/collage/projects/${projectId}`);

      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/collage/projects/:id", () => {
    it("updates a project", async () => {
      const res = await request(app)
        .put(`/api/collage/projects/${projectId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "Updated Collage", width: 500 });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated Collage");
      expect(res.body.width).toBe(500);
    });

    it("updates project data (JSON)", async () => {
      const newData = JSON.stringify({
        version: 1,
        width: 500,
        height: 500,
        gridSize: 10,
        fabrics: [],
        layers: [],
      });

      const res = await request(app)
        .put(`/api/collage/projects/${projectId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ data: newData });

      expect(res.status).toBe(200);
      const parsed = JSON.parse(res.body.data);
      expect(parsed.width).toBe(500);
    });

    it("rejects invalid updates", async () => {
      const res = await request(app)
        .put(`/api/collage/projects/${projectId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ width: 0 });

      expect(res.status).toBe(400);
    });

    it("rejects updates from unauthenticated users", async () => {
      const res = await request(app)
        .put(`/api/collage/projects/${projectId}`)
        .send({ name: "Hacked" });

      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/collage/projects/:id", () => {
    it("deletes a project", async () => {
      const res = await request(app)
        .delete(`/api/collage/projects/${projectId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(204);
    });

    it("returns 404 for deleted project", async () => {
      const res = await request(app)
        .get(`/api/collage/projects/${projectId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it("rejects unauthenticated delete", async () => {
      const res = await request(app)
        .delete(`/api/collage/projects/${projectId}`);

      expect(res.status).toBe(401);
    });
  });

  describe("Authorization", () => {
    it("prevents access to other users' projects", async () => {
      // Create project as first user
      const ownRes = await request(app)
        .post("/api/collage/projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "Secret Collage" });

      const otherProjectId = ownRes.body.id;

      // Sign up a second user
      await request(app)
        .post("/api/auth/signup")
        .send({ email: "collage-other@test.com", name: "Other User", password: "testpass123" });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "collage-other@test.com", password: "testpass123" });

      const otherToken = loginRes.body.token;

      const res = await request(app)
        .get(`/api/collage/projects/${otherProjectId}`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });

    it("prevents deletion of other users' projects", async () => {
      // Create project as first user
      const ownRes = await request(app)
        .post("/api/collage/projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "Undeletable" });

      const otherProjectId = ownRes.body.id;

      // Get other user's token
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "collage-other@test.com", password: "testpass123" });

      const otherToken = loginRes.body.token;

      const res = await request(app)
        .delete(`/api/collage/projects/${otherProjectId}`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });
});

// ─── Default Data Integration ───────────────────────────────────────────────

describe("Collage — Default Data", () => {
  it("creates project with default collage canvas when no data provided", async () => {
    const app = await createApp();

    // Sign up a user
    await request(app)
      .post("/api/auth/signup")
      .send({ email: "collage-default@test.com", name: "Default Tester", password: "testpass123" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "collage-default@test.com", password: "testpass123" });

    const token = loginRes.body.token;

    const res = await request(app)
      .post("/api/collage/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Default Collage" });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();

    const parsed = JSON.parse(res.body.data);
    expect(parsed.version).toBe(1);
    expect(parsed.fabrics).toHaveLength(0);
    expect(parsed.layers).toHaveLength(0);
    expect(parsed.width).toBe(300);
    expect(parsed.height).toBe(300);
  });
});
