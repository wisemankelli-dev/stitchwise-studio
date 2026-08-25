/**
 * OpenAI Collage Service — Integration with the OpenAI image generation API
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
import type { CollageLayer, CollageGenerationResult, PatternRegion, CollagePiece } from "../../domain/ai/collageAI";
interface OpenAIGenerationResponse { id: string; url?: string; createdAt?: string; buffer?: Buffer; }
import { generateImageWithDallE } from "./openaiImageService";
import { closestFabricColor } from "../../domain/collage/fabricColors";
import { getRandomTexture } from "../../domain/collage/fabricTextures";
import { segmentImageIntoPieces } from "./collagePieceSegmentation";
import { traceColoringPageIntoPieces } from "./coloringPageTracing";

/** OpenAI API base URL. */
const UNUSED_API_BASE = "https://api.openai.com/v1";
/** Default generation model (OpenAI Kino XL). */
const DEFAULT_MODEL_ID = "gpt-image-1";
/** Timeout for image generation requests (seconds). */
const GENERATION_TIMEOUT_MS = 120_000;

/**
 * Get the OpenAI API key from environment.
 * Falls back gracefully in development/testing.
 */
function getApiKey(): string | null {
  return process.env.OPENAI_API_KEY || null;
}

/**
 * Create an authenticated axios instance for OpenAI API.
 */
function createClient() {
  const apiKey = getApiKey();
  return axios.create({
    baseURL: UNUSED_API_BASE,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
}

/**
 * Generate an image from a text prompt using OpenAI.
 * Reuses the same approach as the embroidery service.
 */
export async function generateCollageImage(prompt: string, negativePrompt?: string, premium = false): Promise<OpenAIGenerationResponse> {
  const artworkPrompt = `black and white coloring book page of ${prompt}; bold clean outlines, white background, simple uncluttered shapes, no shading, suitable for coloring`;
  const result = await generateImageWithDallE(artworkPrompt, negativePrompt, undefined, premium);
  return result ? { id: "openai", url: result.url, buffer: result.buffer } : { id: "openai" };
}
/**
 * Poll OpenAI API until the generation is complete.
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
  throw new Error("OpenAI generation timed out");
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
  const size = gridSize >= 8 && gridSize <= 200 ? gridSize : 32;

  // Coloring-page tracing is the primary piece path. It follows ink boundaries
  // into enclosed, non-overlapping cutouts and avoids the expensive color
  // k-means pipeline for the normal line-art case. Color segmentation below is
  // retained as a graceful fallback for uploads without usable closed outlines.
  try {
    const traced = await traceColoringPageIntoPieces(imageBuffer);
    if (traced.pieces.length > 0) {
      const baseLayer: CollageLayer = {
        id: "bg",
        name: "Base Fabric",
        color: "#ffffff",
        pattern: "solid",
        x: 0,
        y: 0,
        width: 400,
        height: 400,
        rotation: 0,
        opacity: 1,
        zIndex: 0,
      };
      return {
        layers: [baseLayer],
        regions: [],
        gridSize: size,
        layerCount: 1,
        fabricColors: [{ hex: "#ffffff", name: "White", count: 1 }],
        pieces: traced.pieces,
        referenceImage: traced.referenceImage,
      };
    }
  } catch (err) {
    console.warn({ event: "coloring_page_trace_failed", error: String(err) });
  }

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

  // Flood-fill: group adjacent cells by coarse color, creating organic fabric-piece shapes
  interface CellInfo { color: string; name: string; colorKey: string }
  const cellGrid: CellInfo[][] = Array.from({ length: size }, () => []);

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const idx = (row * size + col) * 4;
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
      const fabric = closestFabricColor(r, g, b);
      const colorKey = `${Math.round(r / 96)}:${Math.round(g / 96)}:${Math.round(b / 96)}`;
      cellGrid[row][col] = { color: fabric.hex, name: fabric.name, colorKey };
    }
  }

  const visited: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const regions: Array<{ color: string; name: string; cells: Array<{ row: number; col: number }> }> = [];

  const floodFill = (sr: number, sc: number, targetKey: string) => {
    const cells: Array<{ row: number; col: number }> = [];
    const stack = [[sr, sc]];
    visited[sr][sc] = true;
    while (stack.length > 0) {
      const [r, c] = stack.pop()!;
      cells.push({ row: r, col: c });
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && !visited[nr][nc]) {
          if (cellGrid[nr][nc].colorKey === targetKey) {
            visited[nr][nc] = true;
            stack.push([nr, nc]);
          }
        }
      }
    }
    return cells;
  };

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!visited[row][col]) {
        const cell = cellGrid[row][col];
        const blobCells = floodFill(row, col, cell.colorKey);
        regions.push({ color: cell.color, name: cell.name, cells: blobCells });
      }
    }
  }

  // Convert regions to fabric layers AND pattern regions
  const canvasWidth = 400, canvasHeight = 400;
  const cellW = canvasWidth / size, cellH = canvasHeight / size;
  const MIN_CELLS = 3;

  const layers: CollageLayer[] = [];
  const patternRegions: PatternRegion[] = [];
  const fabricColorCount = new Map<string, { hex: string; name: string; count: number }>();

  // White base
  layers.push({
    id: 'bg', name: 'Base Fabric', color: '#ffffff', pattern: 'solid',
    x: 0, y: 0, width: canvasWidth, height: canvasHeight,
    rotation: 0, opacity: 1, zIndex: 0,
  });

  // Sort largest first
  const sorted = regions.sort((a, b) => b.cells.length - a.cells.length);
  let regionNumber = 0;

  sorted.forEach((region, index) => {
    if (region.cells.length < MIN_CELLS) return;
    regionNumber++;

    const rows = region.cells.map(c => c.row);
    const cols = region.cells.map(c => c.col);
    const x = Math.min(...cols) * cellW;
    const y = Math.min(...rows) * cellH;
    const w = (Math.max(...cols) - Math.min(...cols) + 1.2) * cellW;
    const h = (Math.max(...rows) - Math.min(...rows) + 1.2) * cellH;

    const texture = getRandomTexture();

    layers.push({
      id: uuidv4(),
      name: region.name,
      color: region.color,
      pattern: texture.id,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      width: Math.round(w * 10) / 10,
      height: Math.round(h * 10) / 10,
      rotation: 0, opacity: 1,
      zIndex: index + 1,
    });

    patternRegions.push({
      number: regionNumber,
      suggestedColor: region.name,
      suggestedHex: region.color,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      width: Math.round(w * 10) / 10,
      height: Math.round(h * 10) / 10,
    });

    const key = region.color;
    if (fabricColorCount.has(key)) {
      fabricColorCount.get(key)!.count++;
    } else {
      fabricColorCount.set(key, { hex: region.color, name: region.name, count: 1 });
    }
  });

  if (layers.length <= 1) {
    const fallback = generateMockCollageLayout(size);
    // Even the fallback path segments the real uploaded art into pieces.
    try {
      const seg = await segmentImageIntoPieces(imageBuffer);
      return { ...fallback, pieces: seg.pieces, referenceImage: seg.referenceImage };
    } catch {
      return fallback;
    }
  }

  // Scrapbook pieces — cutouts of the actual art image (owner direction).
  let pieces: CollagePiece[] | undefined;
  let referenceImage: string | undefined;
  try {
    const seg = await segmentImageIntoPieces(imageBuffer);
    pieces = seg.pieces;
    referenceImage = seg.referenceImage;
  } catch (err) {
    console.warn({ event: "collage_piece_segmentation_failed", error: String(err) });
  }

  return {
    layers,
    regions: patternRegions,
    gridSize: size,
    layerCount: layers.length,
    fabricColors: Array.from(fabricColorCount.values()).sort((a, b) => b.count - a.count),
    pieces,
    referenceImage,
  };
}

// ─── Mock Fallback ──────────────────────────────────────────────────────────

/**
 * Generate a realistic mock collage layout based on prompt keywords.
 * Used when no OpenAI API key is configured.
 */
function getMockCollageGenerationResponse(prompt: string): OpenAIGenerationResponse {
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
    regions: layers.filter(l => l.id !== 'bg').map((l, i) => ({
      number: i + 1,
      suggestedColor: l.name,
      suggestedHex: l.color,
      x: l.x, y: l.y, width: l.width, height: l.height,
    })),
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
    regions: layers.filter(l => l.id !== 'bg').map((l, i) => ({
      number: i + 1,
      suggestedColor: l.name,
      suggestedHex: l.color,
      x: l.x, y: l.y, width: l.width, height: l.height,
    })),
    gridSize,
    layerCount: layers.length,
    fabricColors,
    prompt,
  };
}

/**
 * Render the mock layout's layers as a raster artwork image (SVG → PNG),
 * then segment it into real scrapbook cutout pieces.
 *
 * Used by the no-API-key fallback so the scrapbook piece flow works end to
 * end even in mock mode: the pieces are cutouts of the rendered mock art.
 */
export async function attachMockPiecesToCollage(
  collage: CollageGenerationResult,
  size: number = 512,
): Promise<CollageGenerationResult> {
  try {
    const artwork = await renderMockArtworkSvg(collage.layers, size);
    // Keep mock mode aligned with the real path: try line tracing first, then
    // retain the existing color segmentation fallback for generated rectangles.
    const traced = await traceColoringPageIntoPieces(artwork);
    if (traced.pieces.length > 0) {
      return { ...collage, pieces: traced.pieces, referenceImage: traced.referenceImage };
    }
    const seg = await segmentImageIntoPieces(artwork);
    return { ...collage, pieces: seg.pieces, referenceImage: seg.referenceImage };
  } catch (err) {
    console.warn({ event: "mock_piece_attachment_failed", error: String(err) });
    return collage;
  }
}

/**
 * Rasterize a set of collage layers into a PNG buffer (SVG render).
 * Draws each non-background layer as a rotated rounded rectangle so the
 * mock artwork visually matches the generated layout.
 */
async function renderMockArtworkSvg(
  layers: CollageLayer[],
  size: number,
): Promise<Buffer> {
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 400 400">`,
    `<rect x="0" y="0" width="400" height="400" fill="#ffffff"/>`,
  ];
  for (const layer of layers) {
    if (layer.id === 'bg') continue;
    const cx = layer.x + layer.width / 2;
    const cy = layer.y + layer.height / 2;
    parts.push(
      `<g transform="translate(${cx},${cy}) rotate(${layer.rotation || 0})">` +
      `<rect x="${-layer.width / 2}" y="${-layer.height / 2}" width="${layer.width}" height="${layer.height}" ` +
      `rx="${Math.min(18, layer.width / 4)}" fill="${layer.color}"/>` +
      `</g>`,
    );
  }
  parts.push(`</svg>`);
  return sharp(Buffer.from(parts.join(""))).png().toBuffer();
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

  // Background base layer — always white
  layers.push({
    id: 'bg',
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