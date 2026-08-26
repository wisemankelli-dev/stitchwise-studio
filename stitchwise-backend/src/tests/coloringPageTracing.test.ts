import { describe, expect, it } from "@jest/globals";
import sharp from "sharp";
import { traceColoringPageIntoPieces } from "../infrastructure/services/coloringPageTracing";

async function makeLineArt(): Promise<Buffer> {
  const svg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="white" />
      <rect x="80" y="90" width="150" height="180" rx="16" fill="white" stroke="black" stroke-width="8" />
      <circle cx="360" cy="250" r="100" fill="white" stroke="black" stroke-width="8" />
      <circle cx="360" cy="250" r="18" fill="white" stroke="black" stroke-width="8" />
    </svg>
  `);
  return sharp(svg).png().toBuffer();
}

/** A large outlined region with many impractical specks and one real eye-sized feature. */
async function makeSpeckFixture(): Promise<Buffer> {
  const specks: string[] = [];
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 16; col++) {
      const cx = 60 + col * 25;
      const cy = 65 + row * 30;
      specks.push(`<circle cx="${cx}" cy="${cy}" r="3" fill="white" stroke="black" stroke-width="3" />`);
    }
  }
  const svg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="white" />
      <rect x="32" y="32" width="448" height="448" fill="white" stroke="black" stroke-width="8" />
      ${specks.join("\n      ")}
      <circle cx="430" cy="430" r="16" fill="white" stroke="black" stroke-width="4" />
    </svg>
  `);
  return sharp(svg).png().toBuffer();
}

/** 120 meaningful regions exercise the final cap without tiny-region merging. */
async function makePieceCapFixture(): Promise<Buffer> {
  const regions: string[] = [];
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 12; col++) {
      const cx = 60 + col * 36;
      const cy = 70 + row * 40;
      regions.push(`<circle cx="${cx}" cy="${cy}" r="8" fill="white" stroke="black" stroke-width="3" />`);
    }
  }
  const svg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="white" />
      <rect x="32" y="32" width="448" height="448" fill="white" stroke="black" stroke-width="8" />
      ${regions.join("\n      ")}
    </svg>
  `);
  return sharp(svg).png().toBuffer();
}

describe("coloring-page line tracing", () => {
  it("returns enclosed pieces, including an interior feature, without the border background", async () => {
    const result = await traceColoringPageIntoPieces(await makeLineArt());

    // Rectangle, circle interior, and the small enclosed circle are separate
    // white cells. The page background is reachable from the image border.
    expect(result.pieces).toHaveLength(3);
    expect(result.referenceImage).toMatch(/^data:image\/png;base64,/);
    for (const piece of result.pieces) {
      expect(piece.color).toBe("#f8f8f8");
      expect(piece.outline.length).toBeGreaterThanOrEqual(3);
      expect(piece.bounds.x).toBeGreaterThanOrEqual(0);
      expect(piece.bounds.y).toBeGreaterThanOrEqual(0);
      expect(piece.bounds.x + piece.bounds.width).toBeLessThanOrEqual(1);
      expect(piece.bounds.y + piece.bounds.height).toBeLessThanOrEqual(1);

      const png = Buffer.from(piece.image.split(",")[1], "base64");
      const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let opaque = 0;
      for (let i = 0; i < info.width * info.height; i++) {
        if (data[i * 4 + 3] > 0) {
          opaque++;
          expect(data[i * 4]).toBe(255);
          expect(data[i * 4 + 1]).toBe(255);
          expect(data[i * 4 + 2]).toBe(255);
        }
      }
      expect(opaque).toBeGreaterThanOrEqual(3);
    }
  });

  it("returns no pieces for a plain white page", async () => {
    const white = await sharp({
      create: { width: 128, height: 128, channels: 3, background: "white" },
    }).png().toBuffer();
    const result = await traceColoringPageIntoPieces(white);
    expect(result.pieces).toHaveLength(0);
  });

  it("returns no traced pieces for a full-color image so callers can use segmentation fallback", async () => {
    const color = await sharp({
      create: { width: 128, height: 128, channels: 3, background: { r: 230, g: 80, b: 40 } },
    }).png().toBuffer();
    const result = await traceColoringPageIntoPieces(color);
    expect(result.pieces).toHaveLength(0);
    expect(result.referenceImage).toMatch(/^data:image\/png;base64,/);
  });

  it("merges tiny enclosed specks into their surrounding shape but keeps a real eye-sized region", async () => {
    const result = await traceColoringPageIntoPieces(await makeSpeckFixture());

    // Before the merge floor this fixture produced 194 regions (one body,
    // 192 specks, and one eye). The cuttable floor reduces that to body + eye.
    expect(result.pieces).toHaveLength(2);
    const eye = result.pieces.find((piece) => piece.bounds.width < 0.1);
    expect(eye).toBeDefined();
    expect(eye!.bounds.width * eye!.bounds.height).toBeGreaterThan(0.001);
  });

  it("caps patterns at 100 pieces by merging the smallest neighboring regions", async () => {
    const result = await traceColoringPageIntoPieces(await makePieceCapFixture());
    expect(result.pieces.length).toBeLessThanOrEqual(100);
  });
});
