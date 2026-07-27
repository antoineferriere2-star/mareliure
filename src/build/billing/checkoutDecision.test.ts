import { describe, expect, it } from "vitest";
import { canCreateCheckout, resolveBillingAction } from "./checkoutDecision";

describe("resolveBillingAction", () => {
  it("allows Checkout only before Stripe has attached billing identifiers", () => {
    const workspace = { stripe_customer_id: null, stripe_subscription_id: null };
    expect(resolveBillingAction(workspace)).toBe("checkout");
    expect(canCreateCheckout(workspace)).toBe(true);
  });

  it("routes existing Stripe customers to the billing portal", () => {
    const workspace = { stripe_customer_id: "cus_123", stripe_subscription_id: null };
    expect(resolveBillingAction(workspace)).toBe("portal");
    expect(canCreateCheckout(workspace)).toBe(false);
  });

  it("routes existing Stripe subscriptions to the billing portal even before customer sync", () => {
    const workspace = { stripe_customer_id: null, stripe_subscription_id: "sub_123" };
    expect(resolveBillingAction(workspace)).toBe("portal");
    expect(canCreateCheckout(workspace)).toBe(false);
  });
});
