/**
 * Le moteur tarifaire.
 *
 * Il ne contient aucun montant. C'est sa propriété la plus importante et elle
 * est délibérée : la version précédente en portait une quinzaine — 140 € pour
 * une réparation, 200 € pour une belle reliure — posés pour que le calcul
 * produise quelque chose. Ces chiffres n'avaient été vus par aucun relieur, et
 * rien ne les distinguait d'un tarif relevé sur le terrain.
 *
 * Désormais les montants n'ont qu'une origine : les grilles des artisans,
 * agrégées par `rateCard.ts`. Quand elles ne couvrent pas le projet, le moteur
 * ne dégrade pas sa réponse — il s'abstient et rend `manual_review`. Un prix
 * absent se rattrape par un coup de téléphone ; un prix faux se rattrape
 * beaucoup plus mal.
 *
 * Ce que Ma Reliure décide, en revanche, lui appartient : la marge cible et
 * l'arrondi vivent dans `PRICING_POLICY`. Décider sa marge n'est pas inventer
 * un tarif.
 *
 * Le pipeline : réponses structurées → travaux → tarifs de référence →
 * rémunération → prix client → marge → fourchette → confiance → validation
 * humaine. La dernière étape n'est pas ici : le moteur suggère, il ne valide
 * jamais.
 */
import { workItemLabel } from "./catalog";
import { assessConfidence } from "./confidence";
import { PRICING_POLICY } from "./pricing.rules";
import type {
  PricingComponent,
  PricingPolicy,
  PricingSuggestion,
  PricingValidation,
  ReferenceLookup,
} from "./pricing.types";
import { customerPriceForMargin, marginOf } from "./pricebook";
import type { RateAggregate } from "./rateCard";
import { resolveWork } from "./workResolver";
import type { CaseProfile } from "@/marketplace/cases/caseProfile";

export function validateManagedPrice(
  customerPriceCents: number,
  binderPayoutCents: number,
  policy: PricingPolicy = PRICING_POLICY,
): PricingValidation {
  const errors: string[] = [];
  if (!Number.isInteger(customerPriceCents) || customerPriceCents <= 0)
    errors.push("Le prix client doit être un montant positif en centimes.");
  if (!Number.isInteger(binderPayoutCents) || binderPayoutCents <= 0)
    errors.push("La rémunération atelier doit être un montant positif en centimes.");
  if (binderPayoutCents > customerPriceCents)
    errors.push("La rémunération atelier ne peut pas dépasser le prix client.");

  const { marginCents, marginBps } = marginOf(customerPriceCents, binderPayoutCents);
  const minimumMarginCents = Math.max(
    policy.minimumMarginCents,
    Math.ceil((customerPriceCents * policy.minimumMarginBps) / 10_000),
  );
  if (marginCents < minimumMarginCents)
    errors.push("La marge est inférieure au minimum configuré.");

  return { valid: errors.length === 0, marginCents, marginBps, minimumMarginCents, errors };
}

/**
 * Cherche le tarif de référence d'un travail, du plus précis au plus général.
 *
 * Exiger la correspondance exacte rendrait le système inutilisable : quatre
 * formats fois trois complexités fois quarante-sept travaux, personne ne
 * remplit ça en vingt minutes. On se rabat donc sur la classe courante, mais
 * **sans appliquer le moindre coefficient** : majorer de 10 % pour un grand
 * format serait exactement le geste qu'on vient de bannir. L'approximation est
 * déclarée, elle élargit la fourchette et elle coûte des points de confiance.
 */
function lookupAggregate(
  aggregates: readonly RateAggregate[],
  workItemKey: string,
  sizeClass: string,
  complexityClass: string,
): { aggregate: RateAggregate; note: string | null } | null {
  const candidates = aggregates.filter((a) => a.workItemKey === workItemKey);
  if (candidates.length === 0) return null;

  const exact = candidates.find(
    (a) => a.sizeClass === sizeClass && a.complexityClass === complexityClass,
  );
  if (exact) return { aggregate: exact, note: null };

  const sameComplexity = candidates.find(
    (a) => a.sizeClass === "standard" && a.complexityClass === complexityClass,
  );
  if (sameComplexity)
    return { aggregate: sameComplexity, note: "tarif du format courant, faute de référence" };

  const sameSize = candidates.find(
    (a) => a.sizeClass === sizeClass && a.complexityClass === "standard",
  );
  if (sameSize)
    return { aggregate: sameSize, note: "tarif de complexité courante, faute de référence" };

  const generic = candidates.find(
    (a) => a.sizeClass === "standard" && a.complexityClass === "standard",
  );
  if (generic)
    return {
      aggregate: generic,
      note: "tarif courant, ni le format ni la complexité ne sont couverts",
    };

  return null;
}

function abstain(
  reason: string[],
  work: ReturnType<typeof resolveWork>,
  policy: PricingPolicy,
  components: PricingComponent[] = [],
): PricingSuggestion {
  return {
    status: "manual_review",
    suggestedBinderPayoutCents: null,
    suggestedCustomerPriceCents: null,
    lowEstimateCents: null,
    highEstimateCents: null,
    marginCents: null,
    marginBps: null,
    confidence: "manual_review",
    referenceCount: 0,
    components,
    workItemKeys: work.workItemKeys,
    sizeClass: work.sizeClass,
    complexityClass: work.complexityClass,
    factors: reason,
    ruleVersion: policy.version,
  };
}

export function suggestManagedPrice(
  profile: CaseProfile,
  references: ReferenceLookup,
  policy: PricingPolicy = PRICING_POLICY,
): PricingSuggestion {
  const work = resolveWork(profile);

  const components: PricingComponent[] = [];
  const uncovered: string[] = [];
  const usedAggregates: RateAggregate[] = [];

  for (const key of work.workItemKeys) {
    const found = lookupAggregate(references.aggregates, key, work.sizeClass, work.complexityClass);
    if (!found) {
      uncovered.push(key);
      continue;
    }
    usedAggregates.push(found.aggregate);
    components.push({
      workItemKey: key,
      label: workItemLabel(key),
      referencePayoutCents: found.aggregate.medianCents,
      // La fourchette prend l'enveloppe déclarée, pas la dispersion entre
      // ateliers : elle répond à « au mieux combien, au pire combien », alors
      // que min/médiane/max répondent à « que demande le métier ».
      lowCents: found.aggregate.floorCents,
      highCents: found.aggregate.ceilingCents,
      referenceCount: found.aggregate.referenceCount,
      approximated: found.note !== null,
      approximationNote: found.note,
    });
  }

  const assessment = assessConfidence({
    aggregates: usedAggregates,
    uncoveredWorkItemKeys: uncovered,
    workItemKeys: work.workItemKeys,
    missingAnswers: work.missingAnswers,
    heritage: profile.heritage,
  });

  if (assessment.confidence === "manual_review")
    return abstain(assessment.factors, work, policy, components);

  const payout = components.reduce((sum, c) => sum + c.referencePayoutCents, 0);
  const lowEstimate = components.reduce((sum, c) => sum + c.lowCents, 0);
  const highEstimate = components.reduce((sum, c) => sum + c.highCents, 0);

  // Une somme de médianes peut sortir à zéro si toutes les grilles retenues
  // sont à zéro. Cela ne devrait pas arriver — `validateRate` l'interdit à la
  // saisie — mais chiffrer un projet à zéro euro serait pire que s'abstenir.
  if (payout <= 0)
    return abstain(
      ["Les tarifs de référence retenus ne produisent aucun montant."],
      work,
      policy,
      components,
    );

  const customerPrice = customerPriceForMargin(
    payout,
    policy.targetMarginBps,
    policy.roundingIncrementCents,
  );
  const validation = validateManagedPrice(customerPrice, payout, policy);

  return {
    status: "suggested",
    suggestedBinderPayoutCents: payout,
    suggestedCustomerPriceCents: customerPrice,
    lowEstimateCents: customerPriceForMargin(
      lowEstimate,
      policy.targetMarginBps,
      policy.roundingIncrementCents,
    ),
    highEstimateCents: customerPriceForMargin(
      highEstimate,
      policy.targetMarginBps,
      policy.roundingIncrementCents,
    ),
    marginCents: validation.marginCents,
    marginBps: validation.marginBps,
    confidence: assessment.confidence,
    referenceCount: assessment.referenceCount,
    components,
    workItemKeys: work.workItemKeys,
    sizeClass: work.sizeClass,
    complexityClass: work.complexityClass,
    factors: assessment.factors,
    ruleVersion: policy.version,
  };
}
