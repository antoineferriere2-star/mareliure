import { describe, expect, it } from "vitest";
import type { DashboardRows } from "./adminDashboard";
import { excludeTestWorkshops } from "./testWorkshopScope";

const binder = (id: string, is_demo: boolean) => ({ id, status: "approved", public_profile_status: null, stripe_account_id: null,
  stripe_connect_onboarded_at: null, stripe_connect_charges_enabled: null, stripe_connect_payouts_enabled: null, is_demo, created_at: "2026-10-01" });

function rows(): DashboardRows {
  return {
    now: "2026-10-23T10:00:00Z",
    cases: [{ id: "real", reference: "MR-1", brand: "MA_RELIURE", status: "pricing", created_at: "2026-10-01" },
      { id: "own-test", reference: "MR-2", brand: "MA_RELIURE", status: "pricing", created_at: "2026-10-01" },
      { id: "oppe-test", reference: "MR-3", brand: "MA_RELIURE", status: "in_progress", created_at: "2026-10-01" }],
    binders: [binder("real-b", false), binder("test-b", true)],
    applications: [],
    subscriptions: [{ binder_id: "real-b", status: "active", legacy_free: false, cancel_at_period_end: null },
      { binder_id: "test-b", status: "active", legacy_free: false, cancel_at_period_end: null }],
    connectConsents: [{ binder_id: "test-b" }],
    offer: null,
    proposals: [{ id: "p-real", case_id: "real", brand: "MA_RELIURE" }, { id: "p-test", case_id: "oppe-test", brand: "MA_RELIURE" }],
    proposalPayments: [{ proposal_id: "p-real", paid_at: "x", amount_paid_cents: 100, stripe_fee_cents: 1 },
      { proposal_id: "p-test", paid_at: "x", amount_paid_cents: 999, stripe_fee_cents: 9 }],
    oppeRefunds: [{ case_id: "oppe-test", amount_cents: 1, status: "succeeded", created_at: "x" }],
    oppeDisputes: [],
    onlinePayments: [{ id: "op-real", amount_cents: 10, paid_at: "x", stripe_fee_cents: 1, fee_refunded_cents: 0, fee_brand: "MA_RELIURE" },
      { id: "op-test", amount_cents: 20, paid_at: "x", stripe_fee_cents: 2, fee_refunded_cents: 0, fee_brand: "MA_RELIURE" }],
    feeDocuments: [{ payment_id: "op-test", kind: "invoice", brand: "MA_RELIURE", total_ttc_cents: 3 }],
    onlineRefunds: [{ payment_id: "op-test", amount_cents: 1, status: "succeeded", created_at: "x" }],
    onlineDisputes: [{ payment_id: "op-real", status: "open" }],
    plans: [{ case_id: "own-test", mode: "x", workshop_decision: null, return_ready_at: null, submitted_at: null }],
    labelJobs: [{ case_id: "real", direction: "outbound", status: "x", fulfilment: "x", charged_cost_ttc_cents: 1, created_at: "x", updated_at: "x" }],
    automation: null, ownClientLabels: 0, providerConfigured: false,
    unreadByCase: [{ case_id: "own-test", count: 2 }, { case_id: "real", count: 1 }],
  };
}

describe("pilotage : les ateliers de test n'entrent dans aucun indicateur", () => {
  it("retire leurs dossiers (apportés ou confiés), propositions, paiements, frais, logistique et messages", () => {
    const scoped = excludeTestWorkshops(rows(), {
      caseReferrers: [{ id: "real", referred_binder_id: null }, { id: "own-test", referred_binder_id: "test-b" }, { id: "oppe-test", referred_binder_id: null }],
      assignments: [{ case_id: "oppe-test", binder_id: "test-b" }, { case_id: "real", binder_id: "real-b" }],
      paymentBinders: [{ id: "op-real", binder_id: "real-b" }, { id: "op-test", binder_id: "test-b" }],
    });
    expect(scoped.cases.map((c) => c.id)).toEqual(["real"]);
    expect(scoped.subscriptions.map((s) => s.binder_id)).toEqual(["real-b"]);
    expect(scoped.connectConsents).toEqual([]);
    expect(scoped.proposals.map((p) => p.id)).toEqual(["p-real"]);
    expect(scoped.proposalPayments.map((p) => p.proposal_id)).toEqual(["p-real"]);
    expect(scoped.oppeRefunds).toEqual([]);
    expect(scoped.onlinePayments.map((p) => p.id)).toEqual(["op-real"]);
    expect([scoped.feeDocuments, scoped.onlineRefunds, scoped.plans]).toEqual([[], [], []]);
    expect(scoped.onlineDisputes).toHaveLength(1);
    expect(scoped.labelJobs).toHaveLength(1);
    expect(scoped.unreadByCase).toEqual([{ case_id: "real", count: 1 }]);
    // Les ateliers eux-mêmes restent : le pilotage les sépare déjà en réels et démonstration.
    expect(scoped.binders).toHaveLength(2);
  });

  it("un dossier confié à l'atelier de test puis réaffecté à un vrai atelier redevient réel (dans les deux sens)", () => {
    const facts = (first: string, then: string) => ({
      caseReferrers: [{ id: "oppe-test", referred_binder_id: null }],
      assignments: [{ case_id: "oppe-test", binder_id: first, ended_at: "2026-10-10" }, { case_id: "oppe-test", binder_id: then, ended_at: null }],
      paymentBinders: [],
    });
    expect(excludeTestWorkshops(rows(), facts("test-b", "real-b")).cases.map((c) => c.id)).toContain("oppe-test");
    expect(excludeTestWorkshops(rows(), facts("test-b", "real-b")).proposalPayments.map((p) => p.proposal_id)).toContain("p-test");
    expect(excludeTestWorkshops(rows(), facts("real-b", "test-b")).cases.map((c) => c.id)).not.toContain("oppe-test");
  });

  it("une candidature convertie en atelier de test sort des comptes", () => {
    const input = rows();
    input.applications = [{ status: "approved", created_at: "x", converted_binder_id: "test-b" },
      { status: "approved", created_at: "x", converted_binder_id: "real-b" }, { status: "submitted", created_at: "x", converted_binder_id: null }];
    const scoped = excludeTestWorkshops(input, { caseReferrers: [], assignments: [], paymentBinders: [] });
    expect(scoped.applications.map((a) => a.converted_binder_id)).toEqual(["real-b", null]);
  });

  it("ne change rien sans atelier de test", () => {
    const input = rows();
    input.binders = [binder("real-b", false)];
    expect(excludeTestWorkshops(input, { caseReferrers: [], assignments: [], paymentBinders: [] })).toBe(input);
  });
});
