import { Router, type Request, type Response } from "express";
import { CreateProjectInquirySchema } from "../../domain/projectInquiry";
import type { ProjectInquiryRepo } from "../db/projectInquiryRepo";

/**
 * Creates a router for project inquiry CRUD endpoints.
 *
 * @param repo - The ProjectInquiryRepo implementation to use.
 *               Injected to keep routes decoupled from infrastructure.
 */
export function createInquiryRouter(repo: ProjectInquiryRepo): Router {
  const router = Router();

  /**
   * POST /api/inquiries - Submit a new project inquiry.
   */
  router.post("/inquiries", async (req: Request, res: Response) => {
    try {
      const parsed = CreateProjectInquirySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "Validation failed",
          details: parsed.error.issues,
        });
        return;
      }

      const inquiry = await repo.create(parsed.data);
      res.status(201).json(inquiry);
    } catch (err) {
      console.error({ event: "create_inquiry_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/inquiries - List all project inquiries.
   */
  router.get("/inquiries", async (_req: Request, res: Response) => {
    try {
      const inquiries = await repo.findAll();
      res.json(inquiries);
    } catch (err) {
      console.error({ event: "list_inquiries_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/inquiries/:id - Get a single inquiry by ID.
   */
  router.get("/inquiries/:id", async (req: Request, res: Response) => {
    try {
      const inquiry = await repo.findById(req.params.id);
      if (!inquiry) {
        res.status(404).json({ error: "Inquiry not found" });
        return;
      }
      res.json(inquiry);
    } catch (err) {
      console.error({ event: "get_inquiry_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}

export const inquiryRouter = createInquiryRouter;