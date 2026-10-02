import { beforeEach, describe, expect, it, vi } from "vitest";

// Délivrance des étiquettes privées : identité relue avant toute recherche, URL de 60 s,
// aucune URL signée pour un tiers, un paiement absent ou une étiquette non confirmée.
const SELECTED = "44444444-4444-4444-8444-444444444444";
const PROPOSAL = "22222222-2222-4222-8222-222222222222";
const JOB = "33333333-3333-4333-8333-333333333333";
const h = vi.hoisted(() => ({
  context: null as null | Record<string, unknown>,
  proposal: null as null | Record<string, unknown>,
  payment: null as null | Record<string, unknown>,
  jobs: [] as Record<string, unknown>[],
  actorBinder: "44444444-4444-4444-8444-444444444444" as string | null,
  binderStatus: "approved",
  signed: vi.fn(async () => ({ data: { signedUrl: "https://storage.test/signed" }, error: null })),
}));

vi.mock("./caseRepository.server", () => ({ loadCaseContext: async () => h.context }));
vi.mock("./commercialProposalRepository.server", () => ({
  loadAcceptedCommercialProposal: async () => h.proposal, loadLatestCommercialProposal: async () => h.proposal,
}));
vi.mock("./commercialPaymentRepository.server", () => ({ loadCommercialPaymentState: async () => h.payment }));
vi.mock("./binderQuotes.server", () => ({
  requireBinderId: async () => { if (!h.actorBinder) throw new Error("no_binder"); return h.actorBinder; },
}));

import { labelUrl, LogisticsError } from "./caseLogistics.server";

const sb = {
  from: (table: string) => ({
    select: () => ({
      eq: () => table === "marketplace_binders"
        ? { single: async () => ({ data: { status: h.binderStatus }, error: null }) }
        : Promise.resolve({ data: h.jobs, error: null }),
    }),
  }),
  storage: { from: () => ({ createSignedUrl: h.signed }) },
} as never;
const CASE = "11111111-1111-4111-8111-111111111111";
const job = (over: Record<string, unknown> = {}) => ({ id: JOB, direction: "outbound", status: "confirmed", proposal_id: PROPOSAL,
  private_label_path: `${JOB}/label.pdf`, created_at: "2026-10-02T08:00:00Z", ...over });
const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof LogisticsError ? e.code : String(e)));

beforeEach(() => {
  h.context = { customerUserId: "customer", selectedBinderId: SELECTED, invitedBinderIds: [SELECTED] };
  h.proposal = { id: PROPOSAL, shippingOfferKind: "book_round_trip_fr" };
  h.payment = { paidAt: "2026-10-02T07:00:00Z", stripePaymentIntentId: "pi_qa", stripeCheckoutSessionId: "cs_qa" };
  h.jobs = [job()];
  h.actorBinder = SELECTED;
  h.binderStatus = "approved";
  h.signed.mockClear();
});

describe("étiquettes privées", () => {
  it("aller : le propriétaire du dossier seulement, URL de 60 secondes", async () => {
    expect(await labelUrl(sb, { role: "customer", userId: "customer" }, CASE, "outbound"))
      .toEqual({ url: "https://storage.test/signed", expiresInSeconds: 60 });
    expect(h.signed).toHaveBeenCalledWith(`${JOB}/label.pdf`, 60);
    expect(await code(labelUrl(sb, { role: "customer", userId: "intrus" }, CASE, "outbound"))).toBe("forbidden");
    expect(await code(labelUrl(sb, { role: "customer", userId: "customer" }, CASE, "return"))).toBe("forbidden");
    expect(h.signed).toHaveBeenCalledOnce();
  });

  it("retour : l'atelier retenu seulement ; un autre atelier invité est refusé", async () => {
    h.jobs = [job({ direction: "return" })];
    expect(await labelUrl(sb, { role: "workshop", userId: "member" }, CASE, "return")).toMatchObject({ expiresInSeconds: 60 });
    h.actorBinder = "55555555-5555-4555-8555-555555555555";
    h.context = { ...h.context, invitedBinderIds: [SELECTED, h.actorBinder] };
    expect(await code(labelUrl(sb, { role: "workshop", userId: "other" }, CASE, "return"))).toBe("forbidden");
    h.actorBinder = null;
    expect(await code(labelUrl(sb, { role: "workshop", userId: "nobody" }, CASE, "return"))).toBe("forbidden");
    h.actorBinder = SELECTED;
    expect(await code(labelUrl(sb, { role: "workshop", userId: "member" }, CASE, "outbound"))).toBe("forbidden");
  });

  it("refuse paiement absent, étiquette non confirmée, chemin étranger ; préfère la réservation active", async () => {
    h.payment = { ...h.payment, stripePaymentIntentId: null };
    expect(await code(labelUrl(sb, { role: "operator" }, CASE, "outbound"))).toBe("not_found");
    h.payment = { ...h.payment, stripePaymentIntentId: "pi_qa" };
    h.jobs = [job({ status: "claimed" })];
    expect(await code(labelUrl(sb, { role: "operator" }, CASE, "outbound"))).toBe("not_found");
    h.jobs = [job({ private_label_path: "autre/label.pdf" })];
    expect(await code(labelUrl(sb, { role: "operator" }, CASE, "outbound"))).toBe("not_found");
    expect(h.signed).not.toHaveBeenCalled();
    // Une étiquette annulée plus récente ne masque pas la réservation active confirmée.
    h.jobs = [job(), job({ id: "66666666-6666-4666-8666-666666666666", status: "cancelled", created_at: "2026-10-02T09:00:00Z" })];
    expect(await labelUrl(sb, { role: "operator" }, CASE, "outbound")).toMatchObject({ expiresInSeconds: 60 });
  });

  it("aucune étiquette pour une proposition sans forfait aller-retour", async () => {
    h.proposal = { id: PROPOSAL, shippingOfferKind: "manual" };
    expect(await code(labelUrl(sb, { role: "customer", userId: "customer" }, CASE, "outbound"))).toBe("not_found");
  });
});
