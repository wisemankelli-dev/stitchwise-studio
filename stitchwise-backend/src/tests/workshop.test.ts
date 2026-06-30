import request from "supertest";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../app";
import { JWT_SECRET } from "../infrastructure/middleware/auth";

const prisma = new PrismaClient();

/** Create a test JWT for a given user ID and tier. */
function testAuthToken(userId: string, tier = "HOBBYIST"): string {
  return jwt.sign({ userId, tier }, JWT_SECRET, { expiresIn: "1h" });
}

describe("User Profile API", () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    app = await createApp();
  });

  describe("GET /api/me", () => {
    it("returns the current user profile with tier", async () => {
      const res = await request(app).get("/api/me").expect(200);

      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("email");
      expect(res.body).toHaveProperty("name");
      expect(res.body).toHaveProperty("tier");
      expect(["HOBBYIST", "PRO", "STUDIO"]).toContain(res.body.tier);
    });
  });

  describe("GET /api/me/tier", () => {
    it("returns the current user's tier", async () => {
      const res = await request(app).get("/api/me/tier").expect(200);
      expect(res.body).toHaveProperty("tier");
    });
  });
});

describe("Solo Project API", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let projectId: string;
  let authHeader: string;
  let testUserId: string;

  beforeAll(async () => {
    app = await createApp();

    // Create a test user in the database for project CRUD tests
    const user = await prisma.user.upsert({
      where: { email: "test-project-user@stitchwise.dev" },
      update: {},
      create: {
        email: "test-project-user@stitchwise.dev",
        name: "Test Project User",
        passwordHash: "test-hash",
        tier: "PRO",
      },
    });
    testUserId = user.id;
    authHeader = `Bearer ${testAuthToken(testUserId, "PRO")}`;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.project.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe("POST /api/projects", () => {
    it("creates a new project", async () => {
      const res = await request(app)
        .post("/api/projects")
        .set("Authorization", authHeader)
        .send({ name: "Test Project", data: JSON.stringify({ grid: [] }) })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.name).toBe("Test Project");
      expect(res.body.data).toBe('{"grid":[]}');
      projectId = res.body.id;
    });

    it("rejects invalid project data", async () => {
      const res = await request(app)
        .post("/api/projects")
        .set("Authorization", authHeader)
        .send({ name: "" })
        .expect(400);

      expect(res.body).toHaveProperty("error", "Validation failed");
    });

    it("rejects unauthenticated requests", async () => {
      await request(app)
        .post("/api/projects")
        .send({ name: "Test" })
        .expect(401);
    });
  });

  describe("GET /api/projects", () => {
    it("lists projects for the current user", async () => {
      const res = await request(app)
        .get("/api/projects")
        .set("Authorization", authHeader)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /api/projects/:id", () => {
    it("returns a project by ID", async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set("Authorization", authHeader)
        .expect(200);

      expect(res.body.id).toBe(projectId);
    });

    it("returns 404 for non-existent project", async () => {
      await request(app)
        .get("/api/projects/non-existent-id")
        .set("Authorization", authHeader)
        .expect(404);
    });
  });

  describe("PUT /api/projects/:id", () => {
    it("updates a project", async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .send({ name: "Updated Name", data: JSON.stringify({ grid: [1, 2] }) })
        .expect(200);

      expect(res.body.name).toBe("Updated Name");
      expect(JSON.parse(res.body.data).grid).toEqual([1, 2]);
    });
  });
});