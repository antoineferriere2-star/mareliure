import { describe, expect, it } from "vitest";
import { WORK_ITEMS } from "./catalog";
import { lineFromBasePrice } from "@/marketplace/quotes/quoteLines";
import {
  adjustPriceCents,
  buildBinderPricingCatalog,
  bulkPricePreview,
  priceDifferenceBps,
} from "./binderPricingCatalog";

const manual = new Set([
  "restauration_reliure_ancienne",
  "restauration_patrimoniale",
  "reliure_de_creation",
  "projet_sur_mesure",
]);
const base = WORK_ITEMS.map((item, index) => ({
  pricing_key: item.key,
  default_unit_price_cents: manual.has(item.key) ? null : 10_000 + index,
  unit: "ouvrage",
  pricing_mode: manual.has(item.key) ? ("manual_review" as const) : ("fixed" as const),
}));

describe("catalogue tarifaire atelier", () => {
  it("affiche immédiatement 45 prestations, 41 numériques et 4 sur étude", () => {
    const catalog = buildBinderPricingCatalog(base, []);
    expect(catalog).toHaveLength(45);
    expect(catalog.filter((item) => item.basePriceCents !== null)).toHaveLength(41);
    expect(catalog.filter((item) => item.basePricingMode === "manual_review")).toHaveLength(4);
  });

  it("un override est figé en centimes et son retrait retrouve la base", () => {
    const preference = [
      {
        pricing_key: "plein_cuir",
        custom_unit_price_cents: 38_500,
        custom_pricing_mode: "fixed" as const,
        is_favorite: true,
      },
    ];
    const changed = buildBinderPricingCatalog(base, preference).find(
      (item) => item.pricingKey === "plein_cuir",
    )!;
    const reset = buildBinderPricingCatalog(base, [
      { ...preference[0], custom_unit_price_cents: null, custom_pricing_mode: null },
    ]).find((item) => item.pricingKey === "plein_cuir")!;
    expect(changed).toMatchObject({
      effectivePriceCents: 38_500,
      hasOverride: true,
      isFavorite: true,
    });
    expect(reset).toMatchObject({
      effectivePriceCents: changed.basePriceCents,
      hasOverride: false,
      isFavorite: true,
    });
  });

  it("calcule +10 %, -10 % et les centimes sans flottants", () => {
    expect(adjustPriceCents(11_500, 1_000)).toBe(12_650);
    expect(adjustPriceCents(11_500, -1_000)).toBe(10_350);
    expect(priceDifferenceBps(35_000, 38_500)).toBe(1_000);
  });

  it("le bulk exclut les quatre prestations sur étude", () => {
    const catalog = buildBinderPricingCatalog(base, []);
    const preview = bulkPricePreview(
      catalog,
      catalog.map((item) => item.pricingKey),
      1_000,
      "base",
    );
    expect(preview).toHaveLength(41);
    expect(preview.some((item) => manual.has(item.pricingKey))).toBe(false);
  });

  it("distingue une hausse sur la base d'une hausse sur le prix actuel", () => {
    const catalog = buildBinderPricingCatalog(base, [
      {
        pricing_key: "plein_cuir",
        custom_unit_price_cents: 39_000,
        custom_pricing_mode: "fixed",
        is_favorite: false,
      },
    ]);
    const key = ["plein_cuir"];
    const item = catalog.find((row) => row.pricingKey === "plein_cuir")!;
    expect(bulkPricePreview(catalog, key, 1_000, "base")[0].newPriceCents).toBe(
      adjustPriceCents(item.basePriceCents!, 1_000),
    );
    expect(bulkPricePreview(catalog, key, 1_000, "current")[0].newPriceCents).toBe(42_900);
  });

  it("fige le prix effectif dans une nouvelle ligne sans changer les lignes déjà créées", () => {
    const before = lineFromBasePrice({ pricingKey: "plein_cuir", label: "Plein cuir", unit: "ouvrage", unitPriceCents: 35_000, pricingMode: "fixed" }, 2_000, "avant");
    const after = lineFromBasePrice({ pricingKey: "plein_cuir", label: "Plein cuir", unit: "ouvrage", unitPriceCents: 38_500, pricingMode: "fixed" }, 2_000, "apres");
    expect(after.unitPriceCents).toBe(38_500);
    expect(before.unitPriceCents).toBe(35_000);
  });
});
