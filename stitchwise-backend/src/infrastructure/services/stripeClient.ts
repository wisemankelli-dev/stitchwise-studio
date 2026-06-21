/**
 * Stripe client service for subscription payments.
 *
 * Handles Stripe Checkout session creation and price/product management.
 * Uses Stripe API key from STRIPE_SECRET_KEY env var.
 */

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2025-02-24.acacia" as any,
});

// Tier configuration mapped to Stripe price IDs (set via env or created dynamically)
const PRICE_IDS: Record<string, string | undefined> = {
  HOBBYIST: process.env.STRIPE_PRICE_HOBBYIST,     // Free tier — no checkout needed
  PRO: process.env.STRIPE_PRICE_PRO,
  STUDIO: process.env.STRIPE_PRICE_STUDIO,
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
        ? "Unlimited AI generations, machine embroidery exports"
        : "Commercial licenses, multi-user accounts, bulk processing",
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
 * Constructs a Stripe event from a raw webhook payload.
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_placeholder";
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Extracts subscription details from a Stripe Checkout Session event.
 */
export function extractCheckoutData(session: Stripe.Checkout.Session): {
  customerId: string;
  subscriptionId: string;
  tier: string;
  email: string;
} | null {
  if (!session.customer || !session.subscription || !session.metadata?.tier) {
    return null;
  }

  return {
    customerId: typeof session.customer === "string" ? session.customer : session.customer.id,
    subscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription.id,
    tier: session.metadata.tier,
    email: session.customer_email ?? "",
  };
}

export { stripe };
