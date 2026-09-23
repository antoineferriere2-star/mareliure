/* eslint-disable @typescript-eslint/no-explicit-any -- client Supabase en mémoire */
import { beforeEach, describe, expect, it } from "vitest";
import { WORK_ITEMS } from "@/marketplace/pricing/catalog";
import { bulkAdjustBinderPrices, listBinderPricingCatalog, resetBinderPrices, saveBinderPriceOverride, setBinderPriceFavorite } from "./binderPricingCatalog.server";

type Row = Record<string, any>;

function makeDb() {
  const isManual = (key: string) => ["restauration_reliure_ancienne", "restauration_patrimoniale", "reliure_de_creation", "projet_sur_mesure"].includes(key);
  const tables: Record<string, Row[]> = {
    marketplace_reference_default_prices: WORK_ITEMS.map((item, index) => ({ pricing_key: item.key, default_unit_price_cents: isManual(item.key) ? null : 10_000 + index, unit: "ouvrage", pricing_mode: isManual(item.key) ? "manual_review" : item.key === "pleine_toile" ? "starting_from" : "fixed", reference_version: "mareliure-base-prices-v1", status: "published" })),
    marketplace_binder_price_preferences: [],
  };
  const rows = (name: string) => (tables[name] ??= []);
  function from(table: string) {
    let operation: "select" | "update" | "upsert" = "select";
    let values: Row | Row[];
    const filters: ((row: Row) => boolean)[] = [];
    const run = () => {
      if (operation === "upsert") for (const value of Array.isArray(values) ? values : [values]) {
        const found = rows(table).find((row) => row.binder_id === value.binder_id && row.pricing_key === value.pricing_key);
        if (found) Object.assign(found, value); else rows(table).push({ ...value });
      }
      const result = rows(table).filter((row) => filters.every((filter) => filter(row)));
      if (operation === "update") result.forEach((row) => Object.assign(row, values));
      return result.map((row) => ({ ...row }));
    };
    const query: any = {
      select: () => query,
      update: (next: Row) => ((operation = "update"), (values = next), query),
      upsert: (next: Row | Row[]) => ((operation = "upsert"), (values = next), query),
      eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), query),
      in: (column: string, accepted: unknown[]) => (filters.push((row) => accepted.includes(row[column])), query),
      order: () => query,
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => Promise.resolve({ data: run(), error: null }).then(resolve, reject),
    };
    return query;
  }
  return { sb: { from } as any, tables };
}

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let world: ReturnType<typeof makeDb>;

beforeEach(() => { world = makeDb(); });

describe("catalogue tarifaire atelier côté serveur", () => {
  it("isole strictement les préférences de chaque atelier", async () => {
    world.tables.marketplace_binder_price_preferences.push(
      { binder_id: A, pricing_key: "plein_cuir", custom_unit_price_cents: 38_500, custom_pricing_mode: "fixed", is_favorite: true },
      { binder_id: B, pricing_key: "plein_cuir", custom_unit_price_cents: 99_900, custom_pricing_mode: "fixed", is_favorite: false },
    );
    expect((await listBinderPricingCatalog(world.sb, A)).find((row) => row.pricingKey === "plein_cuir")).toMatchObject({ effectivePriceCents: 38_500, isFavorite: true });
  });

  it("enregistre un override et conserve le favori", async () => {
    await setBinderPriceFavorite(world.sb, A, { pricingKey: "plein_cuir", isFavorite: true });
    const catalog = await saveBinderPriceOverride(world.sb, A, { pricingKey: "plein_cuir", unitPriceCents: 38_500 });
    expect(catalog.find((row) => row.pricingKey === "plein_cuir")).toMatchObject({ effectivePriceCents: 38_500, isFavorite: true, hasOverride: true });
  });

  it("applique un pourcentage aux 41 lignes numériques puis retire les overrides", async () => {
    const keys = WORK_ITEMS.map((item) => item.key);
    const adjusted = await bulkAdjustBinderPrices(world.sb, A, { pricingKeys: keys, percentBps: 1_000, source: "base" });
    expect(adjusted.filter((row) => row.hasOverride)).toHaveLength(41);
    expect(adjusted.filter((row) => row.basePricingMode === "manual_review" && row.hasOverride)).toHaveLength(0);
    expect((await resetBinderPrices(world.sb, A, keys)).filter((row) => row.hasOverride)).toHaveLength(0);
  });

  it("limite un ajustement à une catégorie ou à une sélection", async () => {
    const leather = WORK_ITEMS.filter((item) => item.family === "leather").map((item) => item.key);
    let catalog = await bulkAdjustBinderPrices(world.sb, A, { pricingKeys: leather, percentBps: 1_500, source: "base" });
    expect(catalog.filter((row) => row.hasOverride).map((row) => row.pricingKey)).toEqual(leather);
    await resetBinderPrices(world.sb, A, leather);
    catalog = await bulkAdjustBinderPrices(world.sb, A, { pricingKeys: ["plein_cuir", "dorure_titrage"], percentBps: -500, source: "base" });
    expect(catalog.filter((row) => row.hasOverride).map((row) => row.pricingKey)).toEqual(["plein_cuir", "dorure_titrage"]);
  });
});
