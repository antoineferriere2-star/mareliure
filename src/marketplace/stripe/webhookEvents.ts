/**
 * Que faire d'un événement Stripe déjà vérifié — pur, sans Stripe SDK ni
 * base de données, pour rester testable (§27). `webhookHandler.server.ts`
 * exécute la décision, ce module ne fait que la prendre.
 *
 * Les événements minimum du brief du 16 septembre 2026 (§15) : ceux qui
 * font avancer un paiement mettent à jour l'état (idempotent — voir
 * markCommercialPaymentSucceeded, un upsert), les autres sont uniquement
 * journalisés (§23), jamais silencieusement ignorés.
 */

export interface StripeEventLike {
  type: string;
  data: {
    object: {
      id: string;
      metadata?: Record<string, string> | null;
      payment_intent?: string | { id: string } | null;
      invoice?: string | { id: string } | null;
    };
  };
}

export type WebhookAction =
  | { kind: "mark_paid"; caseId: string; proposalId: string; paymentIntentId: string; invoiceId: string | null }
  | { kind: "log"; eventName: string; caseId: string | null }
  | { kind: "ignore" };

const LOGGED_EVENT_NAMES: Record<string, string> = {
  "payment_intent.payment_failed": "CUSTOMER_PAYMENT_FAILED",
  "charge.refunded": "REFUND_CREATED",
  "charge.dispute.created": "DISPUTE_OPENED",
  "invoice.paid": "INVOICE_CREATED",
  "invoice.payment_failed": "INVOICE_PAYMENT_FAILED",
};

function objectId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export function decideWebhookAction(event: StripeEventLike): WebhookAction {
  const metadata = event.data.object.metadata ?? {};
  const caseId = metadata.case_id ?? null;
  const proposalId = metadata.proposal_id ?? null;

  if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
    const paymentIntentId =
      event.type === "payment_intent.succeeded" ? event.data.object.id : objectId(event.data.object.payment_intent);
    if (!caseId || !proposalId || !paymentIntentId) {
      // Un Checkout/PaymentIntent sans notre metadata n'est pas le nôtre —
      // un autre produit (Métré, BatiScores, MuWo…) partage ce même compte
      // Stripe live (voir l'audit du 16 septembre 2026). Ignorer, jamais
      // deviner à qui il appartient.
      return { kind: "ignore" };
    }
    return {
      kind: "mark_paid",
      caseId,
      proposalId,
      paymentIntentId,
      invoiceId: objectId(event.data.object.invoice),
    };
  }

  const eventName = LOGGED_EVENT_NAMES[event.type];
  if (eventName) return { kind: "log", eventName, caseId };

  return { kind: "ignore" };
}
