import { mkdir, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const backupPath = process.argv[2];
if (!backupPath) {
  console.error("usage: backup-database.ts <output.json>");
  process.exit(2);
}
if (!process.env.DATABASE_URL || !/^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL)) {
  throw new Error("DATABASE_URL must be a PostgreSQL connection string");
}

// Keep this list explicit: it makes the backup auditable and ensures every
// user-owned table is captured even when a model has no rows yet.
const tables = [
  "User",
  "ProjectInquiry",
  "Project",
  "MarketplaceListing",
  "ShowcasePhoto",
  "CollageProject",
  "QuiltBlockProject",
  "EmbroideryPattern",
  "PatternPurchase",
] as const;

const prisma = new PrismaClient();
try {
  await prisma.$connect();
  const rows: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const table of tables) {
    // A first publish may target a brand-new database before migrations run.
    // to_regclass lets the backup succeed with an explicit empty table instead
    // of failing on PostgreSQL's undefined-table error.
    const relationName = `"${table}"`;
    const relation = await prisma.$queryRaw<{ relation: string | null }[]>`SELECT to_regclass(${relationName}) AS relation`;
    const tableRows = relation[0]?.relation
      ? await prisma.$queryRawUnsafe<unknown[]>(`SELECT * FROM "${table}"`)
      : [];
    rows[table] = tableRows;
    counts[table] = tableRows.length;
  }
  const payload = {
    format: "stitchwise-postgres-json-backup-v1",
    createdAt: new Date().toISOString(),
    database: "postgresql",
    tables,
    counts,
    rows,
  };
  const replacer = (_key: string, value: unknown): unknown => {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "bigint") return value.toString();
    return value;
  };
  const output = JSON.stringify(payload, replacer) + "\n";
  const target = resolve(backupPath);
  await mkdir(dirname(target), { recursive: true });
  const temp = `${target}.tmp-${process.pid}`;
  await writeFile(temp, output, { encoding: "utf8", mode: 0o600 });
  await rename(temp, target);
  console.log(JSON.stringify({ backup: target, counts }));
} finally {
  await prisma.$disconnect();
}
