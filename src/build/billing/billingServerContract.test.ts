import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const billingServer = readFileSync(
  join(process.cwd(), "src/build/services/billing.data.functions.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

const webhookRoute = readFileSync(
  join(process.cwd(), "src/routes/api/public/payments/webhook.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

function indexOf(source: string, fragment: string): number {
  const index = source.indexOf(fragment);
  expect(index, `Missing fragment: ${fragment}`).toBeGreaterThanOrEqual(0);
  return index;
}

describe("billing server contract", () => {
  it("refuses Checkout for workspaces already known to Stripe before creating a session", () => {
    const selectBillingIds = indexOf(
      billingServer,
      '.select("stripe_customer_id, stripe_subscription_id")',
    );
    const checkoutGuard = indexOf(billingServer, "if (!canCreateCheckout(workspace))");
    const createCheckout = indexOf(billingServer, "stripe.checkout.sessions.create");

    expect(selectBillingIds).toBeLessThan(checkoutGuard);
    expect(checkoutGuard).toBeLessThan(createCheckout);
    expect(billingServer).toContain("Open the billing portal to change plan.");
  });

  it("validates sandbox/live before Stripe signature verification", () => {
    expect(webhookRoute).not.toContain('?? "sandbox"');
    const parseEnv = indexOf(webhookRoute, "const env = parseStripeEnv(rawEnv)");
    const rejectEnv = indexOf(webhookRoute, 'return jsonResponse(400, { error: "Invalid Stripe environment." })');
    const constructEvent = indexOf(webhookRoute, "constructEventAsync");

    expect(parseEnv).toBeLessThan(rejectEnv);
    expect(rejectEnv).toBeLessThan(constructEvent);
  });
});
