import { commercialOriginOf } from "./commercialOrigin";

/** Atelier-facing groups derived from the existing offer and dossier states. */
export type WorkspaceCase = {
  state: string;
  caseStatus: string;
  unreadCount: number;
  /** Absent : projet Oppe, la valeur par défaut des dossiers. */
  acquisitionOrigin?: string | null;
};

export type CaseGroup = "new" | "current" | "waiting" | "quote" | "sent" | "closed";

/** Un projet Oppe ne reçoit jamais de devis de l'atelier : il suit la commande et facture Oppe. */
const isOppeOrder = (row: WorkspaceCase) => commercialOriginOf(row.acquisitionOrigin) === "oppe";

export function caseGroup(row: WorkspaceCase, hasDraftQuote = false, hasSentQuote = false): CaseGroup {
  if (row.state === "declined" || row.state === "cancelled" || row.caseStatus === "cancelled" || row.caseStatus === "completed") return "closed";
  if (row.state === "offered" || row.state === "invited") return "new";
  if (isOppeOrder(row)) return row.state === "accepted" ? "waiting" : "current";
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
  if (isOppeOrder(row)) return "Suivre le dossier";
  if (hasDraftQuote) return "Continuer le devis";
  if (row.state === "selected") return "Créer un devis";
  return "Suivre le dossier";
}
