# Real-Time Collaboration — Research & POC

> Researched by: Backend Engineer
> Date: 2026-06-21
> Task: Research and implement a POC for real-time collaboration in the Workshop

---

## 1. Goal

Multiple users working on the same Workshop project should see each other's SVG/grid updates in near real-time, without manual page refreshes.

## 2. Constraints

- **Database**: SQLite via Prisma (single-writer, file-based)
- **Backend**: Node.js + Express (single process)
- **Frontend**: React (Vite) — the existing Workshop UI
- **Existing endpoints**: `GET /api/projects/:id`, `PUT /api/projects/:id` for fetching and saving project data

## 3. Approach Comparison

| Approach | Latency | Server Load | Complexity | SQLite Compat | Recommendation |
|----------|---------|-------------|------------|---------------|----------------|
| **Polling** (GET every 2-5s) | ~2-5s | Medium (N req/s) | Low | ✅ Native | **MVP** |
| **Server-Sent Events (SSE)** | <1s | Low (1 conn/user) | Medium | ✅ Native | **Short-term** |
| **WebSockets** (ws or Socket.IO) | <100ms | Low | High | ✅ Native | **Long-term** |
| **Turso DB Sync** | ~1-5s | Low | High (frontend DB) | ❌ Different DB | Not suitable for MVP |

### 3.1 Polling (MVP — Implemented in POC)

**How it works:**
- Frontend polls `GET /api/projects/:id?since=<timestamp>` every 2-3 seconds
- Server checks `updatedAt` against the `since` parameter
- If unchanged, returns `304 Not Modified` (minimal bandwidth)
- If changed, returns full project data

**Pros:**
- Dead simple to implement
- Works with any database
- Easy to debug
- No persistent connections to manage

**Cons:**
- ~2-5s delay (acceptable for collaborative editing)
- Unnecessary requests when nothing changed

### 3.2 Server-Sent Events (SSE) (Short-term upgrade)

**How it works:**
- Server maintains a `Map<projectId, Set<Response>>` of active SSE connections
- When `PUT /api/projects/:id` is called, server broadcasts the update to all connected clients for that project
- Clients receive real-time push via `EventSource` API

**Code pattern:**
```typescript
// Server-side (Express route)
router.get("/projects/:id/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const projectId = req.params.id;
  sseClients.add(projectId, res);

  req.on("close", () => sseClients.remove(projectId, res));
});

// On project update, broadcast:
sseClients.broadcast(projectId, JSON.stringify({ event: "project_updated", project }));
```

**Pros:**
- <1s latency, real-time push
- Native browser support (EventSource API)
- No extra dependencies
- Works with SQLite

**Cons:**
- One-way only (server → client)
- Doesn't scale horizontally without a message broker
- Express isn't optimized for many concurrent connections

### 3.3 WebSockets (Long-term recommendation)

**How it works:**
- Use `ws` library or Socket.IO alongside Express
- Clients connect to a WebSocket endpoint
- Server maintains a room-per-project pattern
- Messages broadcast to all clients in the same project room

**Pros:**
- True bidirectional communication
- Lowest latency (<100ms)
- Well-understood pattern
- Scales with Redis adapter

**Cons:**
- More complex setup
- Requires sticky sessions or shared state for horizontal scaling
- Socket.IO adds ~50KB to client bundle

## 4. POC Implementation — Polling with ETag

### Implementation

Added a `since` query parameter to `GET /api/projects/:id` and an `ETag`-style check:

```
GET /api/projects/:id?since=2026-06-21T12:00:00Z
```

Response:
- `200 OK` + full project data if `updatedAt > since`
- `304 Not Modified` if project hasn't changed

### Files Changed

- `src/infrastructure/routes/workshop.ts` — Added `since` parameter and conditional response
- `src/infrastructure/db/prismaWorkshopRepo.ts` — No changes needed (uses existing `updatedAt`)

### Client-Side Usage (Frontend)

```typescript
// React hook for polling
function useProjectPolling(projectId: string, intervalMs = 3000) {
  const [data, setData] = useState(null);
  const lastUpdated = useRef<string>();

  useEffect(() => {
    const poll = async () => {
      const params = lastUpdated.current
        ? `?since=${lastUpdated.current}`
        : "";
      const res = await fetch(`/api/projects/${projectId}${params}`);

      if (res.status === 200) {
        const project = await res.json();
        lastUpdated.current = project.updatedAt;
        setData(project);
      }
      // 304 means no change — skip update
    };

    poll(); // Immediate first fetch
    const interval = setInterval(poll, intervalMs);
    return () => clearInterval(interval);
  }, [projectId, intervalMs]);

  return data;
}
```

## 5. Recommendation

| Phase | Approach | Timeline | Why |
|-------|----------|----------|-----|
| **Now (MVP)** | **Polling** (2-3s interval) | Hours | Zero new dependencies, works with SQLite, simple to implement |
| **Next (Weeks)** | **SSE** for push updates | 1-2 days | Real-time feel, still single-server friendly |
| **Future (Months)** | **WebSockets** via Socket.IO | 1 week | Scales, bidirectional, industry standard |

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Polling creates DB load | Medium | Use 304 responses, increase interval to 5s when idle |
| SSE connections exhaust resources | Medium | Set connection limits, auto-disconnect idle clients |
| Race condition: two users edit simultaneously | Low | Last-write-wins (acceptable for MVP); CRDT later |
| Turso sync delay | Low | Polling reads from SQLite directly, not affected by Turso sync |

## 7. References

- Server-Sent Events: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- Socket.IO: https://socket.io
- CRDT for collaborative editing: https://crdt.tech
- Yjs (CRDT library): https://yjs.dev