// The binder-applications migration (14 septembre 2026), read as a contract
// — same approach as migrationContract.test.ts.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APPLICATION_STATUSES, LEGAL_ENTITY_TYPES, REVENUE_BANDS } from "./binders/application";

const SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260914090000_marketplace_binder_applications.sql"),
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

describe("marketplace_binder_applications is isolated exactly like every other marketplace_* table", () => {
  it("is created", () => {
    expect(STATEMENTS).toContain("CREATE TABLE IF NOT EXISTS public.marketplace_binder_applications (");
  });

  it("grants only service_role", () => {
    expect(STATEMENTS).toContain("GRANT ALL ON public.marketplace_binder_applications TO service_role;");
    expect(STATEMENTS).not.toContain("ON public.marketplace_binder_applications TO authenticated");
    expect(STATEMENTS).not.toContain("ON public.marketplace_binder_applications TO anon");
  });

  it("enables RLS and denies anon + authenticated — a public form writes through the server only", () => {
    expect(STATEMENTS).toContain(
      "ALTER TABLE public.marketplace_binder_applications ENABLE ROW LEVEL SECURITY;",
    );
    const policy = STATEMENTS.slice(
      STATEMENTS.indexOf('CREATE POLICY "No direct access to marketplace_binder_applications"'),
    ).slice(0, 260);
    expect(policy).toContain("FOR ALL TO anon, authenticated");
    expect(policy).toContain("USING (false) WITH CHECK (false)");
  });
});

describe("vocabularies match the code exactly", () => {
  it("status matches APPLICATION_STATUSES", () => {
    expect(new Set(constrainedValues("marketplace_binder_applications_status_check"))).toEqual(
      new Set(APPLICATION_STATUSES),
    );
  });

  it("legal_entity_type matches LEGAL_ENTITY_TYPES", () => {
    expect(
      new Set(constrainedValues("marketplace_binder_applications_legal_entity_check")),
    ).toEqual(new Set(LEGAL_ENTITY_TYPES));
  });

  it("average_annual_revenue_band matches REVENUE_BANDS", () => {
    expect(
      new Set(constrainedValues("marketplace_binder_applications_revenue_band_check")),
    ).toEqual(new Set(REVENUE_BANDS));
  });
});

describe("a reviewed application always records who and when", () => {
  it("enforces it at the schema level, not just in application code", () => {
    expect(STATEMENTS).toContain(
      "status = 'new' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)",
    );
  });
});

describe("this migration never touches marketplace_binders' own policy or another table", () => {
  it("alters no other table", () => {
    const alters = [...STATEMENTS.matchAll(/ALTER TABLE public\.(\w+)/g)].map((m) => m[1]);
    expect(new Set(alters)).toEqual(new Set(["marketplace_binder_applications"]));
  });
});

describe("the migration can be undone", () => {
  it("documents a rollback", () => {
    expect(SQL).toContain("-- Rollback");
  });
});
