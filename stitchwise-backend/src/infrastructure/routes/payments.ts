import { Router, type Request, type Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../middleware/auth";
import {
  createCheckoutSession,
  constructWebhookEvent,
  extractCheckoutData,
} from "../services/stripeClient";

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
        const { tier } = req.body as { tier?: string };

        if (!tier || !["PRO", "STUDIO"].includes(tier)) {
          res.status(400).json({ error: "Invalid tier. Must be 'PRO' or 'STUDIO'" });
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

        const baseUrl = `${req.protocol}://${req.get("host")}`;
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
   * POST /api/payments/webhook
   * Stripe webhook endpoint — handles subscription lifecycle events.
   *
   * Events handled:
   * - checkout.session.completed → Upgrade user's tier
   * - customer.subscription.deleted → Downgrade to HOBBYIST
   */
  router.post(
    "/payments/webhook",
    async (req: Request, res: Response) => {
      const signature = req.headers["stripe-signature"] as string;

      try {
        const event = constructWebhookEvent(req.body, signature);

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as any;
            const data = extractCheckoutData(session);

            if (!data) {
              console.error({ event: "webhook_missing_data", sessionId: session.id });
              res.status(200).json({ received: true });
              return;
            }

            // Update user's tier and Stripe IDs
            await prisma.user.update({
              where: { email: data.email },
              data: {
                tier: data.tier,
                stripeCustomerId: data.customerId,
                stripeSubscriptionId: data.subscriptionId,
              },
            });

            console.error({
              event: "subscription_created",
              email: data.email,
              tier: data.tier,
              subscriptionId: data.subscriptionId,
            });
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object as any;
            const customerId = subscription.customer;

            // Find user by Stripe customer ID
            const user = await prisma.user.findFirst({
              where: { stripeCustomerId: customerId },
            });

            if (user) {
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  tier: "HOBBYIST",
                  stripeSubscriptionId: null,
                },
              });

              console.error({
                event: "subscription_cancelled",
                userId: user.id,
                email: user.email,
              });
            }
            break;
          }

          default:
            console.error({ event: "webhook_unhandled", type: event.type });
        }

        res.json({ received: true });
      } catch (err) {
        console.error({ event: "webhook_error", error: String(err) });
        res.status(400).json({ error: "Webhook signature verification failed" });
      }
    },
  );

  return router;
}

// ─── Stripe webhook routes need raw body parser (handled above) ────────