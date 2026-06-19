import request from "supertest";
import { createApp } from "../app";

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

describe("Collaborative Workshop API", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let projectId: string;

  beforeAll(async () => {
    app = await createApp();
  });

  // ─── Projects ──────────────────────────────────────────────────────────

  describe("POST /api/projects", () => {
    it("creates a new project", async () => {
      const res = await request(app)
        .post("/api/projects")
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
        .send({ name: "" })
        .expect(400);

      expect(res.body).toHaveProperty("error", "Validation failed");
    });
  });

  describe("GET /api/projects", () => {
    it("lists projects for the current user", async () => {
      const res = await request(app).get("/api/projects").expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /api/projects/:id", () => {
    it("returns a project by ID", async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .expect(200);

      expect(res.body.id).toBe(projectId);
    });

    it("returns 404 for non-existent project", async () => {
      await request(app)
        .get("/api/projects/non-existent-id")
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

  // ─── Sharing ──────────────────────────────────────────────────────────

  describe("POST /api/shares", () => {
    it("creates a share link for a project", async () => {
      const res = await request(app)
        .post("/api/shares")
        .send({ projectId, permission: "VIEWER" })
        .expect(201);

      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("shareUrl");
      expect(res.body.permission).toBe("VIEWER");
    });

    it("rejects share for non-existent project", async () => {
      const res = await request(app)
        .post("/api/shares")
        .send({ projectId: "00000000-0000-0000-0000-000000000000" })
        .expect(404);
    });
  });

  describe("GET /api/shared/:token", () => {
    it("accesses a project via valid share token", async () => {
      const shareRes = await request(app)
        .post("/api/shares")
        .send({ projectId, permission: "EDITOR" });

      const token = shareRes.body.token;

      const res = await request(app)
        .get(`/api/shared/${token}`)
        .expect(200);

      expect(res.body).toHaveProperty("project");
      expect(res.body).toHaveProperty("permission", "EDITOR");
      expect(res.body.project.id).toBe(projectId);
    });
  });

  // ─── Collaborators ────────────────────────────────────────────────────

  describe("POST /api/collaborators", () => {
    it("invites a collaborator by email", async () => {
      const res = await request(app)
        .post("/api/collaborators")
        .send({ projectId, email: "collab@test.com", permission: "EDITOR" })
        .expect(201);

      expect(res.body.email).toBe("collab@test.com");
      expect(res.body.permission).toBe("EDITOR");
      expect(res.body.acceptedAt).toBeNull();
    });

    it("rejects duplicate invitations", async () => {
      const res = await request(app)
        .post("/api/collaborators")
        .send({ projectId, email: "collab@test.com" })
        .expect(409);

      expect(res.body).toHaveProperty("error");
    });
  });

  describe("POST /api/collaborators/:id/accept", () => {
    it("accepts a collaboration invitation", async () => {
      const inviteRes = await request(app)
        .post("/api/collaborators")
        .send({ projectId, email: "another@test.com" });

      const collabId = inviteRes.body.id;

      const res = await request(app)
        .post(`/api/collaborators/${collabId}/accept`)
        .expect(200);

      expect(res.body).toHaveProperty("message", "Invitation accepted");
    });
  });
});