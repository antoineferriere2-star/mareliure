import type { CaseProfile } from "@/marketplace/cases/caseProfile";
import type { ComplexityClass, SizeClass } from "./catalog";
import type { PricingConfidence } from "./confidence";
import type { RateAggregate } from "./rateCard";

export type { PricingConfidence };

export interface PricingPolicy {
  version: string;
  targetMarginBps: number;
  minimumMarginBps: number;
  minimumMarginCents: number;
  roundingIncrementCents: number;
  /**
   * L'acompte d'un projet ESTIMATE_THEN_CONFIRM (§25) : max(pourcentage,
   * plancher absolu) — la même formule que la marge, jamais un montant fixe
   * inventé (« ne pas hardcoder 100 € »).
   */
  depositPercentageBps: number;
  depositMinimumCents: number;
}

/**
 * Une ligne de la décomposition : un travail, son tarif de référence, et d'où
 * ce tarif sort. `approximated` dit qu'on a dû se rabattre sur une classe
 * voisine faute de référence exacte — jamais qu'on a appliqué un coefficient
 * inventé pour compenser.
 */
export interface PricingComponent {
  workItemKey: string;
  label: string;
  referencePayoutCents: number;
  lowCents: number;
  highCents: number;
  referenceCount: number;
  approximated: boolean;
  approximationNote: string | null;
}

export interface PricingSuggestion {
  /**
   * `manual_review` est un refus de chiffrer, pas un chiffrage prudent. Dans
   * ce cas tous les montants sont `null` : il n'y a rien à arrondir, rien à
   * afficher, rien à valider par inadvertance.
   */
  status: "suggested" | "manual_review";
  suggestedBinderPayoutCents: number | null;
  suggestedCustomerPriceCents: number | null;
  lowEstimateCents: number | null;
  highEstimateCents: number | null;
  marginCents: number | null;
  marginBps: number | null;
  confidence: PricingConfidence;
  /** Le plus petit nombre d'ateliers sur lequel repose un des travaux. */
  referenceCount: number;
  components: PricingComponent[];
  workItemKeys: string[];
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
  /** Ce qui explique la note de confiance, en français, pour l'administration. */
  factors: string[];
  ruleVersion: string;
}

export interface PricingValidation {
  valid: boolean;
  marginCents: number;
  marginBps: number;
  minimumMarginCents: number;
  errors: string[];
}

/** Ce que le moteur sait du marché au moment où il chiffre. */
export interface ReferenceLookup {
  aggregates: readonly RateAggregate[];
}

export type PricingInput = Pick<
  CaseProfile,
  | "intent"
  | "heightCm"
  | "widthCm"
  | "thicknessCm"
  | "condition"
  | "spineCondition"
  | "boardCondition"
  | "sewingCondition"
  | "material"
  | "finishes"
  | "bandsCount"
  | "heritage"
>;
