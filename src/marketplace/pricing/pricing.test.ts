import { describe, expect, it } from "vitest";
import { buildCaseProfile } from "@/marketplace/cases/caseProfile";
import { suggestManagedPrice, validateManagedPrice } from "./pricing.engine";
import { aggregateRates } from "./rateCard";
import { asVerified, TEST_RATES } from "./testReferences.fixture";
import type { ReferenceLookup } from "./pricing.types";
import type { SizeClass } from "./catalog";

/** Le marché tel que le jeu d'essai le décrit, agrégé une fois pour toutes. */
function testReferences(): ReferenceLookup {
  const rates = asVerified(TEST_RATES);
  const keys = [...new Set(rates.map((r) => `${r.workItemKey}|${r.sizeClass}`))];
  const aggregates = keys
    .map((key) => {
      const [workItemKey, sizeClass] = key.split("|");
      return aggregateRates(rates, workItemKey, sizeClass as SizeClass, "standard");
    })
    .filter((a) => a !== null);
  return { aggregates };
}

const EMPTY: ReferenceLookup = { aggregates: [] };

describe("le moteur tarifaire", () => {
  /**
   * Le comportement qui compte plus que tous les autres. Sans référence
   * terrain, le moteur ne produit pas un prix prudent : il n'en produit aucun.
   * Un prix absent se rattrape par un coup de téléphone, un prix faux beaucoup
   * moins bien.
   */
  it("refuse de chiffrer quand aucun tarif de référence n'existe", () => {
    const profile = buildCaseProfile({
      intention: "belle_reliure",
      hauteur: 24,
      materiau: "demi_cuir",
    });
    const result = suggestManagedPrice(profile, EMPTY);

    expect(result.status).toBe("manual_review");
    expect(result.confidence).toBe("manual_review");
    expect(result.suggestedCustomerPriceCents).toBeNull();
    expect(result.suggestedBinderPayoutCents).toBeNull();
    expect(result.lowEstimateCents).toBeNull();
    expect(result.highEstimateCents).toBeNull();
  });

  it("ne chiffre pas davantage un projet vide", () => {
    const result = suggestManagedPrice(buildCaseProfile({}), testReferences());
    expect(result.status).toBe("manual_review");
    expect(result.suggestedCustomerPriceCents).toBeNull();
  });

  /**
   * Le cas de référence de la Phase 25, calculable à la main : demi-cuir 350 €
   * (médiane de 320 / 350 / 410) + recouture complète 80 € + titrage 45 €,
   * soit 475 € de rémunération. À 18 % de marge cible et arrondi aux 10 €
   * supérieurs, le prix client est 580 €.
   */
  it("additionne les médianes du terrain, et rien d'autre", () => {
    const profile = buildCaseProfile({
      intention: "belle_reliure",
      hauteur: 24,
      materiau: "demi_cuir",
      cahiers: "desolidarises",
      finitions: ["titre"],
    });
    const result = suggestManagedPrice(profile, testReferences());

    expect(result.status).toBe("suggested");
    expect(result.workItemKeys).toEqual(["demi_cuir", "recouture_complete", "dorure_titrage"]);
    expect(result.suggestedBinderPayoutCents).toBe(47_500);
    expect(result.suggestedCustomerPriceCents).toBe(58_000);
    expect(result.marginCents).toBe(10_500);
    expect(result.components.map((c) => c.referencePayoutCents)).toEqual([35_000, 8_000, 4_500]);
  });

  /**
   * Câblage de pricebookReferenceCents (16 septembre 2026, §3) : une entrée
   * Pricebook publiée par travail, couvrant exactement ceux du dossier, doit
   * entrer dans le MAX comme un troisième candidat — jamais remplacer les
   * deux planchers, jamais une somme partielle si un seul travail manque.
   */
  it("relit le Pricebook dossier par dossier quand chaque travail y est publié", () => {
    const profile = buildCaseProfile({
      intention: "belle_reliure",
      hauteur: 24,
      materiau: "demi_cuir",
      cahiers: "desolidarises",
      finitions: ["titre"],
    });
    const pricebookEntry = (workItemKey: string, customerPriceCents: number) => ({
      id: `pb-${workItemKey}`,
      workItemKey,
      sizeClass: "standard" as const,
      complexityClass: "standard" as const,
      referenceBinderPayoutCents: 0,
      customerPriceCents,
      targetMarginCents: 0,
      targetMarginBps: 0,
      pricingMethod: "margin_target" as const,
      version: 1,
      status: "published" as const,
      validatedAt: "2026-09-01T00:00:00.000Z",
      validatedBy: null,
      referenceCountAtValidation: 1,
      notes: null,
    });

    // Somme des trois entrées = 70 000, au-dessus des 58 000 du plancher de
    // marge : la référence doit gagner le MAX.
    const withPricebook = suggestManagedPrice(profile, {
      ...testReferences(),
      pricebookEntries: [
        pricebookEntry("demi_cuir", 45_000),
        pricebookEntry("recouture_complete", 15_000),
        pricebookEntry("dorure_titrage", 10_000),
      ],
    });
    expect(withPricebook.pricebookReferenceCents).toBe(70_000);
    expect(withPricebook.priceBoundBy).toBe("reference");
    expect(withPricebook.suggestedCustomerPriceCents).toBe(70_000);

    // Un seul travail non couvert dans le Pricebook : jamais une somme
    // partielle — la référence disparaît, les planchers seuls décident,
    // exactement comme sans câblage Pricebook du tout.
    const partiallyMissing = suggestManagedPrice(profile, {
      ...testReferences(),
      pricebookEntries: [pricebookEntry("demi_cuir", 45_000)],
    });
    expect(partiallyMissing.pricebookReferenceCents).toBeNull();
    expect(partiallyMissing.suggestedCustomerPriceCents).toBe(58_000);
  });

  it("explique chaque ligne du calcul, avec le nombre d'ateliers derrière", () => {
    const profile = buildCaseProfile({
      intention: "belle_reliure",
      hauteur: 24,
      materiau: "demi_cuir",
    });
    const result = suggestManagedPrice(profile, testReferences());

    expect(result.components).toHaveLength(1);
    expect(result.components[0]).toMatchObject({
      workItemKey: "demi_cuir",
      label: "Demi-cuir",
      referencePayoutCents: 35_000,
      referenceCount: 3,
      approximated: false,
    });
    expect(result.referenceCount).toBe(3);
  });

  /**
   * La fourchette vient du minimum et du maximum réellement déclarés par les
   * ateliers, jamais d'un pourcentage appliqué autour de la médiane.
   */
  it("borne l'estimation avec les extrêmes déclarés", () => {
    const profile = buildCaseProfile({
      intention: "belle_reliure",
      hauteur: 24,
      materiau: "demi_cuir",
    });
    const result = suggestManagedPrice(profile, testReferences());

    // 300 € de plancher terrain + 80 € de contribution minimale (politique du
    // 16 septembre 2026) l'emporte désormais sur le plancher de marge seul.
    expect(result.lowEstimateCents).toBe(38_000);
    expect(result.highEstimateCents).toBe(58_000); // 470 € de plafond terrain
    expect(result.lowEstimateCents!).toBeLessThan(result.suggestedCustomerPriceCents!);
    expect(result.highEstimateCents!).toBeGreaterThan(result.suggestedCustomerPriceCents!);
  });

  it("retient le tarif grand format quand il existe", () => {
    const profile = buildCaseProfile({
      intention: "belle_reliure",
      hauteur: 34,
      materiau: "demi_cuir",
    });
    const result = suggestManagedPrice(profile, testReferences());

    expect(result.sizeClass).toBe("large");
    expect(result.components[0].referencePayoutCents).toBe(43_000);
    expect(result.components[0].approximated).toBe(false);
  });

  /**
   * Quand le format exact n'est pas couvert, on se rabat sur le format
   * courant — mais sans appliquer le moindre coefficient. Majorer de 10 %
   * pour un hors-format serait exactement le geste qu'on vient de bannir :
   * l'approximation est déclarée, elle n'est pas compensée.
   */
  it("déclare son approximation au lieu d'inventer un coefficient", () => {
    const profile = buildCaseProfile({
      intention: "belle_reliure",
      hauteur: 45,
      materiau: "demi_cuir",
    });
    const result = suggestManagedPrice(profile, testReferences());

    expect(result.sizeClass).toBe("oversize");
    expect(result.components[0].approximated).toBe(true);
    expect(result.components[0].approximationNote).toContain("format courant");
    expect(result.components[0].referencePayoutCents).toBe(35_000);
  });

  it("s'abstient dès qu'un seul travail du projet n'est pas tarifé", () => {
    const profile = buildCaseProfile({
      intention: "belle_reliure",
      hauteur: 24,
      materiau: "demi_cuir",
      finitions: ["gardes_decorees"], // aucun atelier ne l'a tarifé
    });
    const result = suggestManagedPrice(profile, testReferences());

    expect(result.status).toBe("manual_review");
    expect(result.factors.join(" ")).toContain("Aucun tarif de référence");
  });

  it("s'abstient sur un ouvrage patrimonial, même parfaitement décrit", () => {
    const profile = buildCaseProfile({
      intention: "belle_reliure",
      nature: "manuscrit",
      hauteur: 24,
      materiau: "demi_cuir",
    });
    const result = suggestManagedPrice(profile, testReferences());

    expect(profile.heritage).toBe(true);
    expect(result.status).toBe("manual_review");
  });

  it("refuse une répartition inversée et une marge sous la politique", () => {
    expect(validateManagedPrice(40_000, 41_000).valid).toBe(false);
    expect(validateManagedPrice(40_000, 39_000).valid).toBe(false);
    expect(validateManagedPrice(49_000, 40_000).valid).toBe(true);
  });
});
