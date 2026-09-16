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

export interface ServicePriceFloorInput {
  binderPayoutCents: number;
  targetMarginBps: number;
  /** Le plancher de contribution absolue — `PricingPolicy.minimumContributionCents`, jamais `minimumMarginCents` (post-hoc, un garde-fou différent). */
  minimumContributionCents: number;
  roundingIncrementCents: number;
  /** Le prix publié du Pricebook pour ce dossier, brand comprise — `null` si aucune correspondance. Jamais réarrondi : une valeur déjà décidée. */
  referenceCents: number | null;
}

export interface ServicePriceFloorResult {
  priceCents: number;
  marginFloorCents: number;
  contributionFloorCents: number;
  referenceCents: number | null;
  boundBy: "reference" | "margin_floor" | "contribution_floor";
}

/**
 * Le prix client HT d'un service, jamais en dessous de deux planchers
 * indépendants (audit du 15 septembre 2026, §5-6) :
 *
 * - un plancher de MARGE (pourcentage du prix client) : `customerPriceForMargin`,
 *   déjà utilisé seul jusqu'ici ;
 * - un plancher de CONTRIBUTION (montant absolu au-dessus de la rémunération
 *   atelier) : `binderPayoutCents + minimumContributionCents`.
 *
 * Les deux répondent à des questions différentes — "quelle part du prix nous
 * revient" contre "combien nous revient, en valeur absolue, quel que soit le
 * prix" — et confondre l'un avec l'autre est précisément l'erreur que ce
 * garde-fou existe pour empêcher : sur un petit projet, un plancher de marge
 * à 25 % peut rendre bien moins que le minimum de contribution absolu dont
 * l'activité a besoin.
 *
 * Une référence Pricebook publiée, quand elle existe, est un troisième
 * candidat — jamais un remplacement des deux planchers : le Pricebook peut
 * dater, les planchers jamais.
 */
export function resolveServicePriceFloors(input: ServicePriceFloorInput): ServicePriceFloorResult {
  const marginFloorCents = customerPriceForMargin(
    input.binderPayoutCents,
    input.targetMarginBps,
    input.roundingIncrementCents,
  );
  const contributionFloorCents =
    Math.ceil(
      (input.binderPayoutCents + input.minimumContributionCents) / input.roundingIncrementCents,
    ) * input.roundingIncrementCents;

  const candidates: { value: number; source: ServicePriceFloorResult["boundBy"] }[] = [
    { value: marginFloorCents, source: "margin_floor" },
    { value: contributionFloorCents, source: "contribution_floor" },
  ];
  if (input.referenceCents !== null) candidates.push({ value: input.referenceCents, source: "reference" });

  const winner = candidates.reduce((best, candidate) => (candidate.value > best.value ? candidate : best));

  return {
    priceCents: winner.value,
    marginFloorCents,
    contributionFloorCents,
    referenceCents: input.referenceCents,
    boundBy: winner.source,
  };
}

export interface PricebookReferenceMatch {
  entry: PricebookEntry;
  /** Même discipline que `lookupAggregate` (pricing.engine.ts) : jamais de coefficient, seulement une classe plus générale déclarée comme telle. */
  note: string | null;
}

export interface PricebookReferenceResult {
  referenceCents: number;
  matches: PricebookReferenceMatch[];
}

/**
 * La même cascade que `lookupAggregate` (pricing.engine.ts), mais contre des
 * entrées Pricebook **publiées** plutôt que des grilles atelier : correspondance
 * exacte d'abord, puis format ou complexité standard, jamais un coefficient
 * appliqué pour combler un trou.
 */
function lookupPricebookEntry(
  entries: readonly PricebookEntry[],
  workItemKey: string,
  sizeClass: string,
  complexityClass: string,
): PricebookReferenceMatch | null {
  const candidates = entries.filter(
    (e) => e.status === "published" && e.workItemKey === workItemKey,
  );
  if (candidates.length === 0) return null;

  const exact = candidates.find(
    (e) => e.sizeClass === sizeClass && e.complexityClass === complexityClass,
  );
  if (exact) return { entry: exact, note: null };

  const sameComplexity = candidates.find(
    (e) => e.sizeClass === "standard" && e.complexityClass === complexityClass,
  );
  if (sameComplexity)
    return { entry: sameComplexity, note: "tarif du format courant, faute de référence" };

  const sameSize = candidates.find(
    (e) => e.sizeClass === sizeClass && e.complexityClass === "standard",
  );
  if (sameSize)
    return { entry: sameSize, note: "tarif de complexité courante, faute de référence" };

  const generic = candidates.find(
    (e) => e.sizeClass === "standard" && e.complexityClass === "standard",
  );
  if (generic)
    return {
      entry: generic,
      note: "tarif courant, ni le format ni la complexité ne sont couverts",
    };

  return null;
}

/**
 * La référence Pricebook d'un dossier — la somme des prix client publiés
 * pour chacun de ses travaux, jamais une estimation partielle : si un seul
 * travail du dossier n'a aucune entrée publiée, la fonction rend `null`
 * plutôt qu'un total qui aurait l'air complet en en taisant un (même
 * discipline que `suggestManagedPrice` s'abstenant sur un travail non
 * tarifé). `resolveServicePriceFloors` reçoit alors `referenceCents: null`,
 * exactement comme aujourd'hui — le Pricebook reste un candidat de plus
 * dans le MAX, jamais un remplacement des deux planchers.
 */
export function lookupPricebookReference(
  entries: readonly PricebookEntry[],
  workItemKeys: readonly string[],
  sizeClass: string,
  complexityClass: string,
): PricebookReferenceResult | null {
  if (workItemKeys.length === 0) return null;
  const matches: PricebookReferenceMatch[] = [];
  for (const key of workItemKeys) {
    const match = lookupPricebookEntry(entries, key, sizeClass, complexityClass);
    if (!match) return null;
    matches.push(match);
  }
  return {
    referenceCents: matches.reduce((sum, m) => sum + m.entry.customerPriceCents, 0),
    matches,
  };
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
