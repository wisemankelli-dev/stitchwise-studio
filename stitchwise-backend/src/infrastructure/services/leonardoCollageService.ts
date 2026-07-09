/**
 * Leonardo AI Collage Service — Integration with the Leonardo AI image generation API
 * for collage generation.
 *
 * Provides:
 * - generateCollageFromText: text-to-image generation for collage layouts
 * - imageToCollageLayers: convert an image to fabric collage layers
 * - Smart mock fallback that generates sample collage layouts when API key is unset
 */
import axios from "axios";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import type { CollageLayer, CollageGenerationResult } from "../../domain/ai/collageAI";
import type { LeonardoGenerationResponse } from "../../domain/ai/embroideryAI";
import { closestFabricColor } from "../../domain/collage/fabricColors";
import { getRandomTexture } from "../../domain/collage/fabricTextures";

/** Leonardo AI API base URL. */
const LEONARDO_API_BASE = "https://cloud.leonardo.ai/api/rest/v1";
/** Default generation model (Leonardo Kino XL). */
const DEFAULT_MODEL_ID = "6b645e3a-d64f-4541-a169-18177b1a9f11";
/** Timeout for image generation requests (seconds). */
const GENERATION_TIMEOUT_MS = 120_000;

/**
 * Get the Leonardo API key from environment.
 * Falls back gracefully in development/testing.
 */
function getApiKey(): string | null {
  return process.env.LEONARDO_API_KEY || null;
}

/**
 * Create an authenticated axios instance for Leonardo API.
 */
function createClient() {
  const apiKey = getApiKey();
  return axios.create({
    baseURL: LEONARDO_API_BASE,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
}

/**
 * Generate an image from a text prompt using Leonardo AI.
 * Reuses the same approach as the embroidery service.
 */
export async function generateCollageImage(
  prompt: string,
  negativePrompt?: string,
): Promise<LeonardoGenerationResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return getMockCollageGenerationResponse(prompt);
  }
  const client = createClient();
  try {
    const payload: Record<string, unknown> = {
      height: 512,
      width: 512,
      modelId: DEFAULT_MODEL_ID,
      prompt: `fabric collage, quilt design, ${prompt}`,
      num_images: 1,
      sd_version: "v2",
      presetStyle: "DYNAMIC",
      scheduler: "DPMSolverMultistep",
      guidance_scale: 7,
    };
    if (negativePrompt) {
      payload.negative_prompt = negativePrompt;
    }
    const response = await client.post("/generations", payload, {
      timeout: GENERATION_TIMEOUT_MS,
    });
    const generationId = response.data.sdGenerationJob?.generationId;
    if (!generationId) {
      throw new Error("No generationId in Leonardo response");
    }
    const url = await pollForGeneration(client, generationId);
    return {
      id: generationId,
      url,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      // Unauthorized — fall back to mock
      return getMockCollageGenerationResponse(prompt);
    }
    throw err;
  }
}

/**
 * Poll Leonardo API until the generation is complete.
 */
async function pollForGeneration(
  client: ReturnType<typeof createClient>,
  generationId: string,
  maxAttempts: number = 30,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const response = await client.get(`/generations/${generationId}`);
    const images = response.data.generations_by_pk?.generated_images;
    if (images && images.length > 0) {
      const url = images[0].url;
      if (url) return url;
    }
  }
  throw new Error("Leonardo generation timed out");
}

/**
 * Convert an image URL to collage fabric layers by:
 * 1. Downloading the image
 * 2. Resizing to gridSize x gridSize pixels
 * 3. Analyzing color regions and converting to fabric layers
 *
 * @param imageUrl - URL of the image to convert
 * @param gridSize - Output grid dimensions (16, 24, 32, 48, 64)
 * @returns CollageGenerationResult with layers array
 */
export async function imageUrlToCollageLayers(
  imageUrl: string,
  gridSize: number = 32,
): Promise<CollageGenerationResult> {
  const response = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    timeout: 30000,
  });
  const imageBuffer = Buffer.from(response.data);
  return imageBufferToCollageLayers(imageBuffer, gridSize);
}

/**
 * Convert an image buffer to collage fabric layers.
 *
 * Analyzes the image in a grid, grouping pixels by dominant color regions,
 * and creates fabric layers for each distinct color region.
 *
 * @param imageBuffer - Raw image data
 * @param gridSize - Output grid dimensions
 * @returns CollageGenerationResult
 */
export async function imageBufferToCollageLayers(
  imageBuffer: Buffer,
  gridSize: number = 32,
): Promise<CollageGenerationResult> {
  const validSizes = [16, 24, 32, 48, 64];
  const size = validSizes.includes(gridSize) ? gridSize : 32;

  // Resize image using sharp
  const { data, info } = await sharp(imageBuffer)
    .resize(size, size, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.nearest,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8ClampedArray(data);

  // Extract color regions from the grid
  // Group adjacent cells by closest fabric color
  const regionMap = new Map<string, { color: string; name: string; cells: Array<{ row: number; col: number }> }>();

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const idx = (row * size + col) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const fabric = closestFabricColor(r, g, b);
      const key = fabric.hex;
      if (regionMap.has(key)) {
        regionMap.get(key)!.cells.push({ row, col });
      } else {
        regionMap.set(key, {
          color: fabric.hex,
          name: fabric.name,
          cells: [{ row, col }],
        });
      }
    }
  }

  // Convert regions to fabric layers
  // Sort by cell count (descending) — largest regions become base layers
  const sortedRegions = Array.from(regionMap.values()).sort(
    (a, b) => b.cells.length - a.cells.length,
  );

  // Calculate canvas dimensions
  const canvasWidth = 400;
  const canvasHeight = 400;
  const cellWidth = canvasWidth / size;
  const cellHeight = canvasHeight / size;

  const layers: CollageLayer[] = [];
  const fabricColorCount = new Map<string, { hex: string; name: string; count: number }>();

  sortedRegions.forEach((region, index) => {
    // Find bounding box of cells
    const rows = region.cells.map((c) => c.row);
    const cols = region.cells.map((c) => c.col);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);

    // Calculate position and size
    const x = minCol * cellWidth;
    const y = minRow * cellHeight;
    const w = (maxCol - minCol + 1) * cellWidth;
    const h = (maxRow - minRow + 1) * cellHeight;

    // Skip very small regions
    if (region.cells.length < 2) return;

    const texture = getRandomTexture();

    layers.push({
      id: uuidv4(),
      name: `${region.name} Layer`,
      color: region.color,
      pattern: texture.id,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      width: Math.round(w * 10) / 10,
      height: Math.round(h * 10) / 10,
      rotation: 0,
      opacity: 1,
      zIndex: index,
    });

    // Track color usage
    const key = region.color;
    if (fabricColorCount.has(key)) {
      fabricColorCount.get(key)!.count++;
    } else {
      fabricColorCount.set(key, {
        hex: region.color,
        name: region.name,
        count: 1,
      });
    }
  });

  // If no layers were generated (all regions too small), create a default layout
  if (layers.length === 0) {
    return generateMockCollageLayout(size);
  }

  const fabricColors = Array.from(fabricColorCount.values()).sort(
    (a, b) => b.count - a.count,
  );

  return {
    layers,
    gridSize: size,
    layerCount: layers.length,
    fabricColors,
  };
}

// ─── Mock Fallback ──────────────────────────────────────────────────────────

/**
 * Generate a realistic mock collage layout based on prompt keywords.
 * Used when no Leonardo API key is configured.
 */
function getMockCollageGenerationResponse(prompt: string): LeonardoGenerationResponse {
  return {
    id: `mock-collage-${Date.now()}`,
    url: `https://placehold.co/512x512/EEE/999?text=${encodeURIComponent(prompt.substring(0, 50))}`,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generate a mock collage layout from prompt keywords.
 * Creates 3-6 FabricLayer items with appropriate colors, textures, and positions.
 */
export function generateMockCollageLayout(gridSize: number = 32): CollageGenerationResult {
  const promptLower = "mock";
  const layers = generateLayersFromPrompt(promptLower);
  const fabricColors = layers.map((l) => ({
    hex: l.color,
    name: l.name.replace(" Layer", ""),
    count: 1,
  }));
  return {
    layers,
    gridSize,
    layerCount: layers.length,
    fabricColors,
  };
}

/**
 * Generate a collage layout from a text prompt (mock mode).
 * Parses prompt for keywords and generates an appropriate layout.
 */
export function generateCollageLayoutFromPrompt(
  prompt: string,
  gridSize: number = 32,
): CollageGenerationResult {
  const layers = generateLayersFromPrompt(prompt.toLowerCase());
  const fabricColors = layers.map((l) => ({
    hex: l.color,
    name: l.name.replace(" Layer", ""),
    count: 1,
  }));
  return {
    layers,
    gridSize,
    layerCount: layers.length,
    fabricColors,
    prompt,
  };
}

/**
 * Generate fabric layers based on prompt keywords.
 */
function generateLayersFromPrompt(prompt: string): CollageLayer[] {
  // Determine theme from keywords
  const isFloral = /floral|flower|rose|garden|bloom|petal|botanical/i.test(prompt);
  const isGeometric = /geometric|abstract|modern|minimal|shape|pattern/i.test(prompt);
  const isNature = /nature|leaf|tree|forest|woodland|organic/i.test(prompt);
  const isVintage = /vintage|retro|classic|antique|traditional/i.test(prompt);

  // Select color palette based on theme
  let colorIndices: number[];
  if (isFloral) {
    colorIndices = [1, 2, 3, 5, 7]; // Pinks + mint
  } else if (isGeometric) {
    colorIndices = [4, 5, 10, 12, 14]; // Bold + lavender + lime + gray
  } else if (isNature) {
    colorIndices = [7, 8, 12, 13, 14]; // Mint + cream + lime + peach + gray
  } else if (isVintage) {
    colorIndices = [1, 2, 9, 10, 13]; // Soft pinks + sky blue + lavender + peach
  } else {
    colorIndices = [1, 3, 5, 7, 11]; // Default: mixed
  }

  const colors = colorIndices.map((i) => {
    const c = [
      { hex: "#ffffff", name: "White" },
      { hex: "#fce7f3", name: "Petal Pink" },
      { hex: "#fbcfe8", name: "Blush Pink" },
      { hex: "#f9a8d4", name: "Rose Pink" },
      { hex: "#f472b6", name: "Vibrant Pink" },
      { hex: "#ec4899", name: "Hot Pink" },
      { hex: "#db2777", name: "Deep Pink" },
      { hex: "#86efac", name: "Mint Green" },
      { hex: "#fef3c7", name: "Cream" },
      { hex: "#bfdbfe", name: "Sky Blue" },
      { hex: "#c4b5fd", name: "Lavender" },
      { hex: "#fca5a5", name: "Coral" },
      { hex: "#d9f99d", name: "Lime" },
      { hex: "#fed7aa", name: "Peach" },
      { hex: "#e2e8f0", name: "Silver Gray" },
    ][i];
    return c;
  });

  const layers: CollageLayer[] = [];

  // Background base layer
  layers.push({
    id: uuidv4(),
    name: "Base Fabric",
    color: colors[0].hex,
    pattern: "solid",
    x: 100,
    y: 100,
    width: 300,
    height: 300,
    rotation: 0,
    opacity: 1,
    zIndex: 0,
  });

  // Accent layers based on theme
  if (isFloral) {
    layers.push({
      id: uuidv4(),
      name: "Petal Shape",
      color: colors[1].hex,
      pattern: "polka",
      x: 150,
      y: 130,
      width: 120,
      height: 100,
      rotation: 15,
      opacity: 0.9,
      zIndex: 1,
    });
    layers.push({
      id: uuidv4(),
      name: "Leaf Accent",
      color: colors[3].hex,
      pattern: "stripe",
      x: 280,
      y: 180,
      width: 80,
      height: 60,
      rotation: -10,
      opacity: 0.8,
      zIndex: 2,
    });
    layers.push({
      id: uuidv4(),
      name: "Center Bloom",
      color: colors[2].hex,
      pattern: "solid",
      x: 200,
      y: 160,
      width: 60,
      height: 60,
      rotation: 0,
      opacity: 1,
      zIndex: 3,
    });
  } else if (isGeometric) {
    layers.push({
      id: uuidv4(),
      name: "Square Block",
      color: colors[1].hex,
      pattern: "solid",
      x: 150,
      y: 150,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 0.9,
      zIndex: 1,
    });
    layers.push({
      id: uuidv4(),
      name: "Diamond Shape",
      color: colors[2].hex,
      pattern: "stripe",
      x: 220,
      y: 120,
      width: 80,
      height: 80,
      rotation: 45,
      opacity: 0.85,
      zIndex: 2,
    });
    layers.push({
      id: uuidv4(),
      name: "Accent Stripe",
      color: colors[3].hex,
      pattern: "plaid",
      x: 180,
      y: 220,
      width: 120,
      height: 40,
      rotation: 0,
      opacity: 0.7,
      zIndex: 3,
    });
  } else if (isNature) {
    layers.push({
      id: uuidv4(),
      name: "Leaf Shape",
      color: colors[1].hex,
      pattern: "linen",
      x: 160,
      y: 140,
      width: 100,
      height: 80,
      rotation: -20,
      opacity: 0.9,
      zIndex: 1,
    });
    layers.push({
      id: uuidv4(),
      name: "Tree Trunk",
      color: colors[3].hex,
      pattern: "stripe",
      x: 230,
      y: 160,
      width: 50,
      height: 120,
      rotation: 0,
      opacity: 0.85,
      zIndex: 2,
    });
    layers.push({
      id: uuidv4(),
      name: "Canopy",
      color: colors[2].hex,
      pattern: "polka",
      x: 180,
      y: 110,
      width: 140,
      height: 80,
      rotation: 0,
      opacity: 0.8,
      zIndex: 3,
    });
  } else {
    // Default: mixed abstract layout
    layers.push({
      id: uuidv4(),
      name: "Abstract Shape 1",
      color: colors[1].hex,
      pattern: "solid",
      x: 150,
      y: 140,
      width: 90,
      height: 90,
      rotation: 10,
      opacity: 0.9,
      zIndex: 1,
    });
    layers.push({
      id: uuidv4(),
      name: "Abstract Shape 2",
      color: colors[2].hex,
      pattern: "polka",
      x: 230,
      y: 170,
      width: 70,
      height: 70,
      rotation: -15,
      opacity: 0.8,
      zIndex: 2,
    });
    layers.push({
      id: uuidv4(),
      name: "Accent Piece",
      color: colors[3].hex,
      pattern: "stripe",
      x: 180,
      y: 230,
      width: 100,
      height: 40,
      rotation: 5,
      opacity: 0.75,
      zIndex: 3,
    });
  }

  return layers;
}