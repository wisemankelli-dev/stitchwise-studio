/**
 * A paid subscription whose checkout email has no account yet.
 *
 * Real case: a buyer paid with k.r.wiseman@att.net while the account was
 * wisemankelli@gmail.com. The webhook used to answer 500 "No account for the
 * paid email yet", so Stripe retried forever and nothing was recorded — the
 * buyer was charged and got nothing.
 *
 * The rules this pins:
 *
 *   - the webhook answers 200 for a paid email with no account (Stripe stops
 *     retrying) and holds the purchase with tier, customer, subscription, email;
 *   - the hold is applied — tier and both Stripe ids — when that email signs up;
 *   - the same happens on login for an account that already exists;
 *   - the hold is cleared once applied, so a later login changes nothing.
 */
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../app";
import {
  recordPendingSubscription,
  resetPendingSubscriptionTableCache,
} from "../domain/pendingSubscription";

jest.mock("../infrastructure/services/stripeClient", () => ({
  createCheckoutSession: jest.fn(),
  constructWebhookEvent: jest.fn(),
  extractCheckoutData: jest.fn(),
  stripe: { webhooks: { constructEvent: jest.fn() } },
}));

const mockedStripe = jest.requireMock("../infrastructure/services/stripeClient");

type HeldRow = {
  email: string;
  tier: string;
  customerId: string;
  subscriptionId: string;
};

describe("Pending subscription — paid with an email that has no account", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await createApp();
    prisma = new PrismaClient();
    resetPendingSubscriptionTableCache();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** Drives a real signed checkout.session.completed through the webhook route. */
  function deliverCheckoutCompleted(opts: {
    email: string;
    tier: "PRO" | "STUDIO";
    customerId: string;
    subscriptionId: string;
  }) {
    const event = {
      id: `evt_${opts.subscriptionId}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_${opts.subscriptionId}`,
          customer: opts.customerId,
          customer_email: opts.email,
          subscription: opts.subscriptionId,
          metadata: { tier: opts.tier },
        },
      },
    };

    mockedStripe.constructWebhookEvent.mockResolvedValueOnce(event);
    mockedStripe.extractCheckoutData.mockReturnValueOnce({
      customerId: opts.customerId,
      subscriptionId: opts.subscriptionId,
      tier: opts.tier,
      email: opts.email,
    });

    return request(app)
      .post("/api/payments/webhook")
      .set("stripe-signature", `sig_${opts.subscriptionId}`)
      .set("Content-Type", "application/json")
      .send(JSON.stringify(event));
  }

  async function held(email: string): Promise<HeldRow[]> {
    return prisma.$queryRaw<HeldRow[]>`
      SELECT "email", "tier", "customerId", "subscriptionId"
      FROM "PendingSubscriptionPurchase"
      WHERE lower("email") = ${email.toLowerCase()}
    `;
  }

  it("answers 200 and holds the purchase when the paid email has no account", async () => {
    const stamp = Date.now();
    const email = `held-nobody-${stamp}@stitchwise.dev`;
    const customerId = `cus_held_${stamp}`;
    const subscriptionId = `sub_held_${stamp}`;

    const res = await deliverCheckoutCompleted({
      email,
      tier: "PRO",
      customerId,
      subscriptionId,
    }).expect(200);
    // 200 (not 500) is the whole point: Stripe stops retrying.
    expect(res.body).toEqual({ received: true, pending: true });

    const rows = await held(email);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email,
      tier: "PRO",
      customerId,
      subscriptionId,
    });
  });

  it("applies the held purchase when that email signs up", async () => {
    const stamp = Date.now();
    const email = `held-signup-${stamp}@stitchwise.dev`;
    const customerId = `cus_signup_${stamp}`;
    const subscriptionId = `sub_signup_${stamp}`;

    await deliverCheckoutCompleted({ email, tier: "STUDIO", customerId, subscriptionId })
      .expect(200);

    const signup = await request(app)
      .post("/api/auth/signup")
      .send({ email, password: "password123", name: "Held Buyer" })
      .expect(201);

    // The account is on the paid tier from the first response — not HOBBYIST.
    expect(signup.body.user.tier).toBe("STUDIO");

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user!.tier).toBe("STUDIO");
    expect(user!.stripeCustomerId).toBe(customerId);
    expect(user!.stripeSubscriptionId).toBe(subscriptionId);

    // The hold is cleared: nothing left to apply twice.
    expect(await held(email)).toHaveLength(0);
  });

  it("applies a held purchase on login for an account that already exists", async () => {
    const stamp = Date.now();
    const email = `held-login-${stamp}@stitchwise.dev`;
    const customerId = `cus_login_${stamp}`;
    const subscriptionId = `sub_login_${stamp}`;

    const signup = await request(app)
      .post("/api/auth/signup")
      .send({ email, password: "password123", name: "Login Buyer" })
      .expect(201);
    expect(signup.body.user.tier).toBe("HOBBYIST");

    // Held while the account was unknown to the webhook.
    await recordPendingSubscription(prisma, {
      email,
      tier: "PRO",
      customerId,
      subscriptionId,
      checkoutSessionId: `cs_login_${stamp}`,
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "password123" })
      .expect(200);

    expect(login.body.user.tier).toBe("PRO");

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user!.tier).toBe("PRO");
    expect(user!.stripeCustomerId).toBe(customerId);
    expect(user!.stripeSubscriptionId).toBe(subscriptionId);
    expect(await held(email)).toHaveLength(0);

    // A second login is a no-op, not a second upgrade or an error.
    const again = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "password123" })
      .expect(200);
    expect(again.body.user.tier).toBe("PRO");
  });
});
