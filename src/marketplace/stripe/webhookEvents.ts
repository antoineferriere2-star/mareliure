/**
 * Que faire d'un événement Stripe déjà vérifié (signature) — pur, sans Stripe SDK ni
 * base de données, pour rester testable (§27). `webhookHandler.server.ts`
 * exécute la décision, ce module ne fait que la prendre.
 *
 * Les événements minimum du brief du 16 septembre 2026 (§15) : ceux qui
 * font avancer un paiement produisent une PREUVE de paiement (`PaymentEvidence`) que le
 * gestionnaire vérifie contre la proposition acceptée avant de marquer quoi que ce soit
 * (`paymentVerification.ts`). Les autres sont uniquement journalisés (§23), jamais
 * silencieusement ignorés.
 *
 * Phase 0 / P1-2 : un événement ne dit pas « payé » à lui seul. `checkout.session.completed`
 * signifie « le client a terminé le Checkout », PAS « l'argent est arrivé » : un paiement
 * asynchrone (virement SEPA, prélèvement…) est `unpaid` à ce moment-là et confirmé plus tard
 * par `checkout.session.async_payment_succeeded`.
 */

export interface StripeEventLike {
  type: string;
  data: {
    object: {
      id: string;
      metadata?: Record<string, string> | null;
      payment_intent?: string | { id: string } | null;
      invoice?: string | { id: string } | null;
      /** Checkout Session : `paid` | `unpaid` | `no_payment_required`. */
      payment_status?: string | null;
      /** Checkout Session : total réellement demandé (centimes, TTC). */
      amount_total?: number | null;
      /** PaymentIntent : ce qui a été encaissé. */
      amount_received?: number | null;
      /** PaymentIntent : `succeeded` quand l'argent est là. */
      status?: string | null;
      currency?: string | null;
    };
  };
}

/** Ce que Stripe affirme d'un paiement — jamais cru sans être comparé à la proposition. */
export interface PaymentEvidence {
  source: "checkout_session" | "payment_intent";
  /** `paid` quand Stripe confirme l'encaissement ; toute autre valeur n'est pas un paiement. */
  paymentStatus: string | null;
  amountCents: number | null;
  currency: string | null;
  /** L'id de la session Checkout ; `null` pour un événement PaymentIntent. */
  checkoutSessionId: string | null;
  paymentIntentId: string;
  invoiceId: string | null;
}

export type WebhookAction =
  | { kind: "mark_paid"; caseId: string; proposalId: string; evidence: PaymentEvidence }
  | { kind: "log"; eventName: string; caseId: string | null }
  | { kind: "ignore" };

const LOGGED_EVENT_NAMES: Record<string, string> = {
  "payment_intent.payment_failed": "CUSTOMER_PAYMENT_FAILED",
  "checkout.session.async_payment_failed": "CUSTOMER_PAYMENT_FAILED",
  "charge.refunded": "REFUND_CREATED",
  "charge.dispute.created": "DISPUTE_OPENED",
  "invoice.paid": "INVOICE_CREATED",
  "invoice.payment_failed": "INVOICE_PAYMENT_FAILED",
};

const SESSION_PAYMENT_EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];

function objectId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export function decideWebhookAction(event: StripeEventLike): WebhookAction {
  const object = event.data.object;
  const metadata = object.metadata ?? {};
  const caseId = metadata.case_id ?? null;
  const proposalId = metadata.proposal_id ?? null;

  const isSessionEvent = SESSION_PAYMENT_EVENTS.includes(event.type);
  if (isSessionEvent || event.type === "payment_intent.succeeded") {
    const paymentIntentId = event.type === "payment_intent.succeeded" ? object.id : objectId(object.payment_intent);
    if (!caseId || !proposalId || !paymentIntentId) {
      // Un Checkout/PaymentIntent sans notre metadata n'est pas le nôtre —
      // un autre produit (Métré, BatiScores, MuWo…) partage ce même compte
      // Stripe live (voir l'audit du 16 septembre 2026). Ignorer, jamais
      // deviner à qui il appartient.
      return { kind: "ignore" };
    }

    const paymentStatus = isSessionEvent
      ? (object.payment_status ?? null)
      : object.status === "succeeded"
        ? "paid"
        : (object.status ?? null);

    if (paymentStatus !== "paid") {
      // Checkout terminé mais argent pas (encore) là : paiement asynchrone en attente — le
      // `checkout.session.async_payment_succeeded` le confirmera — ou état inattendu. Dans les
      // deux cas, ce n'est PAS un paiement : on journalise, on ne marque rien.
      return {
        kind: "log",
        eventName: paymentStatus === "unpaid" ? "CUSTOMER_PAYMENT_PENDING" : "CUSTOMER_PAYMENT_NOT_CONFIRMED",
        caseId,
      };
    }

    return {
      kind: "mark_paid",
      caseId,
      proposalId,
      evidence: {
        source: isSessionEvent ? "checkout_session" : "payment_intent",
        paymentStatus,
        amountCents: (isSessionEvent ? object.amount_total : object.amount_received) ?? null,
        currency: object.currency ?? null,
        checkoutSessionId: isSessionEvent ? object.id : null,
        paymentIntentId,
        invoiceId: objectId(object.invoice),
      },
    };
  }

  const eventName = LOGGED_EVENT_NAMES[event.type];
  if (eventName) return { kind: "log", eventName, caseId };

  return { kind: "ignore" };
}
