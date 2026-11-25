/**
 * Subscription provisioning through the Stripe webhook.
 *
 * These tests drive the REAL signature check: the stripe client is not mocked,
 * so every request carries a genuine `t=…,v1=…` header computed with HMAC-SHA256
 * exactly as Stripe does it. A fake signed event therefore exercises the same
 * code path a live delivery would.
 *
 * Coverage:
 * - checkout.session.completed → the paying email is put on the paid tier
 * - customer.subscription.deleted → back to HOBBYIST
 * - replays are idempotent (a replayed old checkout cannot re-upgrade a
 *   cancelled subscriber)
 * - bad / missing / misconfigured signatures are rejected, and change nothing
 * - the webhook path is configurable via STRIPE_WEBHOOK_PATH
 */
import crypto from "node:crypto";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../app";

const WEBHOOK_SECRET = "whsec_test_subscription_provisioning";
const WEBHOOK_PATH = "/api/payments/webhook";

// Event ids are unique per run so the suite can be re-run against a database
// that already holds the processed-event rows from an earlier run.
const RUN = Date.now().toString(36);
const eid = (name: string) => `evt_${name}_${RUN}`;
// Stripe customer/subscription ids are @unique on the user row, so they are
// per-run too: the suite can run twice against the same database.
const cus = (name: string) => `cus_${name}_${RUN}`;
const sub = (name: string) => `sub_${name}_${RUN}`;

function stripeSignature(
  payload: string,
  secret: string = WEBHOOK_SECRET,
  timestamp: number = Math.floor(Date.now() / 1000),
): string {
  const v1 = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

function eventBody(type: string, object: Record<string, unknown>, id: string): string {
  return JSON.stringify({
    id,
    object: "event",
    api_version: "2026-05-27.dahlia",
    created: Math.floor(Date.now() / 1000),
    type,
    data: { object },
  });
}

function checkoutSession(email: string, tier: string, ids: {
  customer?: string;
  subscription?: string;
  sessionId?: string;
} = {}): Record<string, unknown> {
  return {
    id: ids.sessionId ?? "cs_test_1",
    object: "checkout.session",
    mode: "subscription",
    // customer_email is null for an existing customer — only customer_details
    // carries the address. The handler must still find the account.
    customer_email: null,
    customer_details: { email },
    customer: ids.customer ?? cus("default"),
    subscription: ids.subscription ?? sub("default"),
    metadata: { tier },
  };
}

/**
 * A session as Stripe shapes it for a hosted **Payment Link** (plink_…): the
 * link's own metadata is copied onto every session it creates, so the tier
 * arrives as `session.metadata.tier`. `subscription_details` does not exist on
 * the checkout.session object.
 */
function paymentLinkSession(email: string, tier: string, ids: {
  customer?: string;
  subscription?: string;
  sessionId?: string;
} = {}): Record<string, unknown> {
  return {
    id: ids.sessionId ?? "cs_test_plink",
    object: "checkout.session",
    mode: "subscription",
    customer_email: null,
    customer_details: { email },
    customer: ids.customer ?? cus("default"),
    subscription: ids.subscription ?? sub("default"),
    metadata: { tier },
  };
}

describe("Stripe webhook — subscription provisioning", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let prisma: PrismaClient;
  let email: string;

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_PATH;
    app = await createApp();
    prisma = new PrismaClient();

    email = `subscriber-${Date.now()}@stitchwise.dev`;
    const signup = await request(app)
      .post("/api/auth/signup")
      .send({ email, password: "password123", name: "Subscriber" });
    expect(signup.status).toBe(201);
    expect(signup.body.user.tier).toBe("HOBBYIST");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function deliver(payload: string, signature: string, path = WEBHOOK_PATH) {
    return request(app)
      .post(path)
      .set("Content-Type", "application/json")
      .set("stripe-signature", signature)
      .send(payload);
  }

  async function tierOf() {
    const user = await prisma.user.findUnique({ where: { email } });
    return user;
  }

  it("upgrades the paying email on a signed checkout.session.completed", async () => {
    const payload = eventBody(
      "checkout.session.completed",
      checkoutSession(email, "PRO", {
        customer: cus("pro"),
        subscription: sub("pro"),
      }),
      eid("checkout_pro_1"),
    );

    const res = await deliver(payload, stripeSignature(payload));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    const user = await tierOf();
    expect(user?.tier).toBe("PRO");
    expect(user?.stripeCustomerId).toBe(cus("pro"));
    expect(user?.stripeSubscriptionId).toBe(sub("pro"));
  });

  it("is idempotent: replaying the same event changes nothing", async () => {
    const payload = eventBody(
      "checkout.session.completed",
      checkoutSession(email, "PRO", {
        customer: cus("pro"),
        subscription: sub("pro"),
      }),
      eid("checkout_pro_1"),
    );

    const res = await deliver(payload, stripeSignature(payload));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, duplicate: true });

    const user = await tierOf();
    expect(user?.tier).toBe("PRO");
    expect(user?.stripeSubscriptionId).toBe(sub("pro"));
  });

  it("downgrades to HOBBYIST on customer.subscription.deleted", async () => {
    const payload = eventBody(
      "customer.subscription.deleted",
      {
        id: sub("pro"),
        object: "subscription",
        customer: cus("pro"),
        status: "canceled",
      },
      eid("subscription_deleted_1"),
    );

    const res = await deliver(payload, stripeSignature(payload));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    const user = await tierOf();
    expect(user?.tier).toBe("HOBBYIST");
    expect(user?.stripeSubscriptionId).toBeNull();
  });

  it("does not re-upgrade a cancelled subscriber when the old checkout event is replayed", async () => {
    const payload = eventBody(
      "checkout.session.completed",
      checkoutSession(email, "PRO", {
        customer: cus("pro"),
        subscription: sub("pro"),
      }),
      eid("checkout_pro_1"),
    );

    const res = await deliver(payload, stripeSignature(payload));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, duplicate: true });

    const user = await tierOf();
    expect(user?.tier).toBe("HOBBYIST");
    expect(user?.stripeSubscriptionId).toBeNull();
  });

  it("rejects a signature made with the wrong secret and leaves the tier alone", async () => {
    const payload = eventBody(
      "checkout.session.completed",
      checkoutSession(email, "STUDIO", {
        customer: cus("bad"),
        subscription: sub("bad"),
      }),
      eid("checkout_bad_sig"),
    );

    const res = await deliver(payload, stripeSignature(payload, "whsec_wrong_secret"));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/signature verification/i);

    const user = await tierOf();
    expect(user?.tier).toBe("HOBBYIST");
    // The rejected delivery must not have touched the stored Stripe ids.
    expect(user?.stripeCustomerId).toBe(cus("pro"));
  });

  it("rejects a tampered payload signed over different bytes", async () => {
    const signed = eventBody(
      "checkout.session.completed",
      checkoutSession(email, "STUDIO", { subscription: sub("tamper") }),
      eid("checkout_tamper"),
    );
    const tampered = signed.replace('"tier":"STUDIO"', '"tier":"PRO"');

    const res = await deliver(tampered, stripeSignature(signed));
    expect(res.status).toBe(400);

    const user = await tierOf();
    expect(user?.tier).toBe("HOBBYIST");
  });

  it("refuses deliveries (503) when no signing secret is configured", async () => {
    const payload = eventBody(
      "checkout.session.completed",
      checkoutSession(email, "STUDIO", { subscription: sub("nosecret") }),
      eid("checkout_no_secret"),
    );

    delete process.env.STRIPE_WEBHOOK_SECRET;
    try {
      const res = await deliver(payload, stripeSignature(payload));
      expect(res.status).toBe(503);
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    }

    const user = await tierOf();
    expect(user?.tier).toBe("HOBBYIST");
  });

  it("serves the webhook on a path set by STRIPE_WEBHOOK_PATH", async () => {
    process.env.STRIPE_WEBHOOK_PATH = "/api/stripe/events";
    const customApp = await createApp();

    const payload = eventBody(
      "checkout.session.completed",
      checkoutSession(email, "STUDIO", {
        customer: cus("studio"),
        subscription: sub("studio"),
      }),
      eid("checkout_studio_1"),
    );
    const signature = stripeSignature(payload);

    const onNewPath = await request(customApp)
      .post("/api/stripe/events")
      .set("Content-Type", "application/json")
      .set("stripe-signature", signature)
      .send(payload);
    expect(onNewPath.status).toBe(200);
    expect(onNewPath.body).toEqual({ received: true });

    const user = await tierOf();
    expect(user?.tier).toBe("STUDIO");

    // The default path is no longer served by this app.
    const onOldPath = await request(customApp)
      .post(WEBHOOK_PATH)
      .set("Content-Type", "application/json")
      .set("stripe-signature", signature)
      .send(payload);
    expect(onOldPath.status).toBe(404);

    delete process.env.STRIPE_WEBHOOK_PATH;
  });

  it("upgrades the buyer from a Payment Link session (tier copied onto session.metadata)", async () => {
    // A real plink_… session: the link's metadata arrives as session.metadata.tier.
    const plinkEmail = `plink-${Date.now()}@stitchwise.dev`;
    const signup = await request(app)
      .post("/api/auth/signup")
      .send({ email: plinkEmail, password: "password123", name: "Payment Link" });
    expect(signup.status).toBe(201);
    expect(signup.body.user.tier).toBe("HOBBYIST");

    const payload = eventBody(
      "checkout.session.completed",
      paymentLinkSession(plinkEmail, "PRO", {
        customer: cus("plink"),
        subscription: sub("plink"),
      }),
      eid("checkout_plink_pro"),
    );

    const res = await deliver(payload, stripeSignature(payload));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    const buyer = await prisma.user.findUnique({ where: { email: plinkEmail } });
    expect(buyer?.tier).toBe("PRO");
    expect(buyer?.stripeCustomerId).toBe(cus("plink"));
    expect(buyer?.stripeSubscriptionId).toBe(sub("plink"));
  });

  it("falls back to an expanded subscription's metadata when the session carries none", async () => {
    const subEmail = `plink-sub-${Date.now()}@stitchwise.dev`;
    const signup = await request(app)
      .post("/api/auth/signup")
      .send({ email: subEmail, password: "password123", name: "Expanded" });
    expect(signup.status).toBe(201);

    const session = {
      id: "cs_test_expanded",
      object: "checkout.session",
      mode: "subscription",
      customer_email: subEmail,
      customer: cus("expanded"),
      // Expanded subscription object, no session metadata.
      subscription: { id: sub("expanded"), metadata: { plan: "STUDIO" } },
      metadata: {},
    };
    const payload = eventBody(
      "checkout.session.completed",
      session,
      eid("checkout_expanded_studio"),
    );

    const res = await deliver(payload, stripeSignature(payload));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    const buyer = await prisma.user.findUnique({ where: { email: subEmail } });
    expect(buyer?.tier).toBe("STUDIO");
    expect(buyer?.stripeSubscriptionId).toBe(sub("expanded"));
  });
});
