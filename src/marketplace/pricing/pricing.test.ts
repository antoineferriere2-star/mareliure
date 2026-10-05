import { describe, expect, it } from "vitest";
import { buildCaseProfile } from "@/marketplace/cases/caseProfile";
import { suggestManagedPrice, targetServicePriceCents, validateManagedPrice } from "./pricing.engine";
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
    // Modèle Oppe (v6) : 475 € / (1 − 25 %) = 633,33 € → 634 € à l'euro supérieur.
    expect(result.suggestedCustomerPriceCents).toBe(63_400);
    expect(result.marginCents).toBe(15_900);
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

    // Somme des trois entrées = 70 000. Depuis le modèle Oppe (v6), la référence reste un repère
    // affiché : elle ne relève plus le prix, fixé par la marge cible sur la rémunération.
    const withPricebook = suggestManagedPrice(profile, {
      ...testReferences(),
      pricebookEntries: [
        pricebookEntry("demi_cuir", 45_000),
        pricebookEntry("recouture_complete", 15_000),
        pricebookEntry("dorure_titrage", 10_000),
      ],
    });
    expect(withPricebook.pricebookReferenceCents).toBe(70_000);
    expect(withPricebook.priceBoundBy).toBe("margin_floor");
    expect(withPricebook.suggestedCustomerPriceCents).toBe(63_400);

    // Un seul travail non couvert dans le Pricebook : jamais une somme
    // partielle — la référence disparaît, les planchers seuls décident,
    // exactement comme sans câblage Pricebook du tout.
    const partiallyMissing = suggestManagedPrice(profile, {
      ...testReferences(),
      pricebookEntries: [pricebookEntry("demi_cuir", 45_000)],
    });
    expect(partiallyMissing.pricebookReferenceCents).toBeNull();
    expect(partiallyMissing.suggestedCustomerPriceCents).toBe(63_400);
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

    // 300 € et 470 € d'extrêmes terrain, à 25 % de marge sur le prix de vente.
    expect(result.lowEstimateCents).toBe(40_000);
    expect(result.highEstimateCents).toBe(62_700);
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
    expect(validateManagedPrice(53_300, 40_000).valid).toBe(false); // 24,95 %
    expect(validateManagedPrice(53_400, 40_000).valid).toBe(true); // 25,09 %
  });

  it("applique une marge sur vente, jamais une majoration du coût (150 € → 200 €)", () => {
    expect(targetServicePriceCents(15_000)).toBe(20_000);
    expect(validateManagedPrice(20_000, 15_000)).toMatchObject({ valid: true, marginCents: 5_000, marginBps: 2_500 });
    // 150 € majorés de 25 % = 187,50 € : marge de 20 % seulement, refusée.
    expect(validateManagedPrice(18_750, 15_000).valid).toBe(false);
    // Arrondi à l'euro supérieur, jamais en dessous de la marge cible.
    expect(targetServicePriceCents(15_100)).toBe(20_200);
  });

  it("n'accepte un prix sous la marge cible qu'avec une dérogation motivée", () => {
    expect(validateManagedPrice(19_000, 15_000, undefined, "geste").valid).toBe(false);
    expect(validateManagedPrice(19_000, 15_000, undefined, "Geste commercial validé : client fidèle").valid).toBe(true);
    expect(validateManagedPrice(14_000, 15_000, undefined, "Geste commercial validé : client fidèle").valid).toBe(false);
  });
});
