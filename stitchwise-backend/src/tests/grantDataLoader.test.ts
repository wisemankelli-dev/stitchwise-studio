/**
 * The paid grant payloads live OUTSIDE the public repo and are loaded at boot
 * from the deploy artifact (infrastructure/data/patternGrantData.ts).
 *
 * These tests pin the two things that can go wrong:
 *   1. the asset is found where the artifact actually carries it, and
 *   2. an absent / broken asset degrades to "granting disabled" — it must NEVER
 *      throw, because that would take login down for everyone.
 *
 * Hermetic: every payload is written to a throwaway directory under the OS temp
 * dir; nothing reads the repo, the network or a database.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GRANT_DATA_FILENAME,
  getGrantDataState,
  getPatternGrants,
  grantKindOf,
  loadGrantData,
  resetGrantData,
  resolveGrantDataDirs,
} from "../infrastructure/data/patternGrantData";

/** A minimal but complete grid grant, shaped exactly like the private asset. */
function gridGrant(id: string, size: number) {
  const row = "0".repeat(size);
  return {
    id,
    name: `Test ${id}`,
    gridSize: size,
    stitchCount: size * size,
    previewUrl: `/patterns/${id}.png`,
    palette: [{ color: "#ffffff", count: size * size }],
    rows: Array.from({ length: size }, () => row),
  };
}

function writeGridAsset(dir: string, patterns: Record<string, unknown>) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, GRANT_DATA_FILENAME), JSON.stringify({ version: 1, patterns }));
}

let scratch: string;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "grant-data-"));
  resetGrantData();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  resetGrantData();
  rmSync(scratch, { recursive: true, force: true });
});

describe("grant data — runtime asset loader", () => {
  it("loads the grid grants from the staged asset and reports its sha", () => {
    const dir = join(scratch, "grants");
    writeGridAsset(dir, {
      "rainbow-trout": gridGrant("rainbow-trout", 4),
      "blank-stocking-template": gridGrant("blank-stocking-template", 5),
    });

    const state = loadGrantData({ env: { GRANT_DATA_DIR: dir }, cwd: scratch });

    expect(state.status).toBe("loaded");
    expect(state.patterns).toBe(2);
    expect(state.dir).toBe(dir);
    expect(state.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(state.size).toBeGreaterThan(0);

    const patterns = getPatternGrants();
    expect(Object.keys(patterns).sort()).toEqual(["blank-stocking-template", "rainbow-trout"]);
    expect(patterns["rainbow-trout"].rows).toHaveLength(4);
    expect(grantKindOf("rainbow-trout")).toBe("PATTERN");
    expect(grantKindOf("rooster-collage")).toBeNull();
  });

  it("finds the asset at the artifact path the staging script writes", () => {
    const dir = join(scratch, "dist", "backend", "data", "grants");
    writeGridAsset(dir, { "rainbow-trout": gridGrant("rainbow-trout", 3) });

    // No GRANT_DATA_DIR: the loader must walk the layouts the artifact uses.
    const state = loadGrantData({ env: {}, cwd: scratch, entry: join(scratch, "serve.ts") });

    expect(state.status).toBe("loaded");
    expect(state.dir).toBe(dir);
    expect(state.patterns).toBe(1);
  });

  it("a missing asset logs grant-data-missing and still leaves the server usable", () => {
    const state = loadGrantData({ env: {}, cwd: scratch, entry: join(scratch, "serve.ts") });

    expect(state.status).toBe("missing");
    expect(state.patterns).toBe(0);
    expect(state.error).toMatch(/not found/);
    expect(state.searched.length).toBeGreaterThan(0);
    expect(getPatternGrants()).toEqual({});
    expect(grantKindOf("rainbow-trout")).toBeNull();

    const events = (console.error as unknown as jest.SpyInstance).mock.calls
      .map((call) => String(call[0]))
      .filter((line) => line.includes("grant-data-missing"));
    expect(events.length).toBeGreaterThan(0);
  });

  it("a corrupt asset is reported as invalid and never throws", () => {
    const dir = join(scratch, "grants");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, GRANT_DATA_FILENAME), "{ this is not json");

    const state = loadGrantData({ env: { GRANT_DATA_DIR: dir }, cwd: scratch });

    expect(state.status).toBe("invalid");
    expect(state.error).toMatch(/unreadable/);
    expect(getPatternGrants()).toEqual({});
  });

  it("drops a malformed pattern instead of shipping a broken grid", () => {
    const dir = join(scratch, "grants");
    writeGridAsset(dir, {
      "rainbow-trout": gridGrant("rainbow-trout", 3),
      "blank-stocking-template": { id: "blank-stocking-template", name: "no rows", rows: [] },
    });

    const state = loadGrantData({ env: { GRANT_DATA_DIR: dir }, cwd: scratch });

    expect(state.patterns).toBe(1);
    expect(state.invalidPatterns).toEqual(["blank-stocking-template"]);
    expect(getPatternGrants()["blank-stocking-template"]).toBeUndefined();
  });

  it("resolves GRANT_DATA_DIR ahead of every artifact layout", () => {
    const explicit = join(scratch, "explicit");
    const dirs = resolveGrantDataDirs({ GRANT_DATA_DIR: explicit }, scratch, join(scratch, "serve.ts"));
    expect(dirs).toEqual([explicit]);
  });

  it("exposes the load outcome for /api/health", () => {
    const dir = join(scratch, "grants");
    writeGridAsset(dir, { "rainbow-trout": gridGrant("rainbow-trout", 3) });
    loadGrantData({ env: { GRANT_DATA_DIR: dir }, cwd: scratch });

    const state = getGrantDataState();
    expect(state.status).toBe("loaded");
    expect(state.patterns).toBe(1);
    expect(state.loadedAt).toBeTruthy();
  });
});
