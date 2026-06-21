import { Router, type Request, type Response } from "express";
import { v4 as uuid } from "uuid";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  CreateShareLinkSchema,
  InviteCollaboratorSchema,
} from "../../domain/workshop";
import type { WorkshopRepo } from "../db/workshopRepo";
import { authenticate, optionalAuth } from "../middleware/auth";

/**
 * Creates a router for Collaborative Workshop and User endpoints.
 *
 * @param repo - The WorkshopRepo implementation to use.
 */
export function createWorkshopRouter(repo: WorkshopRepo): Router {
  const router = Router();

  // ─── User Profile ────────────────────────────────────────────────────────

  /**
   * GET /api/me - Get the current user's profile (including tier).
   * Uses a simulated user context. In production, this would come from auth.
   * For now, reads the first user or creates a demo user.
   */
  router.get("/me", async (_req: Request, res: Response) => {
    try {
      // Try getting existing user or create demo user
      let user = await repo.getUserByEmail("demo@stitchwise.dev");
      if (!user) {
        user = await repo.createUser({
          email: "demo@stitchwise.dev",
          name: "Demo User",
        });
      }
      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        createdAt: user.createdAt,
      });
    } catch (err) {
      console.error({ event: "get_user_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/me/tier - Get just the current user's tier.
   */
  router.get("/me/tier", async (_req: Request, res: Response) => {
    try {
      const user = await repo.getUserByEmail("demo@stitchwise.dev");
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json({ tier: user.tier });
    } catch (err) {
      console.error({ event: "get_tier_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Projects CRUD ──────────────────────────────────────────────────────

  /**
   * GET /api/projects - List projects for the current user.
   */
  router.get("/projects", authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.userId || "demo";
      const projects = await repo.listProjectsByUser(userId);
      res.json(projects);
    } catch (err) {
      console.error({ event: "list_projects_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/projects - Create a new project.
   */
  router.post("/projects", authenticate, async (req: Request, res: Response) => {
    try {
      const parsed = CreateProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
        return;
      }

      const user = (req as any).user;
      const project = await repo.createProject({
        name: parsed.data.name,
        data: parsed.data.data ?? "{}",
        userId: user.userId,
      });
      res.status(201).json(project);
    } catch (err) {
      console.error({ event: "create_project_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/projects/:id - Get a single project by ID.
   */
  router.get("/projects/:id", async (req: Request, res: Response) => {
    try {
      const project = await repo.getProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      res.json(project);
    } catch (err) {
      console.error({ event: "get_project_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * PUT /api/projects/:id - Update a project (name and/or data).
   */
  router.put("/projects/:id", async (req: Request, res: Response) => {
    try {
      const parsed = UpdateProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
        return;
      }
      const project = await repo.updateProject(req.params.id, parsed.data);
      res.json(project);
    } catch (err) {
      console.error({ event: "update_project_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * DELETE /api/projects/:id - Delete a project.
   */
  router.delete("/projects/:id", async (req: Request, res: Response) => {
    try {
      await repo.deleteProject(req.params.id);
      res.status(204).send();
    } catch (err) {
      console.error({ event: "delete_project_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Sharing ─────────────────────────────────────────────────────────────

  /**
   * POST /api/shares - Generate a sharing link for a project.
   */
  router.post("/shares", async (req: Request, res: Response) => {
    try {
      const parsed = CreateShareLinkSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
        return;
      }
      const project = await repo.getProject(parsed.data.projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const token = uuid();
      const share = await repo.createShareLink(parsed.data, token);

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const shareUrl = `${baseUrl}/api/shared/${token}`;

      res.status(201).json({ ...share, shareUrl });
    } catch (err) {
      console.error({ event: "create_share_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/shares/:projectId - List all shares for a project.
   */
  router.get("/shares/:projectId", async (req: Request, res: Response) => {
    try {
      const shares = await repo.getSharesForProject(req.params.projectId);
      res.json(shares);
    } catch (err) {
      console.error({ event: "list_shares_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * DELETE /api/shares/:shareId/deactivate - Deactivate a share link.
   */
  router.delete("/shares/:shareId/deactivate", async (req: Request, res: Response) => {
    try {
      await repo.deactivateShare(req.params.shareId);
      res.status(204).send();
    } catch (err) {
      console.error({ event: "deactivate_share_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/shared/:token - Access a project via share token.
   */
  router.get("/shared/:token", async (req: Request, res: Response) => {
    try {
      const share = await repo.getShareByToken(req.params.token);
      if (!share || !share.isActive) {
        res.status(404).json({ error: "Share link not found or deactivated" });
        return;
      }
      if (share.expiresAt && new Date() > share.expiresAt) {
        res.status(410).json({ error: "Share link has expired" });
        return;
      }
      const project = await repo.getProject(share.projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      res.json({ project, permission: share.permission });
    } catch (err) {
      console.error({ event: "access_share_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Collaborators ───────────────────────────────────────────────────────

  /**
   * POST /api/collaborators - Invite a collaborator via email.
   */
  router.post("/collaborators", async (req: Request, res: Response) => {
    try {
      const parsed = InviteCollaboratorSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
        return;
      }
      const project = await repo.getProject(parsed.data.projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const existing = await repo.getCollaboratorByEmail(
        parsed.data.projectId,
        parsed.data.email,
      );
      if (existing) {
        res.status(409).json({ error: "Collaborator already invited to this project" });
        return;
      }
      const collaborator = await repo.inviteCollaborator(parsed.data);

      console.error({
        event: "collaborator_invited",
        projectId: parsed.data.projectId,
        email: parsed.data.email,
        permission: parsed.data.permission,
      });

      res.status(201).json(collaborator);
    } catch (err) {
      console.error({ event: "invite_collaborator_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/collaborators/:projectId - List collaborators for a project.
   */
  router.get("/collaborators/:projectId", async (req: Request, res: Response) => {
    try {
      const collaborators = await repo.getCollaboratorsForProject(req.params.projectId);
      res.json(collaborators);
    } catch (err) {
      console.error({ event: "list_collaborators_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/collaborators/:id/accept - Accept a collaboration invitation.
   */
  router.post("/collaborators/:id/accept", async (req: Request, res: Response) => {
    try {
      await repo.acceptInvitation(req.params.id);
      res.json({ message: "Invitation accepted" });
    } catch (err) {
      console.error({ event: "accept_invitation_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}