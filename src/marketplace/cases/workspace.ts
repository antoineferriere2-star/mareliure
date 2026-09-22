/** Atelier-facing groups derived from the existing offer and dossier states. */
export type WorkspaceCase = {
  state: string;
  caseStatus: string;
  unreadCount: number;
};

export type CaseGroup = "new" | "current" | "waiting" | "quote" | "sent" | "closed";

export function caseGroup(row: WorkspaceCase, hasDraftQuote = false, hasSentQuote = false): CaseGroup {
  if (row.state === "declined" || row.state === "cancelled" || row.caseStatus === "cancelled" || row.caseStatus === "completed") return "closed";
  if (row.state === "offered" || row.state === "invited") return "new";
  if (hasSentQuote) return "sent";
  if (hasDraftQuote || row.state === "selected") return "quote";
  if (row.state === "accepted") return "waiting";
  return "current";
}

export function nextCaseAction(row: WorkspaceCase, hasWork: boolean, hasDraftQuote = false): string {
  if (row.unreadCount > 0) return "Répondre au message";
  if (row.state === "offered" || row.state === "invited") return "Examiner la demande";
  if (row.state === "accepted") return "Attendre la sélection";
  if (row.state === "selected" && !hasWork) return "Créer la fiche ouvrage";
  if (hasDraftQuote) return "Continuer le devis";
  if (row.state === "selected") return "Créer un devis";
  return "Suivre le dossier";
}
