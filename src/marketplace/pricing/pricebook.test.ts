import { describe, expect, it } from "vitest";
import { lookupPricebookReference, resolveServicePriceFloors, type PricebookEntry } from "./pricebook";

function entry(overrides: Partial<PricebookEntry> & Pick<PricebookEntry, "workItemKey">): PricebookEntry {
  return {
    id: `entry-${overrides.workItemKey}-${overrides.sizeClass ?? "standard"}-${overrides.complexityClass ?? "standard"}`,
    sizeClass: "standard",
    complexityClass: "standard",
    referenceBinderPayoutCents: 0,
    customerPriceCents: 0,
    targetMarginCents: 0,
    targetMarginBps: 0,
    pricingMethod: "margin_target",
    version: 1,
    status: "published",
    validatedAt: "2026-09-01T00:00:00.000Z",
    validatedBy: null,
    referenceCountAtValidation: 1,
    notes: null,
    ...overrides,
  };
}

const ROUNDING = 100; // 1 € — assez fin pour ne jamais masquer les exemples de l'audit.

describe("resolveServicePriceFloors", () => {
  /**
   * Cas 1 de l'audit du 15 septembre 2026 : le plancher de marge domine,
   * la contribution minimale (≤ 125 €) ne change rien.
   */
  it("Ma Reliure — cas normal : le plancher de marge suffit", () => {
    const result = resolveServicePriceFloors({
      binderPayoutCents: 37_500,
      targetMarginBps: 2_500,
      minimumContributionCents: 12_500,
      roundingIncrementCents: ROUNDING,
      referenceCents: null,
    });
    expect(result.priceCents).toBe(50_000);
    expect(result.marginFloorCents).toBe(50_000);
    expect(result.contributionFloorCents).toBe(50_000);
    expect(result.boundBy).toBe("margin_floor");
  });

  /**
   * Cas 2 : le plancher de contribution (260 €) dépasse le plancher de marge
   * (240 €) ET la référence Pricebook (200 €, déjà datée). Le moteur ne doit
   * jamais vendre 200 € ni même 240 € — exactement l'erreur que §6 de
   * l'audit demande de ne plus commettre.
   */
  it("plancher de contribution : ne vend jamais en dessous, même avec une référence Pricebook plus basse", () => {
    const result = resolveServicePriceFloors({
      binderPayoutCents: 18_000,
      targetMarginBps: 2_500,
      minimumContributionCents: 8_000,
      roundingIncrementCents: ROUNDING,
      referenceCents: 20_000,
    });
    expect(result.marginFloorCents).toBe(24_000);
    expect(result.contributionFloorCents).toBe(26_000);
    expect(result.priceCents).toBe(26_000);
    expect(result.boundBy).toBe("contribution_floor");
  });

  it("une référence Pricebook au-dessus des deux planchers l'emporte", () => {
    const result = resolveServicePriceFloors({
      binderPayoutCents: 18_000,
      targetMarginBps: 2_500,
      minimumContributionCents: 8_000,
      roundingIncrementCents: ROUNDING,
      referenceCents: 30_000,
    });
    expect(result.priceCents).toBe(30_000);
    expect(result.boundBy).toBe("reference");
  });

  it("sans référence, ne considère que les deux planchers", () => {
    const result = resolveServicePriceFloors({
      binderPayoutCents: 18_000,
      targetMarginBps: 2_500,
      minimumContributionCents: 8_000,
      roundingIncrementCents: ROUNDING,
      referenceCents: null,
    });
    expect(result.priceCents).toBe(26_000);
    expect(result.boundBy).toBe("contribution_floor");
  });

  it("arrondit toujours vers le haut, à l'incrément près", () => {
    const result = resolveServicePriceFloors({
      binderPayoutCents: 37_050,
      targetMarginBps: 2_500,
      minimumContributionCents: 0,
      roundingIncrementCents: ROUNDING,
      referenceCents: null,
    });
    // 37050 / 0.75 = 49400 pile ; vérifie qu'un montant qui tombe déjà rond
    // n'est pas majoré d'un incrément par erreur d'arrondi.
    expect(result.marginFloorCents).toBe(49_400);
  });
});

describe("lookupPricebookReference", () => {
  it("somme le prix client publié de chaque travail du dossier", () => {
    const entries = [
      entry({ workItemKey: "demi_cuir", customerPriceCents: 30_000 }),
      entry({ workItemKey: "restauration_dos", customerPriceCents: 20_000 }),
    ];
    const result = lookupPricebookReference(entries, ["demi_cuir", "restauration_dos"], "standard", "standard");
    expect(result?.referenceCents).toBe(50_000);
    expect(result?.matches).toHaveLength(2);
  });

  it("rend null si un seul travail du dossier n'a aucune entrée publiée — jamais une somme partielle", () => {
    const entries = [entry({ workItemKey: "demi_cuir", customerPriceCents: 30_000 })];
    const result = lookupPricebookReference(entries, ["demi_cuir", "restauration_dos"], "standard", "standard");
    expect(result).toBeNull();
  });

  it("ignore une entrée non publiée (brouillon ou retirée)", () => {
    const entries = [entry({ workItemKey: "demi_cuir", customerPriceCents: 30_000, status: "draft" })];
    const result = lookupPricebookReference(entries, ["demi_cuir"], "standard", "standard");
    expect(result).toBeNull();
  });

  it("retombe sur le format standard faute de correspondance exacte, sans coefficient", () => {
    const entries = [
      entry({ workItemKey: "demi_cuir", sizeClass: "standard", complexityClass: "standard", customerPriceCents: 30_000 }),
    ];
    const result = lookupPricebookReference(entries, ["demi_cuir"], "large", "standard");
    expect(result?.referenceCents).toBe(30_000);
    expect(result?.matches[0].note).toContain("format courant");
  });
});
