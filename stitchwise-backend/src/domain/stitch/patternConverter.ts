/**
 * Pattern Converter — Converts images to embroidery stitch grids.
 *
 * Core pipeline:
 * 1. Download/load image from URL or buffer
 * 2. Resize to target grid dimensions (gridSize x gridSize pixels) using high-quality
 *    lanczos downscaling (each stitch = the average of its source region)
 * 3. Quantize colors to the user's requested number of colors (15-80) via median-cut
 * 4. Map each reduced color to the nearest DMC thread color, deduplicating
 * 5. Build StitchGrid and count DMC usage
 *
 * The pipeline creates clean artwork first (by downscaling, median filtering, and
 * color quantization), then converts pixel-for-pixel to stitches.
 * Owner directive: "Each pixel = one stitch."
 * NOTE (2026-08-18, owner report "bird not blue"): the previous cold-color (blue/violet)
 * remap step was REMOVED — it destroyed legitimate blue/violet subjects by remapping
 * them to warm colors. Edge noise is handled by the median filter + posterization.
 */

import sharp from "sharp";
import axios from "axios";
import type { StitchCell, StitchGrid, PatternResult } from "./types";
import { AVAILABLE_GRID_SIZES, DEFAULT_GRID_SIZE, CROSS_STITCH_SYMBOLS } from "./types";
import { pixelsToStitchGrid } from "./pipeline";
import { closestDmcColor, rgbToHex } from "./dmcColors";

/**
 * Convert an image URL to a stitch grid by:
 * 1. Downloading the image
 * 2. Resizing to gridSize x gridSize pixels
 * 3. Quantizing colors to maxColors via median-cut
 * 4. Quantizing each pixel to the nearest DMC thread color
 *
 * @param imageUrl - URL of the image to convert
 * @param gridSize - Output grid dimensions (50, 75, 100, 150, 200)
 * @param maxColors - Target number of colors (15-80, default 24)
 * @returns PatternResult with grid, stitch count, and DMC usage
 */
export async function imageUrlToStitchGrid(
  imageUrl: string,
  gridSize: number = DEFAULT_GRID_SIZE,
  maxColors: number = 24,
): Promise<PatternResult> {
  try {
    // Download the image
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
    });

    const imageBuffer = Buffer.from(response.data);
    return imageBufferToStitchGrid(imageBuffer, gridSize, maxColors);
  } catch (err) {
    console.error({ event: "image_download_failed", url: imageUrl, error: String(err) });
    // Fallback: generate a simple pattern
    const size = (AVAILABLE_GRID_SIZES as readonly number[]).includes(gridSize) ? gridSize : DEFAULT_GRID_SIZE;
    const fallbackGrid: StitchCell[][] = [];
    for (let r = 0; r < size; r++) {
      const row: StitchCell[] = [];
      for (let c = 0; c < size; c++) {
        if ((r + c) % 3 === 0) { row.push({ color: '#e11d48', dmcCode: '321', dmcName: 'Christmas Red' }); }
        else if ((r + c) % 3 === 1) { row.push({ color: '#0284c7', dmcCode: '798', dmcName: 'Delft Blue' }); }
        else { row.push({ color: '#16a34a', dmcCode: '700', dmcName: 'Green' }); }
      }
      fallbackGrid.push(row);
    }
    return {
      grid: fallbackGrid,
      gridSize: size,
      stitchCount: size * size,
      dmcColors: [
        { code: '321', name: 'Christmas Red', hex: '#e11d48', count: Math.ceil(size * size / 3), symbol: CROSS_STITCH_SYMBOLS[0] },
        { code: '798', name: 'Delft Blue', hex: '#0284c7', count: Math.ceil(size * size / 3), symbol: CROSS_STITCH_SYMBOLS[1] },
        { code: '700', name: 'Green', hex: '#16a34a', count: Math.ceil(size * size / 3), symbol: CROSS_STITCH_SYMBOLS[2] },
      ],
    };
  }
}

/**
 * Convert an image buffer to a stitch grid.
 *
 * Pipeline: resize → median filter → median-cut color quantization → DMC mapping
 * This creates clean artwork first, then converts pixel-for-pixel to stitches.
 *
 * @param imageBuffer - Raw image data
 * @param gridSize - Output grid dimensions (50, 75, 100, 150, 200)
 * @param maxColors - Target number of colors (15-80, default 24)
 * @returns PatternResult
 */
export async function imageBufferToStitchGrid(
  imageBuffer: Buffer,
  gridSize: number = DEFAULT_GRID_SIZE,
  maxColors: number = 24,
  target?: { width: number; height: number },
  opts?: { margin?: boolean; outlinePreserve?: boolean },
): Promise<PatternResult> {
  // Validate grid size
  const validSizes = AVAILABLE_GRID_SIZES as readonly number[];
  const size = gridSize >= 8 && gridSize <= 240 ? gridSize : DEFAULT_GRID_SIZE;
  // Aspect-aware: when the caller supplies canvas dims (e.g. a 154×238 stocking
  // canvas), produce a NON-SQUARE grid at those dims instead of always square.
  // The frontend frames the returned grid by its own dims, so matching the
  // canvas aspect directly fixes the 27%-fill bug (square art scaled into a
  // narrow canvas leaves most cells outside the fitted bbox).
  const outW = target?.width && target.width >= 8 && target.width <= 300 ? target.width : size;
  const outH = target?.height && target.height >= 8 && target.height <= 300 ? target.height : size;
  // Small grids can't survive a 1-cell dark outline through lanczos+quantize;
  // used by both the subject-margin and the dark-outline preservation paths.
  const SMALL_OUTLINE_MAX_DIM = 60;
  // Margin band for FRAME canvases (owner 09-03 #3 + 09-11 — "teddy bear
  // STILL cut off"): prompting the model for margins is not enough — Gemini
  // draws edge-to-edge bleed. The band is applied AFTER posterization and
  // BEFORE DMC mapping, and it is SUBJECT-AWARE: it measures the subject's
  // true bounding box (excluding the light-fabric DMC entry) and, if the
  // subject reaches the band, scales it down about the canvas center so the
  // WHOLE subject fits inside the band instead of being amputated. White-pixel
  // cells merge into the existing light-fabric entry in pixelsToStitchGrid, so
  // DMC counts stay consistent and no new color appears. The band is
  // deterministic — a visible margin regardless of what the model drew.
  // Product shapes / TALL canvases (stocking/ornament/pillow, meant to fill
  // edge-to-edge) never get a band.
  const marginPx =
    opts?.margin === true && outW >= outH
      ? Math.max(2, Math.round(0.06 * Math.min(outW, outH)))
      : 0;

  // Step 0: Auto-crop the light background so the subject fills the grid
  // (recognizability fix — a small subject on a huge white field converts to
  // an unreadable pattern). Also boost saturation so colors separate cleanly.
  // NOTE (owner 09-11 "teddy bear STILL cut off"): on FRAME canvases we SKIP
  // this trim. The AI is prompted to leave ~5-10% margins and genuinely does
  // (fixture source bbox margins L11.6/R9.7/T8.1/B5.3%), but the auto-crop
  // trims those near-white margins away and the cover-resize then zooms the
  // subject to full-bleed — the blind band afterwards has nothing to spare and
  // amputates the subject ("cuts off the actual pattern of the bear"). The
  // margin path below is subject-aware and enforces the band deterministically,
  // so the trim is redundant and harmful there.
  let workingBuffer = imageBuffer;
  if (marginPx === 0) {
    // Small AI-generated product grids (ornament/pillow/bag charm ≤ 60 cells,
    // on the outlinePreserve path) SKIP the auto-trim (owner 09-11 17:57
    // "ears lost + hallucinated dark cap"): the model is prompted to fill most
    // of the circle and keeps intentional margins above the subject (e.g. the
    // ears sit ~6 rows below the top). The trim shaves those margins, pinches
    // the subject to the canvas top, and the outline-preservation pass then
    // fuses the ear/crown darks into a solid top cap (repro: orn3 source 1024²
    // → trim 734×796 → grid r0 becomes a solid 10-cell dark dome; without trim
    // the same source keeps blank rows 0-5 and two separate ear bumps). Uploads
    // and larger grids keep the recognizability zoom — only the AI small-grid
    // path (which already prompts for margins) is affected. Saturation boost is
    // still applied so colors separate exactly like the trimmed path.
    const skipTrimForSmallAI =
      opts?.outlinePreserve === true && Math.min(outW, outH) <= SMALL_OUTLINE_MAX_DIM;
    try {
      if (skipTrimForSmallAI) {
        workingBuffer = await sharp(imageBuffer)
          .modulate({ saturation: 1.4 })
          .toBuffer();
      } else {
        const meta = await sharp(imageBuffer).metadata();
        const trimmed = await sharp(imageBuffer)
          .trim({ background: [255, 255, 255], threshold: 40 })
          .modulate({ saturation: 1.4 })
          .toBuffer({ resolveWithObject: true });
        const ow = meta.width || 0;
        const oh = meta.height || 0;
        const tw = trimmed.info.width;
        const th = trimmed.info.height;
        // Keep the trim only if most of the image survives — a genuinely small
        // subject (e.g. a white bird on white) would be eaten by the trim.
        if (ow > 0 && oh > 0 && tw >= ow * 0.6 && th >= oh * 0.6) {
          workingBuffer = trimmed.data;
        }
      }
    } catch {
      // fall back to the untrimmed image
    }
  } else {
    try {
      // Non-frame path boosts saturation in the trim step; replicate it here
      // so frame canvases keep the same color-vibrancy pipeline.
      workingBuffer = await sharp(imageBuffer)
        .modulate({ saturation: 1.4 })
        .toBuffer();
    } catch {
      // fall back to the original image
    }
  }

  // Step 1: Resize the image to the target grid size using high-quality lanczos
  // downscaling — each stitch cell reflects the average of its source region,
  // preserving the subject's shape and hues (nearest-neighbor sampling caused
  // aliased, blocky patterns and dropped colors).
  // Step 2: Posterize to exactly maxColors flat colors via PNG palette quantization.
  //   This eliminates gradient artifacts and shadow-edge pixels that would otherwise
  //   map to random/wrong DMC threads (e.g. violet edge pixels on yellow petals).
  //   No dithering — every pixel is forced into one of maxColors solid regions.
  // Step 3: Extract raw pixels from the posterized image for DMC mapping.
  const posterizedPng = await sharp(workingBuffer)
    .resize(outW, outH, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.lanczos3,
    })
    .median(3) // stronger noise reduction before posterization
    .png({ palette: true, colours: maxColors, dither: 0 })
    .toBuffer();

  const { data, info } = await sharp(posterizedPng)
    .ensureAlpha() // add alpha channel — pixelsToStitchGrid expects RGBA
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Subject-aware margin band (owner 09-11 "teddy bear STILL cut off"): instead
  // of blindly blanking the outer ring (which ERASES part of a subject that
  // reaches the band — the old code amputated ~16% of the teddy), measure the
  // subject's true bounding box (excluding the light-fabric/background DMC
  // entry) and, when it would cross the band, scale it down about the canvas
  // center so the WHOLE subject fits inside [marginPx, W-1-marginPx] ×
  // [marginPx, H-1-marginPx], then repaint onto white. The final ring-blank is
  // then a pure normalization (it no longer erases any subject pixel; the
  // band's background cells merge into the existing light-fabric DMC entry, so
  // no new color appears and stitch counts stay consistent).
  const subjectAware = new Uint8Array(data);
  if (marginPx > 0) {
    // Background = the halo rule pixelsToStitchGrid merges into DMC White 520
    // (light + low-saturation colors) — NOT a naive "non-white" test, which
    // would count the near-white background halo as subject and hide the cut.
    const isLightFabric = (r: number, g: number, b: number): boolean => {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      return max >= 190 && (max - min) / max <= 0.2;
    };
    let fgTop = outH, fgBottom = -1, fgLeft = outW, fgRight = -1;
    for (let row = 0; row < outH; row++) {
      for (let col = 0; col < outW; col++) {
        const idx = (row * outW + col) * 4;
        if (data[idx + 3] === 0) continue; // transparent → background
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        if (isLightFabric(r, g, b)) continue; // background entry
        if (row < fgTop) fgTop = row;
        if (row > fgBottom) fgBottom = row;
        if (col < fgLeft) fgLeft = col;
        if (col > fgRight) fgRight = col;
      }
    }
    if (fgTop < outH) {
      const bboxW = fgRight - fgLeft + 1;
      const bboxH = fgBottom - fgTop + 1;
      const availW = Math.max(0, outW - 2 * marginPx);
      const availH = Math.max(0, outH - 2 * marginPx);
      const crossesBand =
        fgTop < marginPx ||
        fgBottom > outH - 1 - marginPx ||
        fgLeft < marginPx ||
        fgRight > outW - 1 - marginPx;
      if (crossesBand && availW > 0 && availH > 0) {
        // Subject reaches into the band: shrink the WHOLE subject (never
        // upscale) about the canvas center so it fits inside with a clean
        // margin on every side, then repaint onto white. Nearest-neighbor
        // keeps the subject's silhouette (no invented colors); interior
        // background holes are carried along.
        const scale = Math.min(1, availW / bboxW, availH / bboxH);
        const scaledW = Math.min(Math.round(bboxW * scale), availW);
        const scaledH = Math.min(Math.round(bboxH * scale), availH);
        const destLeft = Math.round((outW - scaledW) / 2);
        const destTop = Math.round((outH - scaledH) / 2);
        subjectAware.fill(255); // white canvas (light fabric)
        for (let dr = 0; dr < scaledH; dr++) {
          const srcRow = fgTop + Math.min(Math.floor((dr * bboxH) / scaledH), bboxH - 1);
          for (let dc = 0; dc < scaledW; dc++) {
            const srcCol = fgLeft + Math.min(Math.floor((dc * bboxW) / scaledW), bboxW - 1);
            const sIdx = (srcRow * outW + srcCol) * 4;
            const dIdx = ((destTop + dr) * outW + (destLeft + dc)) * 4;
            subjectAware[dIdx] = data[sIdx];
            subjectAware[dIdx + 1] = data[sIdx + 1];
            subjectAware[dIdx + 2] = data[sIdx + 2];
            subjectAware[dIdx + 3] = data[sIdx + 3];
          }
        }
      }
    }
    // Final safety: blank the outer marginPx ring. After the subject-aware
    // step the ring contains no subject pixels, so this only normalizes the
    // ring itself to pure white (light fabric).
    for (let row = 0; row < outH; row++) {
      for (let col = 0; col < outW; col++) {
        if (row < marginPx || row >= outH - marginPx || col < marginPx || col >= outW - marginPx) {
          const idx = (row * outW + col) * 4;
          subjectAware[idx] = 255;
          subjectAware[idx + 1] = 255;
          subjectAware[idx + 2] = 255;
          subjectAware[idx + 3] = 255;
        }
      }
    }
  }

  // Step 4: Delegate to the model-agnostic pixel→grid pipeline (non-square aware)
  const pattern = await pixelsToStitchGrid(subjectAware, outW, undefined, outH);

  // Step 5: Dark-outline preservation for small grids (owner 09-11 "ornament
  // collapsed to a solid block"). At ≤60 output cells a 1-cell dark outline /
  // small features (eyes, nose) are thinned by the lanczos downscale and
  // quantized into a grey-tan (measured on a synthetic flat teddy at 42×42:
  // ≈1-cell outline → 0 dark cells; the design reads as one tan block).
  // Compensate deterministically: re-sample a dark mask from the FULL-RES
  // working image with per-cell coverage and re-paint any cell whose source
  // block is majority-dark onto the final DMC grid (nearest dark DMC). Only
  // for small grids on product/non-margin paths — the margin band's
  // subject-aware scale would otherwise move the subject relative to the
  // mask, and large grids keep full detail already.
  if (
    opts?.outlinePreserve === true &&
    marginPx === 0 &&
    Math.min(outW, outH) <= SMALL_OUTLINE_MAX_DIM
  ) {
    let src: { data: Buffer; info: { width: number; height: number; channels: number } };
    try {
      src = await sharp(workingBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    } catch {
      return pattern; // outline pass is best-effort — never fail the conversion
    }
    const srcW = src.info.width;
    const srcH = src.info.height;
    const px = src.data;
    const ch = src.info.channels || 4;
    // Same geometry as sharp resize(fit: "cover", position: "centre") above.
    const scale = Math.max(outW / srcW, outH / srcH);
    const cropW = Math.max(1, Math.round(Math.min(srcW, outW / scale)));
    const cropH = Math.max(1, Math.round(Math.min(srcH, outH / scale)));
    const ox = Math.round((srcW - cropW) / 2);
    const oy = Math.round((srcH - cropH) / 2);

    // Per-output-cell dark coverage fraction (0..255).
    const darkMask = new Uint8Array(outW * outH);
    for (let r = 0; r < outH; r++) {
      const y0 = oy + Math.floor((r * cropH) / outH);
      const y1 = oy + Math.max(y0 + 1, Math.floor(((r + 1) * cropH) / outH));
      for (let c = 0; c < outW; c++) {
        const x0 = ox + Math.floor((c * cropW) / outW);
        const x1 = ox + Math.max(x0 + 1, Math.floor(((c + 1) * cropW) / outW));
        let darkPx = 0;
        let totalPx = 0;
        for (let sy = y0; sy < y1; sy++) {
          for (let sx = x0; sx < x1; sx++) {
            const idx = (sy * srcW + sx) * ch;
            totalPx++;
            if (Math.max(px[idx], px[idx + 1], px[idx + 2]) < 110) darkPx++;
          }
        }
        darkMask[r * outW + c] = totalPx > 0 ? Math.round((darkPx * 255) / totalPx) : 0;
      }
    }

    // Repaint majority-dark cells to the darkest DMC grey and fix counts.
    const darkDmc = closestDmcColor(64, 64, 64);
    const darkHex = rgbToHex(darkDmc.rgb[0], darkDmc.rgb[1], darkDmc.rgb[2]);
    const codeByHex = new Map<string, string>();
    for (const d of pattern.dmcColors) codeByHex.set(d.hex.toLowerCase(), d.code);
    const delta = new Map<string, number>();
    delta.set(darkDmc.code, 0);
    let repainted = 0;
    for (let r = 0; r < outH && r < pattern.grid.length; r++) {
      const row = pattern.grid[r];
      for (let c = 0; c < outW && c < row.length; c++) {
        if (darkMask[r * outW + c] < 128) continue; // >= 50% coverage
        const cell = row[c];
        const oldHex = (cell.color || "").toLowerCase();
        if (oldHex === darkHex.toLowerCase()) continue;
        const oldCode = codeByHex.get(oldHex);
        if (oldCode) delta.set(oldCode, (delta.get(oldCode) ?? 0) - 1);
        delta.set(darkDmc.code, (delta.get(darkDmc.code) ?? 0) + 1);
        cell.color = darkHex;
        cell.dmcCode = darkDmc.code;
        cell.dmcName = darkDmc.name;
        repainted++;
      }
    }
    if (repainted > 0) {
      for (const d of pattern.dmcColors) {
        const dl = delta.get(d.code);
        if (dl && dl !== 0) d.count = Math.max(0, d.count + dl);
      }
      // Make sure the dark entry exists even if it was absent before.
      if (!pattern.dmcColors.some(d => d.code === darkDmc.code)) {
        pattern.dmcColors.push({
          code: darkDmc.code,
          name: darkDmc.name,
          hex: darkHex,
          count: Math.max(0, delta.get(darkDmc.code) ?? 0),
        });
      }
      pattern.dmcColors.sort((a, b) => b.count - a.count);
      pattern.dmcColors.forEach((d, i) => {
        d.symbol = CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length];
      });
    }
  }

  return pattern;
}

/**
 * Re-process an existing grid at a different size using nearest-neighbor scaling.
 * Useful when a user wants to switch sizes without re-uploading the source image.
 * The grid is rendered as a pixel image at the original size, then re-sampled.
 *
 * @param grid - The existing stitch grid
 * @param newSize - Target grid size (50, 75, 100, 150, 200)
 * @param maxColors - Target number of colors (15-80, default 24)
 * @returns PatternResult
 */
export async function resizeStitchGrid(
  grid: StitchGrid,
  newSize: number,
  maxColors: number = 24,
): Promise<PatternResult> {
  const validSizes = AVAILABLE_GRID_SIZES as readonly number[];
  const size = newSize >= 8 && newSize <= 200 ? newSize : DEFAULT_GRID_SIZE;
  const oldSize = grid.length;

  // Render the existing grid as a raw RGBA image at its current size
  const pixelData = Buffer.alloc(oldSize * oldSize * 4);
  for (let row = 0; row < oldSize; row++) {
    for (let col = 0; col < oldSize; col++) {
      const idx = (row * oldSize + col) * 4;
      const cell = grid[row]?.[col];
      if (cell?.color) {
        const hex = cell.color.replace('#', '');
        pixelData[idx] = parseInt(hex.substring(0, 2), 16);
        pixelData[idx + 1] = parseInt(hex.substring(2, 4), 16);
        pixelData[idx + 2] = parseInt(hex.substring(4, 6), 16);
      } else {
        pixelData[idx] = 255;
        pixelData[idx + 1] = 255;
        pixelData[idx + 2] = 255;
      }
      pixelData[idx + 3] = 255;
    }
  }

  // Resize via sharp with nearest-neighbor to preserve hard edges
  const { data } = await sharp(pixelData, {
    raw: { width: oldSize, height: oldSize, channels: 4 },
  })
    .resize(size, size, {
      fit: "fill",
      kernel: sharp.kernel.nearest,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Delegate to the model-agnostic pixel→grid pipeline
  return pixelsToStitchGrid(new Uint8Array(data), size);
}