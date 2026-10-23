import { describe, expect, it, vi } from "vitest";

// Aucun appel Stripe ne doit partir pour un atelier de test : le client est remplacé, et doit rester intact.
const stripe = vi.hoisted(() => ({ client: vi.fn(), guard: vi.fn() }));
vi.mock("./stripeClient.server", () => ({ getMarketplaceStripeClient: stripe.client, assertExpectedStripeAccount: stripe.guard }));
vi.mock("./workshopAccountRecovery.server", () => ({ findWorkshopCustomerAccount: vi.fn() }));
vi.mock("@/marketplace/notifications/adminEventAlerts.server", () => ({ alertWorkshopPaymentsActivated: vi.fn() }));
const { ensureBinderStripeAccount } = await import("./binderConnect.server");
const { TEST_WORKSHOP_PROVIDER_REFUSED } = await import("@/marketplace/binders/testWorkshop.server");

const sb = (isDemo: boolean) => ({
  from: () => {
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: "b", is_demo: isDemo, stripe_account_id: null }, error: null }) };
    return q;
  },
}) as never;

describe("Stripe Connect et atelier de test", () => {
  it("refuse la création du compte avant tout appel à Stripe", async () => {
    await expect(ensureBinderStripeAccount(sb(true), "b")).rejects.toThrow(TEST_WORKSHOP_PROVIDER_REFUSED);
    expect(stripe.client).not.toHaveBeenCalled();
    expect(stripe.guard).not.toHaveBeenCalled();
  });
});
