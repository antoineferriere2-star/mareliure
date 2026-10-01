import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  context: { customerUserId: "customer", selectedBinderId: "44444444-4444-4444-8444-444444444444" },
  proposal: { id: "22222222-2222-4222-8222-222222222222",
    shippingOfferKind: "book_round_trip_fr", paymentCircuit: "legacy_resale" },
  payment: { paidAt: "2026-10-01T10:00:00Z", stripePaymentIntentId: "pi_qa",
    stripeCheckoutSessionId: "cs_qa" },
  job: { id: "33333333-3333-4333-8333-333333333333",
    case_id: "11111111-1111-4111-8111-111111111111",
    proposal_id: "22222222-2222-4222-8222-222222222222",
    binder_id: "44444444-4444-4444-8444-444444444444", direction: "outbound", stripe_payment_intent_id: "pi_qa",
    status: "confirmed", private_label_path: "33333333-3333-4333-8333-333333333333/label.pdf" },
  actorBinderId: "44444444-4444-4444-8444-444444444444",
  signed: vi.fn(async () => ({ data: { signedUrl: "https://storage.test/signed" }, error: null })),
}));

vi.mock("@tanstack/react-start", () => {
  const chain: Record<string, unknown> = {};
  chain.middleware = () => chain;
  chain.inputValidator = () => chain;
  chain.handler = (handler: unknown) => handler;
  return { createServerFn: () => chain };
});
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/build/services/serverError", () => ({ fail: (_status: number, message: string) => { throw new Error(message); } }));
vi.mock("@/build/services/adminAuth.server", () => ({
  admin: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.job, error: null }) }) }) }) }),
    storage: { from: () => ({ createSignedUrl: h.signed }) },
  }),
}));
vi.mock("./caseRepository.server", () => ({ loadCaseContext: async () => h.context }));
vi.mock("./commercialProposalRepository.server", () => ({ loadAcceptedCommercialProposal: async () => h.proposal }));
vi.mock("./commercialPaymentRepository.server", () => ({ loadCommercialPaymentState: async () => h.payment }));
vi.mock("./binderQuotes.server", () => ({ requireBinderId: async (_sb: unknown, actor: string) =>
  actor === "binder-user" ? h.actorBinderId : null }));

import { getRoundTripLabel } from "./roundTripLabels.data.functions";

const caseId = "11111111-1111-4111-8111-111111111111";
const call = (userId: string, direction: "outbound" | "return" = "outbound") =>
  (getRoundTripLabel as unknown as (arg: unknown) => Promise<unknown>)({
    context: { userId }, data: { caseId, direction },
  });

beforeEach(() => {
  h.context = { customerUserId: "customer", selectedBinderId: "44444444-4444-4444-8444-444444444444" };
  h.proposal = { id: "22222222-2222-4222-8222-222222222222",
    shippingOfferKind: "book_round_trip_fr", paymentCircuit: "legacy_resale" };
  h.payment = { paidAt: "2026-10-01T10:00:00Z", stripePaymentIntentId: "pi_qa",
    stripeCheckoutSessionId: "cs_qa" };
  h.job = { id: "33333333-3333-4333-8333-333333333333", case_id: caseId,
    proposal_id: h.proposal.id, binder_id: "44444444-4444-4444-8444-444444444444", direction: "outbound",
    stripe_payment_intent_id: "pi_qa", status: "confirmed",
    private_label_path: "33333333-3333-4333-8333-333333333333/label.pdf" };
  h.actorBinderId = "44444444-4444-4444-8444-444444444444";
  h.signed.mockClear();
});

describe("private label delivery", () => {
  it("returns a short-lived URL only to the customer for the outward leg", async () => {
    expect(await call("customer")).toEqual({ url: "https://storage.test/signed", expiresInSeconds: 60 });
    expect(h.signed).toHaveBeenCalledOnce();
    await expect(call("other")).rejects.toThrow("Accès refusé");
    expect(h.signed).toHaveBeenCalledOnce();
  });
  it("requires the selected atelier for the return leg", async () => {
    h.job = { ...h.job, direction: "return" };
    await expect(call("customer", "return")).rejects.toThrow("Accès refusé");
    h.actorBinderId = "55555555-5555-4555-8555-555555555555";
    await expect(call("binder-user", "return")).rejects.toThrow("Accès refusé");
    h.actorBinderId = "44444444-4444-4444-8444-444444444444";
    expect(await call("binder-user", "return")).toMatchObject({ expiresInSeconds: 60 });
  });
  it("refuses absent platform payment, an unconfirmed label and a foreign object path", async () => {
    h.payment = { ...h.payment, paidAt: "" };
    await expect(call("customer")).rejects.toThrow("Étiquette indisponible");
    h.payment = { ...h.payment, paidAt: "2026-10-01T10:00:00Z" };
    h.job = { ...h.job, status: "ambiguous" };
    await expect(call("customer")).rejects.toThrow("Étiquette indisponible");
    h.job = { ...h.job, status: "confirmed", private_label_path: "other-workshop/label.pdf" };
    await expect(call("customer")).rejects.toThrow("Étiquette indisponible");
    expect(h.signed).not.toHaveBeenCalled();
  });
});

