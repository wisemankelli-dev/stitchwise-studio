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
 * - the signing secret is accepted under any of its known environment names
 *   (STRIPE_WEBHOOK_SECRET, WEBHOOK_SECRET, WEBHOOK), trimmed
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

// Every environment name the signing-secret lookup accepts. Tests that need
// "no secret configured" must clear all of them, not just the canonical one.
const WEBHOOK_SECRET_ENV_NAMES = ["STRIPE_WEBHOOK_SECRET", "WEBHOOK_SECRET", "WEBHOOK"] as const;

function clearWebhookSecretEnv(): void {
  for (const name of WEBHOOK_SECRET_ENV_NAMES) delete process.env[name];
}

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

    clearWebhookSecretEnv();
    try {
      const res = await deliver(payload, stripeSignature(payload));
      expect(res.status).toBe(503);
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    }

    const user = await tierOf();
    expect(user?.tier).toBe("HOBBYIST");
  });

  // The signing secret is saved by hand in the hosting dashboard, and it has
  // been saved as WEBHOOK_SECRET and as WEBHOOK — never only as
  // STRIPE_WEBHOOK_SECRET. Every accepted name must actually verify.
  it("accepts the signing secret saved under an alias (WEBHOOK_SECRET, WEBHOOK)", async () => {
    const aliasSecret = "whsec_test_alias_secret";

    for (const alias of ["WEBHOOK_SECRET", "WEBHOOK"] as const) {
      // Padded on purpose: a value saved with a stray space or newline must
      // still verify, so the lookup trims it.
      const payload = eventBody(
        "checkout.session.completed",
        checkoutSession(email, "STUDIO", {
          customer: cus(`alias_${alias}`),
          subscription: sub(`alias_${alias}`),
        }),
        eid(`checkout_alias_${alias}`),
      );

      clearWebhookSecretEnv();
      process.env[alias] = `  ${aliasSecret}\n`;
      try {
        const res = await deliver(payload, stripeSignature(payload, aliasSecret));
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ received: true });
      } finally {
        clearWebhookSecretEnv();
        process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
      }

      const user = await tierOf();
      expect(user?.tier).toBe("STUDIO");
      expect(user?.stripeSubscriptionId).toBe(sub(`alias_${alias}`));
    }
  });

  it("prefers STRIPE_WEBHOOK_SECRET over the aliases", async () => {
    const payload = eventBody(
      "checkout.session.completed",
      checkoutSession(email, "PRO", {
        customer: cus("precedence"),
        subscription: sub("precedence"),
      }),
      eid("checkout_precedence"),
    );

    process.env.WEBHOOK_SECRET = "whsec_alias_wrong";
    process.env.WEBHOOK = "whsec_alias_wrong";
    try {
      // Signed with the canonical secret: only wins if it is read first.
      const res = await deliver(payload, stripeSignature(payload));
      expect(res.status).toBe(200);
    } finally {
      delete process.env.WEBHOOK_SECRET;
      delete process.env.WEBHOOK;
    }

    const user = await tierOf();
    expect(user?.tier).toBe("PRO");
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
});
