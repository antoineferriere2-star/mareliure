/**
 * Tout ce qu'il faut pour chiffrer, chargé en une fois.
 *
 * La console, le simulateur et le dossier lisent exactement les mêmes données
 * de la même façon. Un simulateur plus indulgent que la validation d'un
 * dossier serait un piège : on y montrerait un prix que le dossier refuserait.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import type { ComplexityClass, SizeClass } from "@/marketplace/pricing/catalog";
import {
  benchmarkAggregatesFrom,
  type BenchmarkAggregate,
  type PriceBenchmark,
} from "@/marketplace/pricing/benchmark";
import type { PricingModifier } from "@/marketplace/pricing/modifiers";
import {
  detectDrift,
  type PricebookDrift,
  type PricebookEntry,
} from "@/marketplace/pricing/pricebook";
import type { BinderRate, RateAggregate } from "@/marketplace/pricing/rateCard";
import {
  referencesFor,
  type DriftSignal,
  type WorkReferences,
} from "@/marketplace/pricing/references";
import {
  aggregatesFrom,
  loadActiveRates,
  loadBenchmarks,
  loadModifiers,
  loadPricebook,
} from "./pricingRepository.server";

export interface PricingContext {
  rates: (BinderRate & { binderName: string })[];
  aggregates: RateAggregate[];
  benchmarks: PriceBenchmark[];
  benchmarkAggregates: BenchmarkAggregate[];
  /** Toutes les versions, retirées comprises : c'est l'historique. */
  pricebook: PricebookEntry[];
  published: PricebookEntry[];
  modifiers: PricingModifier[];
  drift: PricebookDrift[];
  driftSignals: DriftSignal[];
}

export async function loadPricingContext(sb: Supa): Promise<PricingContext> {
  const [rates, benchmarks, pricebook, modifiers] = await Promise.all([
    loadActiveRates(sb),
    loadBenchmarks(sb),
    loadPricebook(sb, false),
    loadModifiers(sb),
  ]);
  const aggregates = aggregatesFrom(rates);
  const published = pricebook.filter((entry) => entry.status === "published");
  const drift = detectDrift(published, aggregates);
  return {
    rates,
    aggregates,
    benchmarks,
    benchmarkAggregates: benchmarkAggregatesFrom(benchmarks),
    pricebook,
    published,
    modifiers,
    drift,
    driftSignals: drift.map((item) => ({ entryId: item.entry.id, severity: item.severity })),
  };
}

export function referencesForWork(
  context: PricingContext,
  workItemKeys: readonly string[],
  sizeClass: SizeClass,
  complexityClass: ComplexityClass,
  now: Date = new Date(),
): Record<string, WorkReferences> {
  return Object.fromEntries(
    [...new Set(workItemKeys)].map((workItemKey) => [
      workItemKey,
      referencesFor({
        workItemKey,
        sizeClass,
        complexityClass,
        aggregates: context.aggregates,
        benchmarkAggregates: context.benchmarkAggregates,
        entries: context.published,
        drift: context.driftSignals,
        now,
      }),
    ]),
  );
}
