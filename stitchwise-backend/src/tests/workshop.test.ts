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
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const studioEmail = `studio-${suffix}@stitchwise.test`;
  const hobbyistEmail = `hobbyist-${suffix}@stitchwise.test`;
  let studioUserId: string;
  let hobbyistUserId: string;

  beforeAll(async () => {
    app = await createApp();

    const user = await prisma.user.create({
      data: {
        email: studioEmail,
        name: "Studio Tester",
        passwordHash: "not-a-real-hash",
        tier: "STUDIO",
      },
    });
    studioUserId = user.id;

    // A free-tier user, so a tier lookup can be told apart from the studio one.
    const hobbyist = await prisma.user.create({
      data: {
        email: hobbyistEmail,
        name: "Hobbyist Tester",
        passwordHash: "not-a-real-hash",
        tier: "HOBBYIST",
      },
    });
    hobbyistUserId = hobbyist.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [studioEmail, hobbyistEmail] } } });
    await prisma.$disconnect();
  });

  describe("GET /api/me", () => {
    it("returns the caller's own profile and tier from the bearer token", async () => {
      const res = await request(app)
        .get("/api/me")
        .set("Authorization", `Bearer ${testAuthToken(studioUserId)}`)
        .expect(200);

      expect(res.body.id).toBe(studioUserId);
      expect(res.body.email).toBe(studioEmail);
      expect(res.body.name).toBe("Studio Tester");
      expect(res.body.tier).toBe("STUDIO");
      // The demo fallback must never appear for a signed-in caller.
      expect(res.body.email).not.toBe("demo@stitchwise.dev");
    });

    it("resolves the caller by email when the token has no usable user id", async () => {
      const token = jwt.sign({ userId: "no-such-user-id", email: studioEmail }, JWT_SECRET, {
        expiresIn: "1h",
      });

      const res = await request(app)
        .get("/api/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.email).toBe(studioEmail);
      expect(res.body.tier).toBe("STUDIO");
    });

    it("returns 401 when there is no token instead of falling back to the demo user", async () => {
      const res = await request(app).get("/api/me").expect(401);
      expect(res.body).not.toHaveProperty("email");
    });

    it("returns 401 for an invalid token", async () => {
      await request(app).get("/api/me").set("Authorization", "Bearer not-a-token").expect(401);
    });

    it("returns 401 for a valid token that matches no user", async () => {
      const token = jwt.sign({ userId: `ghost-${suffix}` }, JWT_SECRET, { expiresIn: "1h" });
      const res = await request(app)
        .get("/api/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
      expect(res.body).not.toHaveProperty("email");
    });
  });

  describe("GET /api/me/tier", () => {
    it("returns the signed-in caller's own tier, not the demo user's", async () => {
      const res = await request(app)
        .get("/api/me/tier")
        .set("Authorization", `Bearer ${testAuthToken(studioUserId)}`)
        .expect(200);

      expect(res.body).toEqual({ tier: "STUDIO" });
    });

    it("returns a different tier for a different signed-in caller", async () => {
      const res = await request(app)
        .get("/api/me/tier")
        .set("Authorization", `Bearer ${testAuthToken(hobbyistUserId)}`)
        .expect(200);

      expect(res.body).toEqual({ tier: "HOBBYIST" });
    });

    it("resolves the caller by email when the token has no usable user id", async () => {
      const token = jwt.sign({ userId: "no-such-user-id", email: studioEmail }, JWT_SECRET, {
        expiresIn: "1h",
      });

      const res = await request(app)
        .get("/api/me/tier")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ tier: "STUDIO" });
    });

    it("returns 401 when there is no token instead of falling back to the demo user", async () => {
      const res = await request(app).get("/api/me/tier").expect(401);
      expect(res.body).not.toHaveProperty("tier");
    });

    it("returns 401 for an invalid token", async () => {
      await request(app)
        .get("/api/me/tier")
        .set("Authorization", "Bearer not-a-token")
        .expect(401);
    });

    it("returns 401 for a valid token that matches no user", async () => {
      const token = jwt.sign({ userId: `ghost-${suffix}` }, JWT_SECRET, { expiresIn: "1h" });
      const res = await request(app)
        .get("/api/me/tier")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
      expect(res.body).not.toHaveProperty("tier");
    });
  });
});
