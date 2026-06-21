import { z } from "zod";

// ─── Auth Types ────────────────────────────────────────────────────────────

export interface SignupInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthPayload {
  userId: string;
  email: string;
  name: string;
  tier: string;
}

export interface AuthTokens {
  token: string;
  user: AuthPayload;
}

export interface JwtPayload {
  userId: string;
  email: string;
}

// ─── Zod Schemas ───────────────────────────────────────────────────────────

export const SignupSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  name: z.string().min(1, "Name is required").max(200),
});

export const LoginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});