/**
 * Fabriques de test pour la grille tarifaire. Chaque test pose ses montants,
 * visiblement, là où il les vérifie.
 */
import type { PricingGrid } from "./composition";
import type { PricingModifier } from "./modifiers";
import type { PayoutPolicy } from "./payout";
import type { PricebookEntry } from "./pricebook";
import { fromTtc } from "./vat";
import type { WebBenchmark } from "./webBenchmark";

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

/** La politique initiale donnée par Ma Reliure : 25 % du HT, 80 € minimum. */
export const POLICY: PayoutPolicy = { targetMarginBps: 2_500, minimumMarginCents: 8_000 };

/** Un tarif validé par Ma Reliure. */
export function entry(overrides: Partial<PricebookEntry> = {}): PricebookEntry {
  const priceTtcCents = overrides.priceTtcCents === undefined ? 35_000 : overrides.priceTtcCents;
  return {
    id: nextId("entry"),
    workItemKey: "demi_cuir",
    pricingMode: "FIXED",
    priceHtCents: priceTtcCents === null ? null : fromTtc(priceTtcCents).htCents,
    priceTtcCents,
    vatRateBps: 2_000,
    status: "published",
    provenance: "ADMIN_VALIDATED",
    version: 1,
    publicVisible: false,
    validatedAt: "2026-09-10T10:00:00.000Z",
    validatedBy: "admin-user",
    createdAt: "2026-09-10T10:00:00.000Z",
    createdBy: "admin-user",
    changeReason: null,
    notes: null,
    ...overrides,
  };
}

/** Une référence initiale web, encore à valider. */
export function draft(overrides: Partial<PricebookEntry> = {}): PricebookEntry {
  return entry({
    status: "draft",
    provenance: "WEB_REFERENCE_INITIAL",
    validatedAt: null,
    validatedBy: null,
    createdBy: null,
    ...overrides,
  });
}

export function benchmark(overrides: Partial<WebBenchmark> = {}): WebBenchmark {
  return {
    workItemKey: "demi_cuir",
    webMinCents: 25_000,
    webReferenceCents: 35_000,
    webMaxCents: 45_000,
    pricingUnit: "per_book",
    openEndedMax: false,
    sourceSummary: "Recherche initiale",
    researchedAt: "2026-09-10",
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

export function grid(
  entries: readonly PricebookEntry[],
  overrides: Partial<PricingGrid> = {},
): PricingGrid {
  return { entries, modifiers: [], policy: POLICY, inactiveWorkItems: [], ...overrides };
}
