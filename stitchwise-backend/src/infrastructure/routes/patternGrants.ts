/**
 * Pattern Library admin routes (fulfillment v2).
 *
 * POST /api/library/admin/grant — record a purchase so the pattern is granted
 * to the buyer's account on their next login/signup. Guarded by the
 * x-admin-key header matching the PATTERN_ADMIN_SECRET env var (used by the
 * lead when a Stripe sale notification arrives; the platform-managed Stripe
 * account has no webhooks the app could receive directly).
 *
 * Body: { email: string, patternId: string } — patternId must exist in
 * PATTERN_GRANTS. Creating the same (email, patternId) twice is rejected.
 */
import { Router, type Request, type Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { PATTERN_GRANTS } from "../data/patternGrantData";

const GrantSchema = z.object({
  email: z.string().email("Valid email is required"),
  patternId: z.string().min(1),
});

export function createPatternGrantRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.post("/admin/grant", async (req: Request, res: Response) => {
    const secret = process.env.PATTERN_ADMIN_SECRET;
    if (!secret) {
      res.status(503).json({ error: "Pattern grant admin is not configured" });
      return;
    }
    const key = req.headers["x-admin-key"];
    if (key !== secret) {
      res.status(401).json({ error: "Invalid admin key" });
      return;
    }
    try {
      const parsed = GrantSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
        return;
      }
      const email = parsed.data.email.toLowerCase().trim();
      const { patternId } = parsed.data;
      if (!PATTERN_GRANTS[patternId]) {
        res.status(400).json({ error: `Unknown pattern id: ${patternId}` });
        return;
      }
      const existing = await prisma.patternPurchase.findFirst({
        where: { email, patternId, granted: false },
      });
      if (existing) {
        res.status(409).json({ error: "A pending purchase for this email already exists" });
        return;
      }
      const purchase = await prisma.patternPurchase.create({
        data: { email, patternId },
      });
      res.status(201).json({ purchase });
    } catch (err) {
      console.error({ event: "pattern_grant_admin_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
