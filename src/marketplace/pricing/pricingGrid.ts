/**
 * La grille tarifaire Ma Reliure telle que l'administration la lit.
 *
 * Une ligne par opération du catalogue, dans l'ordre du catalogue : la
 * référence web à gauche, le tarif Ma Reliure à droite, et l'écart entre les
 * deux. L'écart informe — un tarif au-dessus de la référence est un
 * positionnement, pas une anomalie.
 */
import { WORK_ITEMS, type WorkFamilyKey, type WorkRole } from "./catalog";
import { activeEntry, pricebookHistory, type PricebookEntry } from "./pricebook";
import type { PricingMode } from "./pricingModes";
import type { WebBenchmark } from "./webBenchmark";

export interface WorkItemState {
  key: string;
  active: boolean;
  hint: string | null;
  updatedAt: string | null;
}

export interface PriceDelta {
  cents: number;
  bps: number;
}

export interface GridRow {
  key: string;
  label: string;
  family: WorkFamilyKey;
  role: WorkRole;
  requiresStudy: boolean;
  active: boolean;
  hint: string | null;
  benchmark: WebBenchmark | null;
  entry: PricebookEntry | null;
  mode: PricingMode | null;
  priceTtcCents: number | null;
  /** Sur étude : par le catalogue ou par la grille. */
  study: boolean;
  /** Référence initiale web pas encore validée. */
  toValidate: boolean;
  /** Écart du tarif à la référence web, quand les deux existent. */
  delta: PriceDelta | null;
  modified: boolean;
  lastModifiedAt: string | null;
  versionCount: number;
}

export function priceDelta(
  priceCents: number | null,
  referenceCents: number | null,
): PriceDelta | null {
  if (priceCents === null || referenceCents === null || referenceCents <= 0) return null;
  const cents = priceCents - referenceCents;
  return { cents, bps: Math.round((cents * 10_000) / referenceCents) };
}

export function buildPricingGrid(input: {
  workItems: readonly WorkItemState[];
  benchmarks: readonly WebBenchmark[];
  entries: readonly PricebookEntry[];
}): GridRow[] {
  const states = new Map(input.workItems.map((state) => [state.key, state]));
  const benchmarks = new Map(input.benchmarks.map((benchmark) => [benchmark.workItemKey, benchmark]));

  return WORK_ITEMS.map((item) => {
    const entry = activeEntry(input.entries, item.key);
    const benchmark = benchmarks.get(item.key) ?? null;
    const state = states.get(item.key);
    const priceTtcCents = entry?.priceTtcCents ?? null;
    const delta =
      benchmark?.pricingUnit === "per_hour"
        ? null
        : priceDelta(priceTtcCents, benchmark?.webReferenceCents ?? null);
    return {
      key: item.key,
      label: item.label,
      family: item.family,
      role: item.role,
      requiresStudy: item.requiresStudy === true,
      active: state?.active ?? true,
      hint: state?.hint ?? item.hint ?? null,
      benchmark,
      entry,
      mode: entry?.pricingMode ?? null,
      priceTtcCents,
      study: item.requiresStudy === true || entry?.pricingMode === "MANUAL_REVIEW",
      toValidate: entry?.status === "draft",
      delta,
      modified: delta !== null && delta.cents !== 0,
      lastModifiedAt: entry?.createdAt ?? null,
      versionCount: pricebookHistory(input.entries, item.key).length,
    };
  });
}

export interface GridSummary {
  total: number;
  automatic: number;
  study: number;
  modified: number;
  toValidate: number;
  lastUpdatedAt: string | null;
}

export function gridSummary(rows: readonly GridRow[]): GridSummary {
  const dates = rows.map((row) => row.lastModifiedAt).filter((date): date is string => !!date);
  return {
    total: rows.length,
    automatic: rows.filter((row) => !row.study && row.priceTtcCents !== null).length,
    study: rows.filter((row) => row.study).length,
    modified: rows.filter((row) => row.modified).length,
    toValidate: rows.filter((row) => row.toValidate).length,
    lastUpdatedAt: dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null,
  };
}
