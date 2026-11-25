import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";

/**
 * A paid Stripe subscription whose checkout email has no account yet.
 *
 * The buyer may pay with one email and log in (or sign up) with another, or
 * create the account minutes after paying. Holding the purchase here means the
 * webhook can answer 200 — Stripe stops retrying, the money is recorded — and
 * the tier is applied the first time an account with that email signs up or
 * logs in.
 *
 * The table is created on first use rather than through a migration: the live
 * database is restored from a seed file on every publish, so a migration that
 * only exists in git would be missing in production. `CREATE TABLE IF NOT
 * EXISTS` is self-healing on a fresh seed and harmless on an existing one (the
 * same reason StripeWebhookEvent is created this way).
 */
const TABLE = "PendingSubscriptionPurchase";

let tableReady: Promise<unknown> | null = null;

export function ensurePendingSubscriptionTable(prisma: PrismaClient): Promise<unknown> {
  if (!tableReady) {
    tableReady = prisma
      .$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "${TABLE}" (
           "id" TEXT NOT NULL PRIMARY KEY,
           "email" TEXT NOT NULL,
           "tier" TEXT NOT NULL,
           "customerId" TEXT NOT NULL,
           "subscriptionId" TEXT NOT NULL,
           "checkoutSessionId" TEXT,
           "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
           "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`,
      )
      .then(() =>
        prisma.$executeRawUnsafe(
          `CREATE UNIQUE INDEX IF NOT EXISTS "${TABLE}_email_key" ON "${TABLE}" ("email")`,
        ),
      )
      .catch((err) => {
        tableReady = null; // retry on the next call
        throw err;
      });
  }
  return tableReady;
}

/** Test hook: forget the cached "table exists" promise (one DB per test run). */
export function resetPendingSubscriptionTableCache(): void {
  tableReady = null;
}

export type PendingSubscription = {
  email: string;
  tier: string;
  customerId: string;
  subscriptionId: string;
  checkoutSessionId: string | null;
};

export type PaidCheckout = {
  email: string;
  tier: string;
  customerId: string;
  subscriptionId: string;
  checkoutSessionId?: string | null;
};

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Records a paid checkout that could not be applied yet. One row per email —
 * paying twice with the same email keeps the most recent subscription.
 */
export async function recordPendingSubscription(
  prisma: PrismaClient,
  purchase: PaidCheckout,
): Promise<void> {
  await ensurePendingSubscriptionTable(prisma);
  const email = normalizeEmail(purchase.email);
  if (!email) throw new Error("pending subscription needs an email");

  await prisma.$executeRaw`
    INSERT INTO "PendingSubscriptionPurchase"
      ("id", "email", "tier", "customerId", "subscriptionId", "checkoutSessionId", "createdAt", "updatedAt")
    VALUES
      (${randomUUID()}, ${email}, ${purchase.tier}, ${purchase.customerId}, ${purchase.subscriptionId},
       ${purchase.checkoutSessionId ?? null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT("email") DO UPDATE SET
      "tier" = excluded."tier",
      "customerId" = excluded."customerId",
      "subscriptionId" = excluded."subscriptionId",
      "checkoutSessionId" = excluded."checkoutSessionId",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}

export async function findPendingSubscription(
  prisma: PrismaClient,
  email: string,
): Promise<PendingSubscription | null> {
  await ensurePendingSubscriptionTable(prisma);
  const rows = await prisma.$queryRaw<PendingSubscription[]>`
    SELECT "email", "tier", "customerId", "subscriptionId", "checkoutSessionId"
    FROM "PendingSubscriptionPurchase"
    WHERE lower("email") = ${normalizeEmail(email)}
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return (
    e?.code === "P2002" ||
    (typeof e?.message === "string" && /UNIQUE constraint failed/i.test(e.message))
  );
}

/**
 * Applies a held purchase to the account with that email, if there is one, and
 * clears the hold. Returns the tier the account is now on, or null when there
 * was nothing to apply (no hold, no account) or it could not be applied.
 *
 * Never throws: a failure here must not break signup or login.
 */
export async function applyPendingSubscription(
  prisma: PrismaClient,
  email: string,
): Promise<{ tier: string; customerId: string; subscriptionId: string } | null> {
  try {
    const pending = await findPendingSubscription(prisma, email);
    if (!pending) return null;

    // Case-insensitive on purpose: signup does not lowercase the address, and a
    // buyer may type the same address with different capitalisation.
    const match = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "User" WHERE lower("email") = ${normalizeEmail(email)} LIMIT 1
    `;
    const userId = match[0]?.id;
    if (!userId) return null;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    if (user.tier !== pending.tier || user.stripeSubscriptionId !== pending.subscriptionId) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            tier: pending.tier,
            stripeCustomerId: pending.customerId,
            stripeSubscriptionId: pending.subscriptionId,
          },
        });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // The Stripe customer already belongs to another account: leave the hold
        // in place so a human can sort it out rather than silently dropping it.
        console.error({
          event: "pending_subscription_customer_conflict",
          email: pending.email,
          customerId: pending.customerId,
          userId: user.id,
        });
        return null;
      }
    }

    await prisma.$executeRaw`
      DELETE FROM "PendingSubscriptionPurchase" WHERE "email" = ${pending.email}
    `;

    console.error({
      event: "pending_subscription_applied",
      userId: user.id,
      email: pending.email,
      tier: pending.tier,
      subscriptionId: pending.subscriptionId,
      previousTier: user.tier,
    });

    return {
      tier: pending.tier,
      customerId: pending.customerId,
      subscriptionId: pending.subscriptionId,
    };
  } catch (err) {
    console.error({ event: "pending_subscription_apply_failed", email, error: String(err) });
    return null;
  }
}
