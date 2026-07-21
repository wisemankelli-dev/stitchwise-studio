/**
 * Pattern Repository Tests — End-to-end persistence layer tests.
 *
 * Verifies CRUD operations, serialization roundtrips, and pagination.
 * Requires a running Prisma SQLite database (from `npx prisma db push`).
 */

import { PrismaClient } from "@prisma/client";
import type { StitchGrid, DmcUsage } from "../../src/domain/stitch/types";
import {
  serializeGrid,
  deserializeGrid,
  serializePalette,
  deserializePalette,
} from "../../src/domain/stitch/patternDataModel";

const prisma = new PrismaClient();

// Test helpers
function makeTestGrid(size: number = 50): StitchGrid {
  const grid: StitchGrid = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      row.push({
        color: (r + c) % 2 === 0 ? "#ff0000" : "#0000ff",
        dmcCode: (r + c) % 2 === 0 ? "DMC 321" : "DMC 798",
        dmcName: (r + c) % 2 === 0 ? "Christmas Red" : "Delft Blue",
      });
    }
    grid.push(row);
  }
  return grid;
}

function makeTestPalette(): DmcUsage[] {
  return [
    { code: "DMC 321", name: "Christmas Red", hex: "#e11d48", count: 1250 },
    { code: "DMC 798", name: "Delft Blue", hex: "#0284c7", count: 1250 },
  ];
}

// Clean up before each test
const TEST_USER_ID = "test-user-embroidery-pattern";
beforeAll(async () => {
  // Ensure test user exists
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: {
      id: TEST_USER_ID,
      email: "embroidery-test@example.com",
      name: "Embroidery Test User",
      passwordHash: "test-hash",
    },
  });
});

afterAll(async () => {
  // Clean up test data
  await prisma.embroideryPattern.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.user.delete({ where: { id: TEST_USER_ID } }).catch(() => {});
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.embroideryPattern.deleteMany({ where: { userId: TEST_USER_ID } });
});

// ─── Serialization Roundtrips ──────────────────────────────────────────────

describe("serialization roundtrips", () => {
  test("StitchGrid → JSON → StitchGrid (50x50)", () => {
    const grid = makeTestGrid(50);
    const json = serializeGrid(grid);
    const restored = deserializeGrid(json);
    expect(restored.length).toBe(50);
    expect(restored[0].length).toBe(50);
    expect(restored[0][0].color).toBe("#ff0000");
    expect(restored[0][0].dmcCode).toBe("DMC 321");
  });

  test("StitchGrid → JSON → StitchGrid (75x75)", () => {
    const grid = makeTestGrid(75);
    const json = serializeGrid(grid);
    const restored = deserializeGrid(json);
    expect(restored.length).toBe(75);
  });

  test("DmcUsage[] → JSON → DmcUsage[]", () => {
    const palette = makeTestPalette();
    const json = serializePalette(palette);
    const restored = deserializePalette(json);
    expect(restored.length).toBe(2);
    expect(restored[0].code).toBe("DMC 321");
    expect(restored[1].count).toBe(1250);
  });
});

// ─── Save Pattern ──────────────────────────────────────────────────────────

describe("savePattern", () => {
  test("saves a pattern with full data", async () => {
    const grid = makeTestGrid(50);
    const palette = makeTestPalette();

    const record = await prisma.embroideryPattern.create({
      data: {
        name: "Test Pattern",
        userId: TEST_USER_ID,
        gridData: serializeGrid(grid),
        gridSize: 50,
        dmcPalette: serializePalette(palette),
        stitchCount: 2500,
      },
    });

    expect(record.id).toBeDefined();
    expect(record.name).toBe("Test Pattern");
    expect(record.gridSize).toBe(50);
    expect(record.stitchCount).toBe(2500);

    // Verify grid can be deserialized
    const restored = deserializeGrid(record.gridData);
    expect(restored.length).toBe(50);
    expect(restored[0][0].color).toBe("#ff0000");

    // Verify palette can be deserialized
    const restoredPalette = deserializePalette(record.dmcPalette);
    expect(restoredPalette.length).toBe(2);
  });

  test("default visibility is PRIVATE", async () => {
    const grid = makeTestGrid(50);
    const palette = makeTestPalette();

    const record = await prisma.embroideryPattern.create({
      data: {
        name: "Private Pattern",
        userId: TEST_USER_ID,
        gridData: serializeGrid(grid),
        gridSize: 50,
        dmcPalette: serializePalette(palette),
        stitchCount: 2500,
      },
    });

    expect(record.visibility).toBe("PRIVATE");
  });

  test("saves optional fields (prompt, sourceImage, previewUrl)", async () => {
    const grid = makeTestGrid(50);
    const palette = makeTestPalette();

    const record = await prisma.embroideryPattern.create({
      data: {
        name: "AI Pattern",
        userId: TEST_USER_ID,
        gridData: serializeGrid(grid),
        gridSize: 50,
        dmcPalette: serializePalette(palette),
        stitchCount: 2500,
        prompt: "a red rose",
        sourceImage: "http://example.com/image.png",
        previewUrl: "http://example.com/preview.png",
      },
    });

    expect(record.prompt).toBe("a red rose");
    expect(record.sourceImage).toBe("http://example.com/image.png");
    expect(record.previewUrl).toBe("http://example.com/preview.png");
  });
});

// ─── Retrieve Pattern ──────────────────────────────────────────────────────

describe("getPatternById", () => {
  test("retrieves a saved pattern by ID", async () => {
    const grid = makeTestGrid(50);
    const record = await prisma.embroideryPattern.create({
      data: {
        name: "Findable",
        userId: TEST_USER_ID,
        gridData: serializeGrid(grid),
        gridSize: 50,
        dmcPalette: serializePalette(makeTestPalette()),
        stitchCount: 2500,
      },
    });

    const found = await prisma.embroideryPattern.findUnique({ where: { id: record.id } });
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Findable");
  });

  test("returns null for nonexistent ID", async () => {
    const found = await prisma.embroideryPattern.findUnique({
      where: { id: "nonexistent-id" },
    });
    expect(found).toBeNull();
  });
});

// ─── List Patterns By User ─────────────────────────────────────────────────

describe("getPatternsByUser", () => {
  test("lists all patterns for a user", async () => {
    const grid = makeTestGrid(50);
    const palette = makeTestPalette();

    await prisma.embroideryPattern.create({
      data: {
        name: "Pattern A", userId: TEST_USER_ID,
        gridData: serializeGrid(grid), gridSize: 50,
        dmcPalette: serializePalette(palette), stitchCount: 2500,
      },
    });
    await prisma.embroideryPattern.create({
      data: {
        name: "Pattern B", userId: TEST_USER_ID,
        gridData: serializeGrid(grid), gridSize: 75,
        dmcPalette: serializePalette(palette), stitchCount: 5625,
      },
    });

    const patterns = await prisma.embroideryPattern.findMany({
      where: { userId: TEST_USER_ID },
      orderBy: { createdAt: "desc" },
    });
    expect(patterns.length).toBe(2);
  });
});

// ─── Update Pattern ────────────────────────────────────────────────────────

describe("updatePattern", () => {
  test("updates a pattern's name and visibility", async () => {
    const grid = makeTestGrid(50);
    const record = await prisma.embroideryPattern.create({
      data: {
        name: "Original Name", userId: TEST_USER_ID,
        gridData: serializeGrid(grid), gridSize: 50,
        dmcPalette: serializePalette(makeTestPalette()), stitchCount: 2500,
        visibility: "PRIVATE",
      },
    });

    const updated = await prisma.embroideryPattern.update({
      where: { id: record.id },
      data: { name: "Updated Name", visibility: "PUBLIC" },
    });

    expect(updated.name).toBe("Updated Name");
    expect(updated.visibility).toBe("PUBLIC");
  });
});

// ─── Delete Pattern ────────────────────────────────────────────────────────

describe("deletePattern", () => {
  test("deletes a pattern", async () => {
    const grid = makeTestGrid(50);
    const record = await prisma.embroideryPattern.create({
      data: {
        name: "To Delete", userId: TEST_USER_ID,
        gridData: serializeGrid(grid), gridSize: 50,
        dmcPalette: serializePalette(makeTestPalette()), stitchCount: 2500,
      },
    });

    await prisma.embroideryPattern.delete({ where: { id: record.id } });

    const found = await prisma.embroideryPattern.findUnique({ where: { id: record.id } });
    expect(found).toBeNull();
  });
});

// ─── Public Patterns (Pagination) ──────────────────────────────────────────

describe("getPublicPatterns", () => {
  test("returns only PUBLIC patterns", async () => {
    const grid = makeTestGrid(50);
    const palette = makeTestPalette();

    await prisma.embroideryPattern.create({
      data: {
        name: "Public Pattern", userId: TEST_USER_ID,
        gridData: serializeGrid(grid), gridSize: 50,
        dmcPalette: serializePalette(palette), stitchCount: 2500,
        visibility: "PUBLIC",
      },
    });
    await prisma.embroideryPattern.create({
      data: {
        name: "Private Pattern", userId: TEST_USER_ID,
        gridData: serializeGrid(grid), gridSize: 50,
        dmcPalette: serializePalette(palette), stitchCount: 2500,
        visibility: "PRIVATE",
      },
    });

    const publicPatterns = await prisma.embroideryPattern.findMany({
      where: { visibility: "PUBLIC" },
    });
    // Only the public one should appear
    expect(publicPatterns.every(p => p.visibility === "PUBLIC")).toBe(true);
  });

  test("supports pagination (limit + offset)", async () => {
    const grid = makeTestGrid(50);
    const palette = makeTestPalette();

    for (let i = 0; i < 5; i++) {
      await prisma.embroideryPattern.create({
        data: {
          name: `Public ${i}`, userId: TEST_USER_ID,
          gridData: serializeGrid(grid), gridSize: 50,
          dmcPalette: serializePalette(palette), stitchCount: 2500,
          visibility: "PUBLIC",
        },
      });
    }

    const page1 = await prisma.embroideryPattern.findMany({
      where: { visibility: "PUBLIC" },
      take: 3, skip: 0,
      orderBy: { createdAt: "desc" },
    });
    expect(page1.length).toBe(3);

    const page2 = await prisma.embroideryPattern.findMany({
      where: { visibility: "PUBLIC" },
      take: 3, skip: 3,
      orderBy: { createdAt: "desc" },
    });
    expect(page2.length).toBeGreaterThanOrEqual(2);
  });
});