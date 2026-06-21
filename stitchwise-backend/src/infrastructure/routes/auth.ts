import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { SignupSchema, LoginSchema } from "../../domain/auth";
import { authenticate, JWT_SECRET } from "../middleware/auth";

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "7d";

export function createAuthRouter(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * POST /api/auth/signup - Register a new user.
   */
  router.post("/auth/signup", async (req: Request, res: Response) => {
    try {
      const parsed = SignupSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
        return;
      }

      const { email, password, name } = parsed.data;

      // Check if user already exists
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ error: "A user with this email already exists" });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user
      const user = await prisma.user.create({
        data: { email, passwordHash, name, tier: "HOBBYIST" },
      });

      // Generate token
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: TOKEN_EXPIRY,
      });

      res.status(201).json({
        token,
        user: { userId: user.id, email: user.email, name: user.name, tier: user.tier },
      });
    } catch (err) {
      console.error({ event: "signup_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/auth/login - Authenticate an existing user.
   */
  router.post("/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = LoginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
        return;
      }

      const { email, password } = parsed.data;

      // Find user
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      // Verify password
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      // Generate token
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: TOKEN_EXPIRY,
      });

      res.json({
        token,
        user: { userId: user.id, email: user.email, name: user.name, tier: user.tier },
      });
    } catch (err) {
      console.error({ event: "login_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/me/tier - Get active user tier.
   */
  router.get("/me/tier", authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
      if (!dbUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      // Normalize values to UI expectations
      const mappedTier = dbUser.tier === "PRO" ? "Pro Crafter" : dbUser.tier === "STUDIO" ? "Design Studio" : "Hobbyist";
      res.json({ tier: mappedTier });
    } catch (err) {
      console.error({ event: "get_tier_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/user/profile - Get user profile details.
   */
  router.get("/user/profile", authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
      if (!dbUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json({
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.tier === "STUDIO" ? "studio_admin" : "hobbyist",
        subscriptionTier: dbUser.tier === "PRO" ? "Pro Crafter" : dbUser.tier === "STUDIO" ? "Design Studio" : "Hobbyist",
      });
    } catch (err) {
      console.error({ event: "get_profile_error", error: String(err) });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
