/**
 * Fabric Usage Estimator Service for Collage Quilting.
 *
 * Implements a geometry-based algorithm to calculate the surface area
 * of different fabric colors/patterns used in a collage project, then
 * provides "Suggested Yardage" output based on standard fabric widths.
 *
 * Key features:
 * - Parses canvas data from CollageProject JSON format
 * - Collates layers by unique color + texture combinations
 * - Applies rotation-aware area calculation (bounding box for rotated pieces)
 * - Supports configurable fabric widths (44", 45", 54", 60", 108")
 * - Includes configurable buffer percentage for cutting waste
 * - Produces human-readable yardage suggestions
 */

import type {
  CollageCanvasData,
  CollageFabricLayer,
  FabricEstimateResult,
  FabricMaterialEstimate,
  FabricMaterialKey,
  FabricYardageSuggestion,
  EstimateFromCanvasInput,
  EstimateFromLayersInput,
} from "../../domain/fabricEstimator";
import {
  DEFAULT_FABRIC_WIDTH_INCHES,
  DEFAULT_WASTE_BUFFER_PERCENT,
  MM_PER_INCH,
  INCHES_PER_YARD,
} from "../../domain/fabricEstimator";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum purchase increment: 1/8 yard */
const MIN_PURCHASE_YARDS = 0.125;

/** Rounding precision for display */
const ROUND_PRECISION = 4;

/** Maximum pieces to list by name in a single material group */
const MAX_PIECE_NAMES = 10;

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Parse a hex color string like "#ff0000" or "rgb(255, 0, 0)" to an RGB tuple.
 * Returns [0, 0, 0] for unparseable strings.
 */
function parseColor(color: string): [number, number, number] {
  // Handle hex colors
  const hexMatch = color.match(/^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i);
  if (hexMatch) {
    return [
      parseInt(hexMatch[1], 16),
      parseInt(hexMatch[2], 16),
      parseInt(hexMatch[3], 16),
    ];
  }

  // Handle rgb() strings
  const rgbMatch = color.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1], 10),
      parseInt(rgbMatch[2], 10),
      parseInt(rgbMatch[3], 10),
    ];
  }

  // Named CSS colors (common subset)
  const namedColors: Record<string, [number, number, number]> = {
    white: [255, 255, 255],
    black: [0, 0, 0],
    red: [255, 0, 0],
    green: [0, 128, 0],
    blue: [0, 0, 255],
    pink: [255, 192, 203],
    yellow: [255, 255, 0],
    purple: [128, 0, 128],
    orange: [255, 165, 0],
    brown: [165, 42, 42],
    gray: [128, 128, 128],
    teal: [0, 128, 128],
    navy: [0, 0, 128],
  };

  const lower = color.toLowerCase().trim();
  if (lower in namedColors) {
    return namedColors[lower];
  }

  // Default fallback
  return [128, 128, 128];
}

/**
 * Convert an RGB tuple to a hex color string.
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Calculate the effective area of a fabric layer in square mm.
 *
 * For non-rotated pieces: simple width × height.
 * For rotated pieces: uses the bounding box area of the rotated rectangle,
 *   which represents the "footprint" of fabric needed to cut the shape.
 *   The formula for bounding box of a rotated w×h rectangle by θ degrees:
 *   bb_w = w × |cos(θ)| + h × |sin(θ)|
 *   bb_h = w × |sin(θ)| + h × |cos(θ)|
 */
function calculateLayerAreaMm2(layer: CollageFabricLayer): number {
  const { width, height, rotation } = layer;

  // Area with zero rotation is just width × height
  if (Math.abs(rotation) < 0.01) {
    return width * height;
  }

  // For rotated pieces, use bounding box area (cutting envelope)
  const radians = (rotation * Math.PI) / 180;
  const cosTheta = Math.abs(Math.cos(radians));
  const sinTheta = Math.abs(Math.sin(radians));

  const boundingBoxWidth = width * cosTheta + height * sinTheta;
  const boundingBoxHeight = width * sinTheta + height * cosTheta;

  return boundingBoxWidth * boundingBoxHeight;
}

/**
 * Normalize a texture name to a consistent, display-friendly format.
 */
function normalizeTexture(texture: string): string {
  const t = texture.toLowerCase().trim().replace(/[_-]/g, " ");
  // Capitalize first letter
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Build a unique key for grouping fabric materials by color + texture.
 */
function buildMaterialKey(color: [number, number, number], texture: string): string {
  return `${color[0]}_${color[1]}_${color[2]}_${texture.toLowerCase().trim()}`;
}

/**
 * Round a number to specified decimal places.
 */
function round(value: number, decimals: number = ROUND_PRECISION): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ─── Yardage Calculation ─────────────────────────────────────────────────────

/**
 * Calculate yardage suggestion for a given area and fabric width.
 *
 * Logic:
 * 1. Convert total area (mm²) to square inches.
 * 2. Divide by fabric width (inches) to get linear inches needed.
 * 3. Apply waste buffer.
 * 4. Convert to yards.
 * 5. Round up to nearest 1/8 yard for purchase recommendation.
 */
function calculateYardage(
  totalAreaMm2: number,
  fabricWidthInches: number,
  wasteBufferPercent: number,
): FabricYardageSuggestion {
  // Convert mm² to in² (1 in² = 645.16 mm²)
  const totalAreaIn2 = totalAreaMm2 / (MM_PER_INCH * MM_PER_INCH);

  // Calculate raw linear inches needed (width-wise)
  // Lay the pieces along the fabric width
  const rawLinearInches = totalAreaIn2 / fabricWidthInches;

  // Apply waste buffer
  const bufferFactor = 1 + wasteBufferPercent / 100;
  const bufferedLinearInches = rawLinearInches * bufferFactor;

  // Convert to yards
  const rawYards = round(rawLinearInches / INCHES_PER_YARD);
  const bufferedYards = round(bufferedLinearInches / INCHES_PER_YARD);

  // Round up to nearest 1/8 yard for purchase, minimum 1/8 yard
  const purchaseYards = round(
    Math.max(
      MIN_PURCHASE_YARDS,
      Math.ceil(bufferedLinearInches / INCHES_PER_YARD / MIN_PURCHASE_YARDS) * MIN_PURCHASE_YARDS,
    ),
  );

  // Format as a human-readable string
  const formatted = formatYardage(purchaseYards);

  return {
    fabricWidthInches,
    rawYards,
    bufferedYards,
    purchaseYards,
    wasteBufferPercent,
    formatted,
  };
}

/**
 * Format a decimal yard value as a human-readable fraction string.
 * E.g., 0.125 → "1/8 yd", 1.5 → "1 1/2 yds", 2.0 → "2 yds"
 */
function formatYardage(yards: number): string {
  if (yards <= 0) return "0 yds";

  const whole = Math.floor(yards);
  const fraction = yards - whole;

  // Common fractions in eighths
  const eighths = Math.round(fraction * 8);
  const fractionStr = fractionToStr(eighths);

  if (whole === 0) {
    return `${fractionStr} yd`;
  }

  if (fractionStr === "") {
    return `${whole} ${whole === 1 ? "yd" : "yds"}`;
  }

  return `${whole} ${fractionStr} ${whole === 1 ? "yd" : "yds"}`;
}

/**
 * Convert a number of eighths to a fraction string.
 */
function fractionToStr(eighths: number): string {
  if (eighths <= 0) return "";
  if (eighths >= 8) return "";

  // Reduce fraction
  const simplified = simplifyFraction(eighths, 8);
  if (!simplified) return "";

  const [num, den] = simplified;
  return `${num}/${den}`;
}

/**
 * Simplify a fraction (num/den) by dividing by GCD.
 */
function simplifyFraction(num: number, den: number): [number, number] | null {
  if (num <= 0 || den <= 0) return null;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(num, den);
  return [num / g, den / g];
}

// ─── Core Estimation Algorithm ───────────────────────────────────────────────

/**
 * Estimate fabric usage from canvas data JSON string.
 *
 * @param input - Canvas data and estimation parameters.
 * @returns Complete fabric usage estimate.
 */
export function estimateFabricFromCanvas(input: EstimateFromCanvasInput): FabricEstimateResult {
  // Parse the canvas data
  let canvasData: CollageCanvasData;
  try {
    canvasData = JSON.parse(input.canvasData) as CollageCanvasData;
  } catch {
    throw new Error("Invalid canvasData JSON");
  }

  // Extract layers from the canvas data
  const layers: CollageFabricLayer[] = [];

  const { fabrics, layers: layerOrder, width: canvasWidth, height: canvasHeight } = canvasData;

  if (!fabrics || !Array.isArray(fabrics)) {
    throw new Error("Canvas data is missing 'fabrics' array");
  }

  // Use the provided order from layers[], or fall back to fabrics order
  const orderList = (layerOrder && Array.isArray(layerOrder)) ? layerOrder : fabrics.map(f => f.id);

  for (const layerId of orderList) {
    const fabric = fabrics.find((f: any) => f.id === layerId);
    if (!fabric) continue;

    const color = parseColor(fabric.color);
    layers.push({
      id: fabric.id,
      name: fabric.name || `Fabric ${fabric.id}`,
      color,
      texture: normalizeTexture(fabric.texture || "solid"),
      width: fabric.width || 50,
      height: fabric.height || 50,
      x: fabric.x || 0,
      y: fabric.y || 0,
      rotation: fabric.rotation || 0,
      opacity: fabric.opacity ?? 1,
    });
  }

  return estimateFabricFromLayers({
    layers,
    canvasWidthMm: input.canvasWidthMm ?? canvasWidth ?? 300,
    canvasHeightMm: input.canvasHeightMm ?? canvasHeight ?? 300,
    fabricWidthInches: input.fabricWidthInches ?? DEFAULT_FABRIC_WIDTH_INCHES,
    wasteBufferPercent: input.wasteBufferPercent ?? DEFAULT_WASTE_BUFFER_PERCENT,
  });
}

/**
 * Estimate fabric usage from an array of fabric layers.
 *
 * This is the core algorithm:
 * 1. Group layers by unique (color, texture) combinations.
 * 2. Calculate the area of each layer (accounting for rotation).
 * 3. Sum areas per material group.
 * 4. Calculate yardage for each group and for the total.
 *
 * @param input - Layers and estimation parameters.
 * @returns Complete fabric usage estimate.
 */
export function estimateFabricFromLayers(input: EstimateFromLayersInput): FabricEstimateResult {
  const {
    layers,
    canvasWidthMm = 300,
    canvasHeightMm = 300,
    fabricWidthInches = DEFAULT_FABRIC_WIDTH_INCHES,
    wasteBufferPercent = DEFAULT_WASTE_BUFFER_PERCENT,
  } = input;

  if (layers.length === 0) {
    return {
      canvasWidthMm,
      canvasHeightMm,
      totalFabricAreaMm2: 0,
      totalFabricAreaIn2: 0,
      materials: [],
      uniqueFabricCount: 0,
      totalPieceCount: 0,
      fabricWidthInches,
      wasteBufferPercent,
      summary: "No fabric layers to estimate.",
    };
  }

  // Step 1: Group layers by (color, texture) material key
  const materialGroups = new Map<string, {
    key: FabricMaterialKey;
    layers: CollageFabricLayer[];
    totalAreaMm2: number;
  }>();

  for (const layer of layers) {
    const key = buildMaterialKey(layer.color, layer.texture);
    const area = calculateLayerAreaMm2(layer);

    if (materialGroups.has(key)) {
      const group = materialGroups.get(key)!;
      group.layers.push(layer);
      group.totalAreaMm2 += area;
    } else {
      materialGroups.set(key, {
        key: { color: layer.color, texture: layer.texture },
        layers: [layer],
        totalAreaMm2: area,
      });
    }
  }

  // Step 2: Build per-material estimates
  let totalFabricAreaMm2 = 0;
  const materials: FabricMaterialEstimate[] = [];

  for (const [, group] of materialGroups) {
    const { key, layers: groupLayers, totalAreaMm2 } = group;
    const areaIn2 = totalAreaMm2 / (MM_PER_INCH * MM_PER_INCH);
    const suggestedYardage = calculateYardage(totalAreaMm2, fabricWidthInches, wasteBufferPercent);

    const pieceNames = groupLayers.slice(0, MAX_PIECE_NAMES).map((l) => l.name);

    materials.push({
      color: key.color,
      colorHex: rgbToHex(key.color[0], key.color[1], key.color[2]),
      texture: key.texture,
      totalAreaMm2: round(totalAreaMm2),
      totalAreaIn2: round(areaIn2, 2),
      pieceCount: groupLayers.length,
      suggestedYardage,
      pieceNames,
    });

    totalFabricAreaMm2 += totalAreaMm2;
  }

  // Sort materials by area (largest first)
  materials.sort((a, b) => b.totalAreaMm2 - a.totalAreaMm2);

  // Step 3: Build result
  const totalFabricAreaIn2 = totalFabricAreaMm2 / (MM_PER_INCH * MM_PER_INCH);
  const totalPieceCount = layers.length;

  // Build summary string
  const totalYardage = calculateYardage(maxGroupArea(materials), fabricWidthInches, wasteBufferPercent);
  const summary = buildSummary(materials, totalPieceCount, totalYardage.formatted);

  return {
    canvasWidthMm,
    canvasHeightMm,
    totalFabricAreaMm2: round(totalFabricAreaMm2),
    totalFabricAreaIn2: round(totalFabricAreaIn2, 2),
    materials,
    uniqueFabricCount: materials.length,
    totalPieceCount,
    fabricWidthInches,
    wasteBufferPercent,
    summary,
  };
}

/**
 * Get the maximum single-material area for summary yardage.
 * This gives a "worst case" single fabric purchase recommendation.
 */
function maxGroupArea(materials: FabricMaterialEstimate[]): number {
  if (materials.length === 0) return 0;
  // The total area across all materials, but realistically the
  // summary yardage should show the largest single fabric requirement
  return Math.max(...materials.map((m) => m.totalAreaMm2));
}

/**
 * Build a human-readable summary of the fabric estimate.
 */
function buildSummary(
  materials: FabricMaterialEstimate[],
  totalPieceCount: number,
  mainYardageStr: string,
): string {
  if (materials.length === 0) return "No fabric layers.";

  const uniqueFabrics = materials.length;
  const mainFabric = materials[0];

  if (uniqueFabrics === 1) {
    return (
      `${totalPieceCount} piece${totalPieceCount !== 1 ? "s" : ""} in ` +
      `${mainFabric.colorHex} ${mainFabric.texture}: ~${mainFabric.suggestedYardage.formatted}`
    );
  }

  const topFabrics = materials.slice(0, 3);
  const details = topFabrics
    .map((m) => `${m.colorHex} ${m.texture}: ${m.suggestedYardage.formatted}`)
    .join(", ");

  const remaining = uniqueFabrics - 3;
  const remainingStr = remaining > 0 ? ` + ${remaining} more` : "";

  return (
    `${totalPieceCount} pieces across ${uniqueFabrics} fabrics: ${details}${remainingStr}`
  );
}

/**
 * Estimate the total fabric needed for the entire project (all materials combined),
 * treating it as if cutting from a single fabric type for backing/planning purposes.
 * This is useful for "how much total fabric do I need" questions.
 *
 * @param layers - All fabric layers in the collage
 * @param fabricWidthInches - Fabric width in inches
 * @param wasteBufferPercent - Waste buffer percentage
 * @returns Total yardage estimate as if all pieces were cut from the same fabric
 */
export function estimateTotalFabricYardage(
  layers: CollageFabricLayer[],
  fabricWidthInches: number = DEFAULT_FABRIC_WIDTH_INCHES,
  wasteBufferPercent: number = DEFAULT_WASTE_BUFFER_PERCENT,
): FabricYardageSuggestion {
  const totalAreaMm2 = layers.reduce((sum, layer) => sum + calculateLayerAreaMm2(layer), 0);
  return calculateYardage(totalAreaMm2, fabricWidthInches, wasteBufferPercent);
}

/**
 * Generate a material list suitable for inclusion in PDF/Print pattern exports.
 *
 * @param result - The fabric estimate result.
 * @returns Array of material list entries.
 */
export function generateMaterialList(result: FabricEstimateResult): Array<{
  fabric: string;
  color: string;
  hex: string;
  texture: string;
  pieces: number;
  yardage: string;
  areaIn2: string;
}> {
  return result.materials.map((m) => ({
    fabric: `${m.colorHex} ${m.texture}`,
    color: `RGB(${m.color[0]}, ${m.color[1]}, ${m.color[2]})`,
    hex: m.colorHex,
    texture: m.texture,
    pieces: m.pieceCount,
    yardage: m.suggestedYardage.formatted,
    areaIn2: `${m.totalAreaIn2.toFixed(1)} in²`,
  }));
}