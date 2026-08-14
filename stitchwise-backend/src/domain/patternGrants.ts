/**
 * Pattern Library grant logic (fulfillment v2).
 *
 * When a buyer pays via the Stripe payment link, the lead records a
 * PatternPurchase row against the buyer's checkout email (via the admin
 * endpoint or the record-purchase script). The pattern is then materialized
 * into the buyer's account — an EmbroideryPattern in their Designer — the
 * next time an account with that email signs up or logs in.
 *
 * The recovered original grids live in PATTERN_GRANTS (server-side only;
 * never exposed by the public GET /api/library/patterns endpoint).
 */
import type { PrismaClient } from "@prisma/client";
import type { StitchGrid, DmcUsage } from "./stitch/types";
import { serializeGrid, serializePalette } from "./stitch/patternDataModel";
import { closestDmcColor, hexToRgb } from "./stitch/dmcColors";
import { PATTERN_GRANTS } from "../infrastructure/data/patternGrantData";

const CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * Expand a compact grant grid (rows of palette-index chars) into a full
 * StitchCell[][] with the original hex colors. Empty recovery artifacts were
 * mapped to #ffffff at generation time, so the result matches the previews.
 */
export function expandGrantGrid(
  rows: string[],
  palette: { color: string; count: number }[],
): StitchGrid {
  return rows.map((row) => {
    const cells = new Array(row.length);
    for (let c = 0; c < row.length; c++) {
      const idx = CHARS.indexOf(row[c]);
      if (idx < 0 || idx >= palette.length) {
        throw new Error(`patternGrants: invalid palette index "${row[c]}"`);
      }
      cells[c] = { color: palette[idx].color };
    }
    return cells;
  });
}

/**
 * Build the DmcUsage palette for a granted pattern: exact per-color stitch
 * counts (derived from the grid) + nearest DMC thread code/name for the key.
 * Keeps the original hex so the chart renders exactly like the previews.
 */
export function grantPaletteToDmc(
  grid: StitchGrid,
): DmcUsage[] {
  const counts = new Map<string, number>();
  for (const row of grid) {
    for (const cell of row) {
      const color = cell.color.toLowerCase();
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
  }
  const usage: DmcUsage[] = [];
  for (const [hex, count] of counts) {
    const [r, g, b] = hexToRgb(hex);
    const dmc = closestDmcColor(r, g, b);
    usage.push({ code: dmc.code, name: dmc.name, hex, count });
  }
  usage.sort((a, b) => b.count - a.count);
  return usage;
}

/**
 * Materialize any pending purchases for a user's email into EmbroideryPattern
 * records. Safe to call on every login/signup and on pattern list — it is a
 * no-op when there are no pending purchases. Never throws (grant failures are
 * logged, not fatal to auth).
 */
export async function materializePendingPurchases(
  prisma: PrismaClient,
  email: string,
  userId: string,
): Promise<number> {
  try {
    const pending = await prisma.patternPurchase.findMany({
      where: { email: email.toLowerCase().trim(), granted: false },
    });
    if (pending.length === 0) return 0;
    let granted = 0;
    for (const purchase of pending) {
      const grant = PATTERN_GRANTS[purchase.patternId];
      if (!grant) {
        console.error({
          event: "pattern_grant_unknown",
          patternId: purchase.patternId,
          email: purchase.email,
        });
        continue;
      }
      const grid = expandGrantGrid(grant.rows, grant.palette);
      const palette = grantPaletteToDmc(grid);
      const stitchCount = grid.reduce((s, row) => s + row.length, 0);
      await prisma.embroideryPattern.create({
        data: {
          name: grant.name,
          userId,
          gridData: serializeGrid(grid),
          gridSize: grant.gridSize,
          dmcPalette: serializePalette(palette),
          stitchCount,
          previewUrl: grant.previewUrl || null,
          prompt: "Purchased from the StitchWise Pattern Library",
          visibility: "PRIVATE",
        },
      });
      await prisma.patternPurchase.update({
        where: { id: purchase.id },
        data: { granted: true },
      });
      granted++;
      console.log({
        event: "pattern_granted",
        patternId: purchase.patternId,
        email: purchase.email,
        userId,
      });
    }
    return granted;
  } catch (err) {
    console.error({ event: "pattern_grant_error", error: String(err) });
    return 0;
  }
}
