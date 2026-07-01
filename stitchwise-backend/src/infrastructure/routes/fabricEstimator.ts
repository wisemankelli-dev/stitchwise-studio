/**
 * Fabric Usage Estimator API routes for Collage Quilting.
 *
 * Provides endpoints to estimate fabric yardage requirements from
 * collage canvas data or individual fabric layers.
 *
 * Endpoints:
 *   POST /api/collage/fabric-estimate          — Estimate from canvas data JSON
 *   POST /api/collage/fabric-estimate/:projectId — Estimate from saved collage project
 *   POST /api/collage/material-list/:projectId    — Generate material list for export
 */

import { Router, type Request, type Response } from "express";
import {
  EstimateFromCanvasSchema,
  EstimateByProjectSchema,
} from "../../domain/fabricEstimator";
import {
  estimateFabricFromCanvas,
  generateMaterialList,
} from "../services/fabricEstimatorService";
import type { CollageRepo } from "../db/collageRepo";
import { authenticate } from "../middleware/auth";

/**
 * Creates a router for Fabric Usage Estimator endpoints.
 *
 * @param collageRepo - The CollageRepo implementation for loading projects.
 */
export function createFabricEstimatorRouter(collageRepo: CollageRepo): Router {
  const router = Router();

  /**
   * POST /api/collage/fabric-estimate
   *
   * Estimate fabric usage from canvas data JSON directly.
   * No authentication required — useful for preview before saving.
   *
   * Request body:
   * {
   *   canvasData: string,           // JSON string of CollageProject.data
   *   fabricWidthInches?: 44|45|54|60|108,
   *   wasteBufferPercent?: number   // 0-50
   * }
   */
  router.post("/collage/fabric-estimate", async (req: Request, res: Response) => {
    try {
      const parsed = EstimateFromCanvasSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "Validation failed",
          details: parsed.error.issues,
        });
        return;
      }

      const result = estimateFabricFromCanvas({
        canvasData: parsed.data.canvasData,
        canvasWidthMm: parsed.data.canvasWidthMm,
        canvasHeightMm: parsed.data.canvasHeightMm,
        fabricWidthInches: parsed.data.fabricWidthInches,
        wasteBufferPercent: parsed.data.wasteBufferPercent,
      });

      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error({ event: "fabric_estimate_error", error: message });
      res.status(400).json({ error: message });
    }
  });

  /**
   * POST /api/collage/fabric-estimate/:projectId
   *
   * Estimate fabric usage for a saved collage project.
   * Requires authentication — only the project owner can estimate.
   *
   * Request body (optional):
   * {
   *   fabricWidthInches?: 44|45|54|60|108,
   *   wasteBufferPercent?: number
   * }
   */
  router.post(
    "/collage/fabric-estimate/:projectId",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        // Validate query params
        const parsed = EstimateByProjectSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: "Validation failed",
            details: parsed.error.issues,
          });
          return;
        }

        // Load the project
        const project = await collageRepo.getProject(req.params.projectId);
        if (!project) {
          res.status(404).json({ error: "Collage project not found" });
          return;
        }

        // Ownership check
        const user = (req as any).user;
        if (project.userId !== user.userId) {
          res.status(403).json({ error: "Access denied" });
          return;
        }

        // Estimate from project data
        const result = estimateFabricFromCanvas({
          canvasData: project.data,
          canvasWidthMm: project.width,
          canvasHeightMm: project.height,
          fabricWidthInches: parsed.data.fabricWidthInches,
          wasteBufferPercent: parsed.data.wasteBufferPercent,
        });

        res.json(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "fabric_estimate_project_error", error: message });
        res.status(400).json({ error: message });
      }
    },
  );

  /**
   * POST /api/collage/material-list/:projectId
   *
   * Generate a formatted material list for a saved collage project,
   * suitable for inclusion in PDF/Print pattern exports.
   *
   * Requires authentication — only the project owner can access.
   *
   * Request body (optional):
   * {
   *   fabricWidthInches?: 44|45|54|60|108,
   *   wasteBufferPercent?: number
   * }
   */
  router.post(
    "/collage/material-list/:projectId",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const parsed = EstimateByProjectSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: "Validation failed",
            details: parsed.error.issues,
          });
          return;
        }

        const project = await collageRepo.getProject(req.params.projectId);
        if (!project) {
          res.status(404).json({ error: "Collage project not found" });
          return;
        }

        const user = (req as any).user;
        if (project.userId !== user.userId) {
          res.status(403).json({ error: "Access denied" });
          return;
        }

        // Generate estimate
        const estimate = estimateFabricFromCanvas({
          canvasData: project.data,
          canvasWidthMm: project.width,
          canvasHeightMm: project.height,
          fabricWidthInches: parsed.data.fabricWidthInches,
          wasteBufferPercent: parsed.data.wasteBufferPercent,
        });

        // Generate material list for export
        const materialList = generateMaterialList(estimate);

        res.json({
          projectName: project.name,
          canvasWidth: project.width,
          canvasHeight: project.height,
          totalFabricAreaIn2: estimate.totalFabricAreaIn2,
          totalPieceCount: estimate.totalPieceCount,
          uniqueFabricCount: estimate.uniqueFabricCount,
          fabricWidthInches: estimate.fabricWidthInches,
          wasteBufferPercent: estimate.wasteBufferPercent,
          materials: materialList,
          summary: estimate.summary,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "material_list_error", error: message });
        res.status(400).json({ error: message });
      }
    },
  );

  return router;
}