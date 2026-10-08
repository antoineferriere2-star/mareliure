import { describe, expect, it } from "vitest";
import { buildAdminDashboard, caseStage, type DashboardRows } from "./adminDashboard";

const NOW = "2026-10-08T12:00:00.000Z";
const SINCE_30 = "2026-09-08T12:00:00.000Z";
const OLD = "2026-08-01T10:00:00.000Z";
const RECENT = "2026-10-05T10:00:00.000Z";

function rows(overrides: Partial<DashboardRows> = {}): DashboardRows {
  return {
    now: NOW,
    cases: [
      { id: "c1", reference: "RL-001", brand: "MA_RELIURE", status: "under_review", created_at: RECENT },
      { id: "c2", reference: "RL-002", brand: "MA_RELIURE", status: "paid", created_at: OLD },
      { id: "c3", reference: "FB-001", brand: "FINE_BINDERY", status: "awaiting_approval", created_at: RECENT },
      { id: "c4", reference: "FB-002", brand: "FINE_BINDERY", status: "cancelled", created_at: RECENT },
    ],
    binders: [
      { id: "b1", status: "approved", public_profile_status: "published", stripe_account_id: "acct_1", stripe_connect_onboarded_at: RECENT,
        stripe_connect_charges_enabled: true, stripe_connect_payouts_enabled: true, is_demo: false, created_at: OLD },
      { id: "b2", status: "pending_review", public_profile_status: "draft", stripe_account_id: "acct_2", stripe_connect_onboarded_at: null,
        stripe_connect_charges_enabled: false, stripe_connect_payouts_enabled: false, is_demo: false, created_at: RECENT },
      { id: "demo", status: "approved", public_profile_status: "published", stripe_account_id: "acct_demo", stripe_connect_onboarded_at: RECENT,
        stripe_connect_charges_enabled: true, stripe_connect_payouts_enabled: true, is_demo: true, created_at: OLD },
    ],
    applications: [{ status: "new", created_at: RECENT }, { status: "accepted", created_at: OLD }],
    subscriptions: [
      { binder_id: "b1", status: "active", legacy_free: false, cancel_at_period_end: true },
      { binder_id: "b2", status: "past_due", legacy_free: false, cancel_at_period_end: false },
      { binder_id: "demo", status: "active", legacy_free: false, cancel_at_period_end: false },
    ],
    connectConsents: [{ binder_id: "b1" }, { binder_id: "b1" }, { binder_id: "demo" }],
    offer: { subscription_open: true, online_payment_open: true, connect_onboarding_open: true },
    proposals: [{ id: "p2", case_id: "c2", brand: "MA_RELIURE" }, { id: "p3", case_id: "c3", brand: "FINE_BINDERY" }],
    proposalPayments: [
      { proposal_id: "p2", paid_at: RECENT, amount_paid_cents: 21100, stripe_fee_cents: 345 },
      { proposal_id: "p3", paid_at: OLD, amount_paid_cents: 28930, stripe_fee_cents: 430 },
      { proposal_id: "p3", paid_at: null, amount_paid_cents: null, stripe_fee_cents: null },
    ],
    oppeRefunds: [
      { case_id: "c2", amount_cents: 2000, status: "succeeded", created_at: RECENT },
      { case_id: "c2", amount_cents: 1000, status: "failed", created_at: RECENT },
    ],
    oppeDisputes: [{ case_id: "c3", amount_cents: 28930, status: "needs_response", created_at: RECENT }, { case_id: "c2", amount_cents: 500, status: "won", created_at: RECENT }],
    onlinePayments: [
      { id: "op1", amount_cents: 10000, paid_at: RECENT, stripe_fee_cents: 340, fee_refunded_cents: 60, fee_brand: "MA_RELIURE" },
      { id: "op2", amount_cents: 10000, paid_at: RECENT, stripe_fee_cents: 340, fee_refunded_cents: 0, fee_brand: null },
    ],
    feeDocuments: [
      { payment_id: "op1", kind: "invoice", brand: "MA_RELIURE", total_ttc_cents: 300 },
      { payment_id: "op1", kind: "credit_note", brand: "MA_RELIURE", total_ttc_cents: 60 },
      { payment_id: "op2", kind: "invoice", brand: "FINE_BINDERY", total_ttc_cents: 300 },
    ],
    onlineRefunds: [{ payment_id: "op1", amount_cents: 2000, status: "succeeded", created_at: RECENT }],
    onlineDisputes: [{ status: "under_review" }],
    plans: [
      { case_id: "c2", mode: "organized_round_trip", workshop_decision: "accepted", return_ready_at: RECENT, submitted_at: OLD },
      { case_id: "c3", mode: "organized_round_trip", workshop_decision: null, return_ready_at: null, submitted_at: RECENT },
      { case_id: "c1", mode: "hand_delivery", workshop_decision: null, return_ready_at: null, submitted_at: RECENT },
    ],
    labelJobs: [
      { case_id: "c2", direction: "outbound", status: "confirmed", fulfilment: "manual", charged_cost_ttc_cents: 620, created_at: RECENT, updated_at: RECENT },
      { case_id: "c3", direction: "outbound", status: "claimed", fulfilment: "automatic", charged_cost_ttc_cents: null, created_at: RECENT, updated_at: "2026-10-08T09:00:00.000Z" },
    ],
    automation: { enabled: false, changed_at: RECENT },
    ownClientLabels: 3,
    providerConfigured: true,
    ...overrides,
  };
}

describe("tableau de bord admin", () => {
  it("classe les statuts dans l'ordre du parcours, l'inconnu en clos", () => {
    expect(caseStage("under_review")).toBe("new");
    expect(caseStage("awaiting_payment")).toBe("accepted");
    expect(caseStage("delivered")).toBe("done");
    expect(caseStage("cancelled")).toBe("closed");
    expect(caseStage("statut_futur")).toBe("closed");
  });

  it("deux marques sur 30 jours : flux de la période, états actuels", () => {
    const d = buildAdminDashboard(rows(), { brand: "ALL", since: SINCE_30 });
    expect(d.cases.created).toBe(3);
    expect(d.cases.byStage.find((s) => s.key === "new")?.count).toBe(1);
    expect(d.cases.byStage.find((s) => s.key === "closed")?.count).toBe(1);
    // Proposé (c3) + accepté ou au-delà (c2) : 1 sur 2.
    expect(d.cases.acceptanceRate).toBe(0.5);
    // A : seul le paiement de la période compte ; remboursement réussi seulement.
    expect(d.payments.a).toMatchObject({ count: 1, grossCents: 21100, stripeFeeCents: 345, refundedCents: 2000, openDisputes: 1, disputedCents: 28930 });
    // C : retenue lue sur la facture, frais remboursés déduits ; marque reprise de la facture si absente du paiement.
    expect(d.payments.c).toMatchObject({ count: 2, grossCents: 20000, platformFeeCents: 540, stripeFeeCents: 680, refundedCents: 2000, openDisputes: 1 });
    expect(d.payments.recent.map((r) => [r.circuit, r.brand, r.reference])).toEqual([["A", "MA_RELIURE", "RL-002"], ["C", "MA_RELIURE", null], ["C", "FINE_BINDERY", null]]);
  });

  it("marque Fine Bindery : n'agrège que ses dossiers et paiements", () => {
    const d = buildAdminDashboard(rows(), { brand: "FINE_BINDERY", since: SINCE_30 });
    expect(d.cases.created).toBe(2);
    expect(d.payments.a.count).toBe(0);
    expect(d.payments.a.openDisputes).toBe(1);
    expect(d.payments.c).toMatchObject({ count: 1, grossCents: 10000, platformFeeCents: 300, refundedCents: 0, openDisputes: 0 });
    expect(d.shipping.plans).toMatchObject({ roundTrip: 1, awaitingWorkshop: 1, returnReadyWithoutLabel: 0 });
    expect(d.shipping.ownClientLabels).toBe(0);
  });

  it("depuis l'ouverture : tous les paiements datés, jamais un paiement non encaissé", () => {
    const d = buildAdminDashboard(rows(), { brand: "ALL", since: null });
    expect(d.payments.a).toMatchObject({ count: 2, grossCents: 50030 });
  });

  it("onboarding : comptes de démonstration écartés, accords dédupliqués, B payant estimé", () => {
    const d = buildAdminDashboard(rows(), { brand: "ALL", since: SINCE_30 });
    expect(d.onboarding.workshops).toEqual({ approved: 1, pendingReview: 1, suspended: 0, published: 1 });
    expect(d.onboarding.connect).toEqual({ started: 2, onboarded: 1, chargesEnabled: 1, payoutsEnabled: 1, consents: 1 });
    expect(d.onboarding.subscriptions).toMatchObject({ paying: 1, late: 1, cancelling: 1, monthlyHtCents: 1500 });
    expect(d.onboarding.applications).toEqual({ created: 1, pending: 1, accepted: 1, rejected: 0 });
  });

  it("envois et alertes : retour prêt sans étiquette, réservation bloquée plus d'une heure", () => {
    const d = buildAdminDashboard(rows(), { brand: "ALL", since: SINCE_30 });
    expect(d.shipping.labels).toMatchObject({ confirmed: 1, manual: 1, automatic: 0, chargedCents: 620, inProgress: 1 });
    expect(d.shipping.automation).toEqual({ enabled: false, changedAt: RECENT, providerConfigured: true });
    expect(Object.fromEntries(d.alerts.map((a) => [a.key, a.count]))).toEqual({
      disputes: 2, labels: 1, refunds: 1, subscriptions: 1, newCases: 1, applications: 1, workshopReview: 1, shipping: 1,
    });
  });

  it("base vide : aucun total inventé, aucune alerte", () => {
    const empty = rows({ cases: [], binders: [], applications: [], subscriptions: [], connectConsents: [], offer: null, proposals: [],
      proposalPayments: [], oppeRefunds: [], oppeDisputes: [], onlinePayments: [], feeDocuments: [], onlineRefunds: [], onlineDisputes: [],
      plans: [], labelJobs: [], automation: null, ownClientLabels: 0, providerConfigured: false });
    const d = buildAdminDashboard(empty, { brand: "ALL", since: null });
    expect(d.alerts).toEqual([]);
    expect(d.cases.acceptanceRate).toBeNull();
    expect(d.payments.a.grossCents + d.payments.c.grossCents).toBe(0);
    expect(d.onboarding.offer).toBeNull();
    expect(d.shipping.automation.enabled).toBe(false);
  });
});
