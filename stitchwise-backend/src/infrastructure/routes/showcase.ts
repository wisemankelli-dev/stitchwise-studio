import { Router, type Request, type Response } from "express";
import multer from "multer";
import {
  CreateShowcasePhotoSchema,
  UpdateShowcasePhotoSchema,
} from "../../domain/showcase";
import type { ShowcaseRepo } from "../db/showcaseRepo";
import { authenticate } from "../middleware/auth";
import { getStorageProvider, validateImageFile } from "../services/storageService";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const error = validateImageFile(file.mimetype, 0);
    if (error) {
      cb(new Error(error));
      return;
    }
    cb(null, true);
  },
});

/**
 * Creates a router for Community Showcase API endpoints.
 *
 * @param repo - The ShowcaseRepo implementation to use.
 */
export function createShowcaseRouter(repo: ShowcaseRepo): Router {
  const router = Router();
  const storage = getStorageProvider();

  /**
   * POST /api/showcase/upload - Upload a photo to the Community Showcase.
   * Accepts multipart/form-data with fields: image (file), title, caption?, projectId?
   * Photo is created with status PENDING until reviewed.
   */
  router.post(
    "/showcase/upload",
    authenticate,
    upload.single("image"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: "No image file provided" });
          return;
        }

        // Validate file
        const validationError = validateImageFile(req.file.mimetype, req.file.size);
        if (validationError) {
          res.status(400).json({ error: validationError });
          return;
        }

        // Parse form fields
        const parsed = CreateShowcasePhotoSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
          return;
        }

        // Store file
        const stored = await storage.store(req.file.buffer, req.file.originalname, req.file.mimetype);

        const user = (req as any).user;
        const photo = await repo.createPhoto({
          userId: user.userId,
          title: parsed.data.title,
          caption: parsed.data.caption ?? null,
          projectId: parsed.data.projectId ?? null,
          imageUrl: stored.url,
          thumbnailUrl: null, // Could generate thumbnails in production
        });

        res.status(201).json(photo);
      } catch (err: any) {
        if (err.message?.includes("Invalid file type")) {
          res.status(400).json({ error: err.message });
          return;
        }
        console.error({ event: "showcase_upload_error", error: String(err) });
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  /**
   * GET /api/showcase/gallery - Fetch all approved showcase photos (public).
   * No authentication required — this is the public gallery.
   */
  router.get("/showcase/gallery", async (_req: Request, res: Response) => {
    try {
      const photos = await repo.listApprovedPhotos();
      res.json(photos);
    } catch (err) {
      console.error({ event: "showcase_gallery_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/showcase/mine - Fetch the current user's own showcase photos (authenticated).
   */
  router.get("/showcase/mine", authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const photos = await repo.listPhotosByUser(user.userId);
      res.json(photos);
    } catch (err) {
      console.error({ event: "showcase_mine_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * DELETE /api/showcase/:id - Delete a showcase photo (own photos only).
   * Also removes the stored file from disk.
   */
  router.delete("/showcase/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const photo = await repo.getPhoto(req.params.id);
      if (!photo) {
        res.status(404).json({ error: "Photo not found" });
        return;
      }

      const user = (req as any).user;
      if (photo.userId !== user.userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      // Delete the stored file
      await storage.delete(photo.imageUrl);
      if (photo.thumbnailUrl) {
        await storage.delete(photo.thumbnailUrl);
      }

      await repo.deletePhoto(req.params.id);
      res.status(204).send();
    } catch (err) {
      console.error({ event: "showcase_delete_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}