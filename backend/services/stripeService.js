/**
 * @title StripeService
 * @description Stripe payment processing for USD fiat investments (test mode)
 * @features
 * - Create PaymentIntents for investment amounts
 * - Confirm payments via webhook or manual confirmation
 * - Mark investments as confirmed after successful Stripe payment
 * - Full test mode support (sk_test_... keys)
 */

import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "../db/connection.js";
import { investments, paymentProofs } from "../db/schema.js";

export class StripeServiceError extends Error {
  constructor(message, { httpStatus = 500, code = "stripe_error", type } = {}) {
    super(message);
    this.name = "StripeServiceError";
    this.httpStatus = httpStatus;
    this.code = code;
    this.type = type;
  }
}

class StripeService {
  constructor() {
    this.enabled =
      process.env.ENABLE_STRIPE === "true" ||
      process.env.STRIPE_ENABLED === "true" ||
      process.env.FEATURE_STRIPE_PAYMENTS === "true";
    this.stripe = null;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || null;
  }

  _getStripe() {
    if (!this.stripe) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new StripeServiceError(
          "STRIPE_SECRET_KEY not configured. Set it in .env to enable Stripe payments.",
          {
            httpStatus: 503,
            code: "stripe_not_configured",
          },
        );
      }
      const stripeOptions = {};
      if (process.env.STRIPE_API_VERSION) {
        stripeOptions.apiVersion = process.env.STRIPE_API_VERSION;
      }
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, stripeOptions);
    }
    return this.stripe;
  }

  _isValidIntentId(paymentIntentId) {
    return /^pi_[A-Za-z0-9]+$/.test(paymentIntentId || "");
  }

  _isValidPaymentMethodId(paymentMethodId) {
    // Stripe test payment method IDs can include underscores (for example pm_card_visa).
    return /^pm_[A-Za-z0-9_]+$/.test(paymentMethodId || "");
  }

  _resolveReturnUrl(returnUrl, propertyId) {
    if (typeof returnUrl === "string") {
      const trimmed = returnUrl.trim();
      if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
      }
    }

    const base = (process.env.FRONTEND_URL || "http://localhost:5173").replace(
      /\/$/,
      "",
    );

    if (Number.isInteger(propertyId) && propertyId > 0) {
      return `${base}/property/${propertyId}`;
    }

    return `${base}/marketplace`;
  }

  _mapStripeError(error, fallbackMessage) {
    if (error instanceof StripeServiceError) {
      return error;
    }

    const message = error?.message || fallbackMessage;
    const type = error?.type;
    const code = error?.code || "stripe_error";

    if (type === "StripeCardError") {
      return new StripeServiceError(message, {
        httpStatus: 402,
        code,
        type,
      });
    }

    if (type === "StripeInvalidRequestError") {
      return new StripeServiceError(message, {
        httpStatus: 400,
        code,
        type,
      });
    }

    if (type === "StripeAuthenticationError") {
      return new StripeServiceError(
        "Stripe authentication failed. Check Stripe configuration.",
        {
          httpStatus: 502,
          code,
          type,
        },
      );
    }

    if (type === "StripeConnectionError") {
      return new StripeServiceError(
        "Unable to reach Stripe. Please try again.",
        {
          httpStatus: 502,
          code,
          type,
        },
      );
    }

    return new StripeServiceError(message, {
      httpStatus: 500,
      code,
      type,
    });
  }

  /**
   * Create a Stripe PaymentIntent for a USD investment
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async createPaymentIntent({
    investmentId,
    propertyId,
    amountUSD,
    userEmail,
    userId,
    propertyTitle,
    returnUrl,
    metadata = {},
  }) {
    try {
      if (!this.enabled) {
        throw new StripeServiceError(
          "Stripe payments are not enabled. Set ENABLE_STRIPE=true in .env",
          {
            httpStatus: 503,
            code: "stripe_disabled",
          },
        );
      }

      const stripe = this._getStripe();

      // Stripe requires amount in smallest currency unit (cents)
      const numericAmount = Number.parseFloat(amountUSD);
      const amountCents = Math.round(numericAmount * 100);

      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new StripeServiceError("Amount must be a positive USD value", {
          httpStatus: 400,
          code: "invalid_amount",
        });
      }

      if (amountCents < 50) {
        throw new StripeServiceError("Minimum Stripe payment is $0.50 USD", {
          httpStatus: 400,
          code: "amount_too_small",
        });
      }

      const normalizedInvestmentId =
        Number.isInteger(investmentId) && investmentId > 0
          ? investmentId
          : undefined;
      const normalizedPropertyId =
        Number.isInteger(propertyId) && propertyId > 0 ? propertyId : undefined;
      const resolvedReturnUrl = this._resolveReturnUrl(
        returnUrl,
        normalizedPropertyId,
      );

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
        payment_method_types: ["card"],
        receipt_email: userEmail || undefined,
        description: `RWAchain Investment #${investmentId} — ${propertyTitle || "Property"}`,
        metadata: {
          investmentId: normalizedInvestmentId
            ? String(normalizedInvestmentId)
            : "",
          propertyId: normalizedPropertyId ? String(normalizedPropertyId) : "",
          userId: userId ? String(userId) : "",
          returnUrl: resolvedReturnUrl,
          platform: "rwachain",
          ...metadata,
        },
      });

      // Store the PaymentIntent ID only when an investment already exists.
      if (normalizedInvestmentId) {
        await db
          .update(investments)
          .set({ stripePaymentIntentId: paymentIntent.id })
          .where(eq(investments.id, normalizedInvestmentId));
      }

      return {
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: numericAmount,
        currency: "USD",
        status: paymentIntent.status,
        returnUrl: resolvedReturnUrl,
      };
    } catch (error) {
      const mappedError = this._mapStripeError(
        error,
        "Unable to create Stripe payment intent.",
      );
      console.error("Stripe createPaymentIntent error:", mappedError);
      throw mappedError;
    }
  }

  /**
   * Handle Stripe webhook events (payment_intent.succeeded, payment_intent.payment_failed)
   * @param {string} rawBody - Raw request body (required for signature verification)
   * @param {string} signature - Stripe-Signature header
   * @returns {Promise<Object>}
   */
  async handleWebhook(rawBody, signature) {
    try {
      const stripe = this._getStripe();

      let event;

      if (this.webhookSecret && signature) {
        event = stripe.webhooks.constructEvent(
          rawBody,
          signature,
          this.webhookSecret,
        );
      } else {
        // Dev mode: parse without signature verification
        console.warn(
          "⚠️  Stripe webhook signature not verified (STRIPE_WEBHOOK_SECRET not set)",
        );
        const payload = Buffer.isBuffer(rawBody)
          ? rawBody.toString("utf8")
          : rawBody;
        event = JSON.parse(payload);
      }

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        await this._markInvestmentPaid(paymentIntent.id, paymentIntent);
        console.log(`✅ Stripe payment succeeded: ${paymentIntent.id}`);
      }

      if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object;
        await this._markInvestmentFailed(paymentIntent.id);
        console.warn(`❌ Stripe payment failed: ${paymentIntent.id}`);
      }

      return { received: true, type: event.type };
    } catch (error) {
      console.error("Stripe webhook error:", error);
      throw error;
    }
  }

  /**
   * Manually confirm a Stripe PaymentIntent (for test mode without webhook)
   * @param {string} paymentIntentId
   * @returns {Promise<Object>}
   */
  async confirmPaymentIntent(paymentIntentId, options = {}) {
    try {
      const { paymentMethodId, returnUrl, propertyId } = options;

      if (!this._isValidIntentId(paymentIntentId)) {
        throw new StripeServiceError(
          "Invalid paymentIntentId format. Expected a Stripe PaymentIntent ID.",
          {
            httpStatus: 400,
            code: "invalid_payment_intent_id",
          },
        );
      }

      if (paymentMethodId && !this._isValidPaymentMethodId(paymentMethodId)) {
        throw new StripeServiceError(
          "Invalid paymentMethodId format. Expected a Stripe PaymentMethod ID.",
          {
            httpStatus: 400,
            code: "invalid_payment_method_id",
          },
        );
      }

      const stripe = this._getStripe();
      const resolvedReturnUrl = this._resolveReturnUrl(returnUrl, propertyId);

      let paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (
        paymentIntent.status === "requires_payment_method" ||
        paymentIntent.status === "requires_confirmation"
      ) {
        const fallbackTestPaymentMethod = this._isTestMode()
          ? "pm_card_visa"
          : undefined;
        const methodToUse = paymentMethodId || fallbackTestPaymentMethod;

        if (!methodToUse) {
          return {
            success: false,
            paymentIntentId,
            status: paymentIntent.status,
            message:
              "Payment method is required to confirm this PaymentIntent.",
          };
        }

        const confirmParams = {
          payment_method: methodToUse,
        };

        if (resolvedReturnUrl) {
          confirmParams.return_url = resolvedReturnUrl;
        }

        paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
          ...confirmParams,
        });
      }

      if (paymentIntent.status === "succeeded") {
        await this._markInvestmentPaid(paymentIntentId, paymentIntent);
        return {
          success: true,
          paymentIntentId,
          status: "succeeded",
          message: "Payment confirmed successfully.",
        };
      }

      if (
        paymentIntent.status === "requires_action" ||
        paymentIntent.status === "requires_source_action"
      ) {
        return {
          success: false,
          paymentIntentId,
          status: paymentIntent.status,
          requiresAction: true,
          nextAction: paymentIntent.next_action?.type || null,
          returnUrl: resolvedReturnUrl,
          message:
            "Additional customer action is required to complete this payment.",
        };
      }

      return {
        success: false,
        paymentIntentId,
        status: paymentIntent.status,
        message: `PaymentIntent is ${paymentIntent.status}.`,
      };
    } catch (error) {
      const mappedError = this._mapStripeError(
        error,
        "Unable to confirm Stripe payment intent.",
      );
      console.error("Stripe confirmPaymentIntent error:", mappedError);
      throw mappedError;
    }
  }

  /**
   * Get current Stripe PaymentIntent status
   * @param {string} paymentIntentId
   * @returns {Promise<{id: string, status: string}>}
   */
  async getPaymentIntentStatus(paymentIntentId) {
    const stripe = this._getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
    };
  }

  /**
   * Mark investment as payment_confirmed after successful Stripe payment
   * @private
   */
  async _markInvestmentPaid(paymentIntentId, paymentIntentData = {}) {
    try {
      // Find investment by stripePaymentIntentId
      const [investment] = await db
        .select()
        .from(investments)
        .where(eq(investments.stripePaymentIntentId, paymentIntentId))
        .limit(1);

      if (!investment) {
        console.warn(
          `⚠️  No investment found for Stripe intent: ${paymentIntentId}`,
        );
        return;
      }

      // Update investment status
      await db
        .update(investments)
        .set({
          paymentStatus: "payment_confirmed",
          transactionHash: `stripe_${paymentIntentId}`,
        })
        .where(eq(investments.id, investment.id));

      // Update or create payment proof record
      const [existingProof] = await db
        .select()
        .from(paymentProofs)
        .where(eq(paymentProofs.investmentId, investment.id))
        .limit(1);

      if (existingProof) {
        await db
          .update(paymentProofs)
          .set({
            status: "verified",
            verificationNotes: `Stripe payment confirmed: ${paymentIntentId}`,
            verifiedAt: new Date(),
          })
          .where(eq(paymentProofs.id, existingProof.id));
      } else {
        await db.insert(paymentProofs).values({
          investmentId: investment.id,
          userId: investment.userId,
          proofType: "stripe_payment",
          bankReference: paymentIntentId,
          amount: paymentIntentData.amount ? paymentIntentData.amount / 100 : 0,
          currency: "USD",
          status: "verified",
          uploadedAt: new Date(),
          verifiedAt: new Date(),
          verificationNotes: `Auto-verified by Stripe webhook`,
        });
      }

      console.log(
        `✅ Investment #${investment.id} marked as payment_confirmed via Stripe`,
      );
    } catch (error) {
      console.error("Error marking investment paid via Stripe:", error);
    }
  }

  /**
   * Mark investment as failed
   * @private
   */
  async _markInvestmentFailed(paymentIntentId) {
    try {
      await db
        .update(investments)
        .set({ paymentStatus: "failed" })
        .where(eq(investments.stripePaymentIntentId, paymentIntentId));
    } catch (error) {
      console.error("Error marking investment failed:", error);
    }
  }

  _isTestMode() {
    return (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_");
  }
}

const stripeService = new StripeService();
export default stripeService;
