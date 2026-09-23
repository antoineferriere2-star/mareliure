import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260923130000_marketplace_binder_pricing_catalog.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("migration des préférences tarifaires atelier", () => {
  it("stocke un override nullable distinct du favori", () => {
    expect(SQL).toContain("custom_unit_price_cents INTEGER");
    expect(SQL).toContain("custom_pricing_mode TEXT");
    expect(SQL).toContain("is_favorite BOOLEAN NOT NULL DEFAULT false");
    expect(SQL).toContain("UNIQUE (binder_id, pricing_key)");
  });
  it("isole chaque atelier et refuse l'accès navigateur", () => {
    expect(SQL).toContain("binder_id UUID NOT NULL");
    expect(SQL).toContain("ENABLE ROW LEVEL SECURITY");
    expect(SQL).toContain("FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)");
  });
  it("reste additive et ne réécrit aucun document existant", () => {
    expect(SQL).not.toMatch(/UPDATE\s+public\.marketplace_(binder_quotes|binder_invoices)/i);
    expect(SQL).not.toMatch(/ALTER TABLE\s+public\.marketplace_(binder_quotes|binder_invoices)/i);
  });
});
