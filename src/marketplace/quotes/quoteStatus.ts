/**
 * Les états d'un devis et ce qu'on peut en faire. Pur : aucune lecture, aucune
 * écriture. « Expiré » est déduit de la date de validité à l'affichage — aucun
 * traitement planifié ne change un devis dans son dos.
 */

export const QUOTE_STATUSES = ["draft", "sent", "accepted", "refused", "expired", "invoiced"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  refused: "Refusé",
  expired: "Expiré",
  invoiced: "Facturé",
};

/**
 * Les changements d'état que le relieur peut demander. `invoiced` n'y figure
 * jamais : on ne devient « facturé » qu'en convertissant le devis en facture.
 */
const TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ["sent", "accepted", "refused"],
  sent: ["accepted", "refused", "expired"],
  accepted: ["refused"],
  refused: [],
  expired: ["sent", "accepted"],
  invoiced: [],
};

export function isQuoteStatus(value: string): value is QuoteStatus {
  return (QUOTE_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: QuoteStatus): readonly QuoteStatus[] {
  return TRANSITIONS[from];
}

/** Seul un brouillon se modifie ; dès qu'il est envoyé, il est figé. */
export function isEditable(status: QuoteStatus): boolean {
  return status === "draft";
}

export function canConvertToInvoice(status: QuoteStatus): boolean {
  return status === "accepted";
}

/** Le statut à AFFICHER : un devis brouillon ou envoyé dont la validité est dépassée se lit « Expiré ». */
export function effectiveStatus(status: QuoteStatus, validUntil: string, today: string): QuoteStatus {
  if ((status === "draft" || status === "sent") && validUntil < today) return "expired";
  return status;
}

/** Date de fin de validité : `issueDate` (AAAA-MM-JJ) + N jours, en UTC (aucun décalage d'heure d'été). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** La date du jour à Paris (AAAA-MM-JJ) : un devis émis à 23 h 50 en France ne porte pas la date du lendemain UTC. */
export function todayInParis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
