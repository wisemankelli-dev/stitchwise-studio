/**
 * Regression test for collage "color blocking" segmentation.
 *
 * Owner report (08-18): "Just tried collage again and it is not cutting pattern
 * correctly yet. Pattern should cut color blocking."
 *
 * The similar-color merge (mergeSimilarColors) had a 30-piece floor and was
 * skipped for any image producing ≤30 regions — the common case — so a solid
 * color area kept its k-means over-split fragments and 1-2px boundary slivers
 * as separate pieces. Each distinct color region must come out as ONE piece.
 */
import { describe, it, expect } from "@jest/globals";
import sharp from "sharp";
import { segmentImageIntoPieces } from "../infrastructure/services/collagePieceSegmentation";

/** White background with 4 distinct solid color blocks (blue band, red band,
 *  green square, amber circle). */
function makeColorBlockImage(W: number, H: number): Uint8Array {
  const px = new Uint8Array(W * H * 4);
  const set = (x: number, y: number, r: number, g: number, b: number) => {
    const i = (y * W + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, 255, 255, 255);
  for (let y = 0; y < H; y++) for (let x = 40; x < 160; x++) set(x, y, 21, 101, 192);   // blue #1565c0
  for (let y = 0; y < H; y++) for (let x = 352; x < 472; x++) set(x, y, 198, 40, 40);   // red #c62828
  for (let y = 80; y < 200; y++) for (let x = 200; x < 300; x++) set(x, y, 46, 125, 50); // green #2e7d32
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (Math.hypot(x - 250, y - 340) <= 90) set(x, y, 255, 193, 7); // amber #ffc107 circle
  }
  return px;
}

describe("Collage Piece Segmentation — color blocking", () => {
  it("cuts each distinct solid color into exactly ONE piece (no fragments/slivers)", async () => {
    const W = 512, H = 512;
    const px = makeColorBlockImage(W, H);
    const png = await sharp(Buffer.from(px), { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();

    const res = await segmentImageIntoPieces(png);

    // 4 distinct color regions → 4 pieces (blue, red, green, amber).
    expect(res.pieces.length).toBe(4);

    const colors = res.pieces.map((p) => p.color);
    // Every piece is one of the four solid-block colors (avg color of merged region).
    expect(colors.some((c) => c === "#1565c0")).toBe(true); // blue
    expect(colors.some((c) => c === "#c62828")).toBe(true); // red
    expect(colors.some((c) => c === "#2e7d32")).toBe(true); // green
    expect(colors.some((c) => c === "#ffc108")).toBe(true); // amber (avg incl. anti-aliased px)

    // No degenerate 1-2px slivers: every piece should cover a meaningful area.
    for (const p of res.pieces) {
      expect(p.bounds.width).toBeGreaterThan(0.05);
      expect(p.bounds.height).toBeGreaterThan(0.05);
    }
  });
});
