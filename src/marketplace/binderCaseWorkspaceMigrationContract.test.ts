import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RAW = readFileSync(resolve(process.cwd(), "supabase/migrations/20260922140000_marketplace_binder_case_work.sql"), "utf8").replace(/\r\n/g, "\n");
const SQL = RAW.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");

describe("migration dossier Ma Reliure vers atelier", () => {
  it("est additive et ne crée ni dossier, ni message, ni table", () => {
    expect(SQL).not.toMatch(/\b(CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|DELETE\s+FROM|UPDATE\s+public\.)\b/i);
    expect(SQL).not.toMatch(/INSERT INTO public\.marketplace_(cases|messages|conversation_reads)/i);
  });

  it("exige le dossier Ma Reliure, le match selected et un atelier actif", () => {
    expect(SQL).toContain("c.brand = 'MA_RELIURE'");
    expect(SQL).toContain("m.state = 'selected'");
    expect(SQL).toContain("m.binder_id = p_binder_id");
    expect(SQL).toContain("b.status NOT IN ('suspended', 'rejected')");
  });

  it("est idempotente sous verrou et impose la provenance", () => {
    expect(SQL).toMatch(/FOR UPDATE/);
    expect(SQL).toMatch(/WHERE binder_id = p_binder_id AND case_id = p_case_id/);
    expect(SQL).toContain("'ma_reliure', p_case_id");
    expect(SQL).toContain("'ma_reliure', p_case_id)");
  });

  it("reste service_role seulement et sans SECURITY DEFINER", () => {
    const signature = "marketplace_binder_import_case(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT)";
    expect(SQL).toContain(`REVOKE ALL ON FUNCTION public.${signature}`);
    expect(SQL).toContain("FROM PUBLIC, anon, authenticated");
    expect(SQL).toContain(`GRANT EXECUTE ON FUNCTION public.${signature}`);
    expect(SQL).toContain("TO service_role");
    expect(SQL).not.toMatch(/SECURITY\s+DEFINER/i);
  });
});
