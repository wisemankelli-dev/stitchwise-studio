import handler from "./dist/server/server.js";

const PORT = 3000;
const HOST = "0.0.0.0";
const CLIENT_DIR = `${import.meta.dir}/dist/client`;
const APP_DIR = `${import.meta.dir}/../repo-check/client-portal/dist`;

const freePort =
  `for _ in $(seq 1 25); do ` +
  `pids=$(lsof -t -iTCP:${String(PORT)} -sTCP:LISTEN 2>/dev/null || true); ` +
  `if [ -z "$pids" ]; then exit 0; fi; ` +
  `kill $pids 2>/dev/null || true; sleep 0.2; ` +
  `done`;

for (let attempt = 1; ; attempt++) {
  await Bun.$`sudo sh -c ${freePort}`.quiet().nothrow();
  try {
    Bun.serve({
      port: PORT,
      hostname: HOST,
      async fetch(req) {
        const url = new URL(req.url);
        const pathname = url.pathname;

        // Proxy API requests to the backend
        if (pathname.startsWith("/api")) {
          const backendUrl = `http://localhost:3001${pathname}${url.search}`;
          const backendReq = new Request(backendUrl, { method: req.method, headers: req.headers, body: req.body });
          try { return await fetch(backendReq); } catch { return new Response("Backend unavailable", { status: 502 }); }
        }

        // Serve client-portal app under /app/ paths
        if (pathname.startsWith("/app/") || pathname === "/app") {
          const appPath = pathname === "/app" ? "/index.html" : pathname.replace("/app", "");
          const file = Bun.file(APP_DIR + appPath);
          if (await file.exists()) return new Response(file);
          // SPA fallback — serve index.html for any /app/ route
          const indexFile = Bun.file(APP_DIR + "/index.html");
          if (await indexFile.exists()) return new Response(indexFile);
          return new Response("Not found", { status: 404 });
        }

        // Serve marketing site static assets
        if (pathname !== "/") {
          const file = Bun.file(CLIENT_DIR + pathname);
          if (await file.exists()) return new Response(file);
        }
        return (
          handler as { fetch: (r: Request) => Response | Promise<Response> }
        ).fetch(req);
      },
    });
    break;
  } catch (err) {
    if (attempt >= 10) throw err;
    await Bun.sleep(200);
  }
}

console.log(`team-site serving on http://${HOST}:${String(PORT)}`);