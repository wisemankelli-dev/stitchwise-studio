import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../../domain/auth";

const JWT_SECRET = process.env.JWT_SECRET ?? "stitchwise-dev-secret-change-in-prod";

/**
 * Extracts and verifies a JWT from the Authorization header.
 * If valid, attaches the decoded payload to `req.user`.
 * If invalid or missing, returns 401.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer "

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Optional auth — attaches user info if a valid token is present,
 * but does not reject unauthenticated requests.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      (req as any).user = decoded;
    } catch {
      // Token invalid, continue without auth
    }
  }
  next();
}

export { JWT_SECRET };