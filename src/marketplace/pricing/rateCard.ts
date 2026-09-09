/**
 * La grille d'un relieur, et ce qu'on en déduit collectivement.
 *
 * Une ligne de grille est une phrase dite par un artisan un jour donné : « un
 * demi-cuir grand format, chez moi, c'est entre 320 et 420, disons 370 ». On
 * la stocke telle quelle — trois montants, un format, une complexité, une
 * date, une source — et on ne la moyenne jamais avec autre chose que des
 * phrases comparables.
 *
 * Les montants sont des entiers de centimes. Jamais de flottant sur de la
 * monnaie : 0.1 + 0.2 ne fait pas 0.3, et une marge calculée sur des flottants
 * dérive silencieusement.
 */
import type { ComplexityClass, SizeClass } from "./catalog";
import { countsAsReference, type PriceProvenance, type RateSource } from "./provenance";

export interface BinderRate {
  id: string;
  binderId: string;
  /** Clé du catalogue. Une ligne qui nomme un travail inconnu est ignorée. */
  workItemKey: string;
  minimumPayoutCents: number;
  typicalPayoutCents: number;
  maximumPayoutCents: number;
  estimatedHours: number | null;
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
  notes: string | null;
  effectiveFrom: string;
  status: "active" | "superseded" | "draft";
  source: RateSource;
  provenance: PriceProvenance;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

/**
 * Ce qu'une ligne doit respecter pour être enregistrable. Volontairement
 * minimal : on ne discute pas le tarif d'un artisan, on vérifie seulement
 * qu'il est cohérent avec lui-même.
 */
export function validateRate(rate: {
  minimumPayoutCents: number;
  typicalPayoutCents: number;
  maximumPayoutCents: number;
  estimatedHours?: number | null;
}): string[] {
  const errors: string[] = [];
  const amounts = [rate.minimumPayoutCents, rate.typicalPayoutCents, rate.maximumPayoutCents];
  if (!amounts.every((value) => Number.isInteger(value) && value > 0))
    errors.push("Les trois montants doivent être des entiers de centimes positifs.");
  else {
    if (rate.minimumPayoutCents > rate.typicalPayoutCents)
      errors.push("Le minimum ne peut pas dépasser le tarif courant.");
    if (rate.typicalPayoutCents > rate.maximumPayoutCents)
      errors.push("Le tarif courant ne peut pas dépasser le maximum.");
  }
  if (
    rate.estimatedHours !== null &&
    rate.estimatedHours !== undefined &&
    (rate.estimatedHours <= 0 || rate.estimatedHours > 500)
  )
    errors.push("Le temps estimé doit être compris entre 0 et 500 heures.");
  return errors;
}

/** Une contribution retenue dans un agrégat, avec de quoi remonter à sa source. */
export interface RateContribution {
  binderId: string;
  binderName: string;
  typicalPayoutCents: number;
  minimumPayoutCents: number;
  maximumPayoutCents: number;
  effectiveFrom: string;
  source: RateSource;
}

export interface RateAggregate {
  workItemKey: string;
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
  /** Nombre d'ateliers distincts, pas nombre de lignes. */
  referenceCount: number;
  minimumCents: number;
  medianCents: number;
  maximumCents: number;
  /**
   * Quartiles seulement au-delà de cinq ateliers. En dessous, un « premier
   * quartile » calculé sur trois valeurs est une précision inventée : il
   * donnerait l'apparence d'une statistique là où on n'a qu'un avis.
   */
  q1Cents: number | null;
  q3Cents: number | null;
  /** Écart max/min rapporté à la médiane, en points de base. */
  dispersionBps: number;
  /** Date de la contribution la plus ancienne retenue. */
  oldestEffectiveFrom: string;
  contributions: RateContribution[];
}

/** Seuil à partir duquel les quartiles cessent d'être une décoration. */
export const QUARTILE_MINIMUM_REFERENCES = 5;

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return Math.round(sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower));
}

export function median(values: readonly number[]): number {
  return percentile(
    [...values].sort((a, b) => a - b),
    0.5,
  );
}

/**
 * Deux questions indépendantes se posent sur une ligne de grille, et les
 * confondre serait une erreur.
 *
 * « Est-ce une observation du marché ? » est épistémique : un prix décidé par
 * Ma Reliure n'en est pas une, quel que soit l'environnement.
 *
 * « Est-ce une donnée du monde réel ou une fixture ? » est une question
 * d'environnement : un jeu d'essai doit pouvoir animer une base de
 * développement sans jamais approcher la production.
 *
 * D'où ce réglage explicite, faux par défaut. Il faut le demander pour que le
 * jeu d'essai compte, et personne ne le demande par accident.
 */
export interface AggregationOptions {
  includeTestData?: boolean;
}

/**
 * Agrège les grilles de plusieurs ateliers pour un travail donné.
 *
 * Deux règles portent tout le sens :
 *
 * 1. **Un atelier, une voix.** Un relieur qui a saisi trois lignes pour le
 *    même travail ne pèse pas trois fois dans la médiane — on retient sa ligne
 *    la plus récente. Sans cela, le plus bavard fixerait le prix du marché.
 * 2. **Seul le terrain compte** (`countsAsReference`). Un prix décidé par Ma
 *    Reliure n'entre pas dans la statistique : se citer soi-même comme source
 *    revient à confirmer ses propres hypothèses.
 */
export function aggregateRates(
  rates: readonly (BinderRate & { binderName: string })[],
  workItemKey: string,
  sizeClass: SizeClass,
  complexityClass: ComplexityClass,
  options: AggregationOptions = {},
): RateAggregate | null {
  const counts = (rate: BinderRate) =>
    countsAsReference(rate.provenance) ||
    (options.includeTestData === true && rate.provenance === "TEST_ONLY");

  const eligible = rates.filter(
    (rate) =>
      rate.workItemKey === workItemKey &&
      rate.sizeClass === sizeClass &&
      rate.complexityClass === complexityClass &&
      rate.status === "active" &&
      counts(rate),
  );
  if (eligible.length === 0) return null;

  const latestByBinder = new Map<string, BinderRate & { binderName: string }>();
  for (const rate of eligible) {
    const held = latestByBinder.get(rate.binderId);
    if (!held || rate.effectiveFrom > held.effectiveFrom) latestByBinder.set(rate.binderId, rate);
  }

  const retained = [...latestByBinder.values()].sort(
    (a, b) => a.typicalPayoutCents - b.typicalPayoutCents,
  );
  const typicals = retained.map((rate) => rate.typicalPayoutCents);
  const medianCents = percentile(typicals, 0.5);
  const minimumCents = Math.min(...retained.map((rate) => rate.minimumPayoutCents));
  const maximumCents = Math.max(...retained.map((rate) => rate.maximumPayoutCents));
  const enough = retained.length >= QUARTILE_MINIMUM_REFERENCES;

  return {
    workItemKey,
    sizeClass,
    complexityClass,
    referenceCount: retained.length,
    minimumCents,
    medianCents,
    maximumCents,
    q1Cents: enough ? percentile(typicals, 0.25) : null,
    q3Cents: enough ? percentile(typicals, 0.75) : null,
    dispersionBps:
      medianCents > 0 ? Math.round(((maximumCents - minimumCents) * 10_000) / medianCents) : 0,
    oldestEffectiveFrom: retained
      .map((rate) => rate.effectiveFrom)
      .reduce((oldest, current) => (current < oldest ? current : oldest)),
    contributions: retained.map((rate) => ({
      binderId: rate.binderId,
      binderName: rate.binderName,
      typicalPayoutCents: rate.typicalPayoutCents,
      minimumPayoutCents: rate.minimumPayoutCents,
      maximumPayoutCents: rate.maximumPayoutCents,
      effectiveFrom: rate.effectiveFrom,
      source: rate.source,
    })),
  };
}

/**
 * Le nombre d'ateliers à partir duquel une fourchette peut être présentée
 * comme un ordre de grandeur du métier, et non comme l'avis de deux personnes.
 *
 * Trois, parce qu'en dessous il n'y a pas de milieu : avec deux références la
 * « médiane » est la moyenne de deux avis, et un seul artisan atypique déplace
 * tout. Ce seuil garde la page /tarifs honnête.
 */
export const PUBLISHABLE_MINIMUM_REFERENCES = 3;

export function isPublishableRange(aggregate: RateAggregate | null): boolean {
  return aggregate !== null && aggregate.referenceCount >= PUBLISHABLE_MINIMUM_REFERENCES;
}
