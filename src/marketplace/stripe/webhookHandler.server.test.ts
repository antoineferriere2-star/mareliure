/**
 * Phase 0 / P1-2 + P1-3 — le comportement réel de `handleStripeWebhookRequest`.
 *
 * P1-2 : un paiement n'est marqué qu'une fois `payment_status`, montant, devise, session et
 *        proposition vérifiés.
 * P1-3 : un événement dont le traitement échoue n'est jamais « traité » : il reste `failed`, et
 *        la redélivrance de Stripe le REPREND (au lieu de l'absorber comme doublon).
 *
 * Seuls la base de données et le SDK Stripe sont remplacés. L'état des événements et l'écriture des
 * paiements reproduisent les fonctions SQL `marketplace_claim_webhook_event` et
 * `marketplace_mark_proposal_paid` (vérifiées sur Postgres réel dans le contrôle de migration).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { amountInput } from "./amountDue.fixtures";

type EventStatus = "received" | "processing" | "processed" | "failed";
interface EventRow {
  id: string;
  status: EventStatus;
  attempts: number;
  processingError: string | null;
  startedAtMs: number;
}
interface PaymentRow {
  proposalId: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  paidAt: string | null;
  amountPaidCents: number | null;
  currency: string | null;
}

const db = vi.hoisted(() => ({
  events: new Map<string, EventRow>(),
  payment: null as null | PaymentRow,
  proposal: null as null | Record<string, unknown>,
  journal: [] as { case_id: string; event_type: string; metadata: Record<string, unknown> }[],
  failNextJournalInsert: false,
  failNextProposalLoad: false,
  nowMs: 1_000_000,
  logged: [] as string[],
}));

const STALE_MS = 300_000;

vi.mock("@/build/services/adminAuth.server", () => ({
  admin: async () => ({
    from: (table: string) => {
      if (table !== "marketplace_events") throw new Error(`unexpected table ${table}`);
      return {
        insert: async (row: { case_id: string; event_type: string; metadata: Record<string, unknown> }) => {
          if (db.failNextJournalInsert) {
            db.failNextJournalInsert = false;
            return { error: new Error("journal insert failed") };
          }
          db.journal.push(row);
          return { error: null };
        },
        select: () => {
          const filters: [string, unknown][] = [];
          let contains: Record<string, unknown> = {};
          const q = {
            eq: (col: string, value: unknown) => (filters.push([col, value]), q),
            contains: (_col: string, value: Record<string, unknown>) => ((contains = value), q),
            limit: async () => ({
              error: null,
              data: db.journal
                .filter((r) => filters.every(([c, v]) => (r as unknown as Record<string, unknown>)[c] === v))
                .filter((r) => Object.entries(contains).every(([k, v]) => r.metadata[k] === v))
                .map(() => ({ id: "x" })),
            }),
          };
          return q;
        },
      };
    },
  }),
}));
vi.mock("@/build/services/operationalLog.server", () => ({
  logOperationalError: (name: string) => void db.logged.push(name),
}));
vi.mock("./stripeClient.server", () => ({
  getMarketplaceStripeWebhookSecret: () => "whsec_test",
  getMarketplaceStripeClient: () => ({
    webhooks: {
      constructEvent: (raw: string) => {
        if (raw === "FORGED") throw new Error("bad signature");
        return JSON.parse(raw);
      },
    },
  }),
}));
vi.mock("@/marketplace/services/commercialProposalRepository.server", () => ({
  loadCommercialProposalById: async () => {
    if (db.failNextProposalLoad) {
      db.failNextProposalLoad = false;
      throw new Error("database unavailable");
    }
    return db.proposal;
  },
}));
vi.mock("@/marketplace/services/commercialPaymentRepository.server", () => ({
  loadCommercialPaymentState: async () =>
    db.payment
      ? {
          proposalId: db.payment.proposalId,
          stripeCheckoutSessionId: db.payment.stripeCheckoutSessionId,
          stripePaymentIntentId: db.payment.stripePaymentIntentId,
          stripeInvoiceId: null,
          paidAt: db.payment.paidAt,
        }
      : null,
  // Modèle de `marketplace_mark_proposal_paid`
  markCommercialPaymentSucceeded: async (
    _sb: unknown,
    proposalId: string,
    input: { paymentIntentId: string; amountCents: number; currency: string },
  ) => {
    if (db.payment?.paidAt) return db.payment.stripePaymentIntentId === input.paymentIntentId ? "already_paid_same" : "other_payment";
    db.payment = {
      proposalId,
      stripeCheckoutSessionId: db.payment?.stripeCheckoutSessionId ?? null,
      stripePaymentIntentId: input.paymentIntentId,
      paidAt: new Date(db.nowMs).toISOString(),
      amountPaidCents: input.amountCents,
      currency: input.currency,
    };
    return "marked";
  },
}));
vi.mock("@/marketplace/services/stripeWebhookLog.server", () => ({
  // Modèle de `marketplace_claim_webhook_event`
  claimWebhookEvent: async (_sb: unknown, event: { id: string }) => {
    const row = db.events.get(event.id);
    if (!row) {
      db.events.set(event.id, { id: event.id, status: "processing", attempts: 1, processingError: null, startedAtMs: db.nowMs });
      return { outcome: "claimed", attempts: 1 };
    }
    if (row.status === "processed") return { outcome: "already_processed", attempts: row.attempts };
    if (row.status === "processing" && row.startedAtMs > db.nowMs - STALE_MS) return { outcome: "in_progress", attempts: row.attempts };
    row.status = "processing";
    row.attempts += 1;
    row.startedAtMs = db.nowMs;
    return { outcome: "claimed", attempts: row.attempts };
  },
  markWebhookEventProcessed: async (_sb: unknown, id: string) => {
    const row = db.events.get(id)!;
    if (row.status === "processing") Object.assign(row, { status: "processed", processingError: null });
  },
  markWebhookEventFailed: async (_sb: unknown, id: string, message: string) => {
    const row = db.events.get(id)!;
    if (row.status === "processing") Object.assign(row, { status: "failed", processingError: message });
  },
}));

import { handleStripeWebhookRequest, MAX_WEBHOOK_ATTEMPTS } from "./webhookHandler.server";

const CASE_ID = "case-1";
const PROPOSAL_ID = "proposal-1";
const acceptedProposal = (over: Record<string, unknown> = {}) => ({
  id: PROPOSAL_ID,
  caseId: CASE_ID,
  status: "accepted",
  acceptedAt: "2026-09-19T10:00:00.000Z",
  ...amountInput(50_000, 0, 2000), // 500 € HT → 600 € TTC
  ...over,
});

let counter = 0;
const sessionEvent = (over: Record<string, unknown> = {}, id = `evt_${++counter}`, type = "checkout.session.completed") => ({
  id,
  type,
  data: {
    object: {
      id: "cs_1",
      metadata: { case_id: CASE_ID, proposal_id: PROPOSAL_ID },
      payment_intent: "pi_1",
      payment_status: "paid",
      amount_total: 60_000,
      currency: "eur",
      ...over,
    },
  },
});
const piEvent = (over: Record<string, unknown> = {}, id = `evt_${++counter}`) => ({
  id,
  type: "payment_intent.succeeded",
  data: {
    object: {
      id: "pi_1",
      metadata: { case_id: CASE_ID, proposal_id: PROPOSAL_ID },
      status: "succeeded",
      amount_received: 60_000,
      currency: "eur",
      ...over,
    },
  },
});
const deliver = async (event: unknown) => {
  const res = await handleStripeWebhookRequest(
    new Request("https://x.test/api/marketplace/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=abc" },
      body: typeof event === "string" ? event : JSON.stringify(event),
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};
const paid = () => Boolean(db.payment?.paidAt);
const paymentJournal = () => db.journal.filter((j) => j.event_type === "CUSTOMER_PAYMENT_SUCCEEDED");

beforeEach(() => {
  db.events.clear();
  db.journal = [];
  db.logged = [];
  db.failNextJournalInsert = false;
  db.failNextProposalLoad = false;
  db.nowMs = 1_000_000;
  db.proposal = acceptedProposal();
  db.payment = { proposalId: PROPOSAL_ID, stripeCheckoutSessionId: "cs_1", stripePaymentIntentId: null, paidAt: null, amountPaidCents: null, currency: null };
});

describe("P1-2 — un paiement n'est marqué qu'une fois vérifié", () => {
  it("payé, bon montant TTC, bonne devise, bonne session → marqué payé, journalisé, événement traité", async () => {
    const event = sessionEvent();
    const res = await deliver(event);
    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(paid()).toBe(true);
    expect(db.payment).toMatchObject({ stripePaymentIntentId: "pi_1", amountPaidCents: 60_000, currency: "eur" });
    expect(paymentJournal()).toHaveLength(1);
    expect(db.events.get(event.id)).toMatchObject({ status: "processed", attempts: 1 });
  });

  it("payment_status « unpaid » (paiement asynchrone en attente) → PAS payé, journalisé en attente", async () => {
    const res = await deliver(sessionEvent({ payment_status: "unpaid" }));
    expect(res.status).toBe(200);
    expect(paid()).toBe(false);
    expect(db.journal.map((j) => j.event_type)).toEqual(["CUSTOMER_PAYMENT_PENDING"]);
  });

  it("payment_status « no_payment_required » → PAS payé", async () => {
    await deliver(sessionEvent({ payment_status: "no_payment_required", amount_total: 0 }));
    expect(paid()).toBe(false);
    expect(db.journal.map((j) => j.event_type)).toEqual(["CUSTOMER_PAYMENT_NOT_CONFIRMED"]);
  });

  it("paiement asynchrone : `completed` unpaid puis `async_payment_succeeded` payé → marqué payé à la confirmation", async () => {
    await deliver(sessionEvent({ payment_status: "unpaid" }, "evt_a"));
    expect(paid()).toBe(false);
    const res = await deliver(sessionEvent({ payment_status: "paid" }, "evt_b", "checkout.session.async_payment_succeeded"));
    expect(res.status).toBe(200);
    expect(paid()).toBe(true);
  });

  it("mauvais montant (le HT au lieu du TTC) → PAS payé, événement en échec avec sa raison", async () => {
    const event = sessionEvent({ amount_total: 50_000 });
    const res = await deliver(event);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ ok: false, reason: "amount_mismatch" });
    expect(paid()).toBe(false);
    expect(db.events.get(event.id)).toMatchObject({ status: "failed", processingError: expect.stringContaining("amount_mismatch") });
    expect(paymentJournal()).toHaveLength(0);
  });

  it("mauvaise devise → PAS payé", async () => {
    const event = sessionEvent({ currency: "usd" });
    const res = await deliver(event);
    expect(res.body).toMatchObject({ reason: "currency_mismatch" });
    expect(paid()).toBe(false);
    expect(db.events.get(event.id)?.status).toBe("failed");
  });

  it("mauvaise session (pas celle créée pour cette proposition) → PAS payé", async () => {
    const res = await deliver(sessionEvent({ id: "cs_forged" }));
    expect(res.body).toMatchObject({ reason: "session_mismatch" });
    expect(paid()).toBe(false);
  });

  it("proposition inconnue ou d'un autre dossier → PAS payé", async () => {
    db.proposal = null;
    expect((await deliver(sessionEvent())).body).toMatchObject({ reason: "proposal_unknown" });
    db.proposal = acceptedProposal({ caseId: "case-OTHER" });
    expect((await deliver(sessionEvent())).body).toMatchObject({ reason: "case_mismatch" });
    expect(paid()).toBe(false);
  });

  it("proposition non acceptée → PAS payé", async () => {
    db.proposal = acceptedProposal({ status: "proposed", acceptedAt: null });
    expect((await deliver(sessionEvent())).body).toMatchObject({ reason: "proposal_not_accepted" });
    expect(paid()).toBe(false);
  });

  it("le PaymentIntent du même paiement, arrivé après la session, ne double ni le paiement ni le journal", async () => {
    await deliver(sessionEvent());
    const first = { ...db.payment! };
    db.nowMs += 5_000;
    const res = await deliver(piEvent());
    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(db.payment).toEqual(first); // rien réécrit : même paid_at, même PaymentIntent
    expect(paymentJournal()).toHaveLength(1);
  });

  it("un événement PaymentIntent au mauvais montant n'est pas cru non plus", async () => {
    const res = await deliver(piEvent({ amount_received: 50_000 }));
    expect(res.body).toMatchObject({ reason: "amount_mismatch" });
    expect(paid()).toBe(false);
  });

  it("un second paiement (autre PaymentIntent) sur une commande déjà payée est signalé, rien n'est écrasé", async () => {
    await deliver(sessionEvent());
    const first = { ...db.payment! };
    const second = sessionEvent({ payment_intent: "pi_2" });
    const res = await deliver(second);
    expect(res.body).toMatchObject({ ok: false, reason: "duplicate_payment" });
    expect(db.payment).toEqual(first);
    expect(db.events.get(second.id)?.status).toBe("failed");
  });

  it("un événement d'un autre produit du même compte Stripe (sans notre metadata) est ignoré, sans écriture", async () => {
    const event = sessionEvent({ metadata: {} });
    const res = await deliver(event);
    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(paid()).toBe(false);
    expect(db.journal).toHaveLength(0);
    expect(db.events.get(event.id)?.status).toBe("processed");
  });
});

describe("P1-3 — un événement en échec n'est jamais « traité » : la redélivrance le reprend", () => {
  it("doublon d'un événement TRAITÉ → accusé, jamais rejoué", async () => {
    const event = sessionEvent();
    await deliver(event);
    const before = { payment: { ...db.payment! }, journal: db.journal.length };
    const res = await deliver(event);
    expect(res).toEqual({ status: 200, body: { ok: true, duplicate: true } });
    expect({ payment: db.payment, journal: db.journal.length }).toEqual(before);
    expect(db.events.get(event.id)?.attempts).toBe(1);
  });

  it("échec métier (montant faux) puis redélivrance après correction → REPRIS et traité (plus jamais absorbé)", async () => {
    const event = sessionEvent();
    db.proposal = acceptedProposal({ customerTotalTtcCents: 1 }); // snapshot corrompu → non payable
    expect((await deliver(event)).status).toBe(500);
    expect(db.events.get(event.id)).toMatchObject({ status: "failed", attempts: 1 });

    db.proposal = acceptedProposal(); // la donnée est corrigée
    const retry = await deliver(event); // Stripe redélivre le MÊME event.id
    expect(retry).toEqual({ status: 200, body: { ok: true } });
    expect(paid()).toBe(true);
    expect(db.events.get(event.id)).toMatchObject({ status: "processed", attempts: 2, processingError: null });
  });

  it("panne d'infrastructure en cours de traitement → 500 + failed ; la redélivrance réussit", async () => {
    const event = sessionEvent();
    db.failNextProposalLoad = true;
    const first = await deliver(event);
    expect(first.status).toBe(500);
    expect(db.events.get(event.id)).toMatchObject({ status: "failed", processingError: expect.stringContaining("database unavailable") });
    expect(paid()).toBe(false);

    expect((await deliver(event)).status).toBe(200);
    expect(paid()).toBe(true);
    expect(db.events.get(event.id)?.status).toBe("processed");
  });

  it("paiement enregistré mais journal non écrit (arrêt entre les deux) → la reprise écrit le journal, une seule fois", async () => {
    const event = sessionEvent();
    db.failNextJournalInsert = true;
    expect((await deliver(event)).status).toBe(500);
    expect(paid()).toBe(true); // le paiement, lui, est bien enregistré
    expect(paymentJournal()).toHaveLength(0);
    expect(db.events.get(event.id)?.status).toBe("failed");

    expect((await deliver(event)).status).toBe(200);
    expect(paymentJournal()).toHaveLength(1);
    expect(db.events.get(event.id)?.status).toBe("processed");
    // …et une troisième livraison n'ajoute rien.
    expect((await deliver(event)).body).toEqual({ ok: true, duplicate: true });
    expect(paymentJournal()).toHaveLength(1);
  });

  it("le même événement livré pendant qu'un autre worker le traite → 409, jamais traité deux fois en parallèle", async () => {
    db.events.set("evt_busy", { id: "evt_busy", status: "processing", attempts: 1, processingError: null, startedAtMs: db.nowMs });
    const res = await deliver(sessionEvent({}, "evt_busy"));
    expect(res.status).toBe(409);
    expect(paid()).toBe(false);
  });

  it("un worker mort en cours de traitement (délai dépassé) est repris", async () => {
    db.events.set("evt_stale", { id: "evt_stale", status: "processing", attempts: 1, processingError: null, startedAtMs: db.nowMs - STALE_MS - 1 });
    expect((await deliver(sessionEvent({}, "evt_stale"))).status).toBe(200);
    expect(paid()).toBe(true);
    expect(db.events.get("evt_stale")).toMatchObject({ status: "processed", attempts: 2 });
  });

  it("l'échec persistant : 500 tant qu'on peut réessayer, 200 à la dernière tentative — mais TOUJOURS failed, jamais processed", async () => {
    const event = sessionEvent({ amount_total: 1 });
    let last = { status: 0, body: {} as Record<string, unknown> };
    for (let i = 1; i <= MAX_WEBHOOK_ATTEMPTS; i += 1) {
      last = await deliver(event);
      if (i < MAX_WEBHOOK_ATTEMPTS) expect(last.status).toBe(500);
    }
    expect(last.status).toBe(200);
    expect(last.body).toMatchObject({ ok: false, giveUp: true, attempts: MAX_WEBHOOK_ATTEMPTS });
    expect(db.events.get(event.id)).toMatchObject({ status: "failed", attempts: MAX_WEBHOOK_ATTEMPTS });
    expect(paid()).toBe(false);
  });

  it("les échecs sont journalisés côté opérations avec leur raison", async () => {
    await deliver(sessionEvent({ amount_total: 1 }));
    expect(db.logged).toContain("stripe-webhook.payment-rejected");
  });

  it("une signature invalide → 400, rien n'est lu ni enregistré", async () => {
    const res = await deliver("FORGED");
    expect(res.status).toBe(400);
    expect(db.events.size).toBe(0);
  });
});
