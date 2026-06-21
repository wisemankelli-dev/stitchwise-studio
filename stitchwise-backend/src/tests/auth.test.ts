/**
 * Tests for JWT Authentication endpoints.
 */
import request from "supertest";
import { createApp } from "../app";

describe("Auth API", () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    app = await createApp();
  });

  const testUser = {
    email: `test-${Date.now()}@stitchwise.dev`,
    password: "password123",
    name: "Test User",
  };

  describe("POST /api/auth/signup", () => {
    it("creates a new user and returns a token", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send(testUser)
        .expect(201);

      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user.name).toBe(testUser.name);
      expect(res.body.user.tier).toBe("HOBBYIST");
      expect(typeof res.body.token).toBe("string");
    });

    it("rejects duplicate email", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send(testUser)
        .expect(409);

      expect(res.body).toHaveProperty("error", "A user with this email already exists");
    });

    it("rejects invalid email", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({ email: "invalid", password: "password123", name: "Test" })
        .expect(400);

      expect(res.body).toHaveProperty("error", "Validation failed");
    });

    it("rejects short password", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({ email: "short@test.com", password: "123", name: "Test" })
        .expect(400);

      expect(res.body).toHaveProperty("error", "Validation failed");
    });
  });

  describe("POST /api/auth/login", () => {
    it("authenticates with valid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.email).toBe(testUser.email);
    });

    it("rejects invalid password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email, password: "wrongpassword" })
        .expect(401);

      expect(res.body).toHaveProperty("error");
    });

    it("rejects non-existent user", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nonexistent@test.com", password: "password123" })
        .expect(401);

      expect(res.body).toHaveProperty("error");
    });
  });

  describe("Auth middleware", () => {
    it("returns 401 without Authorization header", async () => {
      const res = await request(app).get("/api/projects").expect(401);
      expect(res.body).toHaveProperty("error", "Missing or invalid Authorization header");
    });
  });
});