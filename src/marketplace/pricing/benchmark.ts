/**
 * Le benchmark marché : ce que des ateliers affichent publiquement.
 *
 * Troisième couche, et la plus faible. Un prix lu sur un site est un repère
 * pour situer le Pricebook — « nous sommes au-dessus de ce qui s'affiche » —
 * rien de plus. Il n'a été ni confirmé par l'atelier, ni ajusté à un livre
 * donné, et il mêle souvent HT, TTC et « non précisé ».
 *
 * D'où trois interdits, que le code rend impossibles plutôt que déconseillés :
 *
 * - **jamais public** : ce module ne produit rien que `publicPrices.ts` sache
 *   lire, et la table refuse toute autre provenance que `WEB_BENCHMARK` ;
 * - **jamais un prix validé** : aucune fonction ne transforme un repère en
 *   entrée de Pricebook, et `canReachCustomer("WEB_BENCHMARK")` est faux ;
 * - **jamais une référence d'atelier** : il n'entre pas dans les médianes des
 *   grilles (`countsAsReference`), qui ne mélangent que du terrain.
 *
 * Chaque ligne porte sa page, son extrait et sa date. Sans eux, un repère
 * n'est qu'un chiffre de plus.
 */
import type { ComplexityClass, SizeClass } from "./catalog";
import { percentile, QUARTILE_MINIMUM_REFERENCES } from "./rateCard";

export const PRICE_BASES = ["TTC", "HT", "NOT_STATED"] as const;
export type PriceBasis = (typeof PRICE_BASES)[number];

export const PRICE_BASIS_LABELS: Record<PriceBasis, string> = {
  TTC: "TTC",
  HT: "HT",
  NOT_STATED: "non précisé",
};

/** Au-delà, un prix affiché a probablement changé. */
export const BENCHMARK_STALE_AFTER_DAYS = 730;

export interface PriceBenchmark {
  id: string;
  workItemKey: string;
  /** `null` : la source ne précise pas de format, et on ne lui en prête pas. */
  sizeClass: SizeClass | null;
  complexityClass: ComplexityClass | null;
  lowPriceCents: number;
  highPriceCents: number;
  /** « par coin », « par cahier »… `null` pour un prix d'ouvrage. */
  unitLabel: string | null;
  priceBasis: PriceBasis;
  /** Le format tel que la source l'écrit : « 245 x 160 », « épaisseur < 20 mm ». */
  formatLabel: string | null;
  sourceName: string;
  sourceUrl: string;
  sourceExcerpt: string;
  observedAt: string;
  provenance: "WEB_BENCHMARK";
  status: "active" | "retired";
  notes: string | null;
}

export interface BenchmarkInput {
  lowPriceCents: number;
  highPriceCents: number;
  sourceName: string;
  sourceUrl: string;
  sourceExcerpt: string;
  observedAt: string;
}

export function validateBenchmark(input: BenchmarkInput, now: Date = new Date()): string[] {
  const errors: string[] = [];
  if (
    !Number.isInteger(input.lowPriceCents) ||
    !Number.isInteger(input.highPriceCents) ||
    input.lowPriceCents <= 0
  )
    errors.push("Les montants doivent être des entiers de centimes positifs.");
  else if (input.lowPriceCents > input.highPriceCents)
    errors.push("Le bas de la fourchette ne peut pas dépasser le haut.");
  if (!/^https?:\/\//.test(input.sourceUrl)) errors.push("La source doit être une adresse web.");
  if (input.sourceName.trim() === "") errors.push("La source doit être nommée.");
  const excerpt = input.sourceExcerpt.trim();
  if (excerpt === "" || excerpt.length > 400)
    errors.push("L'extrait de la page est obligatoire (400 caractères au plus).");
  const observed = new Date(`${input.observedAt}T00:00:00Z`);
  if (Number.isNaN(observed.getTime())) errors.push("La date de relevé est invalide.");
  else if (observed.getTime() > now.getTime()) errors.push("La date de relevé est dans le futur.");
  return errors;
}

export interface BenchmarkSource {
  sourceName: string;
  sourceUrl: string;
  lowPriceCents: number;
  highPriceCents: number;
  priceBasis: PriceBasis;
  formatLabel: string | null;
  sourceExcerpt: string;
  observedAt: string;
}

export interface BenchmarkAggregate {
  workItemKey: string;
  sizeClass: SizeClass | null;
  unitLabel: string | null;
  /** Nombre de sources distinctes, pas nombre de lignes. */
  sourceCount: number;
  /** Le plus bas affiché et le plus haut affiché, toutes sources confondues. */
  lowCents: number;
  highCents: number;
  /** Médiane des milieux de fourchette, une voix par source. */
  medianCents: number;
  /** Seulement à partir de cinq sources, comme pour les grilles d'ateliers. */
  q1Cents: number | null;
  q3Cents: number | null;
  /** Les bases rencontrées. Plus d'une : les montants ne sont pas comparables tels quels. */
  bases: PriceBasis[];
  oldestObservedAt: string;
  stale: boolean;
  sources: BenchmarkSource[];
}

function daysSince(isoDate: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(`${isoDate}T00:00:00Z`).getTime()) / 86_400_000);
}

/**
 * Agrège les repères d'un travail, pour un format donné (ou « non précisé »)
 * et une unité donnée.
 *
 * Même discipline que les grilles : **une source, une voix** — un site qui
 * publie neuf formats ne pèse pas neuf fois — et pas de quartile sur trois
 * valeurs. Les formats « non précisé » ne se mélangent pas aux autres : un
 * prix « tous formats » n'est pas un prix de grand format.
 */
export function aggregateBenchmarks(
  rows: readonly PriceBenchmark[],
  workItemKey: string,
  sizeClass: SizeClass | null,
  unitLabel: string | null,
  now: Date = new Date(),
): BenchmarkAggregate | null {
  const eligible = rows.filter(
    (row) =>
      row.status === "active" &&
      row.workItemKey === workItemKey &&
      row.sizeClass === sizeClass &&
      row.unitLabel === unitLabel,
  );
  if (eligible.length === 0) return null;

  // Une voix par source : la fourchette la plus récente, élargie aux autres
  // lignes de la même source relevées le même jour (plusieurs formats d'une
  // même classe, par exemple).
  const bySource = new Map<string, BenchmarkSource>();
  for (const row of eligible) {
    const held = bySource.get(row.sourceUrl);
    if (!held || row.observedAt > held.observedAt) {
      bySource.set(row.sourceUrl, {
        sourceName: row.sourceName,
        sourceUrl: row.sourceUrl,
        lowPriceCents: row.lowPriceCents,
        highPriceCents: row.highPriceCents,
        priceBasis: row.priceBasis,
        formatLabel: row.formatLabel,
        sourceExcerpt: row.sourceExcerpt,
        observedAt: row.observedAt,
      });
    } else if (row.observedAt === held.observedAt) {
      held.lowPriceCents = Math.min(held.lowPriceCents, row.lowPriceCents);
      held.highPriceCents = Math.max(held.highPriceCents, row.highPriceCents);
    }
  }

  const sources = [...bySource.values()].sort((a, b) => a.lowPriceCents - b.lowPriceCents);
  const midpoints = sources
    .map((source) => Math.round((source.lowPriceCents + source.highPriceCents) / 2))
    .sort((a, b) => a - b);
  const enough = sources.length >= QUARTILE_MINIMUM_REFERENCES;
  const oldestObservedAt = sources
    .map((source) => source.observedAt)
    .reduce((oldest, current) => (current < oldest ? current : oldest));

  return {
    workItemKey,
    sizeClass,
    unitLabel,
    sourceCount: sources.length,
    lowCents: Math.min(...sources.map((source) => source.lowPriceCents)),
    highCents: Math.max(...sources.map((source) => source.highPriceCents)),
    medianCents: percentile(midpoints, 0.5),
    q1Cents: enough ? percentile(midpoints, 0.25) : null,
    q3Cents: enough ? percentile(midpoints, 0.75) : null,
    bases: [...new Set(sources.map((source) => source.priceBasis))],
    oldestObservedAt,
    stale: daysSince(oldestObservedAt, now) > BENCHMARK_STALE_AFTER_DAYS,
    sources,
  };
}

/** Tous les agrégats présents, sans produit cartésien des combinaisons vides. */
export function benchmarkAggregatesFrom(
  rows: readonly PriceBenchmark[],
  now: Date = new Date(),
): BenchmarkAggregate[] {
  const combinations = new Map<string, [string, SizeClass | null, string | null]>();
  for (const row of rows) {
    if (row.status !== "active") continue;
    combinations.set(`${row.workItemKey}|${row.sizeClass ?? ""}|${row.unitLabel ?? ""}`, [
      row.workItemKey,
      row.sizeClass,
      row.unitLabel,
    ]);
  }
  return [...combinations.values()]
    .map(([key, size, unit]) => aggregateBenchmarks(rows, key, size, unit, now))
    .filter((aggregate): aggregate is BenchmarkAggregate => aggregate !== null);
}
