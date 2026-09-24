import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(resolve(process.cwd(), "supabase/migrations/20260924120000_finebindery_i18n.sql"), "utf8");

describe("FineBindery i18n migration", () => {
  it("keeps workshop languages independent from country", () => {
    expect(SQL).toContain("spoken_languages");
    expect(SQL).toContain("country_code");
    expect(SQL).not.toMatch(/spoken_languages\s+[^,\n]*\bGENERATED\b/i);
  });

  it("stores the submission locale and preferred language on a project", () => {
    expect(SQL).toContain("submission_locale TEXT");
    expect(SQL).toContain("preferred_language TEXT");
    for (const locale of ["en", "fr", "de", "it", "es"]) expect(SQL).toContain(`'${locale}'`);
  });

  it("does not modify existing business rows", () => {
    expect(SQL).not.toMatch(/\b(UPDATE|DELETE|TRUNCATE)\s+public\./i);
  });
});
