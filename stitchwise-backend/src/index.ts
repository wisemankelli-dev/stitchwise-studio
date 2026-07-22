#!/usr/bin/env node

/**
 * StitchWise Studio Portal — Backend API entry point.
 *
 * Binds to 0.0.0.0:3000 so it's reachable at the team's public URL.
 */

import { createApp } from "./app";
import { generateImageWithStability } from "./infrastructure/services/stabilityAIService";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const HOST = "0.0.0.0";

async function main(): Promise<void> {
  try {
    const app = await createApp();

    const server = app.listen(PORT, HOST, () => {
      console.log(`[stitchwise-backend] Listening on http://${HOST}:${PORT}`);
    });

    // ── AI Service Health Check ────────────────────────────────────────────
    const hasStability = !!process.env.STABILITY_API_KEY;
    const hasLeonardo = !!process.env.LEONARDO_API_KEY;

    if (!hasStability && !hasLeonardo) {
      console.error("╔══════════════════════════════════════════════════════════╗");
      console.error("║  ⚠️  NO AI API KEYS CONFIGURED                          ║");
      console.error("║  All image generation will use GRAY PLACEHOLDERS.       ║");
      console.error("║  Set STABILITY_API_KEY or LEONARDO_API_KEY in env.      ║");
      console.error("╚══════════════════════════════════════════════════════════╝");
    } else {
      console.log(`[stitchwise-backend] AI services: Stability=${hasStability ? "✓" : "✗"} Leonardo=${hasLeonardo ? "✓" : "✗"}`);

      // Quick connectivity test
      if (hasStability) {
        generateImageWithStability("test", undefined)
          .then((r) => {
            if (r) console.log("[stitchwise-backend] Stability AI: connected ✓");
            else console.warn("[stitchwise-backend] Stability AI: degraded ⚠ (returned empty)");
          })
          .catch(() => console.warn("[stitchwise-backend] Stability AI: unreachable ⚠"));
      }
    }

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`[stitchwise-backend] Received ${signal}, shutting down...`);
      server.close(() => process.exit(0));
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("[stitchwise-backend] Failed to start:", err);
    process.exit(1);
  }
}

main();