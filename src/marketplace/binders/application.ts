/**
 * La candidature d'un atelier — ce qu'un formulaire public collecte avant
 * qu'un compte, une invitation ou un profil n'existent (§7).
 *
 * Volontairement séparée de `marketplace_binders` : une candidature n'est
 * pas un atelier, elle n'a ni compétences vérifiées ni conditions
 * commerciales — la conflation des deux transformerait chaque champ de ce
 * formulaire en une décision produit sur le profil opérationnel. L'admin
 * crée l'atelier lui-même, à la main, une fois la candidature lue — le même
 * principe que l'invitation (Phase A) : jamais d'auto-déclaration.
 *
 * Pure et sans framework, comme membership.ts et decisions.ts.
 */
import type { Viewer } from "@/marketplace/permissions";

export const LEGAL_ENTITY_TYPES = [
  "auto_entrepreneur",
  "ei",
  "eirl",
  "eurl",
  "sarl",
  "sas",
  "autre",
] as const;
export type LegalEntityType = (typeof LEGAL_ENTITY_TYPES)[number];

export const LEGAL_ENTITY_LABELS: Record<LegalEntityType, string> = {
  auto_entrepreneur: "Auto-entrepreneur / micro-entreprise",
  ei: "Entreprise individuelle",
  eirl: "EIRL",
  eurl: "EURL",
  sarl: "SARL",
  sas: "SAS / SASU",
  autre: "Autre",
};

/**
 * Une bande, jamais un montant exact — moins intrusif pour un premier
 * formulaire public, et suffisant pour une première lecture par l'admin.
 * Même discipline que `declared_value_band` (marketplace_cases).
 */
export const REVENUE_BANDS = [
  "under_20k",
  "20k_50k",
  "50k_100k",
  "100k_250k",
  "over_250k",
  "undisclosed",
] as const;
export type RevenueBand = (typeof REVENUE_BANDS)[number];

export const REVENUE_BAND_LABELS: Record<RevenueBand, string> = {
  under_20k: "Moins de 20 000 €",
  "20k_50k": "20 000 – 50 000 €",
  "50k_100k": "50 000 – 100 000 €",
  "100k_250k": "100 000 – 250 000 €",
  over_250k: "Plus de 250 000 €",
  undisclosed: "Je préfère ne pas préciser",
};

export const APPLICATION_STATUSES = ["new", "reviewed", "accepted", "rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Seul un admin lit et traite les candidatures — jamais l'atelier candidat lui-même. */
export function canReviewApplications(viewer: Viewer): boolean {
  return viewer.role === "admin";
}

export interface ReviewDecision {
  allowed: boolean;
  reason?: string;
}

/** Une candidature déjà traitée ne se retraite pas silencieusement deux fois. */
export function decideReview(application: { status: string }): ReviewDecision {
  if (application.status !== "new") {
    return { allowed: false, reason: "Cette candidature a déjà été traitée." };
  }
  return { allowed: true };
}
