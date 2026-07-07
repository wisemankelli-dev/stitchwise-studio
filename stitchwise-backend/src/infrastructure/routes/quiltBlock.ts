/**
 * Quilt Block Studio API routes.
 *
 * Provides CRUD endpoints for quilt block design projects.
 * Follows the same pattern as the Collage Studio routes.
 *
 * Endpoints:
 *   GET    /api/quilt-block/projects       — List user's quilt block projects
 *   POST   /api/quilt-block/projects       — Create a new quilt block project
 *   GET    /api/quilt-block/projects/:id   — Get a single project
 *   PUT    /api/quilt-block/projects/:id   — Update a project
 *   DELETE /api/quilt-block/projects/:id   — Delete a project
 *   GET    /api/quilt-block/templates      — List pre-defined block templates
 */

import { Router, type Request, type Response } from "express";
import {
  CreateQuiltBlockProjectSchema,
  UpdateQuiltBlockProjectSchema,
  BLOCK_TEMPLATES,
} from "../../domain/quiltBlock";
import type { QuiltBlockRepo } from "../db/quiltBlockRepo";
import { authenticate } from "../middleware/auth";

/**
 * Creates a router for Quilt Block Studio API endpoints.
 *
 * @param repo - The QuiltBlockRepo implementation to use.
 */
export function createQuiltBlockRouter(repo: QuiltBlockRepo): Router {
  const router = Router();

  /**
   * GET /api/quilt-block/templates - List pre-defined block templates.
   * No authentication required.
   */
  router.get("/quilt-block/templates", (_req: Request, res: Response) => {
    res.json({ templates: BLOCK_TEMPLATES });
  });

  /**
   * GET /api/quilt-block/projects - List quilt block projects for the current user.
   */
  router.get("/quilt-block/projects", authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const projects = await repo.listProjectsByUser(user.userId);
      res.json(projects);
    } catch (err) {
      console.error({ event: "list_quilt_block_projects_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/quilt-block/projects - Create a new quilt block project.
   */
  router.post("/quilt-block/projects", authenticate, async (req: Request, res: Response) => {
    try {
      const parsed = CreateQuiltBlockProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
        return;
      }

      const user = (req as any).user;
      const project = await repo.createProject({
        name: parsed.data.name,
        data: parsed.data.data,
        blockSize: parsed.data.blockSize,
        gridRows: parsed.data.gridRows,
        gridCols: parsed.data.gridCols,
        userId: user.userId,
      });
      res.status(201).json(project);
    } catch (err) {
      console.error({ event: "create_quilt_block_project_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/quilt-block/projects/:id - Get a single quilt block project by ID.
   */
  router.get("/quilt-block/projects/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const project = await repo.getProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Quilt block project not found" });
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
      console.error({ event: "get_quilt_block_project_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * PUT /api/quilt-block/projects/:id - Update a quilt block project.
   */
  router.put("/quilt-block/projects/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const project = await repo.getProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Quilt block project not found" });
        return;
      }

      const user = (req as any).user;
      if (project.userId !== user.userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const parsed = UpdateQuiltBlockProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
        return;
      }

      const updated = await repo.updateProject(req.params.id, parsed.data);
      res.json(updated);
    } catch (err) {
      console.error({ event: "update_quilt_block_project_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * DELETE /api/quilt-block/projects/:id - Delete a quilt block project.
   */
  router.delete("/quilt-block/projects/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const project = await repo.getProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Quilt block project not found" });
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
      console.error({ event: "delete_quilt_block_project_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}