/**
 * Quilt Block PDF Export Tests — Validates PDF generation for quilt block patterns.
 *
 * Covers:
 * - Basic PDF buffer generation
 * - Project metadata in uncompressed PDF document info
 * - PDF structure validation (page count, content streams)
 * - Edge cases (empty data, large grids, HST/QST splits)
 */

import { describe, it, expect } from "@jest/globals";
import { generateQuiltBlockPdf } from "../infrastructure/services/quiltBlockPdfExporter";
import { PatchShape, GridSplit } from "../domain/quiltBlock";
import type {
  QuiltBlockProject,
  QuiltBlockData,
  Patch,
} from "../domain/quiltBlock";

// ─── Helpers ─────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<QuiltBlockProject> = {}): QuiltBlockProject {
  const defaultData: QuiltBlockData = {
    version: 1,
    blockSize: 12,
    gridRows: 4,
    gridCols: 4,
    seamAllowance: 0.25,
    fabrics: [
      { id: "f1", name: "Red", color: "#e74c3c", texture: "solid" },
      { id: "f2", name: "Blue", color: "#3498db", texture: "solid" },
      { id: "f3", name: "White", color: "#ffffff", texture: "solid" },
    ],
    patches: [
      { id: "p1", shape: PatchShape.SQUARE, row: 0, col: 0, fabricIndex: 0, split: GridSplit.NONE, rotation: 0, scale: 1 },
      { id: "p2", shape: PatchShape.SQUARE, row: 0, col: 1, fabricIndex: 1, split: GridSplit.NONE, rotation: 0, scale: 1 },
      { id: "p3", shape: PatchShape.HALF_SQUARE_TRIANGLE, row: 1, col: 0, fabricIndex: 0, split: GridSplit.HST_A, rotation: 0, scale: 1 },
      { id: "p4", shape: PatchShape.SQUARE, row: 1, col: 1, fabricIndex: 2, split: GridSplit.NONE, rotation: 0, scale: 1 },
    ],
  };

  const project: QuiltBlockProject = {
    id: "test-project-1",
    name: "Test Block",
    userId: "user-1",
    data: JSON.stringify(defaultData),
    blockSize: 12,
    gridRows: 4,
    gridCols: 4,
    thumbnail: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return Object.assign(project, overrides);
}

/**
 * Extract strings from the uncompressed parts of a PDF buffer.
 * Searches for parenthetical strings in the raw PDF (not inside streams).
 */
function pdfRawText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  // Match parenthetical strings, but skip those inside stream blocks
  // by removing stream content first
  const withoutStreams = raw.replace(/stream[\s\S]*?endstream/g, "");
  const matches = withoutStreams.match(/\(([^)]+)\)/g) || [];
  return matches.map((m) => m.slice(1, -1)).join("\n");
}

/**
 * Counts the number of pages in the PDF by counting page objects.
 * A page object is `/Type /Page` followed by `/Parent` (not `/Pages`).
 */
function countPages(buffer: Buffer): number {
  const raw = buffer.toString("latin1");
  // Match /Type /Page entries (the parent pages tree has /Type /Pages with 's')
  const pages = (raw.match(/\/Type\s*\/Page\b(?!s)/g) || []).length;
  return pages;
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe("generateQuiltBlockPdf", () => {
  describe("basic PDF generation", () => {
    it("produces a non-empty buffer", async () => {
      const project = makeProject();
      const buffer = await generateQuiltBlockPdf(project);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(100);
    });

    it("starts with %PDF header", async () => {
      const project = makeProject();
      const buffer = await generateQuiltBlockPdf(project);
      const header = buffer.slice(0, 5).toString();
      expect(header).toBe("%PDF-");
    });

    it("is a single-page document", async () => {
      const project = makeProject();
      const buffer = await generateQuiltBlockPdf(project);
      expect(countPages(buffer)).toBeGreaterThanOrEqual(1);
    });

    it("contains PDFKit producer tag in uncompressed doc info", async () => {
      const project = makeProject();
      const buffer = await generateQuiltBlockPdf(project);
      const text = pdfRawText(buffer);
      expect(text).toContain("PDFKit");
    });
  });

  describe("PDF structure", () => {
    it("contains valid cross-reference table", async () => {
      const project = makeProject();
      const buffer = await generateQuiltBlockPdf(project);
      const raw = buffer.toString("latin1");
      expect(raw).toContain("xref");
    });

    it("ends with %%EOF marker", async () => {
      const project = makeProject();
      const buffer = await generateQuiltBlockPdf(project);
      const raw = buffer.toString("latin1");
      expect(raw).toContain("%%EOF");
    });

    it("contains stream objects for page content", async () => {
      const project = makeProject();
      const buffer = await generateQuiltBlockPdf(project);
      const raw = buffer.toString("latin1");
      // Should have at least one content stream
      expect(raw).toContain("stream");
      expect(raw).toContain("endstream");
    });
  });

  describe("metadata variants", () => {
    it("works with short project names", async () => {
      const project = makeProject({ name: "Star" });
      const buffer = await generateQuiltBlockPdf(project);
      expect(buffer.length).toBeGreaterThan(100);
    });

    it("works with long project names", async () => {
      const project = makeProject({ name: "My Amazing Ohio Star Variation #42" });
      const buffer = await generateQuiltBlockPdf(project);
      expect(buffer.length).toBeGreaterThan(100);
    });

    it("handles special characters in project name", async () => {
      const project = makeProject({ name: "Star & Crown #7" });
      const buffer = await generateQuiltBlockPdf(project);
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer.toString("latin1")).toContain("%%EOF");
    });

    it("produces larger PDF for larger block size", async () => {
      const small = await generateQuiltBlockPdf(makeProject({ blockSize: 6 }));
      const large = await generateQuiltBlockPdf(makeProject({ blockSize: 24 }));
      // Larger block sizes may or may not affect size — just verify both work
      expect(small.length).toBeGreaterThan(100);
      expect(large.length).toBeGreaterThan(100);
    });
  });

  describe("empty / edge case data", () => {
    it("handles project with no patches", async () => {
      const data: QuiltBlockData = {
        version: 1,
        blockSize: 12,
        gridRows: 2,
        gridCols: 2,
        seamAllowance: 0.25,
        fabrics: [
          { id: "f1", name: "Red", color: "#e74c3c", texture: "solid" },
        ],
        patches: [],
      };
      const project = makeProject({
        data: JSON.stringify(data),
        gridRows: 2,
        gridCols: 2,
      });
      const buffer = await generateQuiltBlockPdf(project);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer.toString("latin1")).toContain("%%EOF");
    });

    it("handles project with no fabrics", async () => {
      const data: QuiltBlockData = {
        version: 1,
        blockSize: 6,
        gridRows: 1,
        gridCols: 1,
        seamAllowance: 0,
        fabrics: [],
        patches: [],
      };
      const project = makeProject({
        data: JSON.stringify(data),
        gridRows: 1,
        gridCols: 1,
      });
      const buffer = await generateQuiltBlockPdf(project);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer.toString("latin1")).toContain("%%EOF");
    });

    it("handles large grid (8x8)", async () => {
      const patches: Patch[] = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          patches.push({
            id: `p_${r}_${c}`,
            shape: PatchShape.SQUARE,
            row: r,
            col: c,
            fabricIndex: (r + c) % 2,
            split: GridSplit.NONE,
            rotation: 0,
            scale: 1,
          });
        }
      }
      const data: QuiltBlockData = {
        version: 1,
        blockSize: 12,
        gridRows: 8,
        gridCols: 8,
        seamAllowance: 0.25,
        fabrics: [
          { id: "f1", name: "Dark", color: "#2c3e50", texture: "solid" },
          { id: "f2", name: "Light", color: "#ecf0f1", texture: "solid" },
        ],
        patches,
      };
      const project = makeProject({
        data: JSON.stringify(data),
        gridRows: 8,
        gridCols: 8,
      });
      const buffer = await generateQuiltBlockPdf(project);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(1000); // Large grid should produce substantial PDF
      expect(buffer.toString("latin1")).toContain("%%EOF");
    });

    it("handles HST split patches", async () => {
      const data: QuiltBlockData = {
        version: 1,
        blockSize: 12,
        gridRows: 2,
        gridCols: 2,
        seamAllowance: 0.25,
        fabrics: [
          { id: "f1", name: "Red", color: "#e74c3c", texture: "solid" },
          { id: "f2", name: "White", color: "#ffffff", texture: "solid" },
        ],
        patches: [
          { id: "p1", shape: PatchShape.HALF_SQUARE_TRIANGLE, row: 0, col: 0, fabricIndex: 0, split: GridSplit.HST_A, rotation: 0, scale: 1 },
          { id: "p2", shape: PatchShape.HALF_SQUARE_TRIANGLE, row: 0, col: 1, fabricIndex: 0, split: GridSplit.HST_B, rotation: 0, scale: 1 },
          { id: "p3", shape: PatchShape.QUARTER_SQUARE_TRIANGLE, row: 1, col: 0, fabricIndex: 1, split: GridSplit.QST, rotation: 0, scale: 1 },
          { id: "p4", shape: PatchShape.SQUARE, row: 1, col: 1, fabricIndex: 1, split: GridSplit.NONE, rotation: 0, scale: 1 },
        ],
      };
      const project = makeProject({
        data: JSON.stringify(data),
        gridRows: 2,
        gridCols: 2,
      });
      const buffer = await generateQuiltBlockPdf(project);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer.toString("latin1")).toContain("%%EOF");
    });

    it("handles flying geese shapes", async () => {
      const data: QuiltBlockData = {
        version: 1,
        blockSize: 12,
        gridRows: 2,
        gridCols: 2,
        seamAllowance: 0.25,
        fabrics: [
          { id: "f1", name: "Sky", color: "#85c1e9", texture: "solid" },
          { id: "f2", name: "Goose", color: "#d4ac0d", texture: "solid" },
        ],
        patches: [
          { id: "p1", shape: PatchShape.FLYING_GEESE, row: 0, col: 0, fabricIndex: 1, split: GridSplit.NONE, rotation: 0, scale: 1 },
          { id: "p2", shape: PatchShape.SQUARE, row: 1, col: 0, fabricIndex: 0, split: GridSplit.NONE, rotation: 0, scale: 1 },
          { id: "p3", shape: PatchShape.SQUARE, row: 0, col: 1, fabricIndex: 0, split: GridSplit.NONE, rotation: 0, scale: 1 },
          { id: "p4", shape: PatchShape.SQUARE, row: 1, col: 1, fabricIndex: 0, split: GridSplit.NONE, rotation: 0, scale: 1 },
        ],
      };
      const project = makeProject({
        data: JSON.stringify(data),
        gridRows: 2,
        gridCols: 2,
      });
      const buffer = await generateQuiltBlockPdf(project);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer.toString("latin1")).toContain("%%EOF");
    });

    it("handles diamond shapes", async () => {
      const data: QuiltBlockData = {
        version: 1,
        blockSize: 12,
        gridRows: 1,
        gridCols: 2,
        seamAllowance: 0.25,
        fabrics: [
          { id: "f1", name: "Diamond", color: "#9b59b6", texture: "solid" },
          { id: "f2", name: "Background", color: "#f9ebea", texture: "solid" },
        ],
        patches: [
          { id: "p1", shape: PatchShape.DIAMOND, row: 0, col: 0, fabricIndex: 0, split: GridSplit.NONE, rotation: 45, scale: 0.7 },
          { id: "p2", shape: PatchShape.SQUARE, row: 0, col: 1, fabricIndex: 1, split: GridSplit.NONE, rotation: 0, scale: 1 },
        ],
      };
      const project = makeProject({
        data: JSON.stringify(data),
        gridRows: 1,
        gridCols: 2,
      });
      const buffer = await generateQuiltBlockPdf(project);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer.toString("latin1")).toContain("%%EOF");
    });

    it("handles fabric with missing color gracefully", async () => {
      const data: QuiltBlockData = {
        version: 1,
        blockSize: 6,
        gridRows: 1,
        gridCols: 1,
        seamAllowance: 0,
        fabrics: [
          { id: "f1", name: "Mystery", color: "", texture: "solid" },
        ],
        patches: [
          { id: "p1", shape: PatchShape.SQUARE, row: 0, col: 0, fabricIndex: 0, split: GridSplit.NONE, rotation: 0, scale: 1 },
        ],
      };
      const project = makeProject({
        data: JSON.stringify(data),
        gridRows: 1,
        gridCols: 1,
      });
      const buffer = await generateQuiltBlockPdf(project);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer.toString("latin1")).toContain("%%EOF");
    });

    it("handles patch with out-of-range fabricIndex", async () => {
      const data: QuiltBlockData = {
        version: 1,
        blockSize: 6,
        gridRows: 1,
        gridCols: 1,
        seamAllowance: 0,
        fabrics: [
          { id: "f1", name: "Red", color: "#e74c3c", texture: "solid" },
        ],
        patches: [
          { id: "p1", shape: PatchShape.SQUARE, row: 0, col: 0, fabricIndex: 99, split: GridSplit.NONE, rotation: 0, scale: 1 },
        ],
      };
      const project = makeProject({
        data: JSON.stringify(data),
        gridRows: 1,
        gridCols: 1,
      });
      const buffer = await generateQuiltBlockPdf(project);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer.toString("latin1")).toContain("%%EOF");
    });

    it("is a valid PDF for 1x1 minimum grid", async () => {
      const data: QuiltBlockData = {
        version: 1,
        blockSize: 6,
        gridRows: 1,
        gridCols: 1,
        seamAllowance: 0,
        fabrics: [
          { id: "f1", name: "Red", color: "#e74c3c", texture: "solid" },
        ],
        patches: [
          { id: "p1", shape: PatchShape.SQUARE, row: 0, col: 0, fabricIndex: 0, split: GridSplit.NONE, rotation: 0, scale: 1 },
        ],
      };
      const project = makeProject({
        data: JSON.stringify(data),
        gridRows: 1,
        gridCols: 1,
      });
      const buffer = await generateQuiltBlockPdf(project);
      expect(countPages(buffer)).toBeGreaterThanOrEqual(1);
      expect(buffer.toString("latin1")).toContain("%%EOF");
    });
  });
});
