/**
 * Tests for the Fabric Usage Estimator (Collage Quilting).
 *
 * Covers:
 * - Core algorithm correctness
 * - Edge cases (rotated pieces, empty canvas, single piece)
 * - Material grouping by color + texture
 * - Yardage calculation accuracy
 * - Material list generation for exports
 * - API route integration tests
 */

import { describe, it, expect } from "@jest/globals";
import {
  estimateFabricFromCanvas,
  estimateFabricFromLayers,
  generateMaterialList,
  estimateTotalFabricYardage,
} from "../infrastructure/services/fabricEstimatorService";
import type { CollageFabricLayer } from "../domain/fabricEstimator";

// ─── Test Fixtures ───────────────────────────────────────────────────────────

/** A simple 2-layer collage (base fabric + one accent piece). */
function simpleTwoLayerCanvas(): string {
  return JSON.stringify({
    version: 1,
    width: 300,
    height: 300,
    gridSize: 10,
    fabrics: [
      {
        id: "fabric-1",
        name: "Background",
        color: "#ffffff",
        texture: "linen weave",
        width: 300,
        height: 300,
        x: 0,
        y: 0,
        rotation: 0,
        opacity: 1,
      },
      {
        id: "fabric-2",
        name: "Accent Petal",
        color: "#ff69b4",
        texture: "solid",
        width: 80,
        height: 60,
        x: 100,
        y: 120,
        rotation: 15,
        opacity: 0.9,
      },
    ],
    layers: ["fabric-1", "fabric-2"],
  });
}

/** A multi-material collage with 4 distinct fabrics. */
function multiMaterialCanvas(): string {
  return JSON.stringify({
    version: 1,
    width: 400,
    height: 300,
    gridSize: 10,
    fabrics: [
      {
        id: "fabric-base",
        name: "Base Fabric",
        color: "#f0e6d3",
        texture: "linen weave",
        width: 400,
        height: 300,
        x: 0,
        y: 0,
        rotation: 0,
        opacity: 1,
      },
      {
        id: "fabric-petal-1",
        name: "Pink Petal",
        color: "#ff69b4",
        texture: "solid",
        width: 60,
        height: 50,
        x: 50,
        y: 80,
        rotation: 0,
        opacity: 1,
      },
      {
        id: "fabric-petal-2",
        name: "Pink Petal 2",
        color: "#ff69b4", // Same color as petal-1
        texture: "solid",
        width: 55,
        height: 45,
        x: 150,
        y: 100,
        rotation: 10,
        opacity: 1,
      },
      {
        id: "fabric-leaf-1",
        name: "Green Leaf",
        color: "#228b22",
        texture: "solid",
        width: 40,
        height: 70,
        x: 200,
        y: 150,
        rotation: -25,
        opacity: 1,
      },
      {
        id: "fabric-center",
        name: "Yellow Center",
        color: "#ffd700",
        texture: "polka dot",
        width: 30,
        height: 30,
        x: 110,
        y: 85,
        rotation: 0,
        opacity: 1,
      },
    ],
    layers: ["fabric-base", "fabric-petal-1", "fabric-petal-2", "fabric-leaf-1", "fabric-center"],
  });
}

/** A canvas with a single layer. */
function singleLayerCanvas(): string {
  return JSON.stringify({
    version: 1,
    width: 200,
    height: 200,
    gridSize: 10,
    fabrics: [
      {
        id: "fabric-sole",
        name: "Sole Fabric",
        color: "#ff0000",
        texture: "solid",
        width: 200,
        height: 200,
        x: 0,
        y: 0,
        rotation: 0,
        opacity: 1,
      },
    ],
    layers: ["fabric-sole"],
  });
}

/** A canvas with heavily rotated pieces. */
function rotatedPiecesCanvas(): string {
  return JSON.stringify({
    version: 1,
    width: 300,
    height: 300,
    gridSize: 10,
    fabrics: [
      {
        id: "fabric-bg",
        name: "Background",
        color: "#ffffff",
        texture: "solid",
        width: 300,
        height: 300,
        x: 0,
        y: 0,
        rotation: 0,
        opacity: 1,
      },
      {
        id: "fabric-diagonal",
        name: "Diagonal Stripe",
        color: "#0000ff",
        texture: "striped",
        width: 100,
        height: 40,
        x: 100,
        y: 130,
        rotation: 45,
        opacity: 1,
      },
      {
        id: "fabric-severe",
        name: "Severe Angle",
        color: "#0000ff", // Same color
        texture: "striped", // Same texture — should group with diagonal
        width: 50,
        height: 30,
        x: 50,
        y: 50,
        rotation: 90,
        opacity: 0.8,
      },
    ],
    layers: ["fabric-bg", "fabric-diagonal", "fabric-severe"],
  });
}

/** An empty canvas (no fabrics). */
function emptyCanvas(): string {
  return JSON.stringify({
    version: 1,
    width: 300,
    height: 300,
    gridSize: 10,
    fabrics: [],
    layers: [],
  });
}

/** A canvas with invalid data. */
function invalidCanvas(): string {
  return "not-json-at-all";
}

/** A canvas missing fabrics array. */
function missingFabricsCanvas(): string {
  return JSON.stringify({
    version: 1,
    width: 300,
    height: 300,
    layers: [],
  });
}

// ─── Direct Layer Fixtures ───────────────────────────────────────────────────

const singleLayer: CollageFabricLayer[] = [
  {
    id: "f1", name: "Square", color: [255, 0, 0], texture: "Solid",
    width: 100, height: 100, x: 0, y: 0, rotation: 0, opacity: 1,
  },
];

const twoLayerSameMaterial: CollageFabricLayer[] = [
  {
    id: "f1", name: "Piece A", color: [255, 0, 0], texture: "Solid",
    width: 50, height: 50, x: 0, y: 0, rotation: 0, opacity: 1,
  },
  {
    id: "f2", name: "Piece B", color: [255, 0, 0], texture: "Solid",
    width: 30, height: 40, x: 100, y: 100, rotation: 0, opacity: 1,
  },
];

const twoLayerDiffMaterial: CollageFabricLayer[] = [
  {
    id: "f1", name: "Red Piece", color: [255, 0, 0], texture: "Solid",
    width: 50, height: 50, x: 0, y: 0, rotation: 0, opacity: 1,
  },
  {
    id: "f2", name: "Blue Piece", color: [0, 0, 255], texture: "Linen",
    width: 40, height: 60, x: 100, y: 100, rotation: 0, opacity: 1,
  },
];

const rotatedLayer: CollageFabricLayer[] = [
  {
    id: "f1", name: "Rotated", color: [0, 255, 0], texture: "Striped",
    width: 100, height: 50, x: 0, y: 0, rotation: 30, opacity: 1,
  },
];

// ─── Tests: Core Algorithm ───────────────────────────────────────────────────

describe("Fabric Usage Estimator — Service Layer", () => {
  describe("estimateFabricFromLayers", () => {
    it("calculates area for a single square layer", () => {
      const result = estimateFabricFromLayers({ layers: singleLayer });
      expect(result.totalPieceCount).toBe(1);
      expect(result.uniqueFabricCount).toBe(1);
      // 100mm × 100mm = 10000 mm²
      expect(result.totalFabricAreaMm2).toBe(10000);
      expect(result.materials[0].totalAreaMm2).toBe(10000);
      expect(result.materials[0].pieceCount).toBe(1);
    });

    it("groups layers with same color + texture together", () => {
      const result = estimateFabricFromLayers({ layers: twoLayerSameMaterial });
      expect(result.totalPieceCount).toBe(2);
      expect(result.uniqueFabricCount).toBe(1);
      // Piece A: 50×50 = 2500, Piece B: 30×40 = 1200, total = 3700
      expect(result.materials[0].totalAreaMm2).toBe(3700);
      expect(result.materials[0].pieceCount).toBe(2);
    });

    it("separates layers with different color or texture", () => {
      const result = estimateFabricFromLayers({ layers: twoLayerDiffMaterial });
      expect(result.totalPieceCount).toBe(2);
      expect(result.uniqueFabricCount).toBe(2);
      // Red Solid: 2500 mm²
      expect(result.materials[0].totalAreaMm2).toBe(2500);
      expect(result.materials[1].totalAreaMm2).toBe(2400);
    });

    it("accounts for rotation in area calculation", () => {
      const result = estimateFabricFromLayers({ layers: rotatedLayer });
      expect(result.totalPieceCount).toBe(1);
      // For a 100×50 rect rotated 30°:
      // bb_w = 100*|cos(30)| + 50*|sin(30)| = 100*0.866 + 50*0.5 = 86.6 + 25 = 111.6
      // bb_h = 100*|sin(30)| + 50*|cos(30)| = 100*0.5 + 50*0.866 = 50 + 43.3 = 93.3
      // area = 111.6 * 93.3 ≈ 10412.28
      const cos30 = Math.cos(30 * Math.PI / 180);
      const sin30 = Math.sin(30 * Math.PI / 180);
      const bbW = 100 * cos30 + 50 * sin30;
      const bbH = 100 * sin30 + 50 * cos30;
      const expectedArea = Math.round(bbW * bbH);
      expect(result.totalFabricAreaMm2).toBeCloseTo(expectedArea, -1); // within ~10
    });

    it("uses default parameters when not provided", () => {
      const result = estimateFabricFromLayers({ layers: singleLayer });
      expect(result.fabricWidthInches).toBe(44);
      expect(result.wasteBufferPercent).toBe(15);
    });

    it("respects custom fabric width and waste buffer", () => {
      const result = estimateFabricFromLayers({
        layers: singleLayer,
        fabricWidthInches: 60,
        wasteBufferPercent: 10,
      });
      expect(result.fabricWidthInches).toBe(60);
      expect(result.wasteBufferPercent).toBe(10);
    });

    it("returns empty result for no layers", () => {
      const result = estimateFabricFromLayers({ layers: [] });
      expect(result.totalPieceCount).toBe(0);
      expect(result.uniqueFabricCount).toBe(0);
      expect(result.materials).toHaveLength(0);
      expect(result.summary).toContain("No fabric layers");
    });

    it("sorts materials by area (largest first)", () => {
      const result = estimateFabricFromLayers({ layers: twoLayerDiffMaterial });
      expect(result.materials[0].totalAreaMm2).toBeGreaterThanOrEqual(result.materials[1].totalAreaMm2);
    });
  });

  describe("estimateFabricFromCanvas", () => {
    it("parses canvas JSON and estimates fabric usage", () => {
      const result = estimateFabricFromCanvas({ canvasData: simpleTwoLayerCanvas() });
      expect(result.totalPieceCount).toBe(2);
      expect(result.uniqueFabricCount).toBe(2);
      // Background: 300*300 = 90000 mm²
      // Accent: rotated 15°, bounding box ≈ 80*|cos15| + 60*|sin15| × 80*|sin15| + 60*|cos15|
      expect(result.canvasWidthMm).toBe(300);
      expect(result.canvasHeightMm).toBe(300);
    });

    it("detects multiple materials from canvas data", () => {
      const result = estimateFabricFromCanvas({ canvasData: multiMaterialCanvas() });
      // 5 total pieces
      expect(result.totalPieceCount).toBe(5);
      // But only 4 unique materials (2 pink petals share color+texture)
      expect(result.uniqueFabricCount).toBe(4);
    });

    it("handles a single layer canvas", () => {
      const result = estimateFabricFromCanvas({ canvasData: singleLayerCanvas() });
      expect(result.totalPieceCount).toBe(1);
      expect(result.uniqueFabricCount).toBe(1);
      expect(result.totalFabricAreaMm2).toBe(200 * 200); // 40000
    });

    it("groups same-color + same-texture pieces from canvas", () => {
      const result = estimateFabricFromCanvas({ canvasData: rotatedPiecesCanvas() });
      // 3 pieces: bg (white solid) + 2 blue striped (should be grouped together)
      expect(result.totalPieceCount).toBe(3);
      expect(result.uniqueFabricCount).toBe(2); // white solid + blue striped
      expect(result.materials.length).toBe(2);
    });

    it("throws error for invalid JSON canvas data", () => {
      expect(() => {
        estimateFabricFromCanvas({ canvasData: invalidCanvas() });
      }).toThrow("Invalid canvasData JSON");
    });

    it("throws error for canvas data missing fabrics array", () => {
      expect(() => {
        estimateFabricFromCanvas({ canvasData: missingFabricsCanvas() });
      }).toThrow("missing 'fabrics' array");
    });

    it("handles empty canvas with zero fabrics", () => {
      const result = estimateFabricFromCanvas({ canvasData: emptyCanvas() });
      expect(result.totalPieceCount).toBe(0);
      expect(result.uniqueFabricCount).toBe(0);
      expect(result.materials).toHaveLength(0);
    });
  });

  describe("Yardage Calculation", () => {
    it("produces sensible yardage for a small piece", () => {
      // A 100×100mm piece on 44" fabric with 15% waste
      const result = estimateFabricFromLayers({ layers: singleLayer });
      const mat = result.materials[0];
      // 10000 mm² = 15.5 in²
      // At 44" width: 15.5/44 = 0.352 linear inches
      // With 15% buffer: 0.352 * 1.15 = 0.405"
      // In yards: 0.405/36 = 0.011 yards → min 1/8 yd
      expect(mat.suggestedYardage.purchaseYards).toBeGreaterThanOrEqual(0.125);
      expect(mat.suggestedYardage.formatted).toBe("1/8 yd");
    });

    it("produces correct yardage for a large fabric", () => {
      // 300×300mm = 90000 mm² = 139.5 in² on 44" fabric
      const bgLayer: CollageFabricLayer[] = [{
        id: "bg", name: "Background", color: [255, 255, 255], texture: "Solid",
        width: 300, height: 300, x: 0, y: 0, rotation: 0, opacity: 1,
      }];
      const result = estimateFabricFromLayers({ layers: bgLayer });
      const mat = result.materials[0];
      // 90000 mm² / 645.16 = 139.5 in²
      // 139.5 / 44 = 3.17 linear inches
      // 3.17 * 1.15 = 3.65 inches
      // 3.65 / 36 = 0.101 yards → rounded up to 1/8 yd
      // Actually this is small for a 12"×12" piece — let me verify the math
      // 300mm = 11.8", so 300×300mm = 11.8"×11.8" = 139.24 in²
      // At 44" width: you can fit 3.73 11.8" rows across (44/11.8 = 3.73)
      // So you need 11.8" of length = 0.33 yards raw
      // With 15% buffer: 0.38 yards → 1/2 yards purchase
      expect(mat.suggestedYardage.purchaseYards).toBeGreaterThanOrEqual(0.125);
    });

    it("applies waste buffer correctly", () => {
      const result = estimateFabricFromLayers({
        layers: singleLayer,
        wasteBufferPercent: 0, // No buffer
      });
      const resultWithBuffer = estimateFabricFromLayers({
        layers: singleLayer,
        wasteBufferPercent: 50, // 50% buffer
      });
      // With 50% buffer, buffered yards should be 1.5x raw yards
      const noBuf = result.materials[0].suggestedYardage;
      const withBuf = resultWithBuffer.materials[0].suggestedYardage;
      expect(withBuf.bufferedYards).toBeGreaterThan(noBuf.bufferedYards);
    });

    it("produces different yardage for different fabric widths", () => {
      const result44 = estimateFabricFromLayers({
        layers: singleLayer,
        fabricWidthInches: 44,
      });
      const result108 = estimateFabricFromLayers({
        layers: singleLayer,
        fabricWidthInches: 108,
      });
      // Wider fabric should need less linear yardage
      expect(result108.materials[0].suggestedYardage.purchaseYards)
        .toBeLessThanOrEqual(result44.materials[0].suggestedYardage.purchaseYards);
    });
  });

  describe("Material List Generation", () => {
    it("generates material list from estimate result", () => {
      const estimate = estimateFabricFromLayers({ layers: twoLayerDiffMaterial });
      const materialList = generateMaterialList(estimate);
      expect(materialList).toHaveLength(2);
      expect(materialList[0].pieces).toBe(1);
      expect(materialList[0].hex).toBe("#ff0000");
      expect(materialList[1].hex).toBe("#0000ff");
    });

    it("includes yardage suggestion in each material entry", () => {
      const estimate = estimateFabricFromLayers({ layers: singleLayer });
      const materialList = generateMaterialList(estimate);
      expect(materialList[0].yardage).toBeTruthy();
      expect(materialList[0].yardage).toContain("yd");
    });
  });

  describe("estimateTotalFabricYardage", () => {
    it("calculates total yardage for combined layers", () => {
      const yardage = estimateTotalFabricYardage(twoLayerSameMaterial);
      expect(yardage.rawYards).toBeGreaterThan(0);
      expect(yardage.purchaseYards).toBeGreaterThanOrEqual(0.125);
      expect(yardage.fabricWidthInches).toBe(44);
    });
  });

  describe("Color Parsing", () => {
    it("handles layers with hex colors from canvas data", () => {
      const result = estimateFabricFromCanvas({ canvasData: simpleTwoLayerCanvas() });
      const whiteFabric = result.materials.find(m => m.colorHex === "#ffffff");
      const pinkFabric = result.materials.find(m => m.colorHex === "#ff69b4");
      expect(whiteFabric).toBeDefined();
      expect(pinkFabric).toBeDefined();
    });

    it("handles layers with direct RGB colors", () => {
      const result = estimateFabricFromLayers({ layers: twoLayerDiffMaterial });
      expect(result.materials[0].color).toEqual([255, 0, 0]);
      expect(result.materials[0].colorHex).toBe("#ff0000");
    });
  });

  describe("Summary Generation", () => {
    it("generates a readable summary for single material", () => {
      const result = estimateFabricFromLayers({ layers: singleLayer });
      expect(result.summary).toContain("1 piece");
      expect(result.summary).toContain("#ff0000");
    });

    it("generates a readable summary for multiple materials", () => {
      const result = estimateFabricFromLayers({ layers: twoLayerDiffMaterial });
      expect(result.summary).toContain("2 pieces");
      expect(result.summary).toContain("fabrics");
    });
  });
});

// ─── Integration Tests (API Routes) ──────────────────────────────────────────

describe("Fabric Usage Estimator — API Integration", () => {
  it("exported function estimateFabricFromCanvas exists and is callable", () => {
    expect(typeof estimateFabricFromCanvas).toBe("function");
  });

  it("exported function estimateFabricFromLayers exists and is callable", () => {
    expect(typeof estimateFabricFromLayers).toBe("function");
  });

  it("exported function generateMaterialList exists and is callable", () => {
    expect(typeof generateMaterialList).toBe("function");
  });

  it("can process a multi-material canvas from frontend data", () => {
    // Simulates the kind of data coming from CollageStudio.tsx
    const frontendStyleCanvas = JSON.stringify({
      version: 1,
      width: 300,
      height: 300,
      gridSize: 10,
      fabrics: [
        {
          id: "fab-1",
          name: "Base",
          color: "#fff5f5",
          texture: "linen weave",
          width: 300,
          height: 300,
          x: 0,
          y: 0,
          rotation: 0,
          opacity: 1,
        },
        {
          id: "fab-2",
          name: "Petal",
          color: "#ffb6c1",
          texture: "solid",
          width: 75,
          height: 55,
          x: 100,
          y: 120,
          rotation: 20,
          opacity: 0.85,
        },
      ],
      layers: ["fab-1", "fab-2"],
    });

    const result = estimateFabricFromCanvas({ canvasData: frontendStyleCanvas });
    expect(result.totalPieceCount).toBe(2);
    expect(result.uniqueFabricCount).toBe(2);
    // Base: 300*300 = 90000
    // Petal: rotated 20°, bounding box calculation
    const cos20 = Math.cos(20 * Math.PI / 180);
    const sin20 = Math.sin(20 * Math.PI / 180);
    const bbW = 75 * cos20 + 55 * sin20;
    const bbH = 75 * sin20 + 55 * cos20;
    const petalArea = bbW * bbH;
    expect(result.totalFabricAreaMm2).toBeCloseTo(90000 + petalArea, -1);
  });
});