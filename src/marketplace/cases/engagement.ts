/**
 * Quand un dossier est engagé, et ce que cela interdit (Phase 0 / P1-5).
 *
 * Défaut corrigé : rien n'empêchait un dossier dont la proposition était acceptée, ou dont l'atelier
 * était choisi, de repartir silencieusement en « chiffrage » — `generateMarketplacePricing` écrivait
 * `status = 'pricing'` de partout, `marketplace_validate_pricing` écrivait `status = 'matching'` de
 * partout, et un dossier payé pouvait se retrouver à choisir des ateliers avec un prix changé.
 *
 * Deux degrés :
 * - ENGAGÉ : une proposition est acceptée, OU l'atelier est retenu (`binder_selected` et au-delà).
 *   Les conditions commerciales sont figées, le statut ne revient plus en arrière. Toute évolution
 *   passe par une nouvelle version explicite, jamais par une réécriture.
 * - OFFRES EN COURS (`awaiting_binder_response`, `binder_accepted`) : des ateliers ont reçu un prix ;
 *   on peut re-sélectionner (`matching`), pas revenir en chiffrage.
 *
 * Le même contrôle est écrit en base (trigger `marketplace_cases_guard_engagement`) : ce module
 * donne au serveur un refus net et lisible AVANT l'écriture, la base reste la garantie.
 *
 * Pur : aucune lecture, aucune écriture.
 */
import { isCaseStatus, type CaseStatus } from "./state";

/** L'atelier est retenu : le travail est engagé au-delà de la simple sélection. */
export const COMMITTED_STATUSES: readonly CaseStatus[] = [
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
];

/** Les seuls états où le prix peut encore être (re)généré, saisi ou validé. */
export const PRICING_EDITABLE_STATUSES: readonly CaseStatus[] = ["under_review", "pricing", "matching"];

export type RepriceBlock = "proposal_accepted" | "case_committed" | "offers_out" | "case_cancelled";

export type RepriceVerdict = { allowed: true } | { allowed: false; reason: RepriceBlock };

export function repriceVerdict(input: { status: string; hasAcceptedProposal: boolean }): RepriceVerdict {
  if (input.hasAcceptedProposal) return { allowed: false, reason: "proposal_accepted" };
  if (!isCaseStatus(input.status)) return { allowed: false, reason: "case_committed" };
  if (PRICING_EDITABLE_STATUSES.includes(input.status)) return { allowed: true };
  if (input.status === "cancelled") return { allowed: false, reason: "case_cancelled" };
  if (COMMITTED_STATUSES.includes(input.status)) return { allowed: false, reason: "case_committed" };
  return { allowed: false, reason: "offers_out" };
}

/** Les mots d'un refus : dit pourquoi, et ce qu'il faut faire — jamais un code brut. */
export const REPRICE_BLOCK_MESSAGES: Record<RepriceBlock, string> = {
  proposal_accepted:
    "La proposition de ce dossier est acceptée : son prix est figé. Toute évolution commerciale passe par une nouvelle version de proposition explicite.",
  case_committed:
    "Ce dossier est engagé auprès d'un atelier : son prix est figé. Toute évolution commerciale passe par une nouvelle version de proposition explicite.",
  offers_out:
    "Des offres sont en cours auprès des ateliers : le prix ne peut plus être recalculé. Ramenez d'abord le dossier à la sélection des ateliers.",
  case_cancelled: "Ce dossier est annulé.",
};
