import type { StitchGrid } from "../../domain/stitch/types";
import { getGridDimensions } from "../../domain/stitch/stitchGrid";
import type { DesignPathInput } from "../../domain/stitchEngine";

interface ColorGroup {
  hex: string;
  rgb: [number, number, number];
  pixels: Array<{ row: number; col: number }>;
}

/**
 * Converts a pixel StitchGrid into embroidery DesignPathInput[] suitable
 * for the Python stitch service. Pixels are grouped by color, and each
 * group becomes a set of horizontal running-stitch segments.
 */
export function gridToDesignPaths(
  grid: StitchGrid,
  stitchDensity: number = 4,
): { paths: DesignPathInput[]; totalStitches: number } {
  const { width, height } = getGridDimensions(grid);

  // Group pixels by hex color
  const groups = new Map<string, ColorGroup>();
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = grid[r][c];
      if (!cell.color || cell.color === "#ffffff" || cell.color === "#fff") continue;

      let group = groups.get(cell.color);
      if (!group) {
        group = {
          hex: cell.color,
          rgb: hexToRgb(cell.color),
          pixels: [],
        };
        groups.set(cell.color, group);
      }
      group.pixels.push({ row: r, col: c });
    }
  }

  // Scale: each pixel = 2mm × 2mm at given density
  const pixelSpacing = 2.0; // mm per pixel
  const totalStitches = Array.from(groups.values()).reduce(
    (sum, g) => sum + g.pixels.length, 0,
  );

  // Convert each color group to design paths
  const paths: DesignPathInput[] = [];

  for (const group of groups.values()) {
    // Sort pixels row-major for efficient stitching
    group.pixels.sort((a, b) => a.row - b.row || a.col - b.col);

    // Build horizontal running stitch segments per row
    const segments: Array<[number, number, string]> = [];
    const rowMap = new Map<number, number[]>();

    for (const p of group.pixels) {
      const row = rowMap.get(p.row) || [];
      row.push(p.col);
      rowMap.set(p.row, row);
    }

    for (const [row, cols] of rowMap) {
      cols.sort((a, b) => a - b);

      // Group consecutive pixels into runs
      let runStart = cols[0];
      let runEnd = cols[0];

      for (let i = 1; i < cols.length; i++) {
        if (cols[i] === runEnd + 1) {
          runEnd = cols[i];
        } else {
          // Emit run segment
          const x1 = runStart * pixelSpacing;
          const x2 = (runEnd + 1) * pixelSpacing;
          const y = row * pixelSpacing;

          if (segments.length === 0) {
            segments.push([x1, y, "M"]);
          } else {
            segments.push([x1, y, "M"]);
          }
          segments.push([x2, y, "L"]);

          runStart = cols[i];
          runEnd = cols[i];
        }
      }

      // Emit final run in this row
      const x1 = runStart * pixelSpacing;
      const x2 = (runEnd + 1) * pixelSpacing;
      const y = row * pixelSpacing;

      if (segments.length === 0) {
        segments.push([x1, y, "M"]);
      } else {
        segments.push([x1, y, "M"]);
      }
      segments.push([x2, y, "L"]);
    }

    if (segments.length > 0) {
      paths.push({
        segments,
        color: group.rgb,
        stitchType: "running",
      });
    }
  }

  return { paths, totalStitches };
}

/** Convert hex color string to [r, g, b] tuple (0-255). */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}
