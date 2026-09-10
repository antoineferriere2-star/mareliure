/**
 * Les imprévus : ce que l'atelier découvre en ouvrant le livre.
 *
 * Un imprévu ne passe jamais par la conversation avec le client. L'atelier le
 * signale à Ma Reliure, qui l'examine, et qui seule peut, le cas échéant,
 * proposer au client une modification de sa commande. Un artisan ne négocie
 * pas un supplément directement : c'est la promesse du service.
 *
 * Aucun montant ici, à dessein. Un imprévu dit ce qui se passe ; le prix, s'il
 * doit changer, repasse par le Pricebook et une nouvelle photographie.
 */

export const SCOPE_REASONS = [
  "SEWING_WORSE",
  "PAPER_FRAGILE",
  "EXTRA_RESTORATION",
  "MATERIAL_UNAVAILABLE",
  "NOT_FEASIBLE",
  "OTHER",
] as const;
export type ScopeReason = (typeof SCOPE_REASONS)[number];

export const SCOPE_REASON_LABELS: Record<ScopeReason, string> = {
  SEWING_WORSE: "Couture plus dégradée que prévu",
  PAPER_FRAGILE: "Papier très fragile",
  EXTRA_RESTORATION: "Restauration supplémentaire nécessaire",
  MATERIAL_UNAVAILABLE: "Matériau prévu indisponible",
  NOT_FEASIBLE: "Intervention impossible comme prévue",
  OTHER: "Autre imprévu",
};

export const SCOPE_STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED"] as const;
export type ScopeStatus = (typeof SCOPE_STATUSES)[number];

export const SCOPE_STATUS_LABELS: Record<ScopeStatus, string> = {
  OPEN: "Signalé à Ma Reliure",
  IN_REVIEW: "En examen par Ma Reliure",
  RESOLVED: "Traité",
};

export function validateScopeIssue(input: { description: string }): string[] {
  const description = input.description.trim();
  if (description.length < 3) return ["Décrivez ce que vous avez découvert."];
  if (description.length > 3000) return ["La description est limitée à 3 000 caractères."];
  return [];
}
