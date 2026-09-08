/**
 * Where a case is in the transaction.
 *
 * Deliberately separate from Métré's own statuses. `build_dossiers.status`
 * answers "is this qualification complete?"; this answers "where is the
 * transaction?". Merging them would produce one enum that means two things and
 * is wrong for both — the very duplication §49 warns against.
 *
 * Transitions are declared rather than implied, so an impossible jump (paid ->
 * matching, delivered -> binder_selected) fails a test instead of leaving a
 * case in a state no screen can render.
 */

export const CASE_STATUSES = [
  /** Ingested from a Dossier, not yet looked at by anyone. */
  "under_review",
  /** Cleared for a Ma Reliure price suggestion and validation. */
  "pricing",
  /** Price validated; the admin is choosing relieurs. */
  "matching",
  "awaiting_binder_response",
  "binder_accepted",
  "binder_selected",
  "awaiting_payment",
  "paid",
  "shipping_to_binder",
  "received_by_binder",
  "in_progress",
  "awaiting_approval",
  "shipping_to_customer",
  "delivered",
  "completed",
  "cancelled",
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

/** Human labels for the back-office. French, like everything a person reads here. */
export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  under_review: "À examiner",
  pricing: "Prix à valider",
  matching: "Sélection des relieurs",
  awaiting_binder_response: "Réponse des ateliers attendue",
  binder_accepted: "Atelier disponible",
  binder_selected: "Relieur choisi",
  awaiting_payment: "En attente de paiement",
  paid: "Payé",
  shipping_to_binder: "En route vers l'atelier",
  received_by_binder: "Reçu par l'atelier",
  in_progress: "Travail en cours",
  awaiting_approval: "En attente de validation",
  shipping_to_customer: "En route vers le client",
  delivered: "Livré",
  completed: "Terminé",
  cancelled: "Annulé",
};

/**
 * Cancelling is allowed from anywhere before money moves, so it is added to
 * every entry below rather than repeated in each list.
 */
const TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  under_review: ["pricing"],
  pricing: ["matching"],
  matching: ["awaiting_binder_response"],
  awaiting_binder_response: ["binder_accepted", "matching"],
  binder_accepted: ["binder_selected", "matching"],
  binder_selected: ["awaiting_payment"],
  awaiting_payment: ["paid"],
  paid: ["shipping_to_binder"],
  shipping_to_binder: ["received_by_binder"],
  received_by_binder: ["in_progress"],
  in_progress: ["awaiting_approval", "shipping_to_customer"],
  awaiting_approval: ["in_progress", "shipping_to_customer"],
  shipping_to_customer: ["delivered"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
};

/** Once the customer has paid, cancelling is a refund conversation, not a status change. */
const CANCELLABLE: readonly CaseStatus[] = [
  "under_review",
  "pricing",
  "matching",
  "awaiting_binder_response",
  "binder_accepted",
  "binder_selected",
  "awaiting_payment",
];

export function nextCaseStatuses(from: CaseStatus): CaseStatus[] {
  const forward = [...TRANSITIONS[from]];
  return CANCELLABLE.includes(from) ? [...forward, "cancelled"] : forward;
}

export function canTransitionCase(from: CaseStatus, to: CaseStatus): boolean {
  return nextCaseStatuses(from).includes(to);
}

export function isCaseStatus(value: unknown): value is CaseStatus {
  return typeof value === "string" && (CASE_STATUSES as readonly string[]).includes(value);
}

/**
 * A case held for manual review must not reach relieurs, whatever the UI
 * offers. The check lives here rather than in the screen so that every caller —
 * admin action, future automation, a script — obeys it.
 */
export function canSendToBinders(input: {
  status: CaseStatus;
  manualReviewRequired: boolean;
  reviewCleared: boolean;
  pricingValidated: boolean;
}): boolean {
  if (input.manualReviewRequired && !input.reviewCleared) return false;
  return input.pricingValidated && input.status === "matching";
}
