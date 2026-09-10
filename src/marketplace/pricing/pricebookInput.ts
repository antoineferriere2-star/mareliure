/**
 * Ce qu'une entrée de Pricebook doit respecter pour être publiée.
 *
 * Deux sortes de règles, et la distinction est la raison d'être du fichier :
 *
 * - **les incohérences refusent** : une rémunération au-dessus du prix, un
 *   travail sur étude affublé d'un prix fixe, une fourchette à l'envers. Ce ne
 *   sont pas des décisions, ce sont des erreurs ;
 * - **la marge informe** : OK, Attention, Alerte. Descendre sous la cible est
 *   une décision commerciale qui appartient à la personne qui publie ; on la
 *   lui montre, on ne la lui interdit pas.
 *
 * Le TTC n'est jamais saisi : il sort de `vat.ts`, une fois, ici.
 */
import { requiresStudy, workItem, type ComplexityClass, type SizeClass } from "./catalog";
import { assessMargin, type MarginAssessment } from "./margin";
import { modeCarriesAmount, modeRequiresUnit, type PricingMode } from "./pricingModes";
import { fromHt } from "./vat";

export interface PricebookInput {
  workItemKey: string;
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
  pricingMode: PricingMode;
  referenceBinderPayoutCents: number | null;
  customerPriceHtCents: number | null;
  priceHtHighCents: number | null;
  unitLabel: string | null;
  vatRateBps: number;
  targetMarginBps: number;
  minimumMarginCents: number | null;
  includedWorkItems: string[];
  publicVisible: boolean;
  changeReason: string | null;
}

export interface PreparedPricebookEntry {
  errors: string[];
  customerPriceTtcCents: number | null;
  /** `null` sur étude : il n'y a pas de marge à évaluer sans prix. */
  margin: MarginAssessment | null;
}

const positiveCents = (value: number | null): value is number =>
  value !== null && Number.isInteger(value) && value > 0;

export function preparePricebookEntry(
  input: PricebookInput,
  context: { hasPreviousVersion: boolean; policyMinimumMarginCents: number },
): PreparedPricebookEntry {
  const errors: string[] = [];
  const item = workItem(input.workItemKey);
  if (!item) errors.push("Travail hors catalogue.");

  if (item?.requiresStudy && input.pricingMode !== "MANUAL_REVIEW")
    errors.push("Ce travail se chiffre sur étude : il ne peut porter qu'une entrée « Sur étude ».");

  if (!Number.isInteger(input.vatRateBps) || input.vatRateBps < 0 || input.vatRateBps > 10_000)
    errors.push("Le taux de TVA est invalide.");
  if (
    !Number.isInteger(input.targetMarginBps) ||
    input.targetMarginBps < 0 ||
    input.targetMarginBps > 9_999
  )
    errors.push("La marge cible est invalide.");
  if (
    input.minimumMarginCents !== null &&
    (!Number.isInteger(input.minimumMarginCents) || input.minimumMarginCents < 0)
  )
    errors.push("La marge minimum est invalide.");

  if (!modeCarriesAmount(input.pricingMode)) {
    if (input.referenceBinderPayoutCents !== null || input.customerPriceHtCents !== null)
      errors.push("Une entrée « Sur étude » ne porte aucun montant.");
    if (input.publicVisible) errors.push("Un travail sur étude n'a pas de prix à publier.");
  } else {
    if (
      !positiveCents(input.referenceBinderPayoutCents) ||
      !positiveCents(input.customerPriceHtCents)
    )
      errors.push("La rémunération et le prix HT doivent être des montants positifs en centimes.");
    else if (input.referenceBinderPayoutCents > input.customerPriceHtCents)
      errors.push("La rémunération atelier ne peut pas dépasser le prix HT.");
  }

  if (input.pricingMode === "RANGE") {
    if (!positiveCents(input.priceHtHighCents)) errors.push("Une fourchette a besoin de son haut.");
    else if (
      positiveCents(input.customerPriceHtCents) &&
      input.priceHtHighCents < input.customerPriceHtCents
    )
      errors.push("Le haut de la fourchette est sous son bas.");
  } else if (input.priceHtHighCents !== null) {
    errors.push("Seule une fourchette porte un prix haut.");
  }

  if (modeRequiresUnit(input.pricingMode) && !input.unitLabel?.trim())
    errors.push("Un prix à l'unité ou à l'heure dit dans quelle unité il compte.");

  const included = new Set<string>();
  for (const key of input.includedWorkItems) {
    if (key === input.workItemKey) errors.push("Un travail ne s'inclut pas lui-même.");
    else if (!workItem(key)) errors.push(`Travail inclus hors catalogue : ${key}.`);
    else if (requiresStudy([key]))
      errors.push("Un travail sur étude ne peut pas être inclus d'office.");
    else if (included.has(key)) errors.push(`Travail inclus en double : ${key}.`);
    included.add(key);
  }

  if (context.hasPreviousVersion && !input.changeReason?.trim())
    errors.push("Modifier un prix publié demande d'en dire la raison.");

  const priced =
    modeCarriesAmount(input.pricingMode) &&
    positiveCents(input.customerPriceHtCents) &&
    positiveCents(input.referenceBinderPayoutCents) &&
    errors.length === 0;

  return {
    errors,
    customerPriceTtcCents: priced
      ? fromHt(input.customerPriceHtCents!, input.vatRateBps).ttcCents
      : null,
    margin: priced
      ? assessMargin({
          priceHtCents: input.customerPriceHtCents!,
          payoutCents: input.referenceBinderPayoutCents!,
          targetMarginBps: input.targetMarginBps,
          minimumMarginCents: input.minimumMarginCents ?? context.policyMinimumMarginCents,
        })
      : null,
  };
}
