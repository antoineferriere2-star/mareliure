import { beforeEach, describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import {
  processWorkshopConnectEvent,
  assertWorkshopDirectChargeAccount,
} from "./workshopOnlinePayment.server";
const h = vi.hoisted(() => ({
  stripe: {
    paymentIntents: { retrieve: vi.fn() },
    checkout: { sessions: { retrieve: vi.fn() } },
    charges: { retrieve: vi.fn() },
    accounts: { retrieve: vi.fn() },
    v2: { core: { accounts: { retrieve: vi.fn() } } },
    refunds: { list: vi.fn() },
    disputes: { list: vi.fn() },
    applicationFees: { retrieve: vi.fn() },
  },
  guard: vi.fn(),
}));
vi.mock("./stripeClient.server", () => ({
  getMarketplaceStripeClient: () => h.stripe,
  assertExpectedStripeAccount: h.guard,
}));
vi.mock("@/marketplace/notifications/workshopNotices.server", () => ({ notifyWorkshop: vi.fn() }));
let p: Record<string, unknown>;
let intent: Record<string, unknown>;
let session: Record<string, unknown>;
let patches: Record<string, unknown>[];
function db() {
  return {
    from: (table: string) => {
      const filters: ((row: Record<string, unknown>) => boolean)[] = [];
      let patch: Record<string, unknown> | null = null;
      const run = () => {
        if (table === "marketplace_workshop_online_refunds") return { data: [], error: null };
        if (table === "marketplace_workshop_checkout_attempts") return { data: null, error: null };
        if (!filters.every((test) => test(p))) return { data: null, error: { code: "not_found" } };
        if (patch) {
          patches.push(patch);
          Object.assign(p, patch);
        }
        return { data: p, error: null };
      };
      const q = {
        select: () => q,
        eq: (key: string, value: unknown) => (filters.push((row) => row[key] === value), q),
        lte: (key: string, value: number) => (filters.push((row) => Number(row[key]) <= value), q),
        single: async () => run(),
        maybeSingle: async () => run(),
        upsert: async () => ({ error: null }),
        update: (value: Record<string, unknown>) => ((patch = value), q),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve),
      };
      return q;
    },
  } as never;
}
const event = (type: string, object: unknown, account = "acct_workshop") =>
  ({ id: "evt_qa", type, account, created: 100, data: { object } }) as Stripe.Event;
beforeEach(() => {
  vi.clearAllMocks();
  patches = [];
  p = {
    id: "payment_qa",
    binder_id: "binder_qa",
    invoice_id: "invoice_qa",
    stripe_account_id: "acct_workshop",
    checkout_session_id: "cs_qa",
    amount_cents: 10000,
    fee_cents: 300,
    currency: "eur",
    status: "ready",
    paid_at: null,
    refunded_cents: 0,
  };
  const metadata = {
    activity: "workshop_online_payment",
    payment_id: "payment_qa",
    binder_id: "binder_qa",
    invoice_id: "invoice_qa",
  };
  intent = {
    id: "pi_qa",
    metadata,
    amount: 10000,
    amount_received: 10000,
    currency: "eur",
    application_fee_amount: 300,
    status: "succeeded",
    latest_charge: {
      id: "ch_qa",
      amount_refunded: 0,
      disputed: false,
      balance_transaction: {
        fee_details: [
          { type: "stripe_fee", amount: 175 },
          { type: "application_fee", amount: 300 },
        ],
      },
    },
  };
  session = { id: "cs_qa", payment_intent: "pi_qa", metadata, payment_status: "paid" };
  h.stripe.paymentIntents.retrieve.mockImplementation(async () => intent);
  h.stripe.checkout.sessions.retrieve.mockImplementation(async () => session);
  h.stripe.charges.retrieve.mockImplementation(async () => ({ payment_intent: "pi_qa" }));
  h.stripe.refunds.list.mockReturnValue((async function* () {})());
  h.stripe.disputes.list.mockReturnValue((async function* () {})());
});
describe("C : preuves de paiement du bon compte connecté", () => {
  it("confirme la facture atelier avec 3 % et frais Stripe distincts", async () => {
    await processWorkshopConnectEvent(db(), event("checkout.session.completed", session));
    expect(p).toMatchObject({ status: "paid", payment_intent_id: "pi_qa", stripe_fee_cents: 175 });
    expect(h.stripe.paymentIntents.retrieve).toHaveBeenCalledWith(
      "pi_qa",
      { expand: ["latest_charge.balance_transaction"] },
      { stripeAccount: "acct_workshop" },
    );
  });
  it("ne marque pas payé un moyen de paiement asynchrone en cours", async () => {
    intent.status = "processing";
    intent.latest_charge = null;
    await processWorkshopConnectEvent(db(), event("checkout.session.completed", session));
    expect(p.status).toBe("processing");
    expect(p.paid_at).toBeNull();
    intent.status = "succeeded";
    await processWorkshopConnectEvent(
      db(),
      event("checkout.session.async_payment_succeeded", session),
    );
    expect(p.status).toBe("paid");
  });
  it.each(["amount", "amount_received", "currency", "application_fee_amount"])(
    "refuse une preuve contradictoire : %s",
    async (key) => {
      intent[key] = key === "currency" ? "usd" : 1;
      await expect(
        processWorkshopConnectEvent(db(), event("payment_intent.succeeded", intent)),
      ).rejects.toThrow("connect_payment_mismatch");
      expect(patches).toHaveLength(0);
    },
  );
  it("refuse un autre compte connecté et une autre session", async () => {
    await expect(
      processWorkshopConnectEvent(db(), event("checkout.session.completed", session, "acct_other")),
    ).rejects.toBeTruthy();
    await expect(
      processWorkshopConnectEvent(
        db(),
        event("checkout.session.completed", { ...session, id: "cs_other" }),
      ),
    ).rejects.toThrow("connect_session_mismatch");
  });
  it("conserve une seule confirmation sur doublon et signale un remboursement sans avoir", async () => {
    await processWorkshopConnectEvent(db(), event("payment_intent.succeeded", intent));
    const paid = p.paid_at;
    await processWorkshopConnectEvent(db(), event("payment_intent.succeeded", intent));
    expect(p.paid_at).toBe(paid);
    (intent.latest_charge as Record<string, unknown>).amount_refunded = 2000;
    await processWorkshopConnectEvent(db(), event("charge.refunded", { id: "ch_qa" }));
    expect(p).toMatchObject({ refunded_cents: 2000, reconciliation_required: true });
  });
  it("refuse de facturer sur l’ancien type de compte où Oppe paie les frais", async () => {
    h.stripe.v2.core.accounts.retrieve.mockResolvedValue({
      dashboard: "full",
      configuration: {
        merchant: {
          capabilities: {
            card_payments: { status: "active" },
            stripe_balance: { payouts: { status: "active" } },
          },
        },
      },
      defaults: {
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
          requirements_collector: "stripe",
        },
      },
    });
    await expect(assertWorkshopDirectChargeAccount("acct_old")).rejects.toThrow(
      "connect_direct_charge_account_required",
    );
  });
  it("rapproche les frais plateforme réellement remboursés", async () => {
    (intent.latest_charge as Record<string, unknown>).application_fee = "fee_qa";
    h.stripe.applicationFees.retrieve.mockResolvedValue({
      amount: 300,
      amount_refunded: 60,
      currency: "eur",
      account: "acct_workshop",
    });
    await processWorkshopConnectEvent(db(), event("payment_intent.succeeded", intent));
    expect(p).toMatchObject({ fee_cents: 300, fee_refunded_cents: 60, stripe_fee_cents: 175 });
    h.stripe.applicationFees.retrieve.mockResolvedValue({
      amount: 300,
      amount_refunded: 60,
      currency: "eur",
      account: "acct_other",
    });
    await expect(
      processWorkshopConnectEvent(db(), event("payment_intent.succeeded", intent)),
    ).rejects.toThrow("connect_fee_mismatch");
  });
  it("termine le litige gagné et signale une perte sans fabriquer un remboursement", async () => {
    (intent.latest_charge as Record<string, unknown>).disputed = true;
    const dispute = {
      id: "dp_qa",
      status: "under_review",
      amount: 10000,
      currency: "eur",
      reason: "fraudulent",
      evidence_details: { due_by: 200 },
    };
    h.stripe.disputes.list.mockImplementation(() =>
      (async function* () {
        yield dispute;
      })(),
    );
    await processWorkshopConnectEvent(db(), event("charge.dispute.created", { charge: "ch_qa" }));
    expect(p.disputed).toBe(true);
    dispute.status = "won";
    await processWorkshopConnectEvent(db(), event("charge.dispute.closed", { charge: "ch_qa" }));
    expect(p).toMatchObject({ disputed: false, reconciliation_required: false, refunded_cents: 0 });
    dispute.status = "lost";
    await processWorkshopConnectEvent(db(), event("charge.dispute.closed", { charge: "ch_qa" }));
    expect(p).toMatchObject({ disputed: false, reconciliation_required: true, refunded_cents: 0 });
  });
});
