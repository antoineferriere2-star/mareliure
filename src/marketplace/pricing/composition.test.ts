/**
 * Composer un prix depuis le Pricebook — et savoir ne pas le faire.
 */
import { describe, expect, it } from "vitest";
import { composePrice, type CompositionInput } from "./composition";
import { modifier, POLICY, pricebookEntry } from "./pricingConsole.fixtures";

const base = (overrides: Partial<CompositionInput>): CompositionInput => ({
  lines: [],
  sizeClass: "standard",
  complexityClass: "standard",
  entries: [],
  modifiers: [],
  policy: POLICY,
  ...overrides,
});

describe("la composition d'un prix", () => {
  it("additionne les lignes en centimes, TVA et marge comprises", () => {
    const result = composePrice(
      base({
        lines: [
          { workItemKey: "demi_cuir", quantity: 1 },
          { workItemKey: "dorure_fleurons", quantity: 4 },
        ],
        entries: [
          pricebookEntry({
            workItemKey: "demi_cuir",
            referenceBinderPayoutCents: 30_000,
            customerPriceCents: 40_000,
          }),
          pricebookEntry({
            workItemKey: "dorure_fleurons",
            pricingMode: "PER_UNIT",
            unitLabel: "par fleuron",
            referenceBinderPayoutCents: 450,
            customerPriceCents: 600,
          }),
        ],
      }),
    );
    expect(result.status).toBe("priced");
    expect(result.payoutCents).toBe(31_800);
    expect(result.priceHtCents).toBe(42_400);
    expect(result.breakdown).toEqual({
      htCents: 42_400,
      vatRateBps: 2_000,
      vatCents: 8_480,
      ttcCents: 50_880,
    });
    expect(result.margin?.marginCents).toBe(10_600);
  });

  it("s'abstient dès qu'un travail n'a pas de prix publié : aucun total partiel", () => {
    const result = composePrice(
      base({
        lines: [
          { workItemKey: "demi_cuir", quantity: 1 },
          { workItemKey: "nerfs", quantity: 1 },
        ],
        entries: [pricebookEntry({ workItemKey: "demi_cuir" })],
      }),
    );
    expect(result.status).toBe("manual_review");
    expect(result.priceHtCents).toBeNull();
    expect(result.payoutCents).toBeNull();
    expect(result.breakdown).toBeNull();
    expect(result.reasons.some((reason) => reason.startsWith("Nerfs"))).toBe(true);
  });

  it("s'abstient pour un travail sur étude, même si une entrée prétend le chiffrer", () => {
    const result = composePrice(
      base({
        lines: [{ workItemKey: "restauration_patrimoniale", quantity: 1 }],
        entries: [pricebookEntry({ workItemKey: "restauration_patrimoniale" })],
      }),
    );
    expect(result.status).toBe("manual_review");
    expect(result.priceHtCents).toBeNull();
  });

  it("s'abstient quand l'entrée du Pricebook est « sur étude »", () => {
    const result = composePrice(
      base({
        lines: [{ workItemKey: "demi_cuir", quantity: 1 }],
        entries: [
          pricebookEntry({
            pricingMode: "MANUAL_REVIEW",
            referenceBinderPayoutCents: null,
            customerPriceCents: null,
            customerPriceTtcCents: null,
          }),
        ],
      }),
    );
    expect(result.status).toBe("manual_review");
  });

  it("refuse deux structures pour un même ouvrage", () => {
    const result = composePrice(
      base({
        lines: [
          { workItemKey: "demi_cuir", quantity: 1 },
          { workItemKey: "plein_cuir", quantity: 1 },
        ],
        entries: [
          pricebookEntry({ workItemKey: "demi_cuir" }),
          pricebookEntry({ workItemKey: "plein_cuir" }),
        ],
      }),
    );
    expect(result.status).toBe("manual_review");
    expect(result.reasons[0]).toContain("Deux structures");
  });

  it("ne facture pas deux fois un travail compris dans un autre", () => {
    const result = composePrice(
      base({
        lines: [
          { workItemKey: "dorure_titrage", quantity: 1 },
          { workItemKey: "demi_cuir", quantity: 1 },
        ],
        entries: [
          pricebookEntry({ workItemKey: "demi_cuir", includedWorkItems: ["dorure_titrage"] }),
          pricebookEntry({
            workItemKey: "dorure_titrage",
            referenceBinderPayoutCents: 1_500,
            customerPriceCents: 2_000,
          }),
        ],
      }),
    );
    const titrage = result.lines.find((line) => line.workItemKey === "dorure_titrage")!;
    expect(titrage.includedIn).toBe("demi_cuir");
    expect(titrage.priceHtCents).toBe(0);
    expect(result.priceHtCents).toBe(40_000);
  });

  it("ne se rabat jamais sur le format courant sans modificateur actif", () => {
    const entries = [pricebookEntry({ workItemKey: "demi_cuir" })];
    const lines = [{ workItemKey: "demi_cuir", quantity: 1 }];

    const withoutModifier = composePrice(base({ lines, entries, sizeClass: "large" }));
    expect(withoutModifier.status).toBe("manual_review");

    // Semé tel quel : désactivé, sans valeur. Aucun effet.
    const seeded = composePrice(
      base({ lines, entries, sizeClass: "large", modifiers: [modifier()] }),
    );
    expect(seeded.status).toBe("manual_review");

    // Activé sans valeur : toujours aucun effet.
    const emptyEnabled = composePrice(
      base({ lines, entries, sizeClass: "large", modifiers: [modifier({ enabled: true })] }),
    );
    expect(emptyEnabled.status).toBe("manual_review");
  });

  it("applique un modificateur décidé, à la rémunération comme au prix", () => {
    const result = composePrice(
      base({
        lines: [{ workItemKey: "demi_cuir", quantity: 1 }],
        entries: [pricebookEntry({ workItemKey: "demi_cuir" })],
        sizeClass: "large",
        modifiers: [modifier({ enabled: true, percentBps: 2_500 })],
      }),
    );
    expect(result.status).toBe("priced");
    expect(result.payoutCents).toBe(37_500);
    expect(result.priceHtCents).toBe(50_000);
    // Un pourcentage garde la marge en %.
    expect(result.margin?.marginBps).toBe(2_500);
    expect(result.lines[0].modifiers[0]).toContain("Grand format");
  });

  it("préfère toujours une entrée exacte à un modificateur", () => {
    const result = composePrice(
      base({
        lines: [{ workItemKey: "demi_cuir", quantity: 1 }],
        entries: [
          pricebookEntry({ workItemKey: "demi_cuir" }),
          pricebookEntry({
            workItemKey: "demi_cuir",
            sizeClass: "large",
            referenceBinderPayoutCents: 36_000,
            customerPriceCents: 45_000,
          }),
        ],
        sizeClass: "large",
        modifiers: [modifier({ enabled: true, percentBps: 2_500 })],
      }),
    );
    expect(result.priceHtCents).toBe(45_000);
    expect(result.lines[0].modifiers).toEqual([]);
  });

  it("ignore les versions retirées", () => {
    const result = composePrice(
      base({
        lines: [{ workItemKey: "demi_cuir", quantity: 1 }],
        entries: [pricebookEntry({ status: "retired" })],
      }),
    );
    expect(result.status).toBe("manual_review");
  });

  it("porte le haut d'une fourchette et signale un « à partir de »", () => {
    const result = composePrice(
      base({
        lines: [
          { workItemKey: "demi_cuir", quantity: 1 },
          { workItemKey: "etui", quantity: 1 },
        ],
        entries: [
          pricebookEntry({
            workItemKey: "demi_cuir",
            pricingMode: "RANGE",
            priceHtHighCents: 50_000,
          }),
          pricebookEntry({
            workItemKey: "etui",
            pricingMode: "STARTING_FROM",
            referenceBinderPayoutCents: 5_000,
            customerPriceCents: 8_000,
          }),
        ],
      }),
    );
    // Deux structures (demi-cuir, étui) : le catalogue les refuse ensemble.
    expect(result.status).toBe("manual_review");

    const single = composePrice(
      base({
        lines: [{ workItemKey: "demi_cuir", quantity: 2 }],
        entries: [
          pricebookEntry({
            workItemKey: "demi_cuir",
            pricingMode: "RANGE",
            priceHtHighCents: 50_000,
          }),
        ],
      }),
    );
    expect(single.priceHtCents).toBe(80_000);
    expect(single.priceHtHighCents).toBe(100_000);
  });

  it("refuse une quantité invalide et une liste vide", () => {
    expect(composePrice(base({ lines: [] })).status).toBe("manual_review");
    const result = composePrice(
      base({ lines: [{ workItemKey: "demi_cuir", quantity: 0 }], entries: [pricebookEntry()] }),
    );
    expect(result.status).toBe("manual_review");
  });
});
