/**
 * Seed script for StitchWise Studio.
 *
 * Populates the database with sample designs for the Featured Gallery
 * and a demo user for development.
 */
import { PrismaClient } from "@prisma/client";
import { v4 as uuid } from "uuid";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ── Create demo admin user ──────────────────────────────────────────────
  const adminId = uuid();
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@stitchwise.dev" },
    update: {},
    create: {
      id: adminId,
      email: "admin@stitchwise.dev",
      name: "StitchWise Admin",
      passwordHash,
      tier: "STUDIO",
    },
  });
  console.log(`  ✓ Admin user: ${admin.email} (${admin.tier})`);

  // ── Create demo hobbyist user ──────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: "demo@stitchwise.dev" },
    update: {},
    create: {
      email: "demo@stitchwise.dev",
      name: "Demo User",
      passwordHash,
      tier: "HOBBYIST",
    },
  });
  console.log("  ✓ Demo user: demo@stitchwise.dev (HOBBYIST)");

  // ── Create sample designs (visibility: SAMPLE) ─────────────────────────
  const sampleDesigns = [
    {
      name: "Floral Bouquet",
      data: JSON.stringify({
        version: "1.0",
        stitchType: "running",
        stitchDensity: 4,
        paths: [
          { segments: [[0, 0, "M"], [10, -20, "C"], [20, 0, "C"], [10, 20, "C"], [0, 0, "C"]], color: [220, 50, 80], type: "running" },
          { segments: [[5, -5, "M"], [15, -15, "C"], [18, 0, "C"]], color: [50, 180, 80], type: "running" },
          { segments: [[5, 5, "M"], [15, 15, "C"], [18, 0, "C"]], color: [50, 180, 80], type: "running" },
        ],
        colors: [{ rgb: [220, 50, 80], name: "Crimson" }, { rgb: [50, 180, 80], name: "Emerald" }],
        description: "A delicate floral bouquet pattern with running stitch details.",
      }),
    },
    {
      name: "Geometric Mandala",
      data: JSON.stringify({
        version: "1.0",
        stitchType: "fill",
        stitchDensity: 6,
        paths: [
          { segments: [[0, -30, "M"], [26, -15, "L"], [26, 15, "L"], [0, 30, "L"], [-26, 15, "L"], [-26, -15, "L"], [0, -30, "Z"]], color: [80, 60, 180], type: "fill" },
          { segments: [[0, -15, "M"], [13, -7.5, "L"], [13, 7.5, "L"], [0, 15, "L"], [-13, 7.5, "L"], [-13, -7.5, "L"], [0, -15, "Z"]], color: [220, 180, 50], type: "fill" },
          { segments: [[0, 0, "M"], [0, 0, "L"]], color: [255, 255, 255], type: "running" },
        ],
        colors: [{ rgb: [80, 60, 180], name: "Indigo" }, { rgb: [220, 180, 50], name: "Gold" }],
        description: "A concentric mandala pattern using fill stitches for bold color blocks.",
      }),
    },
    {
      name: "Satin Butterfly",
      data: JSON.stringify({
        version: "1.0",
        stitchType: "satin",
        stitchDensity: 8,
        paths: [
          {
            segments: [[0, 0, "M"], [15, -10, "C"], [30, -5, "C"], [25, 5, "C"], [15, 3, "C"], [0, 0, "Z"]],
            color: [255, 140, 60],
            type: "satin",
            rails: [
              [[0, 0, "M"], [15, -10, "C"], [30, -5, "C"]],
              [[0, 0, "M"], [15, 3, "C"], [25, 5, "C"]],
            ],
            underlay: true,
          },
          {
            segments: [[0, 0, "M"], [-15, -10, "C"], [-30, -5, "C"], [-25, 5, "C"], [-15, 3, "C"], [0, 0, "Z"]],
            color: [255, 100, 100],
            type: "satin",
            rails: [
              [[0, 0, "M"], [-15, -10, "C"], [-30, -5, "C"]],
              [[0, 0, "M"], [-15, 3, "C"], [-25, 5, "C"]],
            ],
            underlay: true,
          },
        ],
        colors: [{ rgb: [255, 140, 60], name: "Tangerine" }, { rgb: [255, 100, 100], name: "Coral" }],
        description: "A butterfly wing pattern using satin stitch auto-fill with underlay.",
      }),
    },
    {
      name: "Celtic Knot Border",
      data: JSON.stringify({
        version: "1.0",
        stitchType: "running",
        stitchDensity: 5,
        paths: [
          { segments: [[0, 0, "M"], [5, 5, "L"], [10, 0, "L"], [15, -5, "L"], [20, 0, "L"], [15, 5, "L"], [10, 0, "L"], [5, -5, "L"], [0, 0, "Z"]], color: [30, 100, 180], type: "running" },
          { segments: [[2, 2, "M"], [7, -3, "L"], [12, 2, "L"], [17, -3, "L"]], color: [30, 100, 180], type: "running" },
        ],
        colors: [{ rgb: [30, 100, 180], name: "Ocean Blue" }],
        description: "An interlocking Celtic knot border pattern for edge decorations.",
      }),
    },
    {
      name: "Abstract Waves",
      data: JSON.stringify({
        version: "1.0",
        stitchType: "fill",
        stitchDensity: 4,
        paths: [
          { segments: [[0, 10, "M"], [10, -5, "C"], [20, 25, "C"], [30, 10, "C"], [40, 25, "C"], [50, 10, "L"]], color: [60, 180, 200], type: "fill" },
          { segments: [[0, 20, "M"], [10, 5, "C"], [20, 35, "C"], [30, 20, "C"], [40, 35, "C"], [50, 20, "L"]], color: [60, 160, 220], type: "fill" },
        ],
        colors: [{ rgb: [60, 180, 200], name: "Teal" }, { rgb: [60, 160, 220], name: "Sky Blue" }],
        description: "Flowing wave pattern with overlapping fill stitches.",
      }),
    },
  ];

  for (const design of sampleDesigns) {
    const existing = await prisma.project.findFirst({
      where: { name: design.name, visibility: "SAMPLE" },
    });
    if (!existing) {
      await prisma.project.create({
        data: {
          name: design.name,
          data: design.data,
          userId: admin.id,
          visibility: "SAMPLE",
        },
      });
      console.log(`  ✓ Sample design: ${design.name}`);
    } else {
      console.log(`  → Sample design already exists: ${design.name}`);
    }
  }

  console.log("\nSeeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });