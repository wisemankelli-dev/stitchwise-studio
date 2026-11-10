/**
 * Pattern Library grant logic (fulfillment v2).
 *
 * When a buyer pays via the Stripe payment link, the lead records a
 * PatternPurchase row against the buyer's checkout email (via the admin
 * endpoint or the record-purchase script). The purchase is then materialized
 * into the buyer's account — an EmbroideryPattern in their Designer, or a
 * CollageProject in their Collage studio — the next time an account with that
 * email signs up or logs in.
 *
 * The recovered original grids live in the private grant asset loaded at boot
 * (see infrastructure/data/patternGrantData.ts — server-side only, never exposed
 * by the public GET /api/library/patterns endpoint and never committed).
 */
import type { PrismaClient } from "@prisma/client";
import type { StitchGrid, DmcUsage } from "./stitch/types";
import { serializeGrid, serializePalette } from "./stitch/patternDataModel";
import { closestDmcColor, hexToRgb } from "./stitch/dmcColors";
import {
  COLLAGE_GRANTS,
  getCollageGrant,
  getPatternGrants,
  grantKindOf,
} from "../infrastructure/data/patternGrantData";
import type { CollageRepo } from "../infrastructure/db/collageRepo";

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

/** Marker written into a granted collage's data JSON so a re-grant is detectable. */
export interface CollageGrantMarker {
  grantId: string;
  grantEmail: string;
}

function readGrantId(data: string | null | undefined): string | null {
  try {
    const parsed = JSON.parse(data || "{}");
    return typeof parsed?.grantId === "string" ? parsed.grantId : null;
  } catch {
    return null;
  }
}

/** Grant one grid pattern into the buyer's Designer. Returns true when it landed. */
async function grantGridPattern(
  prisma: PrismaClient,
  purchase: { patternId: string; email: string },
  userId: string,
): Promise<boolean> {
  const grant = getPatternGrants()[purchase.patternId];
  if (!grant) {
    console.error({ event: "pattern_grant_unknown", patternId: purchase.patternId, email: purchase.email });
    return false;
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
  return true;
}

/**
 * Grant one collage into the buyer's Collage studio.
 *
 * Idempotent: a buyer who already owns a project carrying this grant's id is not
 * given a second one (re-recording a sale after a successful grant must not
 * duplicate the project). `layers` must be non-empty — the studio wipes the
 * canvas when it loads a project with no layers — so a payload without layers is
 * skipped and the purchase stays pending for a later login.
 */
async function grantCollageProject(
  collageRepo: CollageRepo | undefined,
  purchase: { patternId: string; email: string },
  userId: string,
): Promise<boolean> {
  if (!collageRepo) {
    console.error({ event: "collage_grant_repo_missing", patternId: purchase.patternId, userId });
    return false;
  }
  const def = COLLAGE_GRANTS[purchase.patternId];
  const payload = getCollageGrant(purchase.patternId);
  if (!def || !payload || !Array.isArray(payload.layers) || payload.layers.length === 0) {
    console.error({ event: "collage_grant_payload_missing", patternId: purchase.patternId, userId });
    return false;
  }

  const existing = (await collageRepo.listProjectsByUser(userId)).find(
    (project) => readGrantId(project.data) === purchase.patternId,
  );
  if (existing) {
    console.log({
      event: "collage_grant_already_present",
      patternId: purchase.patternId,
      userId,
      projectId: existing.id,
    });
    return true;
  }

  const marker: CollageGrantMarker = { grantId: purchase.patternId, grantEmail: purchase.email };
  await collageRepo.createProject({
    name: def.name,
    data: JSON.stringify({ ...payload, ...marker }),
    width: 300,
    height: 300,
    userId,
  });
  return true;
}

/**
 * Materialize any pending purchases for a user's email into the buyer's studios:
 * grid patterns become EmbroideryPattern records in the Designer, collages become
 * CollageProject records in the Collage studio.
 *
 * Safe to call on every login/signup, on pattern list and on collage list — it is
 * a no-op when there are no pending purchases. Never throws (grant failures are
 * logged, not fatal to auth), and one bad grant never blocks the others.
 *
 * The purchase's `kind` is derived from the grant registries (`grantKindOf`), so
 * no database column is needed — a new column would be missing from every
 * restored database snapshot and would break every PatternPurchase query.
 */
export async function materializePendingPurchases(
  prisma: PrismaClient,
  email: string,
  userId: string,
  collageRepo?: CollageRepo,
): Promise<number> {
  try {
    const pending = await prisma.patternPurchase.findMany({
      where: { email: email.toLowerCase().trim(), granted: false },
    });
    if (pending.length === 0) return 0;
    let granted = 0;
    for (const purchase of pending) {
      try {
        const kind = grantKindOf(purchase.patternId);
        if (!kind) {
          console.error({
            event: "pattern_grant_unknown",
            patternId: purchase.patternId,
            email: purchase.email,
          });
          continue;
        }
        const landed =
          kind === "COLLAGE"
            ? await grantCollageProject(collageRepo, purchase, userId)
            : await grantGridPattern(prisma, purchase, userId);
        if (!landed) continue;
        await prisma.patternPurchase.update({
          where: { id: purchase.id },
          data: { granted: true },
        });
        granted++;
        console.log({
          event: "pattern_granted",
          kind,
          patternId: purchase.patternId,
          email: purchase.email,
          userId,
        });
      } catch (err) {
        console.error({
          event: "pattern_grant_item_error",
          patternId: purchase.patternId,
          error: String(err),
        });
      }
    }
    return granted;
  } catch (err) {
    console.error({ event: "pattern_grant_error", error: String(err) });
    return 0;
  }
}
