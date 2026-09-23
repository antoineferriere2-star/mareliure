import type { Supa } from "@/build/services/adminAuth.server";
import {
  BASE_PRICE_REFERENCE_VERSION,
  BASE_PRICE_PRICING_MODES,
  type BasePricePricingMode,
} from "@/marketplace/pricing/basePrices";
import { WORK_ITEMS } from "@/marketplace/pricing/catalog";
import {
  buildBinderPricingCatalog,
  bulkPricePreview,
  type BinderPricingCatalogItem,
  type BulkPriceSource,
} from "@/marketplace/pricing/binderPricingCatalog";
import { BinderQuotesError } from "./binderQuotes.server";

const knownKeys = new Set(WORK_ITEMS.map((item) => item.key));

function assertKey(pricingKey: string) {
  if (!knownKeys.has(pricingKey)) throw new BinderQuotesError("invalid_input");
}

export async function listBinderPricingCatalog(
  sb: Supa,
  binderId: string,
): Promise<BinderPricingCatalogItem[]> {
  const [baseResult, preferenceResult] = await Promise.all([
    sb
      .from("marketplace_reference_default_prices")
      .select("pricing_key, default_unit_price_cents, unit, pricing_mode")
      .eq("reference_version", BASE_PRICE_REFERENCE_VERSION)
      .in("status", ["draft", "published"])
      .order("pricing_key"),
    sb
      .from("marketplace_binder_price_preferences")
      .select("pricing_key, custom_unit_price_cents, custom_pricing_mode, is_favorite")
      .eq("binder_id", binderId),
  ]);
  if (baseResult.error || preferenceResult.error) throw new BinderQuotesError("failed");
  const baseRows = (baseResult.data ?? []).map((row) => ({
    ...row,
    pricing_mode: BASE_PRICE_PRICING_MODES.includes(row.pricing_mode as BasePricePricingMode)
      ? (row.pricing_mode as BasePricePricingMode)
      : ("manual_review" as const),
  }));
  const preferences = (preferenceResult.data ?? []).map((row) => ({
    ...row,
    custom_pricing_mode: row.custom_pricing_mode as BasePricePricingMode | null,
  }));
  const catalog = buildBinderPricingCatalog(baseRows, preferences);
  if (catalog.length !== WORK_ITEMS.length) throw new BinderQuotesError("failed");
  return catalog;
}

async function preferenceFor(sb: Supa, binderId: string, pricingKey: string) {
  const { data, error } = await sb
    .from("marketplace_binder_price_preferences")
    .select("is_favorite")
    .eq("binder_id", binderId)
    .eq("pricing_key", pricingKey)
    .maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  return data;
}

export async function saveBinderPriceOverride(
  sb: Supa,
  binderId: string,
  input: {
    pricingKey: string;
    unitPriceCents: number;
  },
) {
  assertKey(input.pricingKey);
  const catalog = await listBinderPricingCatalog(sb, binderId);
  const item = catalog.find((row) => row.pricingKey === input.pricingKey);
  if (!item) throw new BinderQuotesError("not_found");
  const mode = item.basePricingMode === "manual_review" ? "starting_from" : item.basePricingMode;
  const existing = await preferenceFor(sb, binderId, input.pricingKey);
  const { error } = await sb.from("marketplace_binder_price_preferences").upsert(
    {
      binder_id: binderId,
      pricing_key: input.pricingKey,
      custom_unit_price_cents: input.unitPriceCents,
      custom_pricing_mode: mode,
      is_favorite: existing?.is_favorite ?? false,
    },
    { onConflict: "binder_id,pricing_key" },
  );
  if (error) throw new BinderQuotesError("failed");
  return listBinderPricingCatalog(sb, binderId);
}

export async function setBinderPriceFavorite(
  sb: Supa,
  binderId: string,
  input: { pricingKey: string; isFavorite: boolean },
) {
  assertKey(input.pricingKey);
  const catalog = await listBinderPricingCatalog(sb, binderId);
  const item = catalog.find((row) => row.pricingKey === input.pricingKey);
  if (!item) throw new BinderQuotesError("not_found");
  const { error } = await sb.from("marketplace_binder_price_preferences").upsert(
    {
      binder_id: binderId,
      pricing_key: input.pricingKey,
      custom_unit_price_cents: item.customPriceCents,
      custom_pricing_mode: item.hasOverride ? item.effectivePricingMode : null,
      is_favorite: input.isFavorite,
    },
    { onConflict: "binder_id,pricing_key" },
  );
  if (error) throw new BinderQuotesError("failed");
  return listBinderPricingCatalog(sb, binderId);
}

export async function bulkAdjustBinderPrices(
  sb: Supa,
  binderId: string,
  input: { pricingKeys: string[]; percentBps: number; source: BulkPriceSource },
) {
  input.pricingKeys.forEach(assertKey);
  const catalog = await listBinderPricingCatalog(sb, binderId);
  const preview = bulkPricePreview(catalog, input.pricingKeys, input.percentBps, input.source);
  if (!preview.length) throw new BinderQuotesError("invalid_input");
  const byKey = new Map(catalog.map((item) => [item.pricingKey, item]));
  const rows = preview.map((change) => {
    const item = byKey.get(change.pricingKey)!;
    return {
      binder_id: binderId,
      pricing_key: change.pricingKey,
      custom_unit_price_cents: change.newPriceCents,
      custom_pricing_mode: item.basePricingMode,
      is_favorite: item.isFavorite,
    };
  });
  const { error } = await sb
    .from("marketplace_binder_price_preferences")
    .upsert(rows, { onConflict: "binder_id,pricing_key" });
  if (error) throw new BinderQuotesError("failed");
  return listBinderPricingCatalog(sb, binderId);
}

export async function resetBinderPrices(sb: Supa, binderId: string, pricingKeys: string[]) {
  pricingKeys.forEach(assertKey);
  if (!pricingKeys.length) throw new BinderQuotesError("invalid_input");
  const { error } = await sb
    .from("marketplace_binder_price_preferences")
    .update({ custom_unit_price_cents: null, custom_pricing_mode: null })
    .eq("binder_id", binderId)
    .in("pricing_key", pricingKeys);
  if (error) throw new BinderQuotesError("failed");
  return listBinderPricingCatalog(sb, binderId);
}
