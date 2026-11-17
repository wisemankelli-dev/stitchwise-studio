import { Router, type Request, type Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../middleware/auth";
import {
  createCheckoutSession,
  createPortalSession,
  constructWebhookEvent,
  extractCheckoutData,
} from "../services/stripeClient";

// ─── Webhook configuration ───────────────────────────────────────────────
/**
 * Where Stripe delivers events. Configurable because the endpoint Stripe is
 * pointed at is an owner setting, not a code constant: set STRIPE_WEBHOOK_PATH
 * (a path or a full URL) and app.ts mounts both the raw-body parser and this
 * router on it. Default keeps the historical path.
 */
export const DEFAULT_WEBHOOK_PATH = "/api/payments/webhook";

export function resolveWebhookPath(): string {
  const raw = (process.env.STRIPE_WEBHOOK_PATH ?? "").trim();
  if (!raw) return DEFAULT_WEBHOOK_PATH;
  // Accept a full URL as well as a bare path (e.g. the URL registered in the
  // Stripe dashboard) and reduce it to its path component.
  let path = raw;
  try {
    if (/^https?:\/\//i.test(raw)) path = new URL(raw).pathname;
  } catch {
    path = DEFAULT_WEBHOOK_PATH;
  }
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

// These mirror the error codes thrown by services/stripeClient; kept as
// literals so a mocked stripe client in tests can never make a comparison
// accidentally true against `undefined`.
const CODE_SECRET_MISSING = "WEBHOOK_SECRET_MISSING";
const CODE_SIGNATURE_MISSING = "WEBHOOK_SIGNATURE_MISSING";

// ─── Idempotency store ───────────────────────────────────────────────────
/**
 * One row per processed Stripe event id, so a retried or replayed delivery is
 * acknowledged without being applied twice (a replay of an old
 * checkout.session.completed must never re-upgrade a cancelled subscriber).
 *
 * The table is created on first use rather than through a migration: the live
 * database is restored from a seed file on every publish, so a migration that
 * only exists in git would be missing in production. `CREATE TABLE IF NOT
 * EXISTS` is self-healing on a fresh seed and harmless on an existing one.
 */
const WEBHOOK_EVENT_TABLE = "StripeWebhookEvent";
let webhookTableReady: Promise<unknown> | null = null;

function ensureWebhookEventTable(prisma: PrismaClient): Promise<unknown> {
  if (!webhookTableReady) {
    webhookTableReady = prisma
      .$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "${WEBHOOK_EVENT_TABLE}" (
           "id" TEXT NOT NULL PRIMARY KEY,
           "type" TEXT NOT NULL,
           "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`,
      )
      .catch((err) => {
        webhookTableReady = null; // retry on the next delivery
        throw err;
      });
  }
  return webhookTableReady;
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return (
    e?.code === "P2002" ||
    typeof e?.message === "string" && /UNIQUE constraint failed/i.test(e.message)
  );
}

/** Claims an event id. Returns false when it was already processed. */
async function claimEvent(
  prisma: PrismaClient,
  eventId: string,
  type: string,
): Promise<boolean> {
  await ensureWebhookEventTable(prisma);
  try {
    await prisma.$executeRaw`INSERT INTO "StripeWebhookEvent" ("id", "type") VALUES (${eventId}, ${type})`;
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) return false;
    throw err;
  }
}

/** Releases a claim so a retry can process the event after a failure. */
async function releaseClaim(prisma: PrismaClient, eventId: string): Promise<void> {
  try {
    await prisma.$executeRaw`DELETE FROM "StripeWebhookEvent" WHERE "id" = ${eventId}`;
  } catch {
    // best effort — a stuck claim only costs one lost retry
  }
}

type WebhookOutcome = {
  status: number;
  body: Record<string, unknown>;
};

async function handleCheckoutCompleted(
  prisma: PrismaClient,
  session: any,
): Promise<WebhookOutcome> {
  const data = extractCheckoutData(session);

  if (!data) {
    console.error({
      event: "webhook_missing_data",
      sessionId: session?.id,
      hasTier: Boolean(session?.metadata?.tier),
    });
    // Nothing to apply and nothing a retry could fix.
    return { status: 200, body: { received: true } };
  }

  const user = await prisma.user.findUnique({ where: { email: data.email } });

  if (!user) {
    console.error({
      event: "webhook_user_not_found",
      email: data.email,
      subscriptionId: data.subscriptionId,
    });
    // 500 so Stripe retries: the buyer may still be creating the account with
    // the email they paid with. This is the one failure worth retrying.
    return { status: 500, body: { error: "No account for the paid email yet" } };
  }

  if (user.tier === data.tier && user.stripeSubscriptionId === data.subscriptionId) {
    console.error({
      event: "subscription_already_applied",
      email: data.email,
      tier: data.tier,
      subscriptionId: data.subscriptionId,
    });
    return { status: 200, body: { received: true } };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        tier: data.tier,
        stripeCustomerId: data.customerId,
        stripeSubscriptionId: data.subscriptionId,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      console.error({
        event: "stripe_customer_conflict",
        email: data.email,
        customerId: data.customerId,
        error: String(err),
      });
      return { status: 200, body: { received: true } };
    }
    throw err;
  }

  console.error({
    event: "subscription_created",
    userId: user.id,
    email: data.email,
    tier: data.tier,
    subscriptionId: data.subscriptionId,
    previousTier: user.tier,
  });
  return { status: 200, body: { received: true } };
}

async function handleSubscriptionDeleted(
  prisma: PrismaClient,
  subscription: any,
): Promise<WebhookOutcome> {
  const customer = subscription?.customer;
  const customerId = typeof customer === "string" ? customer : customer?.id;
  const subscriptionId =
    typeof subscription?.id === "string" ? subscription.id : undefined;

  if (!customerId) {
    console.error({ event: "webhook_missing_customer", subscriptionId });
    return { status: 200, body: { received: true } };
  }

  // Match on customer id, or on the subscription id when the customer was not
  // stored (the older checkout path never wrote stripeCustomerId).
  const user = await prisma.user.findFirst({
    where: subscriptionId
      ? { OR: [{ stripeCustomerId: customerId }, { stripeSubscriptionId: subscriptionId }] }
      : { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error({ event: "subscription_cancel_unknown_customer", customerId, subscriptionId });
    return { status: 200, body: { received: true } };
  }

  if (user.tier === "HOBBYIST" && !user.stripeSubscriptionId) {
    console.error({ event: "subscription_already_downgraded", userId: user.id });
    return { status: 200, body: { received: true } };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { tier: "HOBBYIST", stripeSubscriptionId: null },
  });

  console.error({
    event: "subscription_cancelled",
    userId: user.id,
    email: user.email,
    subscriptionId,
    previousTier: user.tier,
  });
  return { status: 200, body: { received: true } };
}

/**
 * POST <webhook path>
 * Stripe subscription lifecycle endpoint.
 *
 * - checkout.session.completed  → put the paying email on the paid tier
 * - customer.subscription.deleted → back to HOBBYIST
 *
 * Mounted on its own (see app.ts) so it receives the raw request body — Stripe's
 * signature is computed over the exact bytes sent, so a JSON-parsed body can
 * never verify. Responses are chosen for Stripe's retry rules: 4xx = never
 * retry, 5xx = retry later.
 */
export function createStripeWebhookRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    const signatureHeader = req.headers["stripe-signature"];
    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;

    if (!signature) {
      console.error({ event: "webhook_missing_signature" });
      res.status(400).json({ error: "Missing Stripe signature header" });
      return;
    }

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : typeof req.body === "string"
        ? req.body
        : null;

    if (!rawBody) {
      console.error({ event: "webhook_body_not_raw", contentType: req.headers["content-type"] });
      res.status(400).json({ error: "Webhook body must be raw (not parsed JSON)" });
      return;
    }

    let event: { id?: string; type: string; data: { object: unknown } };
    try {
      event = constructWebhookEvent(rawBody, signature);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === CODE_SECRET_MISSING) {
        console.error({ event: "webhook_secret_missing" });
        res.status(503).json({ error: "Webhook signing secret is not configured" });
        return;
      }
      if (code === CODE_SIGNATURE_MISSING) {
        console.error({ event: "webhook_missing_signature" });
        res.status(400).json({ error: "Missing Stripe signature header" });
        return;
      }
      console.error({ event: "webhook_signature_rejected", error: String(err) });
      res.status(400).json({ error: "Webhook signature verification failed" });
      return;
    }

    const eventId = typeof event?.id === "string" ? event.id : null;

    try {
      if (eventId) {
        const claimed = await claimEvent(prisma, eventId, event.type);
        if (!claimed) {
          console.error({ event: "webhook_duplicate", eventId, type: event.type });
          res.status(200).json({ received: true, duplicate: true });
          return;
        }
      }

      let outcome: WebhookOutcome;
      switch (event.type) {
        case "checkout.session.completed":
          outcome = await handleCheckoutCompleted(prisma, event.data.object);
          break;
        case "customer.subscription.deleted":
          outcome = await handleSubscriptionDeleted(prisma, event.data.object);
          break;
        default:
          console.error({ event: "webhook_unhandled", type: event.type });
          outcome = { status: 200, body: { received: true } };
      }

      // A retryable failure gives the claim back so Stripe's retry can apply it.
      if (outcome.status >= 500 && eventId) {
        await releaseClaim(prisma, eventId);
      }

      res.status(outcome.status).json(outcome.body);
    } catch (err) {
      console.error({ event: "webhook_processing_failed", eventId, error: String(err) });
      if (eventId) await releaseClaim(prisma, eventId);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  return router;
}

export function createPaymentRouter(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * POST /api/payments/create-checkout-session
   * Generates a Stripe Checkout link for upgrading a user's tier.
   *
   * Body: { tier: "PRO" | "STUDIO" }
   * Response: { url: "https://checkout.stripe.com/..." }
   */
  router.post(
    "/payments/create-checkout-session",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
        const { tier: requestedTier } = req.body as { tier?: string };
        const tier = requestedTier === "Pro Crafter" ? "PRO"
          : requestedTier === "Design Studio" ? "STUDIO"
          : requestedTier;

        if (!tier || !["PRO", "STUDIO"].includes(tier)) {
          res.status(400).json({ error: "Invalid tier. Must be 'PRO', 'STUDIO', 'Pro Crafter', or 'Design Studio'" });
          return;
        }

        // Fetch the full user record for email
        const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
        if (!dbUser) {
          res.status(404).json({ error: "User not found" });
          return;
        }

        if (dbUser.tier === tier) {
          res.status(409).json({ error: `User is already on the ${tier} plan` });
          return;
        }

        const baseUrl = process.env.BASE_URL || "https://stitchwisestudio.com";
        const successUrl = `${baseUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${baseUrl}/payments/cancel`;

        const checkoutUrl = await createCheckoutSession(
          dbUser.email,
          tier as "PRO" | "STUDIO",
          successUrl,
          cancelUrl,
        );

        res.json({ url: checkoutUrl });
      } catch (err) {
        console.error({ event: "create_checkout_error", error: String(err) });
        res.status(500).json({ error: "Failed to create checkout session" });
      }
    },
  );

  /**
   * POST /api/payments/create-portal-session
   * Creates a Stripe Billing Portal session for the authenticated user.
   */
  router.post(
    "/payments/create-portal-session",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
        const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
        if (!dbUser) {
          res.status(404).json({ error: "User not found" });
          return;
        }
        if (!dbUser.stripeCustomerId) {
          res.status(400).json({ error: "No Stripe customer found for this user" });
          return;
        }
        const baseUrl = process.env.BASE_URL || "https://stitchwisestudio.com";
        const returnUrl = req.body?.returnUrl || `${baseUrl}/pricing`;
        const url = await createPortalSession(dbUser.stripeCustomerId, returnUrl);
        res.json({ url });
      } catch (err) {
        console.error({ event: "create_portal_error", error: String(err) });
        res.status(500).json({ error: "Failed to create billing portal session" });
      }
    },
  );

  return router;
}

// The Stripe webhook lives in createStripeWebhookRouter above: it needs the raw
// request body, so app.ts mounts it on its own path before express.json().
