/**
 * Le garde-fou structurel.
 *
 * Les tarifs Ma Reliure ont une seule maison : le Pricebook, initialisé une
 * fois par la migration de la grille unique à partir de la recherche web, puis
 * administré. Ce test lit le code du moteur et refuse qu'un montant y
 * réapparaisse en dur — la faute d'origine, quinze montants posés « en
 * attendant » dans un fichier de règles, était facile à commettre et invisible
 * à la relecture.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { priceProject } from "./pricing.engine";
import { POLICY } from "./pricingGrid.fixtures";
import {
  canReachCustomer,
  isPublicProvenance,
  PRICE_PROVENANCES,
} from "./provenance";

const HERE = join(process.cwd(), "src", "marketplace", "pricing");
const read = (file: string) => readFileSync(join(HERE, file), "utf8");

/** Retire commentaires et chaînes : seuls comptent les montants du code. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

/**
 * Un littéral au-delà de 1 000 centimes (10 €) est un prix. Les bornes et
 * arrondis nommés sont exclus, comme les points de base.
 */
function suspiciousAmounts(source: string): string[] {
  const withoutBounds = code(source)
    .replace(
      /\b(?:MAX_GRID_PRICE_CENTS|MAX_TARGET_MARGIN_BPS|WEB_REFERENCE_ROUNDING_CENTS|PAYOUT_ROUNDING_CENTS|MAX_LINE_QUANTITY)\s*=\s*[\d_]+/g,
      "",
    )
    .replace(/10_000/g, "");
  return [...withoutBounds.matchAll(/\b\d[\d_]{3,}\b/g)]
    .map((match) => match[0])
    .filter((literal) => Number(literal.replace(/_/g, "")) > 1_000);
}

describe("aucun tarif en dur dans le moteur", () => {
  it.each([
    "pricing.rules.ts",
    "pricing.engine.ts",
    "catalog.ts",
    "workResolver.ts",
    "composition.ts",
    "payout.ts",
    "margin.ts",
    "snapshot.ts",
    "pricebook.ts",
    "pricebookChanges.ts",
    "pricingGrid.ts",
    "publicPrices.ts",
    "webBenchmark.ts",
  ])("%s ne porte aucun montant", (file) => {
    expect(suspiciousAmounts(read(file))).toEqual([]);
  });

  it("le catalogue décrit des travaux, pas des prix", () => {
    expect(read("catalog.ts")).not.toMatch(/cents/i);
  });

  it("l'ancienne architecture ne revient pas", () => {
    for (const file of [
      "rateCard.ts",
      "benchmark.ts",
      "references.ts",
      "confidence.ts",
      "pricebookEvidence.ts",
      "pricing.types.ts",
      "testReferences.fixture.ts",
      "webBenchmarks.seed.ts",
      "pricebookInput.ts",
    ])
      expect(existsSync(join(HERE, file)), file).toBe(false);
  });
});

describe("la provenance décide de ce qu'on peut faire d'un montant", () => {
  it("quatre provenances, aucune venue d'un atelier", () => {
    expect([...PRICE_PROVENANCES]).toEqual([
      "WEB_REFERENCE_INITIAL",
      "ADMIN_VALIDATED",
      "HISTORICAL_TRANSACTION",
      "CASE_OVERRIDE",
    ]);
  });

  it("une référence web initiale n'est promise à aucun client, ni publique", () => {
    expect(PRICE_PROVENANCES.filter(canReachCustomer)).toEqual(["ADMIN_VALIDATED", "CASE_OVERRIDE"]);
    expect(PRICE_PROVENANCES.filter(isPublicProvenance)).toEqual(["ADMIN_VALIDATED"]);
  });

  it("sans grille, un projet parfaitement décrit ne produit aucun prix", () => {
    const result = priceProject(
      {
        lines: [
          { workItemKey: "demi_cuir", quantity: 1 },
          { workItemKey: "dorure_titrage", quantity: 1 },
        ],
        sizeClass: "standard",
        complexityClass: "standard",
      },
      { entries: [], modifiers: [], policy: POLICY },
    );
    expect(result.status).toBe("manual_review");
    expect(result.priceTtcCents).toBeNull();
    expect(result.payout).toBeNull();
  });
});
