/**
 * Ce qu'on sait d'un travail, couche par couche, à côté de son prix.
 *
 * Pour une combinaison travail × format × complexité : l'entrée du Pricebook
 * (la décision), la grille des ateliers (l'observation), le benchmark web (le
 * repère), et ce que tout cela vaut comme preuve. Les trois couches sont
 * rendues **côte à côte, jamais fusionnées** : aucune moyenne entre un tarif
 * d'atelier et un prix affiché, aucun montant qui passerait de l'une à l'autre.
 */
import type { ComplexityClass, SizeClass } from "./catalog";
import type { BenchmarkAggregate } from "./benchmark";
import { publishedEntry, type PricebookEntry } from "./pricebook";
import { assessEvidence, type EvidenceAssessment } from "./pricebookEvidence";
import type { RateAggregate } from "./rateCard";

export interface WorkReferences {
  entry: PricebookEntry | null;
  binder: RateAggregate | null;
  /** La grille retenue est celle du format et de la complexité courants. */
  binderApproximated: boolean;
  benchmark: BenchmarkAggregate | null;
  /** Le repère retenu ne précise pas de format. */
  benchmarkFormatUnstated: boolean;
  evidence: EvidenceAssessment;
}

export interface DriftSignal {
  entryId: string;
  severity: "none" | "watch" | "act";
}

export interface ReferenceQuery {
  workItemKey: string;
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
  aggregates: readonly RateAggregate[];
  benchmarkAggregates: readonly BenchmarkAggregate[];
  entries: readonly PricebookEntry[];
  drift: readonly DriftSignal[];
  now?: Date;
}

export function referencesFor(query: ReferenceQuery): WorkReferences {
  const { workItemKey, sizeClass, complexityClass } = query;

  const exact =
    query.aggregates.find(
      (a) =>
        a.workItemKey === workItemKey &&
        a.sizeClass === sizeClass &&
        a.complexityClass === complexityClass,
    ) ?? null;
  const binder =
    exact ??
    query.aggregates.find(
      (a) =>
        a.workItemKey === workItemKey &&
        a.sizeClass === "standard" &&
        a.complexityClass === "standard",
    ) ??
    null;

  const forWork = query.benchmarkAggregates.filter((b) => b.workItemKey === workItemKey);
  const pick = (list: readonly BenchmarkAggregate[]) =>
    list.find((b) => b.unitLabel === null) ?? list[0] ?? null;
  const benchmark =
    pick(forWork.filter((b) => b.sizeClass === sizeClass)) ??
    pick(forWork.filter((b) => b.sizeClass === null));

  const entry = publishedEntry(query.entries, workItemKey, sizeClass, complexityClass);
  const drift = entry ? query.drift.find((signal) => signal.entryId === entry.id) : undefined;

  return {
    entry,
    binder,
    binderApproximated: binder !== null && exact === null,
    benchmark,
    benchmarkFormatUnstated: benchmark !== null && benchmark.sizeClass === null,
    evidence: assessEvidence({
      binderReferenceCount: binder?.referenceCount ?? 0,
      binderOldestEffectiveFrom: binder?.oldestEffectiveFrom ?? null,
      benchmarkSourceCount: benchmark?.sourceCount ?? 0,
      benchmarkOldestObservedAt: benchmark?.oldestObservedAt ?? null,
      pricebookValidatedAt: entry?.validatedAt ?? null,
      driftSeverity: drift && drift.severity !== "none" ? drift.severity : null,
      now: query.now,
    }),
  };
}
