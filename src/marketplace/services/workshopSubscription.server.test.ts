import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { syncWorkshopSubscriptionEvent } from "./workshopSubscription.server";
const h = vi.hoisted(() => ({
  subscription: vi.fn(),
  invoice: vi.fn(),
  guard: vi.fn(),
  notify: vi.fn(),
  rpc: vi.fn(),
  document: vi.fn(),
}));
vi.mock("@/marketplace/stripe/stripeClient.server", () => ({
  assertExpectedStripeAccount: h.guard,
  getMarketplaceStripeClient: () => ({
    subscriptions: { retrieve: h.subscription },
    invoices: { retrieve: h.invoice },
  }),
}));
vi.mock("@/marketplace/notifications/workshopNotices.server", () => ({ notifyWorkshop: h.notify }));
let subscription: Stripe.Subscription;
let invoice: Stripe.Invoice;
const sb = { rpc: h.rpc, from: () => ({ upsert: h.document }) } as never;
const event = (type = "invoice.paid", object: unknown = invoice) =>
  ({ id: "evt_test", created: 100, type, data: { object } }) as Stripe.Event;
beforeEach(() => {
  vi.clearAllMocks();
  subscription = {
    id: "sub_1",
    customer_account: "acct_buyer",
    status: "active",
    cancel_at_period_end: false,
    latest_invoice: "in_1",
    metadata: { activity: "workshop_subscription", binder_id: "binder_1" },
    items: {
      data: [
        {
          quantity: 1,
          current_period_end: 2000000000,
          price: {
            lookup_key: "oppe_workshop_monthly_15_eur_v1",
            unit_amount: 1500,
            currency: "eur",
            tax_behavior: "exclusive",
            recurring: { interval: "month", interval_count: 1 },
          },
        },
      ],
    },
  } as unknown as Stripe.Subscription;
  invoice = {
    id: "in_1",
    customer_account: "acct_buyer",
    status: "paid",
    currency: "eur",
    subtotal_excluding_tax: 1500,
    total: 1800,
    amount_paid: 1800,
    amount_paid_off_stripe: 0,
    created: 100,
    parent: { subscription_details: { subscription: "sub_1" } },
    number: "AB-1",
    invoice_pdf: "https://invoice.stripe.com/test.pdf",
  } as Stripe.Invoice;
  h.subscription.mockImplementation(async () => subscription);
  h.invoice.mockImplementation(async () => invoice);
  h.rpc.mockResolvedValue({ error: null });
  h.document.mockResolvedValue({ error: null });
});
describe("abonnement B : droits et factures issus de preuves Stripe", () => {
  it("enregistre la facture et les droits du customer_account après paiement vérifié", async () => {
    expect(await syncWorkshopSubscriptionEvent(sb, event())).toBe(true);
    expect(h.rpc).toHaveBeenCalledWith(
      "marketplace_sync_workshop_subscription",
      expect.objectContaining({
        p_binder_id: "binder_1",
        p_snapshot: expect.objectContaining({ customer: "acct_buyer", status: "active" }),
      }),
    );
    expect(h.document).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_invoice_id: "in_1", paid_cents: 1800 }),
    );
    expect(h.notify).toHaveBeenCalledWith(
      sb,
      expect.objectContaining({ id: "subscription-in_1-paid" }),
    );
  });
  it("préserve les anciennes références Customer v1", async () => {
    subscription.customer_account = null;
    subscription.customer = "cus_existing";
    invoice.customer_account = null;
    invoice.customer = "cus_existing";
    await syncWorkshopSubscriptionEvent(sb, event());
    expect(h.rpc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        p_snapshot: expect.objectContaining({ customer: "cus_existing" }),
      }),
    );
  });
  it.each(["unit_amount", "currency", "tax_behavior"])(
    "refuse un catalogue contradictoire : %s",
    async (field) => {
      Object.assign(subscription.items.data[0].price, {
        [field]: field === "unit_amount" ? 1501 : "wrong",
      });
      await expect(syncWorkshopSubscriptionEvent(sb, event())).rejects.toThrow(
        "workshop_subscription_price_mismatch",
      );
      expect(h.rpc).not.toHaveBeenCalled();
    },
  );
  it.each(["customer_account", "amount_paid", "amount_paid_off_stripe", "subtotal_excluding_tax"])(
    "refuse une facture incohérente : %s",
    async (field) => {
      Object.assign(invoice, { [field]: field === "customer_account" ? "acct_other" : 1 });
      await expect(syncWorkshopSubscriptionEvent(sb, event())).rejects.toThrow(
        "workshop_subscription_invoice_mismatch",
      );
      expect(h.rpc).not.toHaveBeenCalled();
    },
  );
  it("n’accorde aucun droit depuis un retour Checkout sans abonnement ni paiement", async () => {
    expect(
      await syncWorkshopSubscriptionEvent(
        sb,
        event("checkout.session.completed", {
          metadata: { activity: "workshop_subscription" },
          subscription: null,
        }),
      ),
    ).toBe(true);
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it("suspend la création sur l’échec du renouvellement et garde la facture", async () => {
    subscription.status = "past_due";
    invoice.status = "open";
    invoice.amount_paid = 0;
    await syncWorkshopSubscriptionEvent(sb, event("invoice.payment_failed"));
    expect(h.rpc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ p_snapshot: expect.objectContaining({ status: "past_due" }) }),
    );
    expect(h.document).toHaveBeenCalledWith(expect.objectContaining({ status: "open" }));
  });
  it("un ancien échec ne révoque pas un renouvellement actuellement payé", async () => {
    const old = { ...invoice, id: "in_old", status: "open", amount_paid: 0 };
    h.invoice.mockImplementation(async (id: string) => (id === "in_old" ? old : invoice));
    await syncWorkshopSubscriptionEvent(sb, event("invoice.payment_failed", old));
    expect(h.rpc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ p_snapshot: expect.objectContaining({ status: "active" }) }),
    );
  });
  it("reprend la date de résiliation fournie par le portail même sans cancel_at_period_end", async () => {
    subscription.cancel_at_period_end = false;
    subscription.cancel_at = 1900000000;
    await syncWorkshopSubscriptionEvent(sb, event("customer.subscription.updated", subscription));
    expect(h.rpc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        p_snapshot: expect.objectContaining({
          cancel_at_period_end: true,
          period_end: new Date(1900000000 * 1000).toISOString(),
        }),
      }),
    );
    expect(h.notify).toHaveBeenCalledWith(
      sb,
      expect.objectContaining({ heading: "Résiliation de votre abonnement" }),
    );
  });
  it("conserve la consultation documentaire après résiliation", async () => {
    subscription.status = "canceled";
    await syncWorkshopSubscriptionEvent(sb, event("customer.subscription.deleted", subscription));
    expect(h.document).toHaveBeenCalledWith(expect.objectContaining({ stripe_invoice_id: "in_1" }));
    expect(h.notify).toHaveBeenCalledWith(
      sb,
      expect.objectContaining({ heading: "Résiliation de votre abonnement" }),
    );
  });
});
