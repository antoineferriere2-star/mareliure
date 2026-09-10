/**
 * Le garde-fou structurel.
 *
 * Les tests d'à côté vérifient que le moteur se comporte bien. Celui-ci
 * vérifie qu'on ne peut pas facilement le faire mal se comporter à nouveau :
 * il lit les fichiers du domaine tarifaire et refuse qu'un montant réapparaisse
 * là où il n'a rien à faire.
 *
 * Il existe parce que la faute d'origine était facile à commettre et
 * invisible à la relecture. Quinze montants posés « en attendant » dans un
 * fichier de règles ressemblaient à du code normal ; rien ne les distinguait
 * d'un tarif relevé chez un relieur. Un test qui lit le texte des fichiers est
 * grossier, mais c'est le seul qui attrape la récidive.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCaseProfile } from "@/marketplace/cases/caseProfile";
import { suggestManagedPrice } from "./pricing.engine";
import { canReachCustomer, countsAsReference, PRICE_PROVENANCES } from "./provenance";

const HERE = join(process.cwd(), "src", "marketplace", "pricing");
const read = (file: string) => readFileSync(join(HERE, file), "utf8");

/** Retire commentaires et chaînes : seuls comptent les montants du code. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

/**
 * Un montant en centimes se reconnaît à son ordre de grandeur : au-delà de
 * 1 000 centimes (10 €), un littéral dans ce domaine est un prix, pas un
 * index. Les points de base et les seuils de politique sont exclus nommément.
 */
function suspiciousAmounts(source: string): string[] {
  const withoutPolicy = code(source)
    .replace(
      /\b(?:targetMarginBps|minimumMarginBps|minimumMarginCents|roundingIncrementCents|DRIFT_\w+|HIGH_DISPERSION_BPS|STALE_AFTER_DAYS)\s*[:=]\s*[\d_]+/g,
      "",
    )
    .replace(/10_000/g, "");
  return [...withoutPolicy.matchAll(/\b\d[\d_]{3,}\b/g)]
    .map((match) => match[0])
    .filter((literal) => Number(literal.replace(/_/g, "")) > 1_000);
}

describe("aucun tarif inventé ne peut revenir", () => {
  /**
   * Le fichier de règles portait 140 € pour une réparation, 200 € pour une
   * belle reliure. Il ne doit plus porter que des décisions commerciales —
   * marge, plancher, arrondi — et aucun tarif de travail.
   */
  it("le fichier de règles ne contient plus aucun montant de travail", () => {
    expect(suspiciousAmounts(read("pricing.rules.ts"))).toEqual([]);
  });

  it("le moteur ne contient aucun montant", () => {
    expect(suspiciousAmounts(read("pricing.engine.ts"))).toEqual([]);
  });

  it("le catalogue décrit des travaux, pas des prix", () => {
    expect(suspiciousAmounts(read("catalog.ts"))).toEqual([]);
    expect(read("catalog.ts")).not.toMatch(/cents/i);
  });

  it("le résolveur de travaux ne connaît aucun montant", () => {
    expect(suspiciousAmounts(read("workResolver.ts"))).toEqual([]);
  });

  /**
   * Le jeu d'essai a le droit de porter des montants — c'est sa raison
   * d'être — mais chacun doit être marqué, et le fichier ne doit être importé
   * que par des tests.
   */
  it("le jeu d'essai reste cantonné aux tests", () => {
    const fixture = read("testReferences.fixture.ts");
    expect(fixture).toContain('provenance: "TEST_ONLY"');

    const importers = [
      "pricing.engine.ts",
      "pricing.rules.ts",
      "workResolver.ts",
      "rateCard.ts",
      "pricebook.ts",
      "confidence.ts",
      "catalog.ts",
      "provenance.ts",
    ];
    for (const file of importers) {
      // Sur le code seul : un fichier a le droit d'expliquer en commentaire
      // où sont partis les anciens montants.
      expect(code(read(file)), `${file} importe le jeu d'essai`).not.toContain("testReferences");
    }
  });

  /**
   * Deux provenances seulement peuvent être vendues. Deux font référence : ce
   * qu'un relieur a dit, et ce qu'on lui a réellement payé. Ni un prix décidé
   * par Ma Reliure, ni un prix lu sur le web.
   */
  it("la provenance décide seule de ce qu'on peut faire d'un montant", () => {
    expect(PRICE_PROVENANCES.filter(canReachCustomer)).toEqual([
      "REAL_VERIFIED",
      "ADMIN_VALIDATED",
    ]);
    expect(PRICE_PROVENANCES.filter(countsAsReference)).toEqual([
      "REAL_VERIFIED",
      "HISTORICAL_TRANSACTION",
    ]);
  });

  it("la composition, la photographie et les prix publics ne contiennent aucun montant", () => {
    for (const file of [
      "composition.ts",
      "margin.ts",
      "snapshot.ts",
      "references.ts",
      "publicPrices.ts",
    ])
      expect(suspiciousAmounts(read(file)), file).toEqual([]);
  });

  /**
   * Le comportement de bout en bout : sans référentiel, le moteur n'a aucun
   * moyen de produire un montant, quelle que soit la richesse du projet.
   */
  it("un projet parfaitement décrit ne suffit pas à produire un prix", () => {
    const profile = buildCaseProfile({
      intention: "belle_reliure",
      hauteur: 29.7,
      largeur: 21,
      epaisseur: 12,
      etatDos: "fendu",
      cahiers: "desolidarises",
      materiau: "demi_cuir",
      finitions: ["dorure", "titre", "nerfs"],
      nerfs: 5,
    });

    const result = suggestManagedPrice(profile, { aggregates: [] });
    expect(result.status).toBe("manual_review");
    expect(result.suggestedCustomerPriceCents).toBeNull();
    expect(result.suggestedBinderPayoutCents).toBeNull();
  });
});
