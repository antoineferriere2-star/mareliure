import type { CaseProfile } from "@/marketplace/cases/caseProfile";
import type { ComplexityClass, SizeClass } from "./catalog";
import type { PricingConfidence } from "./confidence";
import type { PricebookEntry } from "./pricebook";
import type { RateAggregate } from "./rateCard";

export type { PricingConfidence };

export interface PricingPolicy {
  version: string;
  targetMarginBps: number;
  minimumMarginBps: number;
  minimumMarginCents: number;
  /**
   * Le plancher de contribution absolue (audit du 15 septembre 2026, §6) —
   * distinct de `minimumMarginCents` : celui-ci ne borne qu'une validation a
   * posteriori (`validateManagedPrice`), tandis que celui-ci entre dans le
   * calcul du prix lui-même (`resolveServicePriceFloors`, pricebook.ts),
   * combiné par MAX avec le plancher de marge — jamais l'un à la place de
   * l'autre. Deux garde-fous, jamais confondus.
   */
  minimumContributionCents: number;
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
  /**
   * Le prix publié du Pricebook pour ce dossier, quand une correspondance
   * existe — `null` aujourd'hui dans tous les cas : rien ne relit encore
   * marketplace_pricebook dossier par dossier (voir l'audit du 15 septembre
   * 2026 ; la table sert la détection de dérive, pas le chiffrage). Le champ
   * existe pour que `resolveServicePriceFloors` ait un troisième candidat le
   * jour où cette lecture sera branchée, sans nouveau changement de forme.
   */
  pricebookReferenceCents: number | null;
  /** Les deux planchers considérés pour `suggestedCustomerPriceCents`, et lequel a gagné le MAX — voir resolveServicePriceFloors. */
  marginFloorCents: number | null;
  contributionFloorCents: number | null;
  priceBoundBy: "reference" | "margin_floor" | "contribution_floor" | null;
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
  /**
   * Les entrées Pricebook publiées, pour `pricebookReferenceCents`. Optionnel
   * et par défaut vide plutôt que `null` : un appelant qui ne le fournit pas
   * (encore) obtient exactement le comportement d'avant ce câblage — aucune
   * référence, jamais une supposition.
   */
  pricebookEntries?: readonly PricebookEntry[];
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
