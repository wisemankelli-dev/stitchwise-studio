#!/usr/bin/env node

/**
 * StitchWise Studio Portal — Backend API entry point.
 *
 * Binds to 0.0.0.0:3000 so it's reachable at the team's public URL.
 */

import { createApp } from "./app";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const HOST = "0.0.0.0";

async function main(): Promise<void> {
  try {
    const app = await createApp();

    const server = app.listen(PORT, HOST, () => {
      console.log(`[stitchwise-backend] Listening on http://${HOST}:${PORT}`);
    });

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