/**
 * La suggestion « tarifs de base » — repli du moteur quand ni le Pricebook
 * publié ni les grilles des ateliers ne couvrent un dossier.
 *
 * Décision d'Antoine du 4 octobre 2026 : les 45 tarifs de base Ma Reliure
 * (`marketplace_reference_default_prices`, version mareliure-base-prices-v1),
 * encore en brouillon, servent à **pré-remplir** un prix que l'administration
 * confirme ou corrige. Ils ne deviennent pas pour autant un barème validé :
 * la suggestion porte une confiance « faible », chaque composant le dit, et
 * rien n'est envoyé sans le clic d'un humain.
 *
 * Le montant de base est lu comme une rémunération atelier de référence
 * (ce que l'atelier facture pour cette prestation). Le prix client en
 * découle par les règles Ma Reliure habituelles (`resolveServicePriceFloors` :
 * marge cible, contribution minimale), exactement comme pour une grille
 * d'atelier. Aucun montant n'est écrit dans ce fichier.
 */
import { workItemLabel } from "./catalog";
import { resolveServicePriceFloors } from "./pricebook";
import { PRICING_POLICY } from "./pricing.rules";
import type { PricingComponent, PricingPolicy, PricingSuggestion } from "./pricing.types";

export interface BasePriceReference {
  pricingKey: string;
  defaultUnitPriceCents: number | null;
  pricingMode: string;
  unit: string | null;
}

/** Ce que l'écran affiche à côté de chaque composant issu d'un tarif de base. */
export const BASE_PRICE_NOTE = "tarif de base Ma Reliure, non validé — à confirmer";

/** Version de règle enregistrée sur le dossier : on sait d'où vient le prix. */
export function basePriceRuleVersion(policy: PricingPolicy = PRICING_POLICY): string {
  return `${policy.version}+base-prices-v1`;
}

function usable(entry: BasePriceReference | undefined): entry is BasePriceReference & { defaultUnitPriceCents: number } {
  return (
    !!entry &&
    entry.pricingMode !== "manual_review" &&
    typeof entry.defaultUnitPriceCents === "number" &&
    entry.defaultUnitPriceCents > 0
  );
}

/**
 * Chiffre un dossier à partir des tarifs de base. `null` si un seul des
 * travaux n'a pas de tarif chiffré (mode « sur étude », montant absent) :
 * une somme partielle aurait l'air d'un prix complet.
 */
export function suggestFromBasePrices(
  input: { workItemKeys: readonly string[]; sizeClass: string; complexityClass: string },
  references: readonly BasePriceReference[],
  policy: PricingPolicy = PRICING_POLICY,
): PricingSuggestion | null {
  if (input.workItemKeys.length === 0) return null;
  const components: PricingComponent[] = [];
  for (const key of input.workItemKeys) {
    const entry = references.find((candidate) => candidate.pricingKey === key);
    if (!usable(entry)) return null;
    const unitNote = entry.pricingMode === "unit" && entry.unit ? ` (prix par ${entry.unit}, quantité 1)` : "";
    const fromNote = entry.pricingMode === "starting_from" ? " (prix « à partir de »)" : "";
    components.push({
      workItemKey: key,
      label: workItemLabel(key),
      referencePayoutCents: entry.defaultUnitPriceCents,
      lowCents: entry.defaultUnitPriceCents,
      highCents: entry.defaultUnitPriceCents,
      referenceCount: 0,
      approximated: true,
      approximationNote: `${BASE_PRICE_NOTE}${unitNote}${fromNote}`,
    });
  }

  const payout = components.reduce((sum, component) => sum + component.referencePayoutCents, 0);
  const floors = resolveServicePriceFloors({
    binderPayoutCents: payout,
    targetMarginBps: policy.targetMarginBps,
    minimumContributionCents: policy.minimumContributionCents,
    roundingIncrementCents: policy.roundingIncrementCents,
    referenceCents: null,
  });
  const marginCents = floors.priceCents - payout;
  const nonStandardFormat = input.sizeClass !== "standard" || input.complexityClass !== "standard";

  return {
    status: "suggested",
    suggestedBinderPayoutCents: payout,
    suggestedCustomerPriceCents: floors.priceCents,
    lowEstimateCents: null,
    highEstimateCents: null,
    marginCents,
    marginBps: floors.priceCents > 0 ? Math.round((marginCents * 10_000) / floors.priceCents) : 0,
    pricebookReferenceCents: null,
    marginFloorCents: floors.marginFloorCents,
    contributionFloorCents: floors.contributionFloorCents,
    priceBoundBy: floors.boundBy,
    confidence: "low",
    referenceCount: 0,
    components,
    workItemKeys: [...input.workItemKeys],
    sizeClass: input.sizeClass as PricingSuggestion["sizeClass"],
    complexityClass: input.complexityClass as PricingSuggestion["complexityClass"],
    factors: [
      "Suggestion issue des tarifs de base Ma Reliure non validés : à confirmer ou corriger avant envoi.",
      ...(nonStandardFormat ? ["Format ou complexité hors standard : les tarifs de base ne les distinguent pas."] : []),
    ],
    ruleVersion: basePriceRuleVersion(policy),
  };
}
