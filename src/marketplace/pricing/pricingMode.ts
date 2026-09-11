/**
 * Le mode commercial d'un dossier (§23-§28) — dérivé de ce que le moteur sait
 * déjà, jamais d'une nouvelle heuristique.
 *
 * `status: "manual_review"` (pricing.engine.ts) est déjà un refus de chiffrer
 * → MANUAL_STUDY. La confiance (confidence.ts) mesure déjà la certitude d'un
 * chiffrage réussi — « haute » veut dire plusieurs ateliers d'accord,
 * récents, sur le travail exact demandé. C'est exactement la frontière entre
 * un prix ferme et une fourchette à confirmer après examen : aucun seuil
 * nouveau n'est inventé ici.
 */
import type { PricingSuggestion } from "./pricing.types";

export const PRICING_MODES = ["FIXED_PRICE", "ESTIMATE_THEN_CONFIRM", "MANUAL_STUDY"] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

export function pricingModeFor(
  suggestion: Pick<PricingSuggestion, "status" | "confidence">,
): PricingMode {
  if (suggestion.status === "manual_review") return "MANUAL_STUDY";
  return suggestion.confidence === "high" ? "FIXED_PRICE" : "ESTIMATE_THEN_CONFIRM";
}

/**
 * L'acompte d'un projet ESTIMATE_THEN_CONFIRM (§25) : max(pourcentage du bas
 * de fourchette, plancher absolu) — même formule que la marge minimale
 * (pricing.engine.ts#validateManagedPrice), jamais un montant fixe.
 *
 * Basé sur le bas de la fourchette, pas le haut : l'acompte garantit un
 * engagement réel sans anticiper le prix définitif, que seul l'examen
 * physique de l'atelier peut fixer (§26).
 */
export function depositCentsFor(
  lowEstimateCents: number,
  policy: { depositPercentageBps: number; depositMinimumCents: number },
): number {
  return Math.max(
    policy.depositMinimumCents,
    Math.ceil((lowEstimateCents * policy.depositPercentageBps) / 10_000),
  );
}
