// The binder-applications extension migration (15 septembre 2026) — adds
// website_url/skills and relaxes legal_entity_type for /partenaires-relieurs'
// shorter form, without touching what /candidature-atelier already sends.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260915090000_marketplace_binder_applications_extend.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const STATEMENTS = SQL.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");

describe("marketplace_binder_applications gains an optional website and skills", () => {
  it("adds website_url and skills, both optional/defaulted", () => {
    expect(STATEMENTS).toContain("ADD COLUMN IF NOT EXISTS website_url TEXT");
    expect(STATEMENTS).toContain("ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}'");
  });

  it("relaxes legal_entity_type to nullable — /partenaires-relieurs never asks for it", () => {
    expect(STATEMENTS).toContain("ALTER COLUMN legal_entity_type DROP NOT NULL");
  });

  it("keeps the same legal_entity_type vocabulary, just nullable now", () => {
    const start = STATEMENTS.indexOf(
      "CONSTRAINT marketplace_binder_applications_legal_entity_check CHECK",
    );
    expect(start).toBeGreaterThan(-1);
    const clause = STATEMENTS.slice(start, start + 300);
    expect(clause).toContain("legal_entity_type IS NULL OR legal_entity_type IN");
    for (const value of ["auto_entrepreneur", "ei", "eirl", "eurl", "sarl", "sas", "autre"]) {
      expect(clause).toContain(`'${value}'`);
    }
  });

  it("touches no other table", () => {
    const alters = [...STATEMENTS.matchAll(/ALTER TABLE public\.(\w+)/g)].map((m) => m[1]);
    expect(new Set(alters)).toEqual(new Set(["marketplace_binder_applications"]));
  });

  it("documents a rollback", () => {
    expect(SQL).toContain("-- Rollback");
  });
});
