import { describe, expect, it, vi } from "vitest";

// Aucun appel Stripe ne doit partir pour un atelier de test : le client est remplacé, et doit rester intact.
const stripe = vi.hoisted(() => ({ client: vi.fn(), guard: vi.fn() }));
vi.mock("./stripeClient.server", () => ({ getMarketplaceStripeClient: stripe.client, assertExpectedStripeAccount: stripe.guard }));
vi.mock("./workshopAccountRecovery.server", () => ({ findWorkshopCustomerAccount: vi.fn() }));
vi.mock("@/marketplace/notifications/adminEventAlerts.server", () => ({ alertWorkshopPaymentsActivated: vi.fn() }));
const handlers = vi.hoisted(() => [] as ((input: { context: { userId: string } }) => Promise<unknown>)[]);
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain: Record<string, unknown> = {};
    chain.middleware = () => chain;
    chain.validator = () => chain;
    chain.handler = (fn: (typeof handlers)[number]) => (handlers.push(fn), fn);
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
const sbRef = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/build/services/adminAuth.server", () => ({ admin: async () => sbRef.current }));
vi.mock("@/marketplace/services/workshopSubscription.server", () => ({
  createWorkshopCheckout: vi.fn(), workshopBillingOwner: vi.fn(async () => "b"),
  loadWorkshopSubscription: vi.fn(async () => ({ subscription: { stripe_customer_id: "cus_1" } })),
}));
const { ensureBinderStripeAccount } = await import("./binderConnect.server");
const { refundWorkshopInvoice } = await import("./workshopOnlinePayment.server");
const { createMyWorkshopBillingPortal } = await import("@/marketplace/services/workshopSubscription.data.functions");
const { TEST_WORKSHOP_PROVIDER_REFUSED } = await import("@/marketplace/binders/testWorkshop.server");

const sb = (isDemo: boolean) => ({
  from: () => {
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: "b", is_demo: isDemo, stripe_account_id: null }, error: null }) };
    return q;
  },
}) as never;

describe("Stripe et atelier de test", () => {
  it("refuse la création du compte avant tout appel à Stripe", async () => {
    await expect(ensureBinderStripeAccount(sb(true), "b")).rejects.toThrow(TEST_WORKSHOP_PROVIDER_REFUSED);
    expect(stripe.client).not.toHaveBeenCalled();
    expect(stripe.guard).not.toHaveBeenCalled();
  });

  it("refuse un remboursement avant toute lecture du paiement et tout appel à Stripe", async () => {
    await expect(refundWorkshopInvoice(sb(true), "b", "p", "c")).rejects.toThrow(TEST_WORKSHOP_PROVIDER_REFUSED);
    expect(stripe.client).not.toHaveBeenCalled();
    expect(stripe.guard).not.toHaveBeenCalled();
  });

  it("refuse le portail d'abonnement, même avec un client Stripe existant", async () => {
    sbRef.current = sb(true);
    const portal = createMyWorkshopBillingPortal as unknown as (typeof handlers)[number];
    await expect(portal({ context: { userId: "u" } })).rejects.toThrow(TEST_WORKSHOP_PROVIDER_REFUSED);
    expect(stripe.client).not.toHaveBeenCalled();
  });
});
