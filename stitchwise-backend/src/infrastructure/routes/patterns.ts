/**
 * Pattern Library API Routes.
 *
 * Endpoint:
 *   GET /api/library/patterns — public list of buyable patterns (no auth required)
 *
 * NOTE: deliberately NOT /api/patterns — that path is owned by the Designer's
 * authenticated persistence router (GET /api/patterns = list my saved designs).
 * The public shop catalog lives under /api/library/ so the two never collide.
 *
 * The catalog is a static typed array (patternsCatalog.ts) populated by the
 * lead when the owner ships a new pattern (image + PDF + price). Each entry
 * carries a Stripe hosted payment link for one-off checkout.
 */
import { Router, type Request, type Response } from "express";
import { PATTERNS_CATALOG } from "../data/patternsCatalog";

/**
 * Creates a router for the Pattern Library endpoints.
 */
export function createPatternsRouter(): Router {
  const router = Router();

  /**
   * GET /api/library/patterns
   *
   * Response:
   * {
   *   patterns: [
   *     {
   *       id: string,
   *       title: string,
   *       description: string,
   *       priceLabel: string,
   *       imageUrl: string,
   *       paymentUrl: string,
   *       badge?: string
   *     }
   *   ]
   * }
   */
  router.get("/library/patterns", (_req: Request, res: Response) => {
    const patterns = PATTERNS_CATALOG.filter((p) => p.active).map(
      ({ id, title, description, priceLabel, imageUrl, paymentUrl, badge }) => ({
        id,
        title,
        description,
        priceLabel,
        imageUrl,
        paymentUrl,
        ...(badge ? { badge } : {}),
      }),
    );
    res.json({ patterns });
  });

  return router;
}
