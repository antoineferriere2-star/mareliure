import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DOCUMENT_ACCENT_COLORS, DOCUMENT_LOGOS_BUCKET, DOCUMENT_LOGO_MAX_BYTES, DOCUMENT_LOGO_MIME_TYPES } from "./quotes/documentBranding";

const SQL = readFileSync(resolve(process.cwd(), "supabase/migrations/20260923110000_marketplace_document_branding.sql"), "utf8");

describe("identité visuelle des devis et factures", () => {
  it("ajoute seulement les champs de marque au profil de l'atelier", () => {
    expect(SQL).toContain("ALTER TABLE public.marketplace_binder_billing_profiles");
    for (const column of ["binder_name", "website", "logo_storage_path", "document_accent_color", "document_footer"]) {
      expect(SQL).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    expect(SQL).not.toMatch(/ALTER TABLE public\.marketplace_binder_(quotes|invoices)/);
  });

  it("limite la palette aux quatre accents proposés par l'interface", () => {
    for (const color of DOCUMENT_ACCENT_COLORS) expect(SQL).toContain(`'${color}'`);
  });

  it("provisionne un bucket privé borné aux PNG et JPEG", () => {
    expect(SQL).toContain(`'${DOCUMENT_LOGOS_BUCKET}'`);
    expect(SQL).toContain(`FALSE, ${DOCUMENT_LOGO_MAX_BYTES}`);
    for (const mime of DOCUMENT_LOGO_MIME_TYPES) expect(SQL).toContain(`'${mime}'`);
    expect(SQL).toContain("FOR ALL TO anon, authenticated");
    expect(SQL).toContain("AND FALSE");
  });
});
