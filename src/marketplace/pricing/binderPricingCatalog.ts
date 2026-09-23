import { WORK_FAMILIES, WORK_ITEMS, type WorkFamilyKey } from "./catalog";
import type { BasePricePricingMode } from "./basePrices";

export interface BinderPriceBaseRow {
  pricing_key: string;
  default_unit_price_cents: number | null;
  unit: string;
  pricing_mode: BasePricePricingMode;
}

export interface BinderPricePreferenceRow {
  pricing_key: string;
  custom_unit_price_cents: number | null;
  custom_pricing_mode: BasePricePricingMode | null;
  is_favorite: boolean;
}

export interface BinderPricingCatalogItem {
  pricingKey: string;
  label: string;
  family: WorkFamilyKey;
  familyLabel: string;
  hint: string | null;
  unit: string;
  basePriceCents: number | null;
  basePricingMode: BasePricePricingMode;
  customPriceCents: number | null;
  effectivePriceCents: number | null;
  effectivePricingMode: BasePricePricingMode;
  isFavorite: boolean;
  hasOverride: boolean;
}

export type BulkPriceSource = "base" | "current";

const familyLabels = new Map(WORK_FAMILIES.map((family) => [family.key, family.label]));

export function buildBinderPricingCatalog(
  baseRows: readonly BinderPriceBaseRow[],
  preferences: readonly BinderPricePreferenceRow[],
): BinderPricingCatalogItem[] {
  const baseByKey = new Map(baseRows.map((row) => [row.pricing_key, row]));
  const preferenceByKey = new Map(preferences.map((row) => [row.pricing_key, row]));
  return WORK_ITEMS.flatMap((work) => {
    const base = baseByKey.get(work.key);
    if (!base) return [];
    const preference = preferenceByKey.get(work.key);
    const hasOverride =
      preference?.custom_unit_price_cents !== null &&
      preference?.custom_unit_price_cents !== undefined;
    return [
      {
        pricingKey: work.key,
        label: work.label,
        family: work.family,
        familyLabel: familyLabels.get(work.family) ?? work.family,
        hint: work.hint ?? null,
        unit: base.unit,
        basePriceCents: base.default_unit_price_cents,
        basePricingMode: base.pricing_mode,
        customPriceCents: hasOverride ? preference!.custom_unit_price_cents : null,
        effectivePriceCents: hasOverride
          ? preference!.custom_unit_price_cents
          : base.default_unit_price_cents,
        effectivePricingMode: hasOverride
          ? (preference!.custom_pricing_mode ?? base.pricing_mode)
          : base.pricing_mode,
        isFavorite: preference?.is_favorite ?? false,
        hasOverride,
      },
    ];
  });
}

/** Pourcentage en points de base : 1 000 = +10 %. Montants toujours entiers. */
export function adjustPriceCents(cents: number, percentBps: number): number {
  if (!Number.isInteger(cents) || cents < 0) throw new RangeError("Prix invalide");
  if (!Number.isInteger(percentBps) || percentBps < -9_000 || percentBps > 50_000) {
    throw new RangeError("Ajustement hors limites");
  }
  return Math.floor((cents * (10_000 + percentBps) + 5_000) / 10_000);
}

export function priceDifferenceBps(
  baseCents: number | null,
  effectiveCents: number | null,
): number | null {
  if (baseCents === null || effectiveCents === null || baseCents === 0) return null;
  return Math.round(((effectiveCents - baseCents) * 10_000) / baseCents);
}

export function bulkPricePreview(
  items: readonly BinderPricingCatalogItem[],
  pricingKeys: readonly string[],
  percentBps: number,
  source: BulkPriceSource,
) {
  const selected = new Set(pricingKeys);
  return items.flatMap((item) => {
    if (
      !selected.has(item.pricingKey) ||
      item.basePriceCents === null ||
      item.basePricingMode === "manual_review"
    )
      return [];
    const sourceCents = source === "base" ? item.basePriceCents : item.effectivePriceCents;
    if (sourceCents === null) return [];
    return [
      {
        pricingKey: item.pricingKey,
        label: item.label,
        currentPriceCents: item.effectivePriceCents!,
        newPriceCents: adjustPriceCents(sourceCents, percentBps),
      },
    ];
  });
}
