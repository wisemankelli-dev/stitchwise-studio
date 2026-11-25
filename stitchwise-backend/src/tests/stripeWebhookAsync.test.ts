/**
 * Regression pin for the webhook verifier.
 *
 * On Bun the synchronous `stripe.webhooks.constructEvent` throws
 * "SubtleCryptoProvider cannot be used in a synchronous context", so every real
 * Stripe event was rejected with 400 and no purchase could ever upgrade an
 * account. `constructWebhookEvent` must therefore use the async variant.
 */
const mockConstructEvent = jest.fn();
const mockConstructEventAsync = jest.fn();

jest.mock("stripe", () =>
  jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
      constructEventAsync: mockConstructEventAsync,
    },
  })),
);

import {
  constructWebhookEvent,
  WEBHOOK_SECRET_MISSING,
  WEBHOOK_SIGNATURE_MISSING,
} from "../infrastructure/services/stripeClient";

const SECRET = "whsec_test_async_verification";
const BUN_SYNC_ERROR =
  "SubtleCryptoProvider cannot be used in a synchronous context. Use `await constructEventAsync(...)` instead.";

describe("constructWebhookEvent — async verification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    // The sync path is exactly what used to break every real event on Bun.
    mockConstructEvent.mockImplementation(() => {
      throw new Error(BUN_SYNC_ERROR);
    });
  });

  afterAll(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("verifies with constructEventAsync and never calls the sync constructEvent", async () => {
    const event = { id: "evt_test_async", type: "checkout.session.completed" };
    mockConstructEventAsync.mockResolvedValueOnce(event);

    await expect(constructWebhookEvent("{}", "t=1,v1=abc")).resolves.toBe(event);

    expect(mockConstructEventAsync).toHaveBeenCalledTimes(1);
    expect(mockConstructEventAsync).toHaveBeenCalledWith("{}", "t=1,v1=abc", SECRET);
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("propagates a bad signature from the async verifier", async () => {
    mockConstructEventAsync.mockRejectedValueOnce(
      new Error("No signatures found matching the expected signature for payload"),
    );

    await expect(constructWebhookEvent("{}", "bad_sig")).rejects.toThrow(
      /no signatures found/i,
    );
  });

  it("still fails closed before reaching Stripe when the secret is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    await expect(constructWebhookEvent("{}", "t=1,v1=abc")).rejects.toMatchObject({
      code: WEBHOOK_SECRET_MISSING,
    });
    expect(mockConstructEventAsync).not.toHaveBeenCalled();
  });

  it("still fails closed when the signature header is empty", async () => {
    await expect(constructWebhookEvent("{}", "")).rejects.toMatchObject({
      code: WEBHOOK_SIGNATURE_MISSING,
    });
    expect(mockConstructEventAsync).not.toHaveBeenCalled();
  });
});
