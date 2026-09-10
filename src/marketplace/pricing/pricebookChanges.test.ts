/**
 * Ce que les gestes de la grille écrivent, et ce que la grille affiche.
 */
import { describe, expect, it } from "vitest";
import { WORK_ITEMS } from "./catalog";
import { planPricebookChange } from "./pricebookChanges";
import { buildPricingGrid, gridSummary } from "./pricingGrid";
import { benchmark, draft, entry } from "./pricingGrid.fixtures";

describe("modifier un tarif", () => {
  it("350 → 390 € : une nouvelle version, validée par Ma Reliure, HT déduit du TTC", () => {
    const current = draft({ id: "demi-v1", workItemKey: "demi_cuir", priceTtcCents: 35_000 });
    const { change, errors } = planPricebookChange(
      { workItemKey: "demi_cuir", action: "set", priceTtcCents: 39_000 },
      { entry: current, benchmark: benchmark() },
    );
    expect(errors).toEqual([]);
    expect(change).toMatchObject({
      work_item_key: "demi_cuir",
      expected_entry_id: "demi-v1",
      status: "published",
      provenance: "ADMIN_VALIDATED",
      pricing_mode: "FIXED",
      customer_price_ttc_cents: 39_000,
      customer_price_cents: 32_500,
    });
  });

  it("refuse un montant invalide ou une faute de frappe", () => {
    const current = entry({ workItemKey: "demi_cuir" });
    for (const priceTtcCents of [0, -100, 12.5, 100_000_000])
      expect(
        planPricebookChange(
          { workItemKey: "demi_cuir", action: "set", priceTtcCents },
          { entry: current, benchmark: null },
        ).change,
      ).toBeNull();
  });

  it("n'écrit rien quand rien ne change", () => {
    const current = entry({ workItemKey: "demi_cuir", priceTtcCents: 39_000 });
    expect(
      planPricebookChange(
        { workItemKey: "demi_cuir", action: "set", priceTtcCents: 39_000 },
        { entry: current, benchmark: null },
      ).errors[0],
    ).toContain("aucun changement");
  });

  it("garde en revue manuelle ce que le catalogue chiffre sur étude", () => {
    const current = draft({
      workItemKey: "reliure_de_creation",
      pricingMode: "MANUAL_REVIEW",
      priceTtcCents: null,
    });
    const refused = planPricebookChange(
      { workItemKey: "reliure_de_creation", action: "set", pricingMode: "FIXED", priceTtcCents: 250_000 },
      { entry: current, benchmark: null },
    );
    expect(refused.change).toBeNull();
    expect(refused.errors[0]).toContain("sur étude");
  });

  it("passe une prestation en « Sur étude » sans montant", () => {
    const { change } = planPricebookChange(
      { workItemKey: "mosaique", action: "set", pricingMode: "MANUAL_REVIEW" },
      { entry: entry({ workItemKey: "mosaique", priceTtcCents: 47_500 }), benchmark: null },
    );
    expect(change).toMatchObject({
      pricing_mode: "MANUAL_REVIEW",
      customer_price_cents: null,
      customer_price_ttc_cents: null,
    });
  });
});

describe("valider, revenir, publier", () => {
  it("valide une référence initiale sans en changer le montant", () => {
    const { change } = planPricebookChange(
      { workItemKey: "etui", action: "validate" },
      { entry: draft({ workItemKey: "etui", priceTtcCents: 13_000 }), benchmark: null },
    );
    expect(change).toMatchObject({
      status: "published",
      provenance: "ADMIN_VALIDATED",
      customer_price_ttc_cents: 13_000,
    });
    expect(
      planPricebookChange(
        { workItemKey: "etui", action: "validate" },
        { entry: entry({ workItemKey: "etui" }), benchmark: null },
      ).errors[0],
    ).toContain("déjà validé");
  });

  it("revient à la référence web : 420 → 350 €, redevenue référence initiale à valider", () => {
    const { change } = planPricebookChange(
      { workItemKey: "demi_cuir", action: "reset" },
      {
        entry: entry({ workItemKey: "demi_cuir", priceTtcCents: 42_000, publicVisible: true }),
        benchmark: benchmark({ webReferenceCents: 35_000 }),
      },
    );
    expect(change).toMatchObject({
      status: "draft",
      provenance: "WEB_REFERENCE_INITIAL",
      customer_price_ttc_cents: 35_000,
      public_visible: false,
    });
  });

  it("ne transforme jamais un taux horaire interne en prix total", () => {
    const refused = planPricebookChange(
      { workItemKey: "reparation_dos", action: "reset" },
      {
        entry: entry({ workItemKey: "reparation_dos" }),
        benchmark: benchmark({
          workItemKey: "reparation_dos",
          pricingUnit: "per_hour",
          webMinCents: null,
          webMaxCents: null,
          webReferenceCents: 8_500,
        }),
      },
    );
    expect(refused.change).toBeNull();
  });

  it("n'affiche sur /tarifs qu'un tarif validé", () => {
    expect(
      planPricebookChange(
        { workItemKey: "etui", action: "visibility", publicVisible: true },
        { entry: draft({ workItemKey: "etui" }), benchmark: null },
      ).change,
    ).toBeNull();
    expect(
      planPricebookChange(
        { workItemKey: "etui", action: "visibility", publicVisible: true },
        { entry: entry({ workItemKey: "etui" }), benchmark: null },
      ).change,
    ).toMatchObject({ public_visible: true, status: "published" });
  });
});

describe("la grille affichée", () => {
  const benchmarks = WORK_ITEMS.map((item) =>
    benchmark({
      workItemKey: item.key,
      webMinCents: 5_000,
      webReferenceCents: 10_000,
      webMaxCents: 15_000,
    }),
  );
  const drafts = WORK_ITEMS.map((item) =>
    item.requiresStudy
      ? draft({ workItemKey: item.key, pricingMode: "MANUAL_REVIEW", priceTtcCents: null })
      : draft({ workItemKey: item.key, priceTtcCents: 10_000 }),
  );

  it("n'est jamais vide : 45 prestations, 42 automatiques, 3 sur étude, toutes à valider", () => {
    const rows = buildPricingGrid({ workItems: [], benchmarks, entries: drafts });
    expect(rows.map((row) => row.key)).toEqual(WORK_ITEMS.map((item) => item.key));
    expect(gridSummary(rows)).toMatchObject({
      total: 45,
      automatic: 42,
      study: 3,
      modified: 0,
      toValidate: 45,
    });
  });

  it("montre l'écart à la référence web, sans en faire une alerte", () => {
    const entries = drafts.map((item) =>
      item.workItemKey === "demi_cuir"
        ? { ...item, status: "retired" as const }
        : item,
    );
    entries.push(entry({ workItemKey: "demi_cuir", priceTtcCents: 12_000, version: 2 }));
    const rows = buildPricingGrid({ workItems: [], benchmarks, entries });
    const row = rows.find((item) => item.key === "demi_cuir")!;
    expect(row.delta).toEqual({ cents: 2_000, bps: 2_000 });
    expect(row.modified).toBe(true);
    expect(row.toValidate).toBe(false);
    expect(row.versionCount).toBe(2);
    expect(gridSummary(rows)).toMatchObject({ modified: 1, toValidate: 44 });
  });
});
