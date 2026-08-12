import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Download, Layers, Palette, RotateCcw,
  ArrowLeft,
  Scissors, Square, ZoomIn, ZoomOut, AlertTriangle,
  Copy, Eraser, Paintbrush, Pipette, FlipHorizontal, MousePointer2, Type, Ruler,
  RectangleHorizontal, Circle, Minus, PaintBucket, Hand, Triangle, Trash2,
  Upload, Eye, Sparkles, Loader2, Save, FolderOpen, ChevronDown
} from 'lucide-react';
import StitchGrid, { DmcLegend } from '../components/StitchGrid';
import type { StitchGridData, StitchCell } from '../components/StitchGrid';
import { describeAiGenerationError } from '../utils/aiGenerationErrors';
import { FONTS, renderTextToGrid } from '../components/FontGlyphs';
import { exportPatternToPdf } from '../utils/pdfExport';
import { stampShape, type ClipartShape } from '../data/shapes';
import ShapePicker from '../components/ShapePicker';
import { api, type SavedPatternSummary, type SavedPatternCell } from '../services/api';

interface StitchStyle { id: string; name: string; description: string; }

type EditTool = 'select' | 'mirror' | 'erase' | 'clone' | 'eyedropper' | 'paint' | 'alphabet' | 'rectangle' | 'circle' | 'line' | 'fill' | 'pan' | 'half';

const COLORS = [
  { name: 'Rose Red', hex: '#e11d48' }, { name: 'Sunset Gold', hex: '#d97706' },
  { name: 'Forest Green', hex: '#16a34a' }, { name: 'Ocean Blue', hex: '#0284c7' },
  { name: 'Royal Violet', hex: '#7c3aed' }, { name: 'Warm Cream', hex: '#fef3c7' },
  { name: 'Pitch Black', hex: '#1e293b' },
];

// DMC thread color palette for image-to-grid conversion (~80 colors)
const DMC_PALETTE: { code: string; name: string; r: number; g: number; b: number }[] = [
  // Reds
  { code: 'DMC 321', name: 'Christmas Red', r: 201, g: 38, b: 45 },
  { code: 'DMC 304', name: 'Red - Medium', r: 183, g: 44, b: 49 },
  { code: 'DMC 309', name: 'Rose - Dark', r: 215, g: 82, b: 95 },
  { code: 'DMC 3326', name: 'Rose - Light', r: 236, g: 141, b: 148 },
  { code: 'DMC 3713', name: 'Salmon - Very Light', r: 249, g: 206, b: 196 },
  { code: 'DMC 347', name: 'Salmon - Dark', r: 191, g: 45, b: 45 },
  { code: 'DMC 351', name: 'Coral', r: 233, g: 99, b: 94 },
  { code: 'DMC 353', name: 'Peach', r: 249, g: 175, b: 161 },
  { code: 'DMC 666', name: 'Red - Bright', r: 213, g: 36, b: 43 },
  { code: 'DMC 817', name: 'Red - Very Dark', r: 187, g: 5, b: 31 },
  // Pinks
  { code: 'DMC 3687', name: 'Mauve - Light', r: 206, g: 127, b: 146 },
  { code: 'DMC 3688', name: 'Mauve - Medium', r: 188, g: 110, b: 127 },
  { code: 'DMC 3689', name: 'Mauve - Dark', r: 167, g: 97, b: 113 },
  { code: 'DMC 3705', name: 'Watermelon - Dark', r: 255, g: 83, b: 87 },
  { code: 'DMC 3706', name: 'Watermelon - Medium', r: 255, g: 103, b: 106 },
  { code: 'DMC 3801', name: 'Watermelon - Light', r: 255, g: 118, b: 121 },
  { code: 'DMC 3833', name: 'Raspberry', r: 211, g: 94, b: 116 },
  { code: 'DMC 3823', name: 'Yellow - Ultra Pale', r: 254, g: 243, b: 205 },
  // Oranges
  { code: 'DMC 334', name: 'Blue - Medium Baby', r: 112, g: 162, b: 190 },
  { code: 'DMC 606', name: 'Orange - Bright', r: 243, g: 58, b: 11 },
  { code: 'DMC 608', name: 'Orange - Bright', r: 255, g: 91, b: 0 },
  { code: 'DMC 740', name: 'Tangerine', r: 222, g: 106, b: 27 },
  { code: 'DMC 741', name: 'Tangerine - Medium', r: 255, g: 126, b: 0 },
  { code: 'DMC 742', name: 'Tangerine - Light', r: 255, g: 161, b: 51 },
  { code: 'DMC 946', name: 'Burnt Orange - Medium', r: 244, g: 98, b: 0 },
  { code: 'DMC 947', name: 'Burnt Orange', r: 255, g: 118, b: 51 },
  // Yellows
  { code: 'DMC 307', name: 'Lemon', r: 253, g: 236, b: 15 },
  { code: 'DMC 444', name: 'Yellow - Dark', r: 255, g: 211, b: 0 },
  { code: 'DMC 445', name: 'Yellow - Light', r: 255, g: 251, b: 139 },
  { code: 'DMC 725', name: 'Topaz - Medium Light', r: 255, g: 200, b: 90 },
  { code: 'DMC 726', name: 'Topaz - Light', r: 253, g: 215, b: 100 },
  { code: 'DMC 727', name: 'Topaz - Very Light', r: 255, g: 240, b: 152 },
  { code: 'DMC 728', name: 'Topaz', r: 233, g: 175, b: 50 },
  { code: 'DMC 743', name: 'Yellow - Medium', r: 254, g: 220, b: 148 },
  { code: 'DMC 744', name: 'Yellow - Pale', r: 255, g: 229, b: 135 },
  { code: 'DMC 745', name: 'Yellow - Light Pale', r: 255, g: 235, b: 169 },
  { code: 'DMC 3820', name: 'Straw - Dark', r: 188, g: 143, b: 77 },
  { code: 'DMC 3821', name: 'Straw', r: 220, g: 167, b: 62 },
  { code: 'DMC 3827', name: 'Golden Brown - Pale', r: 244, g: 192, b: 118 },
  // Greens
  { code: 'DMC 334', name: 'Blue - Medium Baby', r: 112, g: 162, b: 190 },
  { code: 'DMC 3345', name: 'Hunter Green - Dark', r: 63, g: 87, b: 70 },
  { code: 'DMC 3346', name: 'Hunter Green', r: 85, g: 111, b: 63 },
  { code: 'DMC 3347', name: 'Yellow Green - Medium', r: 113, g: 138, b: 60 },
  { code: 'DMC 3348', name: 'Yellow Green - Light', r: 201, g: 217, b: 137 },
  { code: 'DMC 469', name: 'Avocado Green', r: 108, g: 124, b: 58 },
  { code: 'DMC 470', name: 'Avocado Green - Light', r: 137, g: 153, b: 78 },
  { code: 'DMC 471', name: 'Avocado Green - Very Light', r: 164, g: 181, b: 98 },
  { code: 'DMC 472', name: 'Avocado Green - Ultra Light', r: 208, g: 225, b: 137 },
  { code: 'DMC 699', name: 'Green', r: 5, g: 108, b: 60 },
  { code: 'DMC 700', name: 'Green - Bright', r: 47, g: 122, b: 62 },
  { code: 'DMC 701', name: 'Green - Light', r: 89, g: 146, b: 77 },
  { code: 'DMC 702', name: 'Kelly Green', r: 64, g: 152, b: 64 },
  { code: 'DMC 703', name: 'Chartreuse', r: 129, g: 172, b: 64 },
  { code: 'DMC 704', name: 'Chartreuse - Bright', r: 160, g: 198, b: 68 },
  { code: 'DMC 909', name: 'Emerald Green - Very Dark', r: 31, g: 83, b: 70 },
  { code: 'DMC 910', name: 'Emerald Green - Dark', r: 41, g: 104, b: 75 },
  { code: 'DMC 911', name: 'Emerald Green - Medium', r: 24, g: 126, b: 80 },
  { code: 'DMC 912', name: 'Emerald Green - Light', r: 61, g: 153, b: 107 },
  { code: 'DMC 913', name: 'Nile Green - Medium', r: 116, g: 179, b: 140 },
  // Blues
  { code: 'DMC 311', name: 'Blue - Medium Navy', r: 28, g: 56, b: 97 },
  { code: 'DMC 312', name: 'Blue - Very Dark Navy', r: 30, g: 51, b: 102 },
  { code: 'DMC 322', name: 'Blue - Dark', r: 63, g: 96, b: 149 },
  { code: 'DMC 333', name: 'Blue Violet - Dark', r: 87, g: 62, b: 144 },
  { code: 'DMC 336', name: 'Blue - Navy', r: 34, g: 55, b: 103 },
  { code: 'DMC 340', name: 'Blue Violet - Medium', r: 138, g: 108, b: 189 },
  { code: 'DMC 341', name: 'Blue Violet - Light', r: 164, g: 140, b: 211 },
  { code: 'DMC 3743', name: 'Blue Violet - Very Light', r: 212, g: 203, b: 218 },
  { code: 'DMC 517', name: 'Wedgewood - Dark', r: 46, g: 135, b: 175 },
  { code: 'DMC 518', name: 'Wedgewood - Light', r: 77, g: 150, b: 183 },
  { code: 'DMC 519', name: 'Sky Blue', r: 118, g: 182, b: 208 },
  { code: 'DMC 775', name: 'Blue - Very Light Baby', r: 205, g: 229, b: 239 },
  { code: 'DMC 798', name: 'Delft Blue - Dark', r: 64, g: 100, b: 163 },
  { code: 'DMC 799', name: 'Delft Blue - Medium', r: 98, g: 137, b: 190 },
  { code: 'DMC 800', name: 'Delft Blue - Pale', r: 170, g: 196, b: 223 },
  { code: 'DMC 820', name: 'Royal Blue - Very Dark', r: 17, g: 51, b: 118 },
  { code: 'DMC 823', name: 'Navy Blue - Dark', r: 17, g: 34, b: 83 },
  { code: 'DMC 824', name: 'Blue - Very Dark', r: 41, g: 67, b: 135 },
  { code: 'DMC 825', name: 'Blue - Dark', r: 66, g: 98, b: 159 },
  { code: 'DMC 826', name: 'Blue - Medium', r: 96, g: 134, b: 189 },
  { code: 'DMC 827', name: 'Blue - Very Light', r: 185, g: 212, b: 234 },
  { code: 'DMC 939', name: 'Navy Blue - Very Dark', r: 15, g: 24, b: 52 },
  { code: 'DMC 995', name: 'Electric Blue - Dark', r: 40, g: 112, b: 179 },
  { code: 'DMC 996', name: 'Electric Blue - Medium', r: 56, g: 146, b: 211 },
  // Purples
  { code: 'DMC 208', name: 'Lavender - Very Dark', r: 141, g: 104, b: 175 },
  { code: 'DMC 209', name: 'Lavender - Dark', r: 163, g: 126, b: 192 },
  { code: 'DMC 210', name: 'Lavender - Medium', r: 185, g: 154, b: 211 },
  { code: 'DMC 211', name: 'Lavender - Light', r: 215, g: 193, b: 229 },
  { code: 'DMC 550', name: 'Violet - Very Dark', r: 88, g: 54, b: 109 },
  { code: 'DMC 552', name: 'Violet - Medium', r: 124, g: 82, b: 148 },
  { code: 'DMC 553', name: 'Violet', r: 151, g: 101, b: 174 },
  { code: 'DMC 554', name: 'Violet - Light', r: 195, g: 158, b: 208 },
  // Browns
  { code: 'DMC 300', name: 'Mahogany - Very Dark', r: 111, g: 47, b: 0 },
  { code: 'DMC 301', name: 'Mahogany - Medium', r: 179, g: 97, b: 46 },
  { code: 'DMC 400', name: 'Mahogany - Dark', r: 143, g: 67, b: 22 },
  { code: 'DMC 402', name: 'Mahogany - Very Light', r: 247, g: 167, b: 119 },
  { code: 'DMC 433', name: 'Brown - Medium', r: 122, g: 62, b: 34 },
  { code: 'DMC 434', name: 'Brown - Light', r: 153, g: 83, b: 52 },
  { code: 'DMC 435', name: 'Brown - Very Light', r: 181, g: 106, b: 55 },
  { code: 'DMC 436', name: 'Tan', r: 197, g: 126, b: 69 },
  { code: 'DMC 437', name: 'Tan - Light', r: 222, g: 168, b: 117 },
  { code: 'DMC 838', name: 'Beige Brown - Very Dark', r: 88, g: 59, b: 46 },
  { code: 'DMC 839', name: 'Beige Brown - Dark', r: 102, g: 58, b: 41 },
  { code: 'DMC 840', name: 'Beige Brown - Medium', r: 128, g: 96, b: 74 },
  { code: 'DMC 841', name: 'Beige Brown - Light', r: 159, g: 128, b: 105 },
  { code: 'DMC 842', name: 'Beige Brown - Very Light', r: 212, g: 191, b: 170 },
  { code: 'DMC 898', name: 'Coffee Brown - Very Dark', r: 74, g: 42, b: 27 },
  { code: 'DMC 938', name: 'Coffee Brown - Ultra Dark', r: 54, g: 25, b: 14 },
  { code: 'DMC 975', name: 'Golden Brown - Dark', r: 141, g: 77, b: 20 },
  { code: 'DMC 976', name: 'Golden Brown - Medium', r: 210, g: 138, b: 58 },
  // Neutrals
  { code: 'DMC 310', name: 'Black', r: 0, g: 0, b: 0 },
  { code: 'DMC 762', name: 'Pearl Gray - Very Light', r: 219, g: 219, b: 219 },
  { code: 'DMC 3865', name: 'Winter White', r: 249, g: 247, b: 241 },
  { code: 'DMC 822', name: 'Beige Gray - Light', r: 231, g: 226, b: 213 },
  { code: 'DMC 644', name: 'Beige Gray - Medium', r: 221, g: 210, b: 196 },
  { code: 'DMC 642', name: 'Beige Gray - Dark', r: 169, g: 156, b: 140 },
  { code: 'DMC 640', name: 'Beige Gray - Very Dark', r: 133, g: 124, b: 111 },
  { code: 'BLANC', name: 'White', r: 255, g: 255, b: 255 },
];

// Find the nearest DMC color using Euclidean distance in RGB space
function nearestDmc(r: number, g: number, b: number): { hex: string; code: string; name: string } {
  let best = DMC_PALETTE[0];
  let bestDist = Infinity;
  for (const dmc of DMC_PALETTE) {
    const dr = r - dmc.r, dg = g - dmc.g, db = b - dmc.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) { bestDist = dist; best = dmc; }
  }
  const hex = '#' + [best.r, best.g, best.b].map(c => c.toString(16).padStart(2, '0')).join('');
  return { hex, code: best.code, name: best.name };
}

// K-means color quantization: reduces image to exactly K colors
function quantizeColors(pixels: Array<{r: number; g: number; b: number}>, k: number): Array<{r: number; g: number; b: number}> {
  if (pixels.length === 0 || k <= 0) return [];
  if (k >= pixels.length) {
    // More clusters than pixels — each pixel is its own cluster color
    return pixels.map(p => ({ r: p.r, g: p.g, b: p.b }));
  }
  
  // Initialize centroids by picking evenly-spaced pixels
  const centroids: Array<{r: number; g: number; b: number}> = [];
  const step = Math.max(1, Math.floor(pixels.length / k));
  for (let i = 0; i < k; i++) {
    const idx = Math.min(i * step, pixels.length - 1);
    centroids.push({ r: pixels[idx].r, g: pixels[idx].g, b: pixels[idx].b });
  }
  
  // Run k-means iterations
  const MAX_ITER = 10;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Assign each pixel to nearest centroid
    const clusters: Array<Array<{r: number; g: number; b: number}>> = centroids.map(() => []);
    for (const pixel of pixels) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const dr = pixel.r - centroids[c].r;
        const dg = pixel.g - centroids[c].g;
        const db = pixel.b - centroids[c].b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) { bestDist = dist; best = c; }
      }
      clusters[best].push(pixel);
    }
    
    // Recompute centroids
    let changed = false;
    for (let c = 0; c < centroids.length; c++) {
      if (clusters[c].length === 0) continue;
      let sr = 0, sg = 0, sb = 0;
      for (const p of clusters[c]) { sr += p.r; sg += p.g; sb += p.b; }
      const nr = Math.round(sr / clusters[c].length);
      const ng = Math.round(sg / clusters[c].length);
      const nb = Math.round(sb / clusters[c].length);
      if (nr !== centroids[c].r || ng !== centroids[c].g || nb !== centroids[c].b) {
        changed = true;
        centroids[c] = { r: nr, g: ng, b: nb };
      }
    }
    if (!changed) break;
  }
  
  return centroids;
}

// Convert an uploaded image to a DMC-colored grid with color quantization
function imageToGrid(
  img: CanvasImageSource,
  gridW: number,
  gridH: number,
  numColors: number = 20,
): { grid: Record<string, string>; palette: Array<{ code: string; name: string; hex: string; count: number }> } {
  const canvas = document.createElement('canvas');
  canvas.width = gridW;
  canvas.height = gridH;
  const ctx = canvas.getContext('2d')!;
  
  // Fill with white background first (so transparent areas become white)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, gridW, gridH);
  ctx.drawImage(img, 0, 0, gridW, gridH);
  const imageData = ctx.getImageData(0, 0, gridW, gridH);
  
  // Step 1: Collect all pixels
  const allPixels: Array<{r: number; g: number; b: number; y: number; x: number}> = [];
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = (y * gridW + x) * 4;
      allPixels.push({
        r: imageData.data[idx],
        g: imageData.data[idx + 1],
        b: imageData.data[idx + 2],
        y, x,
      });
    }
  }
  
  // Step 2: Quantize to limited palette using k-means
  const quantizedColors = quantizeColors(allPixels, numColors);
  
  // Step 3: Map each quantized color to nearest DMC thread
  const quantizedToDmc = new Map<string, { hex: string; code: string; name: string }>();
  for (const qc of quantizedColors) {
    const key = `${qc.r},${qc.g},${qc.b}`;
    if (!quantizedToDmc.has(key)) {
      const dmc = nearestDmc(qc.r, qc.g, qc.b);
      quantizedToDmc.set(key, dmc);
    }
  }
  
  // Step 4: Fill grid — snap each pixel to nearest quantized color, then to DMC
  const grid: Record<string, string> = {};
  const colorCounts: Record<string, { code: string; name: string; count: number }> = {};
  
  for (const pixel of allPixels) {
    // Find nearest quantized color
    let bestQ = quantizedColors[0];
    let bestDist = Infinity;
    for (const qc of quantizedColors) {
      const dr = pixel.r - qc.r;
      const dg = pixel.g - qc.g;
      const db = pixel.b - qc.b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) { bestDist = dist; bestQ = qc; }
    }
    
    // Map to DMC via quantized color
    const qKey = `${bestQ.r},${bestQ.g},${bestQ.b}`;
    const dmc = quantizedToDmc.get(qKey)!;
    
    const key = `${pixel.y},${pixel.x}`;
    grid[key] = dmc.hex;
    
    if (!colorCounts[dmc.hex]) {
      colorCounts[dmc.hex] = { code: dmc.code, name: dmc.name, count: 0 };
    }
    colorCounts[dmc.hex].count++;
  }
  
  const palette = Object.entries(colorCounts)
    .map(([hex, info]) => ({ ...info, hex }))
    .sort((a, b) => b.count - a.count);
  
  return { grid, palette };
}

const STITCH_STYLES: StitchStyle[] = [
  { id: 'cross', name: 'Cross Stitch', description: 'Traditional X-shaped intersection' },
  { id: 'satin', name: 'Satin Stitch', description: 'Flat, glossy parallel stitches' },
  { id: 'back', name: 'Back Stitch', description: 'Perfect for outlining fine borders' },
  { id: 'french', name: 'French Knot', description: 'Raised, textured point details' },
];

const TOOLS: { id: EditTool; icon: React.ReactNode; label: string }[] = [
  { id: 'select', icon: <MousePointer2 className="h-3.5 w-3.5" />, label: 'Select' },
  { id: 'paint', icon: <Paintbrush className="h-3.5 w-3.5" />, label: 'Paint' },
  { id: 'rectangle', icon: <RectangleHorizontal className="h-3.5 w-3.5" />, label: 'Rect' },
  { id: 'circle', icon: <Circle className="h-3.5 w-3.5" />, label: 'Circle' },
  { id: 'line', icon: <Minus className="h-3.5 w-3.5" />, label: 'Line' },
  { id: 'fill', icon: <PaintBucket className="h-3.5 w-3.5" />, label: 'Fill' },
  { id: 'erase', icon: <Eraser className="h-3.5 w-3.5" />, label: 'Erase' },
  { id: 'eyedropper', icon: <Pipette className="h-3.5 w-3.5" />, label: 'Pick' },
  { id: 'clone', icon: <Copy className="h-3.5 w-3.5" />, label: 'Clone' },
  { id: 'mirror', icon: <FlipHorizontal className="h-3.5 w-3.5" />, label: 'Mirror' },
  { id: 'alphabet', icon: <Type className="h-3.5 w-3.5" />, label: 'Text' },
  { id: 'pan', icon: <Hand className="h-3.5 w-3.5" />, label: 'Pan' },
  { id: 'half', icon: <Triangle className="h-3.5 w-3.5" />, label: 'Half' },
];

/** Canvas size presets defined as physical dimensions (inches).
 *  Grid size = inches × fabricCount (e.g. 3″ ornament on 14ct = 42×42 stitches). */
interface CanvasPreset { name: string; inchW: number; inchH: number; }
const CANVAS_PRESETS: CanvasPreset[] = [
  { name: 'Bag Charm', inchW: 2, inchH: 2 },
  { name: 'Ornament', inchW: 3, inchH: 3 },
  { name: '5×7 Frame', inchW: 5, inchH: 7 },
  { name: '8×10 Frame', inchW: 8, inchH: 10 },
  { name: 'Pillow', inchW: 6, inchH: 6 },
  { name: 'Stocking', inchW: 5, inchH: 8 },
  { name: 'Large Pillow', inchW: 8, inchH: 8 },
  { name: 'Wall Hanging', inchW: 8, inchH: 16 },
];

/** Compute stitch count from physical inches and fabric count, clamped to [6, 200] */
function inchesToStitches(inches: number, fabricCount: number): number {
  return Math.max(6, Math.min(200, Math.round(inches * fabricCount)));
}

/** Distance from point (px,py) to line segment (x1,y1)-(x2,y2) */
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Build a StitchGridData from the manual grid state (flat key-value records) */
function buildManualGridData(
  grid: Record<string, string>,
  stitchTypes: Record<string, string>,
  width: number,
  height: number,
): StitchGridData {
  // Note: AIPatternResponse type removed - buildManualGridData is used directly
  const dmcColorCounts: Record<string, number> = {};
  Object.values(grid).forEach(color => {
    if (color) dmcColorCounts[color] = (dmcColorCounts[color] || 0) + 1;
  });
  const dmcPalette = Object.entries(dmcColorCounts).map(([hex, count], i) => ({
    code: `MAN-${i + 1}`,
    name: hex,
    hex,
    count,
  }));

  const cells: StitchCell[][] = [];
  for (let r = 0; r < height; r++) {
    const row: StitchCell[] = [];
    for (let c = 0; c < width; c++) {
      const key = `${r},${c}`;
      const color = grid[key] || '';
      row.push({
        row: r,
        col: c,
        color,
        stitchType: (stitchTypes[key] as StitchCell['stitchType']) || 'cross',
      });
    }
    cells.push(row);
  }

  const totalStitches = Object.values(grid).filter(Boolean).length;
  return { grid: cells, width, height, dmcPalette, totalStitches };
}

export const Designer: React.FC = () => {
  const [gridWidth, setGridWidth] = useState(100);
  const [gridHeight, setGridHeight] = useState(100);
  const [showResizeWarning, setShowResizeWarning] = useState(false);
  const [pendingGridWidth, setPendingGridWidth] = useState(100);
  const [pendingGridHeight, setPendingGridHeight] = useState(100);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[0].hex);
  const [selectedStitch, setSelectedStitch] = useState('cross');
  const [grid, setGrid] = useState<Record<string, string>>({});
  const [gridStitchTypes, setGridStitchTypes] = useState<Record<string, string>>({});
  const [cellFractions, setCellFractions] = useState<Record<string, number>>({});
  const lastSaved = useRef<Record<string, string>>({});
  // Save/Load state (F-2: studio toolbar Save/Load wired to /api/patterns)
  const [patternName, setPatternName] = useState('');
  const [isSavingPattern, setIsSavingPattern] = useState(false);
  const [savedPatterns, setSavedPatterns] = useState<SavedPatternSummary[]>([]);
  const [showPatternLoad, setShowPatternLoad] = useState(false);
  const [patternSaveMsg, setPatternSaveMsg] = useState<string | null>(null);

  // Editing Tools state
  const [activeTool, setActiveTool] = useState<EditTool>('select');
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [mirrorEnabled, setMirrorEnabled] = useState(false);
  const [cloneSource, setCloneSource] = useState<{ row: number; col: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [numColors, setNumColors] = useState(15); // color count for quantization
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [showReference, setShowReference] = useState(true);
  const [referenceOpacity, setReferenceOpacity] = useState(0.20);

  // Image upload → grid conversion handler
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingImage(true);
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        // Save the original image for reference overlay
        setReferenceImage(ev.target?.result as string);
        setShowReference(true);
        // Maintain aspect ratio: fit image into grid dimensions
        const scale = Math.min(gridWidth / img.width, gridHeight / img.height);
        const drawW = Math.round(img.width * scale);
        const drawH = Math.round(img.height * scale);
        
        // Convert to grid at the aspect-preserving dimensions
        const result = imageToGrid(img, drawW, drawH, numColors);
        
        // Center the design on the grid
        const offsetX = Math.floor((gridWidth - drawW) / 2);
        const offsetY = Math.floor((gridHeight - drawH) / 2);
        
        const centeredGrid: Record<string, string> = {};
        const centeredStitchTypes: Record<string, string> = {};
        for (const [key, color] of Object.entries(result.grid)) {
          const [y, x] = key.split(',').map(Number);
          const cy = y + offsetY;
          const cx = x + offsetX;
          if (cy >= 0 && cy < gridHeight && cx >= 0 && cx < gridWidth) {
            centeredGrid[`${cy},${cx}`] = color;
            centeredStitchTypes[`${cy},${cx}`] = 'cross';
          }
        }
        
        setGrid(centeredGrid);
        setGridStitchTypes(centeredStitchTypes);
        setCellFractions({});
        setIsProcessingImage(false);
        
        // Reset file input so user can re-upload the same file
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [gridWidth, gridHeight, numColors]);

  // Drawing tools state
  const [drawStart, setDrawStart] = useState<{ row: number; col: number } | null>(null);

  // Shape browser state
  const [selectedShape, setSelectedShape] = useState<ClipartShape | null>(null);

  // AI pattern generation state (single-phase, handles both sync 200 and async 202)
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiStats, setAiStats] = useState<{ stitches: number; colors: number; backstitch: number; crossStitch: number } | null>(null);
  const [pollingStatus, setPollingStatus] = useState('');

  // Material Estimator state
  const [fabricCount, setFabricCount] = useState(14);
  
  // Active preset tracking (physical inches) — when set, fabric count changes recalc grid
  const [activePreset, setActivePreset] = useState<{ inchW: number; inchH: number } | null>(null);


  // Utility: stitches to inches based on fabric count
  const stitchesToInches = (stitches: number, count: number): number => stitches / count;

  // --- Material Estimation Calculations ---
  const threadPerStitchCm = 0.5;
  const threadPerStitchAdjustment = fabricCount / 14;

  const colorThreadEstimates = React.useMemo(() => {
    const counts: Record<string, { count: number; hex: string }> = {};
    Object.entries(grid).forEach(([, hex]) => {
      if (!hex) return;
      if (!counts[hex]) counts[hex] = { count: 0, hex };
      counts[hex].count++;
    });
    return Object.entries(counts).map(([hex, data]) => {
      const meters = data.count * threadPerStitchCm * threadPerStitchAdjustment / 100;
      const colorName = COLORS.find(c => c.hex === hex)?.name || hex;
      return { hex, colorName, stitchCount: data.count, meters: Math.round(meters * 100) / 100 };
    }).sort((a, b) => b.stitchCount - a.stitchCount);
  }, [grid, fabricCount]);

  const fabricEstimates = React.useMemo(() => {
    const widthInches = gridWidth / fabricCount;
    const heightInches = gridHeight / fabricCount;
    const fabricWidthInches = widthInches + 4;
    const fabricHeightInches = heightInches + 4;
    return {
      designWidthInches: Math.round(widthInches * 100) / 100,
      designHeightInches: Math.round(heightInches * 100) / 100,
      designWidthCm: Math.round(widthInches * 2.54 * 100) / 100,
      designHeightCm: Math.round(heightInches * 2.54 * 100) / 100,
      fabricWidthInches: Math.round(fabricWidthInches * 100) / 100,
      fabricHeightInches: Math.round(fabricHeightInches * 100) / 100,
      totalSkeins: Math.max(1, Math.ceil(colorThreadEstimates.reduce((sum, c) => sum + c.meters, 0) / 8.7)),
    };
  }, [gridWidth, gridHeight, fabricCount, colorThreadEstimates]);

  const FABRIC_COUNTS = [11, 14, 18, 22, 25, 28, 32, 36];

  // Alphabet tool state
  const [alphabetText, setAlphabetText] = useState('');
  const [selectedFontId, setSelectedFontId] = useState('block');
  const [placeRow, setPlaceRow] = useState(4);
  const [placeCol, setPlaceCol] = useState(2);

  const setCell = useCallback((row: number, col: number, color: string, stitch: string) => {
    const key = `${row},${col}`;
    setGrid(prev => ({ ...prev, [key]: color }));
    setGridStitchTypes(prev => ({ ...prev, [key]: stitch }));
  }, []);

  const clearCell = useCallback((row: number, col: number) => {
    const key = `${row},${col}`;
    setGrid(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setGridStitchTypes(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handlePlaceText = useCallback(() => {
    if (!alphabetText.trim()) return;
    const font = FONTS.find(f => f.id === selectedFontId) || FONTS[0];
    renderTextToGrid(alphabetText, font, placeRow, placeCol, selectedColor, selectedStitch, gridWidth, gridHeight, setCell);
    setAlphabetText('');
  }, [alphabetText, selectedFontId, placeRow, placeCol, selectedColor, selectedStitch, gridWidth, gridHeight, setCell]);

  const mirrorCellEdit = useCallback((row: number, col: number, color: string, stitch: string) => {
    if (!mirrorEnabled) return;
    const mirroredRow = gridHeight - 1 - row;
    const mirroredCol = gridWidth - 1 - col;
    if (mirroredRow === row && mirroredCol === col) return;
    setCell(mirroredRow, mirroredCol, color, stitch);
  }, [mirrorEnabled, gridWidth, gridHeight, setCell]);

  const handleCellAction = useCallback((row: number, col: number) => {
    const key = `${row},${col}`;

    // Shape stamping: only when paint tool is active
    // If a shape is selected from the ShapePicker, clicking with paint stamps it
    if (selectedShape && activeTool === 'paint') {
      const result = stampShape(grid, gridStitchTypes, selectedShape, row, col, selectedColor, selectedStitch, gridWidth, gridHeight);
      setGrid(result.grid);
      setGridStitchTypes(result.stitchTypes);
      return; // shape stays selected for multiple stamps
    }

    switch (activeTool) {
      case 'erase': {
        clearCell(row, col);
        if (mirrorEnabled) {
          const mRow = gridHeight - 1 - row;
          const mCol = gridWidth - 1 - col;
          if (mRow !== row || mCol !== col) clearCell(mRow, mCol);
        }
        break;
      }
      case 'paint': {
        setCell(row, col, selectedColor, selectedStitch);
        if (mirrorEnabled) mirrorCellEdit(row, col, selectedColor, selectedStitch);
        break;
      }
      case 'eyedropper': {
        const existingColor = grid[key];
        if (existingColor) { setSelectedColor(existingColor); setActiveTool('paint'); }
        break;
      }
      case 'clone': {
        if (!cloneSource) {
          if (grid[key]) setCloneSource({ row, col });
        } else {
          const srcKey = `${cloneSource.row},${cloneSource.col}`;
          const srcColor = grid[srcKey];
          const srcStitch = gridStitchTypes[srcKey];
          if (srcColor) {
            setCell(row, col, srcColor, srcStitch || 'cross');
            if (mirrorEnabled) mirrorCellEdit(row, col, srcColor, srcStitch || 'cross');
          }
          setCloneSource(null);
        }
        break;
      }
      // ── Drawing Tools ──
      case 'rectangle':
      case 'circle':
      case 'line': {
        if (!drawStart) {
          setDrawStart({ row, col });
        } else {
          // Draw the shape
          const r1 = Math.min(drawStart.row, row);
          const r2 = Math.max(drawStart.row, row);
          const c1 = Math.min(drawStart.col, col);
          const c2 = Math.max(drawStart.col, col);
          const cx = (c1 + c2) / 2;
          const cy = (r1 + r2) / 2;
          const rx = Math.max(0.5, (c2 - c1) / 2);
          const ry = Math.max(0.5, (r2 - r1) / 2);

          const newFractions: Record<string, number> = {};
          for (let r = Math.floor(r1 - 1); r <= Math.ceil(r2 + 1); r++) {
            for (let c = Math.floor(c1 - 1); c <= Math.ceil(c2 + 1); c++) {
              if (activeTool === 'rectangle') {
                // Anti-aliased rectangle: sample 4 subpixel corners
                const onTop = r === r1, onBot = r === r2, onLeft = c === c1, onRight = c === c2;
                const isEdge = onTop || onBot || onLeft || onRight;
                if (!isEdge) {
                  // Interior cell: full fill
                  setCell(r, c, selectedColor, selectedStitch);
                } else {
                  // Edge cell: sample subpixel coverage
                  let hits = 0;
                  for (const [sr, sc] of [[0.25,0.25],[0.25,0.75],[0.75,0.25],[0.75,0.75]]) {
                    const pr = r + sr, pc = c + sc;
                    if (pr >= r1 && pr <= r2 && pc >= c1 && pc <= c2) hits++;
                  }
                  if (hits === 4) {
                    setCell(r, c, selectedColor, selectedStitch);
                  } else if (hits > 0) {
                    const frac = hits / 4;
                    newFractions[`${r},${c}`] = frac;
                    setCell(r, c, selectedColor, selectedStitch);
                  }
                }
              } else if (activeTool === 'circle') {
                // Compute fraction: sample 4 sub-pixel points per cell
                let hits = 0;
                for (const [sr, sc] of [[0.25,0.25],[0.25,0.75],[0.75,0.25],[0.75,0.75]]) {
                  const dx = (c + sc - cx) / rx;
                  const dy = (r + sr - cy) / ry;
                  if (dx * dx + dy * dy <= 1) hits++;
                }
                if (hits === 4) {
                  setCell(r, c, selectedColor, selectedStitch);
                } else if (hits > 0) {
                  newFractions[`${r},${c}`] = hits / 4;
                  setCell(r, c, selectedColor, selectedStitch);
                }
              } else if (activeTool === 'line') {
                const d = distToSegment(c + 0.5, r + 0.5, drawStart.col + 0.5, drawStart.row + 0.5, col + 0.5, row + 0.5);
                if (d < 1) {
                  setCell(r, c, selectedColor, selectedStitch);
                } else if (d < 1.5) {
                  newFractions[`${r},${c}`] = 0.5;
                  setCell(r, c, selectedColor, selectedStitch);
                }
              }
            }
          }
          setCellFractions(prev => ({ ...prev, ...newFractions }));
          setDrawStart(null);
        }
        break;
      }
      case 'fill': {
        // Flood fill
        const targetColor = grid[key] || '';
        const fillColor = selectedColor;
        if (targetColor === fillColor) break;
        const newGrid = { ...grid };
        const newStitchTypes = { ...gridStitchTypes };
        const stack = [{ row, col }];
        const visited = new Set<string>();
        visited.add(key);
        while (stack.length > 0) {
          const { row: r, col: c } = stack.pop()!;
          const k = `${r},${c}`;
          if ((grid[k] || '') !== targetColor) continue;
          newGrid[k] = fillColor;
          newStitchTypes[k] = selectedStitch;
          for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= gridHeight || nc < 0 || nc >= gridWidth) continue;
            const nk = `${nr},${nc}`;
            if (visited.has(nk)) continue;
            visited.add(nk);
            stack.push({ row: nr, col: nc });
          }
        }
        setGrid(newGrid);
        setGridStitchTypes(newStitchTypes);
        break;
      }
      case 'pan': {
        // Pan is handled by scroll — no-op on cell click
        break;
      }
      case 'half': {
        // Half-stitch: cycle empty → 0.5 fraction → full → empty
        const currentFrac = cellFractions[key];
        if (!grid[key]) {
          // Empty → half-fill
          setCell(row, col, selectedColor, selectedStitch);
          setCellFractions(prev => ({ ...prev, [key]: 0.5 }));
          if (mirrorEnabled) {
            const mRow = gridHeight - 1 - row;
            const mCol = gridWidth - 1 - col;
            if (mRow !== row || mCol !== col) {
              setCell(mRow, mCol, selectedColor, selectedStitch);
              setCellFractions(prev => ({ ...prev, [`${mRow},${mCol}`]: 0.5 }));
            }
          }
        } else if (currentFrac === 0.5) {
          // Half → full (remove fraction)
          setCellFractions(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          if (mirrorEnabled) {
            const mRow = gridHeight - 1 - row;
            const mCol = gridWidth - 1 - col;
            if (mRow !== row || mCol !== col) {
              setCellFractions(prev => {
                const next = { ...prev };
                delete next[`${mRow},${mCol}`];
                return next;
              });
            }
          }
        } else {
          // Full → empty
          clearCell(row, col);
          setCellFractions(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          if (mirrorEnabled) {
            const mRow = gridHeight - 1 - row;
            const mCol = gridWidth - 1 - col;
            if (mRow !== row || mCol !== col) {
              clearCell(mRow, mCol);
              setCellFractions(prev => {
                const next = { ...prev };
                delete next[`${mRow},${mCol}`];
                return next;
              });
            }
          }
        }
        break;
      }
      case 'alphabet': {
        // Click to place text at click position
        if (alphabetText.trim()) {
          const font = FONTS.find(f => f.id === selectedFontId) || FONTS[0];
          renderTextToGrid(alphabetText, font, row, col, selectedColor, selectedStitch, gridWidth, gridHeight, setCell);
        }
        break;
      }
      default: {
        const newGrid = { ...grid };
        const newStitchTypes = { ...gridStitchTypes };
        if (newGrid[key] === selectedColor) {
          delete newGrid[key];
          delete newStitchTypes[key];
        } else {
          newGrid[key] = selectedColor;
          newStitchTypes[key] = selectedStitch;
        }
        setGrid(newGrid);
        setGridStitchTypes(newStitchTypes);

        if (mirrorEnabled) {
          const mRow = gridHeight - 1 - row;
          const mCol = gridWidth - 1 - col;
          if (mRow !== row || mCol !== col) {
            const mKey = `${mRow},${mCol}`;
            if (newGrid[key] === selectedColor) {
              newGrid[mKey] = selectedColor;
              newStitchTypes[mKey] = selectedStitch;
            } else {
              delete newGrid[mKey];
              delete newStitchTypes[mKey];
            }
            setGrid({ ...newGrid });
            setGridStitchTypes({ ...newStitchTypes });
          }
        }
        break;
      }
    }
  }, [activeTool, alphabetText, clearCell, cloneSource, grid, gridStitchTypes, gridWidth, gridHeight, mirrorCellEdit, mirrorEnabled, selectedColor, selectedFontId, selectedStitch, setCell, drawStart, selectedShape, cellFractions]);

  const handleCellHover = useCallback((row: number, col: number) => {
    if (!isMouseDown) return;
    if (activeTool === 'paint') {
      setCell(row, col, selectedColor, selectedStitch);
      if (mirrorEnabled) mirrorCellEdit(row, col, selectedColor, selectedStitch);
    } else if (activeTool === 'erase') {
      clearCell(row, col);
      if (mirrorEnabled) {
        const mRow = gridHeight - 1 - row;
        const mCol = gridWidth - 1 - col;
        if (mRow !== row || mCol !== col) clearCell(mRow, mCol);
      }
    } else if (activeTool === 'half') {
      // On drag: set half-fill if cell is empty
      const key = `${row},${col}`;
      if (!grid[key]) {
        setCell(row, col, selectedColor, selectedStitch);
        setCellFractions(prev => ({ ...prev, [key]: 0.5 }));
      }
    }
  }, [activeTool, clearCell, isMouseDown, mirrorCellEdit, mirrorEnabled, selectedColor, selectedStitch, setCell, grid, gridWidth, gridHeight]);

  const handleClearGrid = () => {
    setGrid({});
    setGridStitchTypes({});
    setCellFractions({});
    setCloneSource(null);
    setSelectedShape(null);
    setDrawStart(null);
    setReferenceImage(null);
    setShowReference(false);
    setReferenceOpacity(0.20);
    setAiError('');
    setAiStats(null);
    setPollingStatus('');
  };
  // ── Pattern Save / Load (F-2) ──
  const handleSavePattern = async () => {
    const name = patternName.trim() || `Pattern ${new Date().toLocaleDateString()}`;
    const stitchData = buildManualGridData(grid, gridStitchTypes, gridWidth, gridHeight);
    const payloadGrid: SavedPatternCell[][] = stitchData.grid.map(row =>
      row.map(cell => {
        const c: SavedPatternCell = { color: cell.color || '' };
        // Carry non-cross stitch type through dmcCode so it round-trips
        if (cell.stitchType && cell.stitchType !== 'cross') c.dmcCode = cell.stitchType;
        return c;
      }),
    );
    const gridSize = Math.max(16, Math.min(500, Math.max(gridWidth, gridHeight)));
    setIsSavingPattern(true);
    setPatternSaveMsg(null);
    try {
      await api.savePattern(name, payloadGrid, stitchData.dmcPalette, gridSize, stitchData.totalStitches);
      setPatternName('');
      setShowPatternLoad(false);
      setPatternSaveMsg(`Saved "${name}"!`);
      setTimeout(() => setPatternSaveMsg(null), 2500);
    } catch {
      setPatternSaveMsg('Save failed.');
      setTimeout(() => setPatternSaveMsg(null), 2500);
    } finally {
      setIsSavingPattern(false);
    }
  };
  const handleLoadPatterns = async () => {
    try {
      const patterns = await api.listPatterns();
      setSavedPatterns(patterns);
    } catch {
      setSavedPatterns([]);
    }
    setShowPatternLoad(prev => !prev);
  };
  const handleLoadPattern = async (id: string) => {
    try {
      const p = await api.loadPattern(id);
      if (!p) return;
      // Restore grid dims + cells from the persisted grid
      const height = p.grid.length;
      const width = p.grid[0]?.length || p.gridSize;
      setGridWidth(width);
      setGridHeight(height);
      const restored: Record<string, string> = {};
      const restoredTypes: Record<string, string> = {};
      p.grid.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (cell.color) restored[`${r},${c}`] = cell.color;
          if (cell.dmcCode) restoredTypes[`${r},${c}`] = cell.dmcCode;
        });
      });
      setGrid(restored);
      setGridStitchTypes(restoredTypes);
      setPatternName(p.name);
      setShowPatternLoad(false);
      setPatternSaveMsg(`Loaded "${p.name}" (${width}×${height}).`);
      setTimeout(() => setPatternSaveMsg(null), 2500);
    } catch {
      setPatternSaveMsg('Load failed.');
      setTimeout(() => setPatternSaveMsg(null), 2500);
    }
  };
  const handleDeletePattern = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.deletePattern(id);
    setSavedPatterns(prev => prev.filter(p => p.id !== id));
  };

  /** Single-phase generation: prompt → pattern (handles sync 200 and async 202 with polling) */
  const handleGenerate = useCallback(async () => {
    if (!aiPrompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setAiError('');
    setAiStats(null);
    setPollingStatus('');
    try {
      const gridSize = Math.max(gridWidth, gridHeight);
      setPollingStatus('Generating your pattern — this can take up to a minute…');

      const data = await api.generatePatternFromText(aiPrompt.trim(), { gridSize, maxColors: 6 });

      // Process the response into the grid
      const newGrid: Record<string, string> = {};
      const newStitchTypes: Record<string, string> = {};
      let backstitch = 0;
      let crossStitch = 0;
      const dmcSet = new Set<string>();

      for (let r = 0; r < data.grid.length; r++) {
        for (let c = 0; c < data.grid[r].length; c++) {
          const color = data.grid[r][c];
          if (color) {
            const key = `${r},${c}`;
            newGrid[key] = color;
            const st = (data.stitchTypes?.[r]?.[c]) || 'cross';
            newStitchTypes[key] = st;
            if (st === 'back') backstitch++;
            else crossStitch++;
          }
        }
      }

      const newH = data.grid.length;
      const newW = data.grid[0]?.length || 0;
      if (newW > 0 && newH > 0) {
        setGridWidth(newW);
        setGridHeight(newH);
      }

      setGrid(newGrid);
      setGridStitchTypes(newStitchTypes);
      setCellFractions({});
      setReferenceImage(null);
      setShowReference(false);

      // Collect DMC palette info
      if (data.dmcPalette) {
        data.dmcPalette.forEach(c => dmcSet.add(c.code));
      }

      setAiStats({
        stitches: Object.keys(newGrid).length,
        colors: dmcSet.size,
        backstitch,
        crossStitch,
      });
      setPollingStatus('');
    } catch (err: unknown) {
      setAiError(describeAiGenerationError(err, 'Failed to generate pattern. Please try again.'));
      setPollingStatus('');
    } finally {
      setIsGenerating(false);
    }
  }, [aiPrompt, isGenerating, gridWidth, gridHeight]);

  const handleExportPdf = useCallback(() => {
    const colorNames: Record<string, string> = {};
    for (const c of COLORS) colorNames[c.hex] = c.name;
    exportPatternToPdf({
      patternName: 'StitchWise Pattern',
      grid,
      gridWidth,
      gridHeight,
      fabricCount,
      colorNames,
      cellFractions,
    });
  }, [grid, gridWidth, gridHeight, fabricCount, cellFractions]);

  // Canvas resize logic
  const hasStitchesOutside = (newW: number, newH: number): boolean => {
    for (const key of Object.keys(grid)) {
      if (!grid[key]) continue;
      const [r, c] = key.split(',').map(Number);
      if (r >= newH || c >= newW) return true;
    }
    return false;
  };

  const applyResize = (newW: number, newH: number) => {
    // Clip any stitches outside the new bounds
    const newGrid: Record<string, string> = {};
    const newStitchTypes: Record<string, string> = {};
    for (const key of Object.keys(grid)) {
      if (!grid[key]) continue;
      const [r, c] = key.split(',').map(Number);
      if (r < newH && c < newW) {
        newGrid[key] = grid[key];
        if (gridStitchTypes[key]) newStitchTypes[key] = gridStitchTypes[key];
      }
    }
    setGrid(newGrid);
    setGridStitchTypes(newStitchTypes);
    setGridWidth(newW);
    setGridHeight(newH);
    setShowResizeWarning(false);
  };

  const requestResize = (newW: number, newH: number) => {
    setPendingGridWidth(newW);
    setPendingGridHeight(newH);
    if (hasStitchesOutside(newW, newH)) {
      setShowResizeWarning(true);
    } else {
      applyResize(newW, newH);
    }
  };


  const stitchData: StitchGridData = buildManualGridData(grid, gridStitchTypes, gridWidth, gridHeight);

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem('stitchwise_designer_save', JSON.stringify({ grid, stitchTypes: gridStitchTypes }));
      lastSaved.current = grid;
    }, 2000);
    return () => clearTimeout(timeout);
  }, [grid, gridStitchTypes]);

  useEffect(() => {
    const saved = localStorage.getItem('stitchwise_designer_save');
    if (saved) {
      try { const p = JSON.parse(saved); if (p.grid) setGrid(p.grid); if (p.stitchTypes) setGridStitchTypes(p.stitchTypes); } catch {}
    }
  }, []);

  // Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'bg-gradient-to-b from-white via-blush-50/30 to-white min-h-screen py-16 px-6 lg:px-8 relative overflow-hidden'}`}>
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.02]">
        <svg className="w-full h-full"><defs><pattern id="des-floral" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
          <circle cx="30" cy="30" r="12" fill="#f472b6" /><circle cx="30" cy="30" r="6" fill="#f9a8d4" />
          <circle cx="80" cy="80" r="16" fill="#f472b6" /><circle cx="80" cy="80" r="8" fill="#f9a8d4" />
          <circle cx="130" cy="30" r="12" fill="#f472b6" /><circle cx="130" cy="130" r="10" fill="#f472b6" />
        </pattern></defs><rect width="100%" height="100%" fill="url(#des-floral)" /></svg>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-6 flex justify-between items-center">
          <Link to="/dashboard" className="text-sm font-semibold text-slate-500 hover:text-blush-600 flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-x-2 rounded-full bg-blush-50/80 backdrop-blur-sm px-4 py-1 text-sm font-semibold leading-6 text-blush-600 ring-1 ring-inset ring-blush-100 mb-4">
            <Scissors className="h-4 w-4 text-blush-500" /> Solo Designer Studio
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 sm:text-5xl">
            StitchWise <span className="text-transparent bg-clip-text bg-gradient-to-r from-blush-500 to-blush-400">Pattern Designer</span>
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-3xl mx-auto">Design perfect patterns stitch by stitch.</p>
        </div>


        {/* ==================== EXISTING GRID EDITOR ==================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT PANEL */}
          <div className="lg:col-span-4 space-y-6">

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-blush-100/50 border border-blush-100 space-y-5">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Palette className="h-5 w-5 text-blush-500" /> Designer Thread Box
              </h2>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Active Thread Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button key={c.name} onClick={() => setSelectedColor(c.hex)} title={c.name}
                      className="h-8 w-8 rounded-full border transition-all relative flex items-center justify-center"
                      style={{ backgroundColor: c.hex, borderColor: selectedColor === c.hex ? '#000' : 'rgba(0,0,0,0.1)' }}>
                      {selectedColor === c.hex && <span className="block h-2.5 w-2.5 rounded-full bg-white shadow-sm" />}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Stitch Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {STITCH_STYLES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedStitch(s.id)}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${selectedStitch === s.id ? 'border-blush-600 bg-blush-50 text-blush-800 ring-1 ring-blush-500' : 'border-blush-100 bg-white hover:bg-blush-50 text-slate-700'}`}>
                      <div className="font-bold">{s.name}</div>
                      <div className="text-[10px] text-slate-500 font-normal leading-tight mt-0.5">{s.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* === CANVAS SIZE CONTROLS === */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg shadow-blush-100/50 border border-blush-100 space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Ruler className="h-5 w-5 text-blush-500" /> Canvas Size
              </h2>

              {/* Resize warning */}
              {showResizeWarning && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold text-amber-800">Stitches will be lost</p>
                      <p className="text-[10px] text-amber-700">
                        Resizing to {pendingGridWidth}×{pendingGridHeight} will remove stitches outside the new bounds.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => applyResize(pendingGridWidth, pendingGridHeight)}
                      className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold py-1.5 transition-all"
                    >
                      Resize & Clip
                    </button>
                    <button
                      onClick={() => setShowResizeWarning(false)}
                      className="flex-1 rounded-lg bg-white border border-amber-200 text-amber-700 text-[10px] font-bold py-1.5 hover:bg-amber-50 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Preset sizes */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Preset Sizes</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CANVAS_PRESETS.map((preset) => {
                    const stitchW = inchesToStitches(preset.inchW, fabricCount);
                    const stitchH = inchesToStitches(preset.inchH, fabricCount);
                    const isActive = activePreset?.inchW === preset.inchW && activePreset?.inchH === preset.inchH;
                    return (
                      <button
                        key={preset.name}
                        onClick={() => {
                          setActivePreset({ inchW: preset.inchW, inchH: preset.inchH });
                          requestResize(stitchW, stitchH);
                        }}
                        className={`px-2.5 py-2 rounded-lg text-left border transition-all ${
                          isActive
                            ? 'bg-blush-500 text-white border-blush-500 shadow-sm'
                            : 'bg-white text-slate-700 border-blush-100 hover:bg-blush-50'
                        }`}
                      >
                        <div className="text-[10px] font-bold leading-tight">{preset.name}</div>
                        <div className={`text-[9px] ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                          {stitchW}×{stitchH} st · {preset.inchW}″×{preset.inchH}″ on {fabricCount}ct
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Manual size inputs */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Custom Size</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">W:</span>
                    <input
                      type="number"
                      value={gridWidth}
                      onChange={(e) => {
                        const v = Math.max(6, Math.min(200, Number(e.target.value) || 6));
                        setActivePreset(null);
                        requestResize(v, gridHeight);
                      }}
                      className="w-14 rounded-lg border-blush-100 text-[11px] font-bold text-slate-700 px-2 py-1.5 border text-center focus:border-blush-500 focus:ring-blush-500"
                      min={6} max={200}
                    />
                  </div>
                  <span className="text-slate-300 font-bold">×</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">H:</span>
                    <input
                      type="number"
                      value={gridHeight}
                      onChange={(e) => {
                        const v = Math.max(6, Math.min(200, Number(e.target.value) || 6));
                        setActivePreset(null);
                        requestResize(gridWidth, v);
                      }}
                      className="w-14 rounded-lg border-blush-100 text-[11px] font-bold text-slate-700 px-2 py-1.5 border text-center focus:border-blush-500 focus:ring-blush-500"
                      min={6} max={200}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Physical size on {fabricCount}ct: {stitchesToInches(gridWidth, fabricCount).toFixed(1)}″ × {stitchesToInches(gridHeight, fabricCount).toFixed(1)}″
                  {gridWidth !== gridHeight && <span className="text-amber-500 ml-1">(non-square)</span>}
                </p>
              </div>
            </div>

            {stitchData && stitchData.dmcPalette.length > 0 && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg shadow-blush-100/50 border border-blush-100">
                <DmcLegend palette={stitchData.dmcPalette} />
                <div className="mt-3 pt-3 border-t border-blush-100 text-[10px] text-slate-500 space-y-0.5">
                  <p>Total stitches: <span className="font-bold text-blush-600">{stitchData.totalStitches}</span></p>
                  <p>Grid: <span className="font-bold text-slate-700">{stitchData.width}×{stitchData.height}</span></p>
                </div>
              </div>
            )}


            {/* === SHAPE BROWSER === */}
            <ShapePicker
              selectedShape={selectedShape}
              selectedColor={selectedColor}
              onSelectShape={(shape) => {
                setSelectedShape(shape);
                setActiveTool('paint');
              }}
            />

            {/* === MATERIAL ESTIMATOR === */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg shadow-blush-100/50 border border-blush-100 space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Ruler className="h-5 w-5 text-blush-500" /> Material Estimator
              </h2>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Fabric Count (stitches/inch)</label>
                <select
                  value={fabricCount}
                  onChange={(e) => {
                    const newCount = Number(e.target.value);
                    setFabricCount(newCount);
                    // If a preset is active, recalculate grid from physical dimensions
                    if (activePreset) {
                      const newW = inchesToStitches(activePreset.inchW, newCount);
                      const newH = inchesToStitches(activePreset.inchH, newCount);
                      requestResize(newW, newH);
                    }
                  }}
                  className="w-full rounded-xl border-blush-100 text-sm text-slate-700 font-semibold px-3 py-2 bg-white shadow-sm focus:border-blush-500 focus:ring-blush-500"
                >
                  {FABRIC_COUNTS.map((count) => (
                    <option key={count} value={count}>{count} count — {count === 11 ? 'Coarse' : count === 14 ? 'Standard' : count === 18 ? 'Fine' : count >= 28 ? 'Extra Fine' : 'Medium'}</option>
                  ))}
                </select>
              </div>

              <div className="bg-blush-50/50 rounded-xl p-4 border border-blush-100 space-y-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Square className="h-3.5 w-3.5 text-blush-500" /> Design Size
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white rounded-lg p-2 border border-blush-100">
                    <span className="text-slate-400">Width</span>
                    <p className="font-bold text-slate-800">{fabricEstimates.designWidthInches}″ / {fabricEstimates.designWidthCm} cm</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-blush-100">
                    <span className="text-slate-400">Height</span>
                    <p className="font-bold text-slate-800">{fabricEstimates.designHeightInches}″ / {fabricEstimates.designHeightCm} cm</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 italic mt-1">
                  Fabric needed (with 2″ margins): {fabricEstimates.fabricWidthInches}″ × {fabricEstimates.fabricHeightInches}″
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-blush-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path d="M12 6v6l4 2"/></svg>
                  Thread Estimate
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {colorThreadEstimates.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">Add stitches to see thread estimates</p>
                  ) : (
                    colorThreadEstimates.map((c) => (
                      <div key={c.hex} className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-blush-100">
                        <span className="h-4 w-4 rounded-full border border-slate-200 shrink-0" style={{ backgroundColor: c.hex }} />
                        <span className="flex-1 text-[10px] font-semibold text-slate-700 truncate">{c.colorName}</span>
                        <span className="text-[10px] text-slate-500">{c.stitchCount} st</span>
                        <span className="text-[10px] font-bold text-blush-700">{c.meters}m</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-2 pt-2 border-t border-blush-100 flex justify-between text-[10px] text-slate-600">
                  <span>Total thread</span>
                  <span className="font-bold text-blush-700">{colorThreadEstimates.reduce((s, c) => s + c.meters, 0).toFixed(2)}m</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>DMC skeins needed (8.7m/skein)</span>
                  <span className="font-bold text-blush-700">~{fabricEstimates.totalSkeins} skein{fabricEstimates.totalSkeins > 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-blush-100/50 border border-blush-100 flex flex-col items-center">
              <div className="w-full flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-blush-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blush-500" /> Embroidery Canvas
                  </h3>
                  <p className="text-xs text-slate-500">Upload an image or click cells to paint your pattern.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-blush-50 p-1 rounded-xl border border-blush-100">
                    <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))} className="p-1.5 rounded-lg hover:bg-white text-slate-500"><ZoomOut className="h-4 w-4" /></button>
                    <span className="text-[10px] font-bold text-slate-600 w-8 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(z + 0.2, 3))} className="p-1.5 rounded-lg hover:bg-white text-slate-500"><ZoomIn className="h-4 w-4" /></button>
                  </div>
                  <button onClick={handleClearGrid} className="p-2 rounded-lg hover:bg-blush-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 border border-blush-100">
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <select
                    value={numColors}
                    onChange={(e) => setNumColors(Number(e.target.value))}
                    className="rounded-lg border border-blush-100 text-[10px] font-bold text-slate-600 px-1.5 py-2 bg-white"
                    title="Number of colors"
                  >
                    <option value={5}>5 colors</option>
                    <option value={10}>10 colors</option>
                    <option value={15}>15 colors</option>
                    <option value={20}>20 colors</option>
                    <option value={30}>30 colors</option>
                  </select>
                  <label
                    htmlFor="image-upload"
                    className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                      isProcessingImage
                        ? 'bg-blush-100 text-blush-400 cursor-wait'
                        : 'bg-blush-500 hover:bg-blush-600 text-white'
                    }`}
                  >
                    {isProcessingImage ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {isProcessingImage ? 'Processing...' : 'Upload Image'}
                  </label>
                  <div className="flex items-center gap-1.5 relative">
                    <input
                      type="text"
                      value={patternName}
                      onChange={(e) => setPatternName(e.target.value)}
                      placeholder="Pattern name..."
                      className="w-24 rounded-lg border border-blush-100 text-[10px] font-bold text-slate-600 px-1.5 py-2 bg-white focus:border-blush-400 focus:ring-1 focus:ring-blush-400"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSavePattern(); }}
                      title="Name this pattern, then Save"
                    />
                    <button
                      onClick={handleSavePattern}
                      disabled={isSavingPattern}
                      className="p-2 rounded-lg bg-blush-500 hover:bg-blush-600 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                      title="Save pattern to your library"
                    >
                      {isSavingPattern ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save
                    </button>
                    <div className="relative">
                      <button
                        onClick={handleLoadPatterns}
                        className="p-2 rounded-lg border border-blush-100 hover:bg-blush-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5"
                        title="Load a saved pattern"
                      >
                        <FolderOpen className="h-3.5 w-3.5" /> Load <ChevronDown className="h-3 w-3" />
                      </button>
                      {showPatternLoad && (
                        <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-lg shadow-lg border border-blush-100 z-50 max-h-60 overflow-y-auto">
                          {savedPatterns.length === 0 ? (
                            <p className="p-3 text-[11px] text-slate-400 text-center">No saved patterns yet</p>
                          ) : (
                            savedPatterns.map(p => (
                              <div
                                key={p.id}
                                onClick={() => handleLoadPattern(p.id)}
                                className="flex items-center justify-between p-2 hover:bg-blush-50 cursor-pointer border-b border-blush-50 last:border-0"
                              >
                                <span className="text-xs text-slate-700 truncate flex-1">
                                  {p.name}
                                  <span className="text-[10px] text-slate-400 ml-2">{new Date(p.updatedAt).toLocaleDateString()}</span>
                                </span>
                                <button
                                  onClick={(e) => handleDeletePattern(p.id, e)}
                                  className="text-slate-300 hover:text-red-500 p-1"
                                  title="Delete pattern"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={handleExportPdf} className="p-2 rounded-lg bg-blush-500 hover:bg-blush-600 text-white text-xs font-semibold flex items-center gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Export PDF
                  </button>
                  {referenceImage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowReference(!showReference)}
                        className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          showReference
                            ? 'bg-pink-100 text-pink-700 border border-pink-200 hover:bg-pink-200'
                            : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'
                        }`}
                        title={showReference ? 'Hide reference image' : 'Show reference image'}
                      >
                        <Eye className={`h-3.5 w-3.5 ${showReference ? '' : 'opacity-50'}`} />
                        Ref
                      </button>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        value={Math.round(referenceOpacity * 100)}
                        onChange={(e) => setReferenceOpacity(Number(e.target.value) / 100)}
                        className="w-14 h-1.5 accent-pink-500 cursor-pointer"
                        title={`Reference opacity: ${Math.round(referenceOpacity * 100)}%`}
                      />
                    </div>
                  )}
                </div>
              </div>

              {patternSaveMsg && (
                <p className={`w-full mb-4 text-[11px] px-2 py-1 rounded ${patternSaveMsg.startsWith('Save failed') || patternSaveMsg.startsWith('Load failed') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                  {patternSaveMsg}
                </p>
              )}

              {/* AI Prompt Bar */}
              <div className="w-full mb-4 p-3 bg-gradient-to-r from-purple-50 to-blush-50 rounded-xl border border-purple-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500 shrink-0" />
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
                    placeholder="Describe a pattern (e.g., 'a sunflower with green leaves')"
                    className="flex-1 rounded-lg border-purple-200 text-xs text-slate-700 px-3 py-2 border bg-white focus:border-blush-500 focus:ring-blush-500"
                    disabled={isGenerating}
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={!aiPrompt.trim() || isGenerating}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-blush-600 to-blush-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-all shrink-0 hover:from-blush-700 hover:to-blush-600"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {isGenerating ? (pollingStatus || 'Generating…') : 'Generate'}
                  </button>
                </div>

                {aiError && (
                  <p className="mt-2 text-[10px] text-red-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {aiError}
                  </p>
                )}
                {isGenerating && pollingStatus && !aiError && (
                  <p className="mt-2 text-[10px] text-blush-600 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> {pollingStatus}
                  </p>
                )}
                {aiStats && (
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-600">
                    <span className="font-bold text-slate-700">{aiStats.stitches} stitches</span>
                    <span className="text-slate-400">•</span>
                    <span>{aiStats.colors} DMC colors</span>
                    <span className="text-slate-400">•</span>
                    <span>{aiStats.crossStitch} cross</span>
                    <span className="text-slate-400">•</span>
                    <span>{aiStats.backstitch} backstitch</span>
                  </div>
                )}
              </div>

              {/* Toolbar */}
              <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-blush-100">
                <div className="flex items-center gap-1 bg-blush-50 p-1 rounded-xl border border-blush-100">
                  {TOOLS.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => {
                        setActiveTool(tool.id);
                        if (tool.id !== 'clone') setCloneSource(null);
                        if (tool.id !== 'mirror') setMirrorEnabled(false);
                        if (tool.id !== 'paint') setSelectedShape(null);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        activeTool === tool.id
                          ? 'bg-white text-slate-800 shadow-sm ring-1 ring-blush-500'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                      title={tool.label}
                    >
                      {tool.icon}
                      <span className="hidden sm:inline">{tool.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearGrid}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:text-red-700 flex items-center gap-1"
                    title="Clear entire grid and start over"
                  >
                    <Trash2 className="h-3 w-3" /> Clear Grid
                  </button>
                  {activeTool === 'mirror' && (
                    <button
                      onClick={() => setMirrorEnabled(!mirrorEnabled)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                        mirrorEnabled ? 'bg-blush-500 text-white shadow-sm' : 'bg-blush-50 text-slate-500 border border-blush-100'
                      }`}
                    >
                      <FlipHorizontal className="h-3 w-3 inline mr-1" />
                      {mirrorEnabled ? 'Mirror ON' : 'Mirror OFF'}
                    </button>
                  )}
                  {activeTool === 'clone' && cloneSource && (
                    <span className="text-[10px] font-bold text-blush-600 bg-blush-50 px-2 py-1 rounded-lg">
                      Source: ({cloneSource.row},{cloneSource.col}) — click to paste
                    </span>
                  )}
                  {activeTool === 'eyedropper' && (
                    <span className="text-[10px] text-slate-500 italic">Click a cell to pick its color</span>
                  )}
                  {activeTool === 'paint' && (
                    <span className="text-[10px] text-slate-500 italic">Click & drag to paint</span>
                  )}
                  {activeTool === 'erase' && (
                    <span className="text-[10px] text-slate-500 italic">Click or drag to erase</span>
                  )}
                  {activeTool === 'half' && (
                    <span className="text-[10px] text-slate-500 italic">Click to cycle: empty → ½ → full</span>
                  )}
                  {activeTool === 'alphabet' && (
                    <div className="flex items-center gap-3">
                      <input type="text" value={alphabetText}
                        onChange={(e) => setAlphabetText(e.target.value.toUpperCase())}
                        placeholder="TYPE TEXT"
                        className="w-28 rounded-lg border-blush-100 text-[10px] font-mono font-bold text-slate-800 uppercase px-2 py-1 border focus:border-blush-500 focus:ring-blush-500"
                        maxLength={12}
                      />
                      <select value={selectedFontId}
                        onChange={(e) => setSelectedFontId(e.target.value)}
                        className="rounded-lg border-blush-100 text-[10px] font-bold text-slate-600 px-2 py-1 border bg-white"
                      >
                        {FONTS.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
                      </select>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">R:</span>
                        <input type="number" value={placeRow}
                          onChange={(e) => setPlaceRow(Math.max(0, Math.min(gridHeight - 1, Number(e.target.value))))}
                          className="w-10 rounded-lg border-blush-100 text-[10px] text-slate-700 px-1 py-1 border text-center" min={0} max={gridHeight - 1} />
                        <span className="text-[10px] text-slate-400">C:</span>
                        <input type="number" value={placeCol}
                          onChange={(e) => setPlaceCol(Math.max(0, Math.min(gridWidth - 1, Number(e.target.value))))}
                          className="w-10 rounded-lg border-blush-100 text-[10px] text-slate-700 px-1 py-1 border text-center" min={0} max={gridWidth - 1} />
                      </div>
                      <button onClick={handlePlaceText} disabled={!alphabetText.trim()}
                        className="rounded-lg bg-blush-500 hover:bg-blush-600 text-white text-[10px] font-bold px-3 py-1.5 disabled:opacity-50 transition-all">
                        <Type className="h-3 w-3 inline mr-1" /> Place
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div
                ref={canvasRef}
                className="w-full p-6 bg-amber-50/20 rounded-2xl border-4 border-dashed border-blush-100 shadow-inner min-h-[360px] flex items-center justify-center overflow-auto"
                onMouseDown={() => setIsMouseDown(true)}
                onMouseUp={() => { setIsMouseDown(false); }}
                onMouseLeave={() => { setIsMouseDown(false); }}
              >
                <div className="w-full">
                    <StitchGrid
                      data={stitchData}
                      zoom={zoom}
                      onCellClick={handleCellAction}
                      activeTool={activeTool}
                      isMouseDown={isMouseDown}
                      onCellHover={handleCellHover}
                      onZoomChange={setZoom}
                      isFullscreen={isFullscreen}
                      onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                      cellFractions={cellFractions}
                      referenceImage={referenceImage}
                      showReference={showReference}
                      referenceOpacity={referenceOpacity}
                    />
                </div>
              </div>

              <div className="w-full mt-4 flex items-center justify-between p-3 bg-blush-50/50 border border-blush-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <Square className="h-4 w-4 text-blush-500" />
                  <span className="text-xs font-bold text-slate-700">{gridWidth}×{gridHeight} Grid</span>
                </div>
                <span className="text-xs text-slate-500">
                  {stitchData.totalStitches} stitches
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};