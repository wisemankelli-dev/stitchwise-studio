/**
 * Estimator API Routes.
 *
 * Endpoint:
 *   POST /api/estimator/calculate  — Calculate thread & fabric usage from pattern data
 */
import { Router, type Request, type Response } from "express";
import { CalculateEstimateSchema } from "../../domain/estimator/index";
import { calculateEstimate } from "../../domain/estimator/calculator";
import { authenticate } from "../middleware/auth";

/**
 * Creates a router for the Estimator endpoints.
 */
export function createEstimatorRouter(): Router {
  const router = Router();

  /**
   * POST /api/estimator/calculate
   *
   * Calculate thread and fabric usage estimates from a stitch pattern.
   *
   * Request body:
   * {
   *   stitches: Record<string, number>,       // DMC code -> stitch count
   *   stitchTypes?: Record<string, string>,   // DMC code -> stitch type
   *   gridWidth?: number,                      // Grid width in stitches
   *   gridHeight?: number,                     // Grid height in stitches
   *   fabricCount?: 11|14|16|18|22             // Fabric count (default 14)
   * }
   *
   * Response:
   * {
   *   success: true,
   *   data: {
   *     threadEstimates: [{ dmcCode, name, hex, stitchCount, stitchType, meters }],
   *     totalThreadMeters: number,
   *     fabricEstimate: { widthIn, heightIn, widthCm, heightCm, ... }
   *   }
   * }
   */
  router.post(
    "/estimator/calculate",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const parsed = CalculateEstimateSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: "Validation failed",
            details: parsed.error.issues,
          });
          return;
        }

        const { stitches, stitchTypes, gridWidth, gridHeight, fabricCount } = parsed.data;

        const result = calculateEstimate(stitches, {
          stitchTypes,
          gridWidth: gridWidth ?? 32,
          gridHeight: gridHeight ?? 32,
          fabricCount,
        });

        res.json({
          success: true,
          data: result,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "estimate_calculation_error", error: message });
        res.status(500).json({ success: false, error: message });
      }
    },
  );

  return router;
}