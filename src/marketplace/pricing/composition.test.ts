/**
 * Le moteur compose le prix d'un projet à partir de la grille Ma Reliure, et
 * de rien d'autre.
 */
import { describe, expect, it } from "vitest";
import { buildCaseProfile } from "@/marketplace/cases/caseProfile";
import type { ComplexityClass, SizeClass } from "./catalog";
import { priceProject, projectRequest } from "./pricing.engine";
import { draft, entry, grid, modifier } from "./pricingGrid.fixtures";

function request(keys: string[], classes: { size?: SizeClass; complexity?: ComplexityClass } = {}) {
  return {
    lines: keys.map((workItemKey) => ({ workItemKey, quantity: 1 })),
    sizeClass: classes.size ?? ("standard" as const),
    complexityClass: classes.complexity ?? ("standard" as const),
  };
}

describe("le test d'acceptation", () => {
  it("demi-cuir modifié à 390 €, puis titrage à 50 € : 440 €, sans aucune grille d'atelier", () => {
    const pricing = grid([
      entry({ workItemKey: "demi_cuir", priceTtcCents: 39_000, version: 2 }),
      draft({ workItemKey: "dorure_titrage", priceTtcCents: 5_000 }),
    ]);

    const alone = priceProject(request(["demi_cuir"]), pricing);
    expect(alone.status).toBe("priced");
    expect(alone.priceTtcCents).toBe(39_000);

    const withTitle = priceProject(request(["demi_cuir", "dorure_titrage"]), pricing);
    expect(withTitle.status).toBe("priced");
    expect(withTitle.subtotalTtcCents).toBe(44_000);
    expect(withTitle.priceTtcCents).toBe(44_000);
    expect(Object.keys(pricing).sort()).toEqual(
      ["entries", "inactiveWorkItems", "modifiers", "policy"].sort(),
    );
  });

  it("additionne une structure et ses compléments : 390 + 350 + 55 + 150 = 945 €", () => {
    const pricing = grid([
      entry({ workItemKey: "demi_cuir", priceTtcCents: 39_000 }),
      entry({ workItemKey: "recouture_complete", priceTtcCents: 35_000 }),
      entry({ workItemKey: "dorure_titrage", priceTtcCents: 5_500 }),
      entry({ workItemKey: "etui", priceTtcCents: 15_000 }),
    ]);
    const result = priceProject(
      request(["demi_cuir", "recouture_complete", "dorure_titrage", "etui"]),
      pricing,
    );
    expect(result.status).toBe("priced");
    expect(result.priceTtcCents).toBe(94_500);
  });

  it("utilise le tarif Ma Reliure, jamais la référence web ni un recalcul", () => {
    const pricing = grid([entry({ workItemKey: "demi_cuir", priceTtcCents: 42_000 })]);
    expect(priceProject(request(["demi_cuir"]), pricing).priceTtcCents).toBe(42_000);
  });

  it("multiplie par la quantité", () => {
    const pricing = grid([entry({ workItemKey: "reparation_coins", priceTtcCents: 5_000 })]);
    const result = priceProject(
      { ...request([]), lines: [{ workItemKey: "reparation_coins", quantity: 4 }] },
      pricing,
    );
    expect(result.priceTtcCents).toBe(20_000);
  });
});

describe("TVA, rémunération et marge", () => {
  const pricing = grid([
    entry({ workItemKey: "demi_cuir", priceTtcCents: 39_000 }),
    entry({ workItemKey: "dorure_titrage", priceTtcCents: 5_000 }),
  ]);
  const result = priceProject(request(["demi_cuir", "dorure_titrage"]), pricing);

  it("déduit le HT et la TVA du TTC décidé, sans perdre un centime", () => {
    expect(result.breakdown).toEqual({
      htCents: 36_667,
      vatRateBps: 2_000,
      vatCents: 7_333,
      ttcCents: 44_000,
    });
  });

  it("propose la rémunération atelier par la politique de marge", () => {
    // 25 % de 366,67 € = 91,67 € gardés ; 275,00 € proposés, arrondis à l'euro.
    expect(result.payout).toEqual({
      payoutCents: 27_500,
      retainedMarginCents: 9_167,
      problem: null,
    });
    expect(result.margin?.status).toBe("OK");
  });
});

describe("pas de total partiel", () => {
  it("une prestation sur étude sort le projet du calcul automatique", () => {
    const pricing = grid([
      entry({ workItemKey: "plein_cuir", priceTtcCents: 59_000 }),
      draft({ workItemKey: "reliure_de_creation", pricingMode: "MANUAL_REVIEW", priceTtcCents: null }),
    ]);
    const result = priceProject(request(["reliure_de_creation"]), pricing);
    expect(result.status).toBe("manual_review");
    expect(result.priceTtcCents).toBeNull();
    expect(result.reasons.join(" ")).toContain("sur étude");
  });

  it("une prestation sans tarif empêche de conclure", () => {
    const pricing = grid([entry({ workItemKey: "demi_cuir", priceTtcCents: 35_000 })]);
    const result = priceProject(request(["demi_cuir", "nerfs"]), pricing);
    expect(result.status).toBe("manual_review");
    expect(result.priceTtcCents).toBeNull();
    expect(result.reasons.join(" ")).toContain("Nerfs");
  });

  it("une prestation désactivée empêche de conclure", () => {
    const pricing = grid([entry({ workItemKey: "demi_cuir", priceTtcCents: 35_000 })], {
      inactiveWorkItems: ["demi_cuir"],
    });
    expect(priceProject(request(["demi_cuir"]), pricing).status).toBe("manual_review");
  });

  it("une grille vide ne produit aucun prix", () => {
    const result = priceProject(request(["demi_cuir"]), grid([]));
    expect(result.status).toBe("manual_review");
    expect(result.payout).toBeNull();
  });

  it("respecte les rôles : deux structures refusées, la protection accompagne une reliure", () => {
    const pricing = grid([
      entry({ workItemKey: "demi_cuir", priceTtcCents: 35_000 }),
      entry({ workItemKey: "plein_cuir", priceTtcCents: 59_000 }),
      entry({ workItemKey: "etui", priceTtcCents: 13_000 }),
      entry({ workItemKey: "chemise", priceTtcCents: 23_500 }),
    ]);
    expect(priceProject(request(["demi_cuir", "plein_cuir"]), pricing).status).toBe(
      "manual_review",
    );
    expect(priceProject(request(["demi_cuir", "etui", "chemise"]), pricing).priceTtcCents).toBe(
      71_500,
    );
  });
});

describe("format et complexité", () => {
  const entries = [
    entry({ workItemKey: "demi_cuir", priceTtcCents: 39_000 }),
    entry({ workItemKey: "dorure_titrage", priceTtcCents: 5_000 }),
  ];

  it("s'appliquent au total, après addition des prestations", () => {
    const pricing = grid(entries, {
      modifiers: [
        modifier({ axis: "size", classKey: "large", percentBps: 1_500, enabled: true }),
        modifier({
          axis: "complexity",
          classKey: "complex",
          kind: "FIXED",
          fixedCents: 2_000,
          enabled: true,
        }),
      ],
    });
    const result = priceProject(
      request(["demi_cuir", "dorure_titrage"], { size: "large", complexity: "complex" }),
      pricing,
    );
    expect(result.subtotalTtcCents).toBe(44_000);
    expect(result.modifiers.map((item) => item.deltaTtcCents)).toEqual([6_600, 2_000]);
    expect(result.priceTtcCents).toBe(52_600);
  });

  it("une classe sans modificateur configuré garde le prix courant et le signale", () => {
    const result = priceProject(request(["demi_cuir"], { size: "large" }), grid(entries));
    expect(result.status).toBe("priced");
    expect(result.priceTtcCents).toBe(39_000);
    expect(result.warnings.join(" ")).toContain("Grand format");
  });

  it("le hors format peut partir en revue manuelle", () => {
    const pricing = grid(entries, {
      modifiers: [
        modifier({ axis: "size", classKey: "oversize", kind: "MANUAL_REVIEW", enabled: true }),
      ],
    });
    const result = priceProject(request(["demi_cuir"], { size: "oversize" }), pricing);
    expect(result.status).toBe("manual_review");
    expect(result.priceTtcCents).toBeNull();
  });
});

describe("références initiales", () => {
  it("le simulateur les utilise, et dit lesquelles restent à valider", () => {
    const pricing = grid([
      entry({ workItemKey: "demi_cuir", priceTtcCents: 39_000 }),
      draft({ workItemKey: "dorure_titrage", priceTtcCents: 5_000 }),
    ]);
    const result = priceProject(request(["demi_cuir", "dorure_titrage"]), pricing);
    expect(result.status).toBe("priced");
    expect(result.unvalidated).toEqual(["Titrage"]);
  });
});

describe("du Dossier aux prestations", () => {
  it("lit les opérations dans les réponses structurées", () => {
    const profile = buildCaseProfile({
      intention: "belle_reliure",
      hauteur: 24,
      largeur: 16,
      epaisseur: 3,
      materiau: "demi_cuir",
      finitions: ["titre"],
    });
    const { lines, sizeClass } = projectRequest(profile);
    expect(lines.map((line) => line.workItemKey)).toEqual(["demi_cuir", "dorure_titrage"]);
    expect(sizeClass).toBe("standard");
  });
});
