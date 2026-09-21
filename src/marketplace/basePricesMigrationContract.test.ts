import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BASE_PRICE_CONFIDENCES,
  BASE_PRICE_PRICING_MODES,
  BASE_PRICE_STATUSES,
} from "./pricing/basePrices";

const SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260921110000_marketplace_base_prices.sql"),
  "utf8",
).replace(/\r\n/g, "\n");
const STATEMENTS = SQL.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");

describe("migration des tarifs de base Ma Reliure", () => {
  it("sépare les tarifs de base des observations ateliers", () => {
    expect(STATEMENTS).toContain("CREATE TABLE IF NOT EXISTS public.marketplace_reference_default_prices");
    expect(STATEMENTS).toContain("CREATE TABLE IF NOT EXISTS public.marketplace_reference_price_operation_links");
    expect(STATEMENTS).not.toContain("ALTER TABLE public.marketplace_binder_rates");
  });

  it("conserve les quatre modes et les trois états", () => {
    for (const mode of BASE_PRICE_PRICING_MODES) expect(STATEMENTS).toContain(`'${mode}'`);
    for (const status of BASE_PRICE_STATUSES) expect(STATEMENTS).toContain(`'${status}'`);
    for (const confidence of BASE_PRICE_CONFIDENCES) expect(STATEMENTS).toContain(`'${confidence}'`);
  });

  it("distingue zéro, null et sur étude", () => {
    expect(STATEMENTS).toContain("pricing_mode = 'manual_review' AND default_unit_price_cents IS NULL");
    expect(STATEMENTS).toContain("pricing_mode <> 'manual_review' AND default_unit_price_cents IS NOT NULL");
    expect(STATEMENTS).toContain("default_unit_price_cents >= 0");
  });

  it("garde versions et accès direct derrière les contrôles serveur", () => {
    expect(STATEMENTS).toContain("version INTEGER NOT NULL DEFAULT 1");
    expect(STATEMENTS).toContain("marketplace_reference_default_prices_version_unique");
    for (const table of [
      "marketplace_reference_default_prices",
      "marketplace_reference_price_operation_links",
    ]) {
      expect(STATEMENTS).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      expect(STATEMENTS).toContain(`DROP POLICY IF EXISTS \"No direct access to ${table}\"`);
    }
  });

  it("ne sème aucun montant en A1", () => {
    expect(STATEMENTS).not.toMatch(/INSERT\s+INTO\s+public\.marketplace_reference_default_prices/i);
  });
});
