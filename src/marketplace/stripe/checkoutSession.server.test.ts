/**
 * Phase 0 / P1-1 — de la proposition acceptée au Checkout Stripe : le montant demandé à Stripe est
 * le TTC du snapshot commercial figé, jamais le HT, jamais une valeur venue du navigateur.
 *
 * Le comportement réel de `createCheckoutForCase` (éligibilité, montant, session, idempotence) ;
 * seuls la base de données et le SDK Stripe sont remplacés.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { amountInput } from "./amountDue.fixtures";
import type { AmountDueInput } from "./amountDue";

const h = vi.hoisted(() => ({
  proposal: null as null | Record<string, unknown>,
  payment: null as null | { paidAt: string | null; stripeCheckoutSessionId: string | null },
  stripe: {
    create: vi.fn(),
    retrieve: vi.fn(),
    expire: vi.fn(),
    assertAccount: vi.fn(async () => undefined),
  },
  recorded: [] as string[],
  events: [] as unknown[],
}));

vi.mock("@tanstack/react-start", () => {
  const chain: Record<string, unknown> = {};
  chain.middleware = () => chain;
  chain.inputValidator = () => chain;
  chain.handler = () => () => undefined;
  return { createServerFn: () => chain };
});
vi.mock("@tanstack/react-start/server", () => ({ getRequestHost: () => "mareliure.test" }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/build/services/adminAuth.server", () => ({ admin: vi.fn() }));
vi.mock("@/marketplace/services/caseRepository.server", () => ({
  loadCaseContext: vi.fn(async () => ({
    customerUserId: "user-1",
    invitedBinderIds: [],
    selectedBinderId: null,
    customerEmail: "cliente@example.test",
  })),
}));
vi.mock("@/marketplace/services/commercialProposalRepository.server", () => ({
  loadAcceptedCommercialProposal: vi.fn(async () => h.proposal),
}));
vi.mock("@/marketplace/services/commercialPaymentRepository.server", () => ({
  loadCommercialPaymentState: vi.fn(async () => h.payment),
  recordCheckoutSession: vi.fn(async (_sb: unknown, _proposalId: string, sessionId: string) => {
    h.recorded.push(sessionId);
  }),
}));
vi.mock("./stripeConfig.server", () => ({
  getStripeProductIds: () => ({ maReliureService: "prod_ma_reliure", fineBinderyService: "prod_fine_bindery", shipping: "prod_shipping" }),
}));
vi.mock("./stripeClient.server", () => ({
  assertExpectedStripeAccount: h.stripe.assertAccount,
  getMarketplaceStripeClient: () => ({
    checkout: { sessions: { create: h.stripe.create, retrieve: h.stripe.retrieve, expire: h.stripe.expire } },
  }),
}));

import { createCheckoutForCase } from "./checkoutSession.server";

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const PROPOSAL_ID = "22222222-2222-4222-8222-222222222222";

function acceptedProposal(amount: AmountDueInput, over: Record<string, unknown> = {}) {
  return {
    id: PROPOSAL_ID,
    caseId: CASE_ID,
    brand: "MA_RELIURE",
    status: "accepted",
    acceptedAt: "2026-09-19T10:00:00.000Z",
    taxPolicy: "FR_B2C",
    taxValidatedAt: "2026-09-19T09:00:00.000Z",
    customerType: "CUSTOMER",
    businessName: null,
    ...amount,
    ...over,
  };
}

const sb = { from: () => ({ insert: async (row: unknown) => void h.events.push(row) }) } as never;
const run = () => createCheckoutForCase({ sb, caseId: CASE_ID, userId: "user-1", isAdmin: false, origin: "https://mareliure.test" });
const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { status?: number }).status ?? "other";
  }
};
const sent = () => h.stripe.create.mock.calls[0][0] as {
  mode: string;
  line_items: { quantity: number; price_data: { currency: string; product: string; unit_amount: number } }[];
  metadata: Record<string, string>;
  payment_intent_data: { metadata: Record<string, string> };
};
const sentTotal = () => sent().line_items.reduce((sum, l) => sum + l.price_data.unit_amount * l.quantity, 0);

beforeEach(() => {
  h.proposal = null;
  h.payment = null;
  h.recorded = [];
  h.events = [];
  h.stripe.create.mockReset().mockResolvedValue({ id: "cs_new", url: "https://checkout.stripe.test/cs_new", status: "open" });
  h.stripe.retrieve.mockReset();
  h.stripe.expire.mockReset().mockResolvedValue({});
  h.stripe.assertAccount.mockClear();
});

describe("proposition acceptée → Checkout → montant attendu", () => {
  it("500 € HT, TVA 20 % validée : Stripe reçoit 600 € TTC (et non 500 € HT)", async () => {
    h.proposal = acceptedProposal(amountInput(50_000, 0, 2000));
    const result = await run();

    expect(result.url).toBe("https://checkout.stripe.test/cs_new");
    expect(h.stripe.create).toHaveBeenCalledTimes(1);
    expect(sent().mode).toBe("payment");
    expect(sent().line_items).toEqual([{ quantity: 1, price_data: { currency: "eur", product: "prod_ma_reliure", unit_amount: 60_000 } }]);
    expect(sentTotal()).toBe(60_000);
  });

  it("service + transport : les lignes totalisent le TTC du snapshot au centime près", async () => {
    h.proposal = acceptedProposal(amountInput(50_000, 2_490, 2000));
    await run();
    expect(sent().line_items.map((l) => [l.price_data.product, l.price_data.unit_amount])).toEqual([
      ["prod_ma_reliure", 60_000],
      ["prod_shipping", 2_988],
    ]);
    expect(sentTotal()).toBe(62_988);
  });

  it("le montant attendu et la proposition voyagent dans les métadonnées de la session ET du paiement", async () => {
    h.proposal = acceptedProposal(amountInput(50_000, 0, 2000));
    await run();
    for (const metadata of [sent().metadata, sent().payment_intent_data.metadata]) {
      expect(metadata).toMatchObject({ case_id: CASE_ID, proposal_id: PROPOSAL_ID, brand: "MA_RELIURE", amount_due_cents: "60000" });
    }
    expect(h.stripe.create.mock.calls[0][1]).toEqual({ idempotencyKey: `checkout-session-${PROPOSAL_ID}-60000` });
    expect(h.recorded).toEqual(["cs_new"]);
  });

  it("une session ouverte qui demande déjà le bon montant est réutilisée, pas dupliquée", async () => {
    h.proposal = acceptedProposal(amountInput(50_000, 0, 2000));
    h.payment = { paidAt: null, stripeCheckoutSessionId: "cs_open" };
    h.stripe.retrieve.mockResolvedValue({ id: "cs_open", status: "open", url: "https://checkout.stripe.test/cs_open", amount_total: 60_000, currency: "eur" });
    expect((await run()).url).toBe("https://checkout.stripe.test/cs_open");
    expect(h.stripe.create).not.toHaveBeenCalled();
    expect(h.stripe.expire).not.toHaveBeenCalled();
  });

  it("une session ouverte AVANT la correction (montant HT) n'est jamais réutilisée : expirée puis recréée au TTC", async () => {
    h.proposal = acceptedProposal(amountInput(50_000, 0, 2000));
    h.payment = { paidAt: null, stripeCheckoutSessionId: "cs_old" };
    h.stripe.retrieve.mockResolvedValue({ id: "cs_old", status: "open", url: "https://checkout.stripe.test/cs_old", amount_total: 50_000, currency: "eur" });
    const result = await run();
    expect(h.stripe.expire).toHaveBeenCalledWith("cs_old");
    expect(result.url).toBe("https://checkout.stripe.test/cs_new");
    expect(sentTotal()).toBe(60_000);
  });

  it("une session ouverte dans une autre devise n'est pas réutilisée non plus", async () => {
    h.proposal = acceptedProposal(amountInput(50_000, 0, 2000));
    h.payment = { paidAt: null, stripeCheckoutSessionId: "cs_usd" };
    h.stripe.retrieve.mockResolvedValue({ id: "cs_usd", status: "open", url: "u", amount_total: 60_000, currency: "usd" });
    await run();
    expect(h.stripe.expire).toHaveBeenCalledWith("cs_usd");
  });
});

describe("ce qui ne doit jamais atteindre Stripe", () => {
  it.each([
    ["TVA non résolue", () => acceptedProposal(amountInput(50_000, 0, null)), 409],
    ["snapshot incohérent (TTC ≠ HT + TVA)", () => acceptedProposal(amountInput(50_000, 0, 2000, { customerTotalTtcCents: 50_000 })), 409],
    ["acompte prévu (paiement en deux temps inexistant)", () => acceptedProposal(amountInput(50_000, 0, 2000, { depositType: "PERCENTAGE", depositAmountCents: 15_000 })), 409],
    ["fiscalité non validée", () => acceptedProposal(amountInput(50_000, 0, 2000), { taxPolicy: "MANUAL_TAX_REVIEW", taxValidatedAt: null }), 409],
    ["proposition non acceptée", () => acceptedProposal(amountInput(50_000, 0, 2000), { status: "proposed", acceptedAt: null }), 409],
  ] as [string, () => Record<string, unknown>, number][])("%s → refus 409, aucun appel Stripe", async (_label, build, status) => {
    h.proposal = build();
    expect(await codeOf(run())).toBe(status);
    expect(h.stripe.create).not.toHaveBeenCalled();
    expect(h.stripe.expire).not.toHaveBeenCalled();
    expect(h.stripe.assertAccount).not.toHaveBeenCalled();
  });

  it("déjà payée → 409, aucun appel Stripe", async () => {
    h.proposal = acceptedProposal(amountInput(50_000, 0, 2000));
    h.payment = { paidAt: "2026-09-19T11:00:00.000Z", stripeCheckoutSessionId: "cs_done" };
    expect(await codeOf(run())).toBe(409);
    expect(h.stripe.create).not.toHaveBeenCalled();
  });

  it("aucune proposition acceptée → 409", async () => {
    h.proposal = null;
    expect(await codeOf(run())).toBe(409);
    expect(h.stripe.create).not.toHaveBeenCalled();
  });

  it("l'entrée du serveur est le seul identifiant de dossier : aucun montant ne vient du navigateur", () => {
    const src = readFileSync(new URL("./checkoutSession.server.ts", import.meta.url), "utf8");
    expect(src).toMatch(/inputValidator\(\(data: unknown\) => z\.object\(\{ caseId: uuid \}\)\.parse\(data\)\)/);
  });
});
