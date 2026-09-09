/**
 * Le Pricebook Ma Reliure : notre décision commerciale, pas l'observation du
 * marché.
 *
 * Les grilles des relieurs disent ce que le travail vaut pour eux. Le
 * Pricebook dit ce que Ma Reliure paie et ce que Ma Reliure vend. Ce sont deux
 * objets différents et il est important qu'ils ne se confondent jamais : le
 * premier se relève, le second se décide.
 *
 * D'où la règle qui structure ce module : **un Pricebook ne se recalibre
 * jamais tout seul.** Qu'un relieur monte ses tarifs ne doit pas changer le
 * prix affiché à un client — cela doit alerter quelqu'un. `detectDrift`
 * produit ce signal, il ne produit pas une écriture. La validation reste une
 * décision humaine, tracée par `validatedAt` / `validatedBy`.
 *
 * Une entrée validée est immuable : on ne modifie pas une version publiée, on
 * en publie une nouvelle. Même discipline que les versions de Playbook, et
 * pour la même raison — il faut pouvoir dire quel prix était en vigueur le
 * jour où un client a commandé.
 */
import type { ComplexityClass, SizeClass } from "./catalog";
import type { RateAggregate } from "./rateCard";

/** Comment le prix client a été construit à partir de la rémunération. */
export const PRICING_METHODS = ["margin_target", "fixed_price", "manual"] as const;
export type PricingMethod = (typeof PRICING_METHODS)[number];

export const PRICING_METHOD_LABELS: Record<PricingMethod, string> = {
  margin_target: "Marge cible appliquée",
  fixed_price: "Prix arrêté",
  manual: "Décidé au cas par cas",
};

export interface PricebookEntry {
  id: string;
  workItemKey: string;
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
  /** La rémunération que Ma Reliure retient comme référence pour ce travail. */
  referenceBinderPayoutCents: number;
  customerPriceCents: number;
  targetMarginCents: number;
  targetMarginBps: number;
  pricingMethod: PricingMethod;
  version: number;
  status: "draft" | "published" | "retired";
  validatedAt: string | null;
  validatedBy: string | null;
  /** Le nombre d'ateliers sur lequel reposait la référence au moment du gel. */
  referenceCountAtValidation: number;
  notes: string | null;
}

export function marginOf(customerPriceCents: number, binderPayoutCents: number) {
  const marginCents = customerPriceCents - binderPayoutCents;
  return {
    marginCents,
    marginBps: customerPriceCents > 0 ? Math.floor((marginCents * 10_000) / customerPriceCents) : 0,
  };
}

/**
 * Le prix client qu'implique une rémunération et une marge cible.
 *
 * La marge est exprimée en part du prix client, pas en majoration de la
 * rémunération : c'est ainsi qu'on raisonne une marge commerciale, et cela
 * évite qu'une même « marge de 18 % » veuille dire deux choses selon le sens
 * du calcul.
 */
export function customerPriceForMargin(
  binderPayoutCents: number,
  targetMarginBps: number,
  roundingIncrementCents: number,
): number {
  const raw = Math.ceil((binderPayoutCents * 10_000) / (10_000 - targetMarginBps));
  return Math.ceil(raw / roundingIncrementCents) * roundingIncrementCents;
}

export interface PricebookDrift {
  entry: PricebookEntry;
  /** La médiane terrain constatée aujourd'hui. */
  observedMedianCents: number;
  /** Écart de la référence du Pricebook à cette médiane, en points de base. */
  driftBps: number;
  referenceCount: number;
  severity: "none" | "watch" | "act";
  message: string;
}

/** Au-delà, la référence du Pricebook a décroché du terrain. */
export const DRIFT_WATCH_BPS = 1_000;
export const DRIFT_ACT_BPS = 2_000;

/**
 * Compare le Pricebook au terrain et dit ce qui mérite un regard.
 *
 * Ne renvoie jamais d'écriture, jamais de nouvelle entrée : uniquement un
 * constat, à charge d'un administrateur d'en faire quelque chose. C'est
 * délibéré, et c'est la garantie qu'un relieur qui change ses tarifs ne peut
 * pas déplacer un prix de vente sans que personne ne l'ait décidé.
 */
export function detectDrift(
  entries: readonly PricebookEntry[],
  aggregates: readonly RateAggregate[],
): PricebookDrift[] {
  const byKey = new Map(
    aggregates.map((a) => [`${a.workItemKey}|${a.sizeClass}|${a.complexityClass}`, a]),
  );
  const drifts: PricebookDrift[] = [];

  for (const entry of entries) {
    if (entry.status !== "published") continue;
    const aggregate = byKey.get(`${entry.workItemKey}|${entry.sizeClass}|${entry.complexityClass}`);
    if (!aggregate) continue;

    const driftBps = Math.round(
      ((aggregate.medianCents - entry.referenceBinderPayoutCents) * 10_000) /
        entry.referenceBinderPayoutCents,
    );
    const magnitude = Math.abs(driftBps);
    const severity =
      magnitude >= DRIFT_ACT_BPS ? "act" : magnitude >= DRIFT_WATCH_BPS ? "watch" : "none";
    if (severity === "none") continue;

    drifts.push({
      entry,
      observedMedianCents: aggregate.medianCents,
      driftBps,
      referenceCount: aggregate.referenceCount,
      severity,
      message:
        driftBps > 0
          ? `Le terrain est passé au-dessus de notre référence (${aggregate.referenceCount} ateliers). La marge se réduit.`
          : `Le terrain est passé en dessous de notre référence (${aggregate.referenceCount} ateliers). Notre prix est peut-être trop haut.`,
    });
  }

  return drifts.sort((a, b) => Math.abs(b.driftBps) - Math.abs(a.driftBps));
}
