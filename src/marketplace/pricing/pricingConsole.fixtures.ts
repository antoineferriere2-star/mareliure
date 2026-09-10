/**
 * Fabriques de test pour la console de prix. Aucun montant n'y est un tarif :
 * chaque test pose les siens, visiblement, là où il les vérifie.
 */
import type { PriceBenchmark } from "./benchmark";
import type { PricingModifier } from "./modifiers";
import type { PricebookEntry } from "./pricebook";

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

export function pricebookEntry(overrides: Partial<PricebookEntry> = {}): PricebookEntry {
  return {
    id: nextId("entry"),
    workItemKey: "demi_cuir",
    sizeClass: "standard",
    complexityClass: "standard",
    pricingMode: "FIXED",
    referenceBinderPayoutCents: 30_000,
    customerPriceCents: 40_000,
    priceHtHighCents: null,
    unitLabel: null,
    vatRateBps: 2_000,
    customerPriceTtcCents: 48_000,
    targetMarginBps: 1_800,
    minimumMarginCents: null,
    includedWorkItems: [],
    publicVisible: false,
    pricingMethod: "manual",
    version: 1,
    status: "published",
    validatedAt: "2026-09-01T10:00:00.000Z",
    validatedBy: "admin-user",
    createdAt: "2026-09-01T10:00:00.000Z",
    createdBy: "admin-user",
    referenceCountAtValidation: 0,
    notes: null,
    changeReason: null,
    ...overrides,
  };
}

export function benchmarkRow(overrides: Partial<PriceBenchmark> = {}): PriceBenchmark {
  return {
    id: nextId("benchmark"),
    workItemKey: "demi_cuir",
    sizeClass: "standard",
    complexityClass: null,
    lowPriceCents: 10_000,
    highPriceCents: 14_000,
    unitLabel: null,
    priceBasis: "TTC",
    formatLabel: null,
    sourceName: "Atelier A",
    sourceUrl: "https://a.example/tarifs",
    sourceExcerpt: "Demi-cuir 100 à 140 €",
    observedAt: "2026-09-10",
    provenance: "WEB_BENCHMARK",
    status: "active",
    notes: null,
    ...overrides,
  };
}

export function modifier(overrides: Partial<PricingModifier> = {}): PricingModifier {
  return {
    id: nextId("modifier"),
    axis: "size",
    classKey: "large",
    kind: "PERCENT",
    percentBps: null,
    fixedCents: null,
    enabled: false,
    notes: null,
    updatedAt: "2026-09-10T00:00:00.000Z",
    updatedBy: null,
    ...overrides,
  };
}

export const POLICY = { targetMarginBps: 1_800, minimumMarginCents: 2_000 };
