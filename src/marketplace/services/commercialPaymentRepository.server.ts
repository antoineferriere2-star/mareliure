/**
 * L'état de paiement d'une proposition commerciale — séparé de
 * `marketplace_commercial_proposals` (immuable après acceptation, jamais
 * touché) pour cette raison précise : payer n'est pas un terme commercial,
 * c'est ce qui arrive ensuite à un terme commercial déjà figé. Une ligne par
 * proposition, dans `marketplace_commercial_proposal_payments` (migration
 * 20260916120000).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Supa = SupabaseClient<Database>;

export interface CommercialPaymentState {
  proposalId: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeInvoiceId: string | null;
  paidAt: string | null;
}

function toState(row: {
  proposal_id: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  paid_at: string | null;
}): CommercialPaymentState {
  return {
    proposalId: row.proposal_id,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    stripeInvoiceId: row.stripe_invoice_id,
    paidAt: row.paid_at,
  };
}

export async function loadCommercialPaymentState(
  sb: Supa,
  proposalId: string,
): Promise<CommercialPaymentState | null> {
  const { data, error } = await sb
    .from("marketplace_commercial_proposal_payments")
    .select("proposal_id, stripe_checkout_session_id, stripe_payment_intent_id, stripe_invoice_id, paid_at")
    .eq("proposal_id", proposalId)
    .maybeSingle();
  if (error) throw error;
  return data ? toState(data) : null;
}

/**
 * Enregistre la session Checkout créée pour cette proposition — appelé une
 * fois, juste après la création côté Stripe, jamais avant : c'est ce qui
 * permet à un appel suivant de retrouver la session existante plutôt que
 * d'en créer une seconde (voir createCommercialCheckoutSession).
 */
export async function recordCheckoutSession(
  sb: Supa,
  proposalId: string,
  checkoutSessionId: string,
): Promise<void> {
  const { error } = await sb.from("marketplace_commercial_proposal_payments").upsert(
    {
      proposal_id: proposalId,
      stripe_checkout_session_id: checkoutSessionId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "proposal_id" },
  );
  if (error) throw error;
}

export type PaymentRecording =
  /** Premier enregistrement de ce paiement. */
  | "marked"
  /** Le même PaymentIntent, déjà enregistré (doublon d'événement, reprise) — rien n'est réécrit. */
  | "already_paid_same"
  /** La proposition est déjà payée par UN AUTRE PaymentIntent (double paiement) — rien n'est écrasé. */
  | "other_payment";

/**
 * Le webhook est l'unique appelant : un paiement ne se marque jamais depuis un retour de navigateur.
 *
 * Ce qui a été encaissé (montant, devise) est conservé, et un paiement déjà enregistré n'est JAMAIS
 * réécrit (`paid_at`, PaymentIntent) : la décision est atomique côté base
 * (`marketplace_mark_proposal_paid`), pas un upsert qui écraserait la première date de paiement.
 */
export async function markCommercialPaymentSucceeded(
  sb: Supa,
  proposalId: string,
  input: { paymentIntentId: string; invoiceId?: string | null; amountCents: number; currency: string },
): Promise<PaymentRecording> {
  const { data, error } = await sb.rpc("marketplace_mark_proposal_paid", {
    p_proposal_id: proposalId,
    p_payment_intent_id: input.paymentIntentId,
    p_invoice_id: (input.invoiceId ?? null) as unknown as string,
    p_amount_cents: input.amountCents,
    p_currency: input.currency,
  });
  if (error) throw error;
  if (data !== "marked" && data !== "already_paid_same" && data !== "other_payment") {
    throw new Error("marketplace_mark_proposal_paid returned no usable outcome");
  }
  return data;
}
