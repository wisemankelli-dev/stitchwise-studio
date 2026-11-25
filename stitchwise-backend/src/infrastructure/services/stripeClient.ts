/**
 * Stripe client service for subscription payments.
 *
 * Handles Stripe Checkout session creation and price/product management.
 * Uses Stripe API key from STRIPE_SECRET_KEY env var.
 */

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2026-05-27.dahlia",
});

// Tier configuration mapped to Stripe price IDs (pre-created by the owner)
// PRO: https://dashboard.stripe.com/test/products/prod_xxx
// STUDIO: https://dashboard.stripe.com/test/products/prod_xxx
const PRICE_IDS: Record<string, string | undefined> = {
  HOBBYIST: undefined,  // Free tier — no checkout needed
  PRO: process.env.STRIPE_PRICE_PRO || undefined,
  STUDIO: process.env.STRIPE_PRICE_STUDIO || undefined,
};

/** Amounts in cents for each tier (used if creating prices dynamically). */
const TIER_AMOUNTS: Record<string, number> = {
  PRO: 1999,    // $19.99/mo
  STUDIO: 5999, // $59.99/mo
};

/**
 * Creates or retrieves a Stripe product and price for a given tier.
 * First checks if a price already exists via list_products.
 */
async function ensurePrice(tier: string): Promise<string> {
  // Return cached price ID from env if configured
  if (PRICE_IDS[tier]) return PRICE_IDS[tier]!;

  // Check for existing products with this tier name
  const products = await stripe.products.list({ active: true, limit: 100 });
  let product = products.data.find((p) => p.name === `StitchWise ${tier}`);

  if (!product) {
    product = await stripe.products.create({
      name: `StitchWise ${tier}`,
      description: tier === "PRO"
        ? "15 AI pattern generations per day (100/month), machine embroidery exports"
        : "Commercial licenses, multi-user accounts, bulk processing",
      tax_code: "txcd_10000000", // General - electronically supplied services
    });
  } else if (!product.tax_code) {
    // Ensure existing product has a tax code
    product = await stripe.products.update(product.id, {
      tax_code: "txcd_10000000",
    });
  }

  // Check for existing price
  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 10,
  });

  if (prices.data.length > 0) {
    return prices.data[0].id;
  }

  // Create new recurring price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: TIER_AMOUNTS[tier],
    currency: "usd",
    recurring: { interval: "month" },
  });

  return price.id;
}

/**
 * Creates a Stripe Checkout Session for a subscription.
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}
/**
 * Creates a Stripe Checkout Session for a subscription.
 */
export async function createCheckoutSession(
  customerEmail: string,
  tier: "PRO" | "STUDIO",
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const priceId = await ensurePrice(tier);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: customerEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tier },
  });

  return session.url!;
}

/**
 * Error codes surfaced by constructWebhookEvent so the route can answer Stripe
 * with the right status: a missing secret must be retried once it is set, a bad
 * signature must not be retried at all.
 */
export const WEBHOOK_SECRET_MISSING = "WEBHOOK_SECRET_MISSING";
export const WEBHOOK_SIGNATURE_MISSING = "WEBHOOK_SIGNATURE_MISSING";

function webhookError(code: string, message: string): Error {
  const err = new Error(message) as Error & { code?: string };
  err.code = code;
  return err;
}

/**
 * Constructs a Stripe event from a raw webhook payload.
 *
 * The payload MUST be the untouched request body (Buffer/string) — any JSON
 * re-serialisation breaks the signature. Fails closed when no signing secret is
 * configured, instead of comparing against a placeholder that can never match.
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw webhookError(
      WEBHOOK_SECRET_MISSING,
      "STRIPE_WEBHOOK_SECRET is not configured",
    );
  }
  if (!signature) {
    throw webhookError(
      WEBHOOK_SIGNATURE_MISSING,
      "No Stripe signature header provided",
    );
  }
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/** Plans that a subscription can actually put a user on. */
const PAID_TIERS = ["PRO", "STUDIO"] as const;
export type PaidTier = (typeof PAID_TIERS)[number];

/** Accepts "PRO"/"pro"/"Pro Crafter" and returns the canonical tier name. */
export function normalizeTier(raw: unknown): PaidTier | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toUpperCase();
  if (key === "PRO" || key === "PRO CRAFTER") return "PRO";
  if (key === "STUDIO" || key === "DESIGN STUDIO") return "STUDIO";
  return null;
}

/** Reads a paid tier out of a metadata bag, accepting `tier` or `plan`. */
function tierFromMetadata(metadata: unknown): PaidTier | null {
  if (!metadata || typeof metadata !== "object") return null;
  const bag = metadata as Record<string, unknown>;
  return normalizeTier(bag.tier) ?? normalizeTier(bag.plan);
}

/**
 * Extracts subscription details from a Stripe Checkout Session event.
 *
 * The tier is looked for, in order:
 *   1. `session.metadata` — set by our own `createCheckoutSession` (`tier`).
 *   2. `session.subscription_details.metadata` — where a Stripe **Payment
 *      Link** puts it: the link sets `subscription_data.metadata.plan`, and
 *      the session carries no metadata of its own (`metadata: {}`).
 *   3. An expanded `session.subscription.metadata` — the subscription object
 *      itself carries whatever was set on `subscription_data`.
 * Both `tier` and `plan` are accepted at every step.
 *
 * Email falls back to `customer_details.email` — `customer_email` is null when
 * Stripe reuses an existing customer, and an empty email used to make the
 * upgrade silently fail.
 */
export function extractCheckoutData(session: Stripe.Checkout.Session): {
  customerId: string;
  subscriptionId: string;
  tier: PaidTier;
  email: string;
} | null {
  const subscription = session.subscription as
    | string
    | { id?: string; metadata?: Record<string, string> }
    | null
    | undefined;
  const subscriptionId =
    typeof subscription === "string" ? subscription : subscription?.id;
  const customer = session.customer as string | { id?: string } | null | undefined;
  const customerId = typeof customer === "string" ? customer : customer?.id;

  const subscriptionDetails = (
    session as unknown as {
      subscription_details?: { metadata?: Record<string, string> | null } | null;
    }
  ).subscription_details;

  const tier =
    tierFromMetadata(session.metadata) ??
    tierFromMetadata(subscriptionDetails?.metadata) ??
    tierFromMetadata(typeof subscription === "object" ? subscription?.metadata : undefined);

  const email = (
    session.customer_email ??
    (session as any).customer_details?.email ??
    ""
  ).trim().toLowerCase();

  if (!customerId || !subscriptionId || !tier || !email) return null;

  return { customerId, subscriptionId, tier, email };
}

export { stripe };