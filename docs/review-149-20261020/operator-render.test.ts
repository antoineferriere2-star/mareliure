import { beforeEach, describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const state = vi.hoisted(() => ({ view: {} as Record<string, unknown>, mode: "purchase" }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: state.view, isPending: false, error: null }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: (options: { mutationFn: () => unknown }) => {
    const body = options.mutationFn.toString();
    const chosen = state.mode === "purchase" ? body.includes("purchase(") : body.includes("action");
    return {
      data: chosen ? { state: "review_required", code: "label_orphaned" } : undefined,
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
describe("real operator component rendered with synthetic query/mutation state", () => {
  it("automatic purchase renders the French orphan explanation", () => {
    expect(render()).toContain("le PDF stocké n’a pas pu être supprimé");
    expect(render()).toContain("label_discard_failed");
  });
  it("adoption result renders the raw code without the French explanation", () => {
    state.mode = "adopt";
    const html = render();
    expect(html).toContain("label_orphaned");
    expect(html).not.toContain("le PDF stocké n’a pas pu être supprimé");
  });
  it("after refresh to failed, adoption result disappears but the persisted journal note remains", () => {
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
    expect(html).not.toContain("label_orphaned");
    expect(html).toContain("label_discard_failed");
    expect(html).toContain("synthetic-job/label.pdf");
  });
});
