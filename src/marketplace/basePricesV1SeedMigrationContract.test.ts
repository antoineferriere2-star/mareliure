import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260922130000_marketplace_base_prices_v1_seed.sql"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("seed Tarif de base Ma Reliure V1", () => {
  it("charge exactement les 45 prestations validées", () => {
    const rows = [...SQL.matchAll(/^ {2}\('([^']+)', 'mareliure-base-prices-v1', (NULL|\d+)/gm)];

    expect(rows).toHaveLength(45);
    expect(rows.filter(([, , amount]) => amount !== "NULL")).toHaveLength(41);
    expect(rows.filter(([, , amount]) => amount === "NULL")).toHaveLength(4);
  });

  it("garde uniquement les quatre prestations sur étude sans montant", () => {
    for (const key of [
      "restauration_reliure_ancienne",
      "restauration_patrimoniale",
      "reliure_de_creation",
      "projet_sur_mesure",
    ]) {
      expect(SQL).toMatch(new RegExp(`\\('${key}', 'mareliure-base-prices-v1', NULL, 'ouvrage', 'manual_review'`));
    }
  });

  it("refuse de publier une grille partielle ou incohérente", () => {
    expect(SQL).toContain("DO $$");
    expect(SQL).not.toMatch(/'(faible|moyenne)'/);
    expect(SQL).toContain("IF total_count <> 45 OR numeric_count <> 41 OR manual_count <> 4 THEN");
  });
});
