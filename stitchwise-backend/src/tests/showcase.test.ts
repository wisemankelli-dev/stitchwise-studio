import request from "supertest";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../app";
import { JWT_SECRET } from "../infrastructure/middleware/auth";
import path from "path";
import fs from "fs";

const prisma = new PrismaClient();

function testAuthToken(userId: string, tier = "PRO"): string {
  return jwt.sign({ userId, tier }, JWT_SECRET, { expiresIn: "1h" });
}

describe("Community Showcase API", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let testUserId: string;
  let authHeader: string;
  let photoId: string;

  beforeAll(async () => {
    app = await createApp();

    // Create a test user
    const user = await prisma.user.upsert({
      where: { email: "showcase-test@stitchwise.dev" },
      update: {},
      create: {
        email: "showcase-test@stitchwise.dev",
        name: "Showcase Test User",
        passwordHash: "test-hash",
        tier: "PRO",
      },
    });
    testUserId = user.id;
    authHeader = `Bearer ${testAuthToken(testUserId, "PRO")}`;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.showcasePhoto.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    await prisma.$disconnect();
  });

  describe("POST /api/showcase/upload", () => {
    it("uploads a photo successfully", async () => {
      // Create a small test image buffer (1x1 pixel PNG)
      const testImage = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );

      const res = await request(app)
        .post("/api/showcase/upload")
        .set("Authorization", authHeader)
        .attach("image", testImage, "test-photo.png")
        .field("title", "My First Showcase Photo")
        .field("caption", "A beautiful embroidery project")
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.title).toBe("My First Showcase Photo");
      expect(res.body.caption).toBe("A beautiful embroidery project");
      expect(res.body.status).toBe("PENDING");
      expect(res.body.userId).toBe(testUserId);
      expect(res.body.imageUrl).toContain("/uploads/");
      photoId = res.body.id;
    });

    it("rejects upload without authentication", async () => {
      const testImage = Buffer.from("fake-image-data");
      await request(app)
        .post("/api/showcase/upload")
        .attach("image", testImage, "test.png")
        .field("title", "Unauthorized")
        .expect(401);
    });

    it("rejects upload without image file", async () => {
      await request(app)
        .post("/api/showcase/upload")
        .set("Authorization", authHeader)
        .field("title", "No Image")
        .expect(400);
    });

    it("rejects upload without title", async () => {
      const testImage = Buffer.from("fake-image-data");
      const res = await request(app)
        .post("/api/showcase/upload")
        .set("Authorization", authHeader)
        .attach("image", testImage, "test.png")
        .expect(400);

      expect(res.body).toHaveProperty("error", "Validation failed");
    });
  });

  describe("GET /api/showcase/gallery", () => {
    it("returns the public gallery (may be empty)", async () => {
      const res = await request(app)
        .get("/api/showcase/gallery")
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it("does not require authentication", async () => {
      await request(app)
        .get("/api/showcase/gallery")
        .expect(200);
    });
  });

  describe("GET /api/showcase/mine", () => {
    it("returns the current user's photos", async () => {
      const res = await request(app)
        .get("/api/showcase/mine")
        .set("Authorization", authHeader)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // Should include the photo we uploaded above
      expect(res.body.some((p: any) => p.id === photoId)).toBe(true);
    });

    it("rejects without authentication", async () => {
      await request(app)
        .get("/api/showcase/mine")
        .expect(401);
    });
  });

  describe("DELETE /api/showcase/:id", () => {
    it("deletes own photo", async () => {
      await request(app)
        .delete(`/api/showcase/${photoId}`)
        .set("Authorization", authHeader)
        .expect(204);
    });

    it("returns 404 for non-existent photo", async () => {
      await request(app)
        .delete("/api/showcase/non-existent-id")
        .set("Authorization", authHeader)
        .expect(404);
    });

    it("rejects without authentication", async () => {
      await request(app)
        .delete(`/api/showcase/${photoId}`)
        .expect(401);
    });
  });
});