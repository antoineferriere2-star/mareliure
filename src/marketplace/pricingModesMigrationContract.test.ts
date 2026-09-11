// The pricing-modes migration (Phase C, 13 septembre 2026), read as a
// contract — same approach as migrationContract.test.ts.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PRICING_MODES } from "./pricing/pricingMode";
import { WORK_FAMILIES } from "./pricing/catalog";

const SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260913090000_marketplace_pricing_modes.sql"),
  "utf8",
).replace(/\r\n/g, "\n");
const STATEMENTS = SQL.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");

function constrainedValues(constraint: string): string[] {
  const match = new RegExp(`CONSTRAINT ${constraint}\\s+CHECK`).exec(STATEMENTS);
  expect(match, `missing constraint ${constraint}`).not.toBeNull();
  const rest = STATEMENTS.slice(match!.index + match![0].length);
  const next = rest.indexOf("CONSTRAINT ");
  const clause = next === -1 ? rest : rest.slice(0, next);
  return [...clause.matchAll(/'([a-zA-Z0-9_]+)'/g)].map((m) => m[1]);
}

describe("marketplace_cases.pricing_mode", () => {
  it("matches PRICING_MODES exactly", () => {
    expect(new Set(constrainedValues("marketplace_cases_pricing_mode_check"))).toEqual(
      new Set(PRICING_MODES),
    );
  });

  it("is nullable — a case may exist before it is ever priced", () => {
    expect(STATEMENTS).toContain("ADD COLUMN IF NOT EXISTS pricing_mode TEXT,");
  });
});

describe("marketplace_cases.deposit_cents", () => {
  it("is either absent or strictly positive — never zero, never negative", () => {
    expect(STATEMENTS).toContain("CHECK (deposit_cents IS NULL OR deposit_cents > 0)");
  });
});

describe("marketplace_binder_commercial_terms", () => {
  it("is created, isolated exactly like every other marketplace_* table", () => {
    expect(STATEMENTS).toContain(
      "CREATE TABLE IF NOT EXISTS public.marketplace_binder_commercial_terms (",
    );
    expect(STATEMENTS).toContain(
      "GRANT ALL ON public.marketplace_binder_commercial_terms TO service_role;",
    );
    expect(STATEMENTS).not.toContain(
      "ON public.marketplace_binder_commercial_terms TO authenticated",
    );
    const policy = STATEMENTS.slice(
      STATEMENTS.indexOf('CREATE POLICY "No direct access to marketplace_binder_commercial_terms"'),
    ).slice(0, 260);
    expect(policy).toContain("FOR ALL TO anon, authenticated");
    expect(policy).toContain("USING (false) WITH CHECK (false)");
  });

  it("family_key matches the WORK_FAMILIES vocabulary exactly", () => {
    expect(
      new Set(constrainedValues("marketplace_binder_commercial_terms_family_check")),
    ).toEqual(new Set(WORK_FAMILIES.map((f) => f.key)));
  });

  it("the multiplier is always positive — zero or negative would invert or erase a payout", () => {
    expect(STATEMENTS).toContain("CHECK (payout_multiplier_bps > 0)");
  });

  it("at most one active (effective_to IS NULL) term per binder and family", () => {
    expect(STATEMENTS).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS marketplace_binder_commercial_terms_active_uidx",
    );
    expect(STATEMENTS).toContain("WHERE effective_to IS NULL");
  });

  it("does not let the relieur administer their own terms — service_role only, no client grant", () => {
    expect(STATEMENTS).not.toMatch(
      /GRANT[\s\S]{0,80}ON public\.marketplace_binder_commercial_terms TO (?!service_role)/,
    );
  });
});

describe("the migration does not touch the Pricebook or any other marketplace table's policy", () => {
  it("alters only marketplace_cases and creates only marketplace_binder_commercial_terms", () => {
    const alters = [...STATEMENTS.matchAll(/ALTER TABLE public\.(\w+)/g)].map((m) => m[1]);
    expect(new Set(alters)).toEqual(new Set(["marketplace_cases", "marketplace_binder_commercial_terms"]));
  });
});

describe("the migration can be undone", () => {
  it("documents a rollback", () => {
    expect(SQL).toContain("-- Rollback");
  });
});
