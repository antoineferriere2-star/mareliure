import { beforeEach, describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const state = vi.hoisted(() => ({
  view: {} as Record<string, unknown>,
  mode: "purchase",
  result: { state: "review_required", code: "label_orphaned" } as { state: string; code?: string },
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: state.view, isPending: false, error: null }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: (options: { mutationFn: () => unknown }) => {
    const body = options.mutationFn.toString();
    const chosen =
      state.mode === "purchase"
        ? body.includes("purchase(")
        : state.mode === "adopt" && body.includes("action");
    return {
      data: chosen ? state.result : undefined,
      isPending: false,
      isError: false,
      mutate: vi.fn(),
    };
  },
}));
vi.mock("@/marketplace/services/caseLogistics.data.functions", () =>
  Object.fromEntries(
    [
      "getOperatorCaseLogistics",
      "getOperatorLabel",
      "getRoundTripShippingOptions",
      "purchaseRoundTripLabel",
      "recordLabelEvent",
      "recordManualLabel",
      "recordRoundTripRateApproval",
      "setRoundTripAutomation",
      "adoptRoundTripLabel",
      "declareRoundTripLabelAbsent",
      "cancelRoundTripLabel",
    ].map((n) => [n, vi.fn()]),
  ),
);
import { OperatorLogisticsPanel } from "../../src/marketplace/pages/admin/OperatorLogisticsPanel";
const job = (status: string, events: unknown[] = []) => ({
  id: "synthetic-job",
  direction: "outbound",
  status,
  fulfilment: "automatic",
  provider: "sendcloud",
  carrier: null,
  tracking: null,
  charged_cost_ttc_cents: null,
  refunded_cost_ttc_cents: null,
  events,
});
const render = () =>
  renderToStaticMarkup(createElement(OperatorLogisticsPanel, { caseId: "synthetic-case" }));
beforeEach(() => {
  state.mode = "purchase";
  state.result = { state: "review_required", code: "label_orphaned" };
  state.view = {
    plan: null,
    jobs: [job("ambiguous")],
    journal: [],
    offerKind: "book_round_trip_fr",
    accepted: true,
    paid: true,
    block: null,
    rate: null,
    automation: { enabled: true, providerConfigured: true },
  };
});
describe("operator resolution non-regressions after #154", () => {
  it("automatic purchase renders the French orphan explanation", () => {
    expect(render()).toContain("le PDF stocké n’a pas pu être supprimé");
    expect(render()).toContain("label_discard_failed");
  });
  it("adoption translates the manual action and orphan explanation", () => {
    state.mode = "adopt";
    const html = render();
    expect(html).toContain("action manuelle nécessaire");
    expect(html).toContain("le PDF stocké n’a pas pu être supprimé");
    expect(html).not.toContain("review_required (");
  });
  it("same mounted result remains visible for a failed job alongside the persisted journal note", () => {
    state.mode = "adopt";
    state.view.jobs = [
      job("failed", [
        {
          created_at: "2026-10-20T12:00:00Z",
          kind: "operator_note",
          details: { note: "label_discard_failed", object: "synthetic-job/label.pdf" },
        },
      ]),
    ];
    const html = render();
    expect(html).toContain("le PDF stocké n’a pas pu être supprimé");
    expect(html).toContain("label_discard_failed");
    expect(html).toContain("synthetic-job/label.pdf");
  });
  for (const [status, result, text] of [
    ["confirmed", { state: "confirmed" }, "étiquette confirmée et stockée"],
    [
      "failed",
      { state: "failed", code: "absent_confirmed" },
      "constat enregistré : réservation close sans étiquette",
    ],
    [
      "confirmed",
      { state: "queued" },
      "annulation en file, confirmée au prochain statut Sendcloud",
    ],
    ["cancelled", { state: "cancelled" }, "étiquette annulée chez Sendcloud"],
    ["confirmed", { state: "refused" }, "annulation refusée par Sendcloud"],
  ] as const)
    it("translates resolution " + result.state + " after refresh to " + status, () => {
      state.mode = "adopt";
      state.result = result;
      state.view.jobs = [job(status)];
      const html = render();
      expect(html).toContain(text);
      expect(html).not.toContain("absent_confirmed");
    });
  it("a fresh mount has no old mutation result; persisted event remains", () => {
    state.mode = "none";
    state.view.jobs = [
      job("failed", [
        {
          created_at: "2026-10-20T12:00:00Z",
          kind: "operator_note",
          details: { note: "label_discard_failed" },
        },
      ]),
    ];
    const html = render();
    expect(html).not.toContain("Résultat :");
    expect(html).toContain("label_discard_failed");
  });
});
