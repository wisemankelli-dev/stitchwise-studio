/**
 * Collage delivery — "buy · log in · it appears in your Collage studio".
 *
 * A collage bought from the Pattern Library is recorded as a PatternPurchase
 * (same admin endpoint as a grid) and must materialise into the buyer's Collage
 * studio on their next login / collage list. The rules this pins:
 *
 *   - exactly ONE project is created, and it carries the base FabricLayer
 *     (a project with `layers: []` makes the studio wipe the canvas);
 *   - `granted` flips so the purchase is not offered again;
 *   - a second login never duplicates the project (idempotent by grant id);
 *   - an unknown id is skipped and stays pending;
 *   - a collage whose payload was not staged stays pending (nothing breaks).
 *
 * Hermetic: a fake Prisma client and a fake CollageRepo — no database, no
 * network. The grant asset is a throwaway directory in the OS temp dir.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { materializePendingPurchases } from "../domain/patternGrants";
import {
  GRANT_DATA_FILENAME,
  loadGrantData,
  resetGrantData,
} from "../infrastructure/data/patternGrantData";

const COLLAGE_ID = "rainbow-trout-collage";
const EMAIL = "buyer@example.com";
const USER = "user-1";

/** The exact shape the Collage studio saves. */
function collagePayload() {
  return {
    layers: [
      {
        id: "bg",
        name: "Base Fabric",
        color: "#ffffff",
        pattern: "solid",
        x: 100,
        y: 100,
        width: 300,
        height: 300,
        rotation: 0,
        opacity: 1,
        zIndex: 0,
      },
    ],
    pieces: [{ instanceId: "placed-1", pieceId: "piece-1", piece: { id: "piece-1", label: "Piece 1" }, x: 0, y: 0 }],
    referenceArt: "data:image/png;base64,AAAA",
  };
}

function gridGrant(id: string, size: number) {
  return {
    id,
    name: `Test ${id}`,
    gridSize: size,
    stitchCount: size * size,
    previewUrl: "",
    palette: [{ color: "#ffffff", count: size * size }],
    rows: Array.from({ length: size }, () => "0".repeat(size)),
  };
}

function stageAsset(dir: string, opts: { collage?: boolean } = {}) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, GRANT_DATA_FILENAME),
    JSON.stringify({ version: 1, patterns: { "rainbow-trout": gridGrant("rainbow-trout", 3) } }),
  );
  if (opts.collage !== false) {
    writeFileSync(join(dir, `${COLLAGE_ID}.json`), JSON.stringify(collagePayload()));
  }
}

function makePrisma(purchases: Array<{ id: string; email: string; patternId: string }>) {
  const state = {
    purchases: purchases.map((p) => ({ ...p, granted: false })),
    patterns: [] as any[],
  };
  const prisma = {
    state,
    patternPurchase: {
      findMany: async ({ where }: any) =>
        state.purchases.filter((p) => p.email === where.email && p.granted === where.granted),
      update: async ({ where, data }: any) => {
        const purchase = state.purchases.find((p) => p.id === where.id)!;
        Object.assign(purchase, data);
        return purchase;
      },
    },
    embroideryPattern: {
      create: async ({ data }: any) => {
        state.patterns.push(data);
        return data;
      },
    },
  };
  return prisma as any;
}

function makeCollageRepo() {
  const projects: any[] = [];
  const repo = {
    projects,
    createProject: async (input: any) => {
      const project = {
        id: `project-${projects.length + 1}`,
        name: input.name,
        data: input.data ?? "{}",
        width: input.width ?? 300,
        height: input.height ?? 300,
        userId: input.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      projects.push(project);
      return project;
    },
    getProject: async (id: string) => projects.find((p) => p.id === id) ?? null,
    listProjectsByUser: async (userId: string) => projects.filter((p) => p.userId === userId),
    updateProject: async () => {
      throw new Error("not used");
    },
    deleteProject: async (id: string) => {
      const i = projects.findIndex((p) => p.id === id);
      if (i >= 0) projects.splice(i, 1);
    },
  };
  return repo as any;
}

let scratch: string;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "collage-grant-"));
  resetGrantData();
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  resetGrantData();
  rmSync(scratch, { recursive: true, force: true });
});

describe("collage delivery — a purchase materialises in the Collage studio", () => {
  it("creates exactly one project, with the base layer present, and flips granted", async () => {
    const dir = join(scratch, "grants");
    stageAsset(dir);
    loadGrantData({ env: { GRANT_DATA_DIR: dir }, cwd: scratch });

    const prisma = makePrisma([{ id: "p1", email: EMAIL, patternId: COLLAGE_ID }]);
    const repo = makeCollageRepo();

    const granted = await materializePendingPurchases(prisma, EMAIL, USER, repo);

    expect(granted).toBe(1);
    expect(repo.projects).toHaveLength(1);

    const project = repo.projects[0];
    expect(project.name).toBe("Rainbow Trout Collage");
    expect(project.userId).toBe(USER);

    const data = JSON.parse(project.data);
    expect(data.layers).toHaveLength(1);
    expect(data.layers[0].id).toBe("bg");
    expect(data.pieces).toHaveLength(1);
    expect(data.referenceArt).toContain("data:image/png");
    // The marker that makes a re-grant detectable.
    expect(data.grantId).toBe(COLLAGE_ID);
    expect(data.grantEmail).toBe(EMAIL);

    expect(prisma.state.purchases[0].granted).toBe(true);
    expect(prisma.state.patterns).toHaveLength(0);
  });

  it("a second login does not duplicate the project", async () => {
    const dir = join(scratch, "grants");
    stageAsset(dir);
    loadGrantData({ env: { GRANT_DATA_DIR: dir }, cwd: scratch });

    const prisma = makePrisma([{ id: "p1", email: EMAIL, patternId: COLLAGE_ID }]);
    const repo = makeCollageRepo();

    await materializePendingPurchases(prisma, EMAIL, USER, repo);
    // Re-record the sale as pending again (a human re-runs the grant command).
    prisma.state.purchases[0].granted = false;
    await materializePendingPurchases(prisma, EMAIL, USER, repo);

    expect(repo.projects).toHaveLength(1);
    expect(prisma.state.purchases[0].granted).toBe(true);
  });

  it("an unknown id is skipped and stays pending", async () => {
    const dir = join(scratch, "grants");
    stageAsset(dir);
    loadGrantData({ env: { GRANT_DATA_DIR: dir }, cwd: scratch });

    const prisma = makePrisma([{ id: "p1", email: EMAIL, patternId: "not-a-real-product" }]);
    const repo = makeCollageRepo();

    const granted = await materializePendingPurchases(prisma, EMAIL, USER, repo);

    expect(granted).toBe(0);
    expect(repo.projects).toHaveLength(0);
    expect(prisma.state.purchases[0].granted).toBe(false);
  });

  it("a collage whose payload was not staged stays pending", async () => {
    const dir = join(scratch, "grants");
    stageAsset(dir, { collage: false }); // pattern-grants.json only
    const state = loadGrantData({ env: { GRANT_DATA_DIR: dir }, cwd: scratch });
    expect(state.missingCollages).toContain(COLLAGE_ID);

    const prisma = makePrisma([{ id: "p1", email: EMAIL, patternId: COLLAGE_ID }]);
    const repo = makeCollageRepo();

    const granted = await materializePendingPurchases(prisma, EMAIL, USER, repo);

    expect(granted).toBe(0);
    expect(repo.projects).toHaveLength(0);
    expect(prisma.state.purchases[0].granted).toBe(false);
  });

  it("grid grants still land in the Designer from the same asset", async () => {
    const dir = join(scratch, "grants");
    stageAsset(dir);
    loadGrantData({ env: { GRANT_DATA_DIR: dir }, cwd: scratch });

    const prisma = makePrisma([{ id: "p1", email: EMAIL, patternId: "rainbow-trout" }]);
    const repo = makeCollageRepo();

    const granted = await materializePendingPurchases(prisma, EMAIL, USER, repo);

    expect(granted).toBe(1);
    expect(prisma.state.patterns).toHaveLength(1);
    expect(prisma.state.patterns[0].gridSize).toBe(3);
    expect(repo.projects).toHaveLength(0);
    expect(prisma.state.purchases[0].granted).toBe(true);
  });

  it("never throws when no collage repo is supplied — the purchase stays pending", async () => {
    const dir = join(scratch, "grants");
    stageAsset(dir);
    loadGrantData({ env: { GRANT_DATA_DIR: dir }, cwd: scratch });

    const prisma = makePrisma([{ id: "p1", email: EMAIL, patternId: COLLAGE_ID }]);

    await expect(materializePendingPurchases(prisma, EMAIL, USER)).resolves.toBe(0);
    expect(prisma.state.purchases[0].granted).toBe(false);
  });
});
