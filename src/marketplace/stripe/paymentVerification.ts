/**
 * Ce qu'un événement Stripe doit prouver avant qu'une commande soit marquée payée
 * (Phase 0 / P1-2). Pur : le gestionnaire lui donne ce qu'il vient de relire en base.
 *
 * Défaut corrigé : `checkout.session.completed` et `payment_intent.succeeded` marquaient la
 * proposition payée dès que la metadata était présente — sans regarder si l'argent était arrivé
 * (paiement asynchrone `unpaid`), ni COMBIEN, ni en quelle devise, ni pour quelle session.
 * Ici, chaque affirmation de Stripe est comparée à la proposition acceptée, seule source du
 * montant (`resolveAmountDue`, la même que celle du Checkout).
 *
 * Fail closed : au moindre écart, le paiement n'est pas marqué et l'événement reste en échec
 * visible (`failed`, avec la raison) — jamais « traité ».
 */
import { resolveAmountDue, type AmountDue, type AmountDueInput } from "./amountDue";
import type { PaymentEvidence } from "./webhookEvents";

export type PaymentRejection =
  | "payment_not_confirmed"
  | "proposal_unknown"
  | "case_mismatch"
  | "proposal_not_accepted"
  | "amount_not_payable"
  | "currency_mismatch"
  | "amount_mismatch"
  | "session_mismatch"
  | "duplicate_payment";

/** Les faits de la proposition relus en base. */
export interface ProposalFacts extends AmountDueInput {
  id: string;
  caseId: string;
  status: string;
  acceptedAt: string | null;
}

/** L'état de paiement relu en base (`null` : aucune ligne). */
export interface PaymentFacts {
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  paidAt: string | null;
}

export type PaymentVerdict =
  | {
      ok: true;
      amountDue: AmountDue;
      /** Cette même preuve a déjà été enregistrée : rien à écrire, seulement à confirmer. */
      alreadyRecorded: boolean;
    }
  | { ok: false; reason: PaymentRejection; detail: string };

const reject = (reason: PaymentRejection, detail: string): PaymentVerdict => ({ ok: false, reason, detail });

export function verifyPaymentEvidence(input: {
  evidence: PaymentEvidence;
  /** Le `case_id` porté par la metadata de l'événement. */
  claimedCaseId: string;
  proposal: ProposalFacts | null;
  payment: PaymentFacts | null;
}): PaymentVerdict {
  const { evidence, proposal, payment } = input;

  if (evidence.paymentStatus !== "paid") return reject("payment_not_confirmed", `payment_status=${evidence.paymentStatus}`);
  if (!proposal) return reject("proposal_unknown", "proposal not found");
  if (proposal.caseId !== input.claimedCaseId) return reject("case_mismatch", "metadata case_id does not own this proposal");
  if (proposal.status !== "accepted" || !proposal.acceptedAt) return reject("proposal_not_accepted", `status=${proposal.status}`);

  const due = resolveAmountDue(proposal);
  if (!due.ok) return reject("amount_not_payable", due.reason);

  const currency = (evidence.currency ?? "").trim().toLowerCase();
  if (currency !== due.currency) return reject("currency_mismatch", `expected ${due.currency}, got ${currency || "none"}`);
  if (evidence.amountCents !== due.amountCents) {
    return reject("amount_mismatch", `expected ${due.amountCents}, got ${evidence.amountCents ?? "none"}`);
  }

  // Une session Checkout doit être CELLE que nous avons créée pour cette proposition. (Un événement
  // PaymentIntent ne porte pas d'id de session : il est rattaché par sa metadata, montant et devise.)
  if (evidence.source === "checkout_session" && payment?.stripeCheckoutSessionId !== evidence.checkoutSessionId) {
    return reject("session_mismatch", `recorded=${payment?.stripeCheckoutSessionId ?? "none"}, event=${evidence.checkoutSessionId}`);
  }

  if (payment?.paidAt) {
    if (payment.stripePaymentIntentId === evidence.paymentIntentId) return { ok: true, amountDue: due, alreadyRecorded: true };
    return reject("duplicate_payment", `already paid by ${payment.stripePaymentIntentId ?? "unknown"}, new ${evidence.paymentIntentId}`);
  }

  return { ok: true, amountDue: due, alreadyRecorded: false };
}
