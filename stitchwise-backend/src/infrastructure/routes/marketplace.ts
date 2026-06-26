import { Router, type Request, type Response } from "express";
import {
  CreateListingSchema,
  UpdateListingSchema,
} from "../../domain/marketplace";
import type { MarketplaceRepo } from "../db/marketplaceRepo";
import { authenticate } from "../middleware/auth";

export function createMarketplaceRouter(repo: MarketplaceRepo): Router {
  const router = Router();

  // ─── Public Endpoints ──────────────────────────────────────────────────

  /**
   * GET /api/marketplace - List all public listings.
   * Query: ?tags=flower,circular&search=rose
   */
  router.get("/marketplace", async (req: Request, res: Response) => {
    try {
      const tags = (req.query.tags as string)?.split(",").filter(Boolean);
      const search = req.query.search as string | undefined;
      const listings = await repo.listPublic({ tags, search });
      res.json(listings);
    } catch (err) {
      console.error({ event: "list_marketplace_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/marketplace/:id - Get a single public listing.
   */
  router.get("/marketplace/:id", async (req: Request, res: Response) => {
    try {
      const listing = await repo.getById(req.params.id);
      if (!listing || listing.visibility !== "PUBLIC") {
        res.status(404).json({ error: "Listing not found" });
        return;
      }
      res.json(listing);
    } catch (err) {
      console.error({ event: "get_listing_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Designer Endpoints (authenticated) ───────────────────────────────

  /**
   * GET /api/designer/listings - List current designer's listings.
   */
  router.get("/designer/listings", authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const listings = await repo.listByDesigner(user.userId);
      res.json(listings);
    } catch (err) {
      console.error({ event: "list_designer_listings_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/designer/listings - Create a new listing.
   */
  router.post("/designer/listings", authenticate, async (req: Request, res: Response) => {
    try {
      const parsed = CreateListingSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
        return;
      }
      const user = (req as any).user;
      const listing = await repo.create(
        { ...parsed.data, designerId: user.userId },
        JSON.stringify(parsed.data.tags ?? []),
      );
      res.status(201).json(listing);
    } catch (err) {
      console.error({ event: "create_listing_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * PUT /api/designer/listings/:id - Update a listing (designer only).
   */
  router.put("/designer/listings/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const parsed = UpdateListingSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
        return;
      }
      const user = (req as any).user;
      const listing = await repo.update(
        req.params.id,
        user.userId,
        parsed.data,
        parsed.data.tags ? JSON.stringify(parsed.data.tags) : undefined,
      );
      res.json(listing);
    } catch (err) {
      console.error({ event: "update_listing_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * DELETE /api/designer/listings/:id - Delete a listing (designer only).
   */
  router.delete("/designer/listings/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      await repo.delete(req.params.id, user.userId);
      res.status(204).send();
    } catch (err) {
      console.error({ event: "delete_listing_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}