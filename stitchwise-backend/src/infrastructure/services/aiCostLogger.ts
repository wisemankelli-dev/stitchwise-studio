/**
 * AI Cost Logger — Structured logging for all AI image generation calls.
 *
 * Provides a single entry point for tracking every AI call across providers.
 * Logs to both console.error (structured JSON) and a rotating JSON log file.
 *
 * Usage:
 *   import { logAICall } from "./aiCostLogger";
 *   const start = Date.now();
 *   try {
 *     const result = await generateImage(prompt);
 *     logAICall({ provider: "stability", prompt, status: "success", cost: 0.01, durationMs: Date.now() - start });
 *   } catch (err) {
 *     logAICall({ provider: "stability", prompt, status: "error", cost: 0.01, durationMs: Date.now() - start, error: String(err) });
 *   }
 */

import fs from "fs";
import path from "path";

// ─── Types ─────────────────────────────────────────────────────────────────

export type AIProvider = "stability" | "leonardo" | "openai";

export interface AICallLogEntry {
  timestamp: string;
  provider: AIProvider;
  prompt: string;        // truncated to 100 chars
  status: "success" | "error" | "credit_error" | "rate_limited" | "skipped";
  estimatedCostUsd: number;
  durationMs: number;
  error?: string;
  userId?: string;
}

// ─── Log File ──────────────────────────────────────────────────────────────

const LOG_DIR = process.env.AI_LOG_DIR ?? path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "ai-costs.jsonl");

// Ensure log directory exists
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}

/**
 * Log an AI generation call to both console and file.
 *
 * @param provider - Which AI provider was called
 * @param prompt - The text prompt (truncated to 100 chars for logging)
 * @param status - Outcome of the call
 * @param estimatedCostUsd - Estimated cost in USD
 * @param durationMs - Response time in milliseconds
 * @param error - Error message if status is "error" or "credit_error"
 * @param userId - Optional user ID for per-user tracking
 */
export function logAICall(params: {
  provider: AIProvider;
  prompt: string;
  status: AICallLogEntry["status"];
  estimatedCostUsd: number;
  durationMs: number;
  error?: string;
  userId?: string;
}): void {
  const entry: AICallLogEntry = {
    timestamp: new Date().toISOString(),
    provider: params.provider,
    prompt: params.prompt.slice(0, 100),
    status: params.status,
    estimatedCostUsd: params.estimatedCostUsd,
    durationMs: params.durationMs,
    ...(params.error && { error: params.error }),
    ...(params.userId && { userId: params.userId }),
  };

  // Console log as structured JSON (visible in server logs)
  console.error(JSON.stringify({
    event: "ai_call",
    ...entry,
  }));

  // Append to JSONL file for persistent cost tracking
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
  } catch {
    // Log file write failure is non-critical — don't break the request
  }
}

// ─── Cost Estimates ────────────────────────────────────────────────────────

/** Estimated cost per image generation (USD). These are approximate. */
export const ESTIMATED_COSTS: Record<AIProvider, number> = {
  stability: 0.01,   // ~$0.01 per SD3 generation at 512px
  leonardo: 0.005,   // ~$0.005 per generation with Kino XL
  openai: 0.04,      // ~$0.04 per DALL-E 3 image
};
