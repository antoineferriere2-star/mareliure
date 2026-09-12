// Fine Bindery, Phase C (16 septembre 2026) — brand devient un attribut de
// marketplace_cases, fixé une fois à la création et jamais réécrit ensuite
// (§65), propagé depuis la Mission qui a produit le dossier.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260916090000_marketplace_fine_bindery_brand.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const STATEMENTS = SQL.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");

describe("marketplace_intake_missions declares which brand it feeds", () => {
  it("adds brand, defaulted to MA_RELIURE for every existing Mission", () => {
    expect(STATEMENTS).toContain(
      "ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'MA_RELIURE'",
    );
  });

  it("only accepts the two known brands", () => {
    const start = STATEMENTS.indexOf("CONSTRAINT marketplace_intake_missions_brand_check");
    expect(start).toBeGreaterThan(-1);
    expect(STATEMENTS.slice(start, start + 100)).toContain(
      "brand IN ('MA_RELIURE', 'FINE_BINDERY')",
    );
  });
});

describe("marketplace_cases carries a brand and its pricing snapshot", () => {
  it("adds brand, defaulted for existing rows", () => {
    expect(STATEMENTS).toContain("ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'MA_RELIURE'");
  });

  it("adds the four pricing-snapshot columns, none of them brand-only (§65)", () => {
    for (const column of [
      "base_service_price_cents INTEGER",
      "brand_multiplier_bps INTEGER",
      "service_price_cents INTEGER",
    ]) {
      expect(STATEMENTS).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    expect(STATEMENTS).toContain(
      "ADD COLUMN IF NOT EXISTS tax_status TEXT NOT NULL DEFAULT 'TAX_REVIEW_REQUIRED'",
    );
  });

  it("never invents a tax decision — only TAX_REVIEW_REQUIRED is a legal value", () => {
    const start = STATEMENTS.indexOf("CONSTRAINT marketplace_cases_tax_status_check");
    expect(start).toBeGreaterThan(-1);
    expect(STATEMENTS.slice(start, start + 100)).toContain(
      "tax_status IN ('TAX_REVIEW_REQUIRED')",
    );
  });

  it("makes brand immutable once a case exists", () => {
    expect(STATEMENTS).toContain("marketplace_cases.brand is immutable once set");
    expect(STATEMENTS).toContain(
      "CREATE TRIGGER marketplace_cases_brand_immutable\n  BEFORE UPDATE ON public.marketplace_cases",
    );
  });
});

describe("the ingestion trigger propagates brand from the Mission, never a default for the whole batch", () => {
  it("reads the Mission's brand before deciding whether to ingest", () => {
    const body = STATEMENTS.slice(
      STATEMENTS.indexOf("CREATE OR REPLACE FUNCTION public.marketplace_ingest_dossier()"),
    );
    expect(body).toContain("SELECT m.brand INTO mission_brand");
    expect(body).toContain("VALUES (\n      NEW.id,\n      NEW.mission_id,");
    expect(body).toContain("mission_brand");
  });

  it("the repair function backfills each case with its own Mission's brand", () => {
    const body = STATEMENTS.slice(
      STATEMENTS.indexOf("CREATE OR REPLACE FUNCTION public.marketplace_ingest_missing_cases()"),
    );
    expect(body).toContain("m.brand AS brand");
    expect(body).toContain("SELECT\n      dossier_id,\n      mission_id,");
  });
});

describe("documents a rollback", () => {
  it("has a Rollback section", () => {
    expect(SQL).toContain("-- Rollback");
  });
});
