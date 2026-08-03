/**
 * AI Cost Logger — structured JSON logging for all AI image generation calls.
 *
 * Logs every AI call with provider, estimated cost, status, and timing.
 * Outputs to console (structured JSON) and appends to logs/ai-costs.jsonl.
 *
 * Usage:
 *   import { logAICall } from "./aiCostLogger";
 *   const start = Date.now();
 *   // ... AI call ...
 *   logAICall({ provider: "openai", model: "gpt-image-1", status: "success", userId: "abc", durationMs: Date.now() - start });
 */

import * as fs from "fs";
import * as path from "path";

export interface AICallLog {
  timestamp: string;
  provider: "openai";
  model: string;
  status: "success" | "error" | "credit_error" | "rate_limited" | "no_key";
  estimatedCost: number; // in USD
  durationMs: number;
  userId?: string;
  promptPreview?: string; // first 100 chars
  error?: string; // only on failure
}

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "ai-costs.jsonl");

// Cost estimates per model (USD)
const COSTS: Record<string, number> = {
  "gpt-image-1": 0.04,  // 1024x1024
  "dall-e-3": 0.04,      // 1024x1024
  "gpt-4o": 0.01,         // SVG generation (approximate token cost + raster)
};

/**
 * Log an AI call to console and file.
 */
export function logAICall(log: AICallLog): void {
  const entry = JSON.stringify(log);

  // Console: structured JSON for log aggregation
  console.error(JSON.stringify({
    event: "ai_cost",
    ...log,
  }));

  // File: append to JSONL
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, entry + "\n");
  } catch (err) {
    // Never let logging failure break the application
    console.error(JSON.stringify({
      event: "ai_cost_log_error",
      error: String(err),
    }));
  }
}

/**
 * Get estimated cost for a model.
 */
export function getEstimatedCost(model: string): number {
  return COSTS[model] ?? 0.04; // default to $0.04 if unknown
}
