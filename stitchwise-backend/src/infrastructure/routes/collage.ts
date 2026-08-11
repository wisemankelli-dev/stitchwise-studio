import { Router, type Request, type Response } from "express";
import {
  CreateCollageProjectSchema,
  UpdateCollageProjectSchema,
} from "../../domain/collage";
import type { CollageRepo } from "../db/collageRepo";
import { authenticate } from "../middleware/auth";

/**
 * Creates a router for Collage Studio API endpoints.
 *
 * @param repo - The CollageRepo implementation to use.
 */
export function createCollageRouter(repo: CollageRepo): Router {
  const router = Router();

  /**
   * GET /api/collage/projects - List collage projects for the current user.
   */
  router.get("/collage/projects", authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const projects = await repo.listProjectsByUser(user.userId);
      res.json(projects);
    } catch (err) {
      console.error({ event: "list_collage_projects_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/collage/projects - Create a new collage project.
   */
  router.post("/collage/projects", authenticate, async (req: Request, res: Response) => {
    try {
      const parsed = CreateCollageProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
        return;
      }

      const user = (req as any).user;
      const project = await repo.createProject({
        name: parsed.data.name,
        data: parsed.data.data,
        width: parsed.data.width,
        height: parsed.data.height,
        userId: user.userId,
      });
      res.status(201).json(project);
    } catch (err) {
      console.error({ event: "create_collage_project_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/collage/projects/:id - Get a single collage project by ID.
   */
  router.get("/collage/projects/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const project = await repo.getProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Collage project not found" });
        return;
      }

      // Only allow access to own projects
      const user = (req as any).user;
      if (project.userId !== user.userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      res.json(project);
    } catch (err) {
      console.error({ event: "get_collage_project_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * PUT /api/collage/projects/:id - Update a collage project.
   */
  router.put("/collage/projects/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const project = await repo.getProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Collage project not found" });
        return;
      }

      const user = (req as any).user;
      if (project.userId !== user.userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const parsed = UpdateCollageProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
        return;
      }

      const updated = await repo.updateProject(req.params.id, parsed.data);
      res.json(updated);
    } catch (err) {
      console.error({ event: "update_collage_project_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * DELETE /api/collage/projects/:id - Delete a collage project.
   */
  router.delete("/collage/projects/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const project = await repo.getProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Collage project not found" });
        return;
      }

      const user = (req as any).user;
      if (project.userId !== user.userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      await repo.deleteProject(req.params.id);
      res.status(204).send();
    } catch (err) {
      console.error({ event: "delete_collage_project_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Frontend adapter routes (the SPA uses /api/collage rather than /projects).
  // Maps a stored project row (data JSON column) to the frontend-shaped object,
  // so the SPA receives layers/pieces/referenceArt instead of raw JSON.
  const toCollageFrontend = (p: any) => {
    let layers: any[] = [];
    let pieces: any;
    let referenceArt: any;
    try {
      const parsed = JSON.parse(p.data || "{}");
      layers = parsed.layers || [];
      pieces = parsed.pieces;
      referenceArt = parsed.referenceArt;
    } catch (e) {
      layers = [];
    }
    return { id: p.id, name: p.name, layers, pieces, referenceArt, createdAt: p.createdAt, updatedAt: p.updatedAt };
  };
  router.get("/collage", authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const projects = await repo.listProjectsByUser(user.userId);
      res.json({ projects: projects.map(toCollageFrontend) });
    } catch (err) {
      console.error({ event: "list_collage_projects_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });
  router.post("/collage", authenticate, async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      if (!body.name || !Array.isArray(body.layers)) {
        res.status(400).json({ error: "Validation failed", details: [{ message: "name and layers[] are required" }] });
        return;
      }
      const user = (req as any).user;
      const project = await repo.createProject({
        name: body.name,
        data: JSON.stringify({ layers: body.layers, pieces: body.pieces, referenceArt: body.referenceArt }),
        width: 300,
        height: 300,
        userId: user.userId,
      });
      res.status(201).json(toCollageFrontend(project));
    } catch (err) {
      console.error({ event: "create_collage_project_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });
  router.get("/collage/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const project = await repo.getProject(req.params.id);
      if (!project) { res.status(404).json({ error: "Collage project not found" }); return; }
      const user = (req as any).user;
      if (project.userId !== user.userId) { res.status(403).json({ error: "Access denied" }); return; }
      res.json({ project: toCollageFrontend(project) });
    } catch (err) { res.status(500).json({ error: "Internal server error" }); }
  });
  router.delete("/collage/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const project = await repo.getProject(req.params.id);
      if (!project) { res.status(404).json({ error: "Collage project not found" }); return; }
      const user = (req as any).user;
      if (project.userId !== user.userId) { res.status(403).json({ error: "Access denied" }); return; }
      await repo.deleteProject(req.params.id); res.status(204).send();
    } catch (err) { res.status(500).json({ error: "Internal server error" }); }
  });
  return router;
}
