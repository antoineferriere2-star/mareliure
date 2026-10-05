/**
 * Un seul statut lisible pour une commande Oppe, du brouillon à la fin : la proposition dit ce
 * qui précède le paiement, la commande ce qui le suit. Jamais un statut deviné.
 */
export type OppeOrderStage =
  | "draft"
  | "sent"
  | "accepted"
  | "paid"
  | "in_production"
  | "completed"
  | "cancelled";

export function oppeOrderStage(input: {
  proposalStatus: string | null;
  paid: boolean;
  orderStatus: "paid" | "in_production" | "completed" | "cancelled" | null;
}): OppeOrderStage | null {
  if (input.orderStatus) return input.orderStatus;
  if (input.paid) return "paid";
  if (input.proposalStatus === "accepted") return "accepted";
  if (input.proposalStatus === "proposed") return "sent";
  if (input.proposalStatus === "draft") return "draft";
  if (input.proposalStatus === "cancelled") return "cancelled";
  return null;
}

export const ORDER_STAGE_LABELS: Record<OppeOrderStage, { fr: string; en: string }> = {
  draft: { fr: "Brouillon", en: "Draft" },
  sent: { fr: "Devis envoyé", en: "Quote sent" },
  accepted: { fr: "Devis accepté", en: "Quote accepted" },
  paid: { fr: "Payée", en: "Paid" },
  in_production: { fr: "En réalisation", en: "In progress" },
  completed: { fr: "Terminée", en: "Completed" },
  cancelled: { fr: "Annulée", en: "Cancelled" },
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  paid: ORDER_STAGE_LABELS.paid.fr,
  in_production: ORDER_STAGE_LABELS.in_production.fr,
  completed: ORDER_STAGE_LABELS.completed.fr,
  cancelled: ORDER_STAGE_LABELS.cancelled.fr,
};
