/**
 * Phase 0 / P1-8 — la règle « quelle mention de TVA est figée dans la facture ».
 * Le scénario complet (devis → profil complété → conversion) est dans
 * binderQuotes.server.test.ts ; la fonction SQL est vérifiée sur Postgres lors du contrôle de migration.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { effectiveVatMention, profileReadiness, EMPTY_BILLING_PROFILE } from "./quoteBuild";

describe("effectiveVatMention", () => {
  it("la mention du devis prime (elle a été promise au client)", () => {
    expect(effectiveVatMention("Mention du devis", "Mention du profil")).toBe("Mention du devis");
  });
  it("à défaut, celle du profil", () => {
    expect(effectiveVatMention(null, "Mention du profil")).toBe("Mention du profil");
  });
  it("une chaîne blanche vaut absence, des deux côtés", () => {
    expect(effectiveVatMention("   ", "Mention du profil")).toBe("Mention du profil");
    expect(effectiveVatMention(null, "  ")).toBeNull();
    expect(effectiveVatMention("", null)).toBeNull();
  });
  it("rogne les espaces", () => {
    expect(effectiveVatMention("  TVA non applicable  ", null)).toBe("TVA non applicable");
  });
});

describe("la facture en franchise exige la mention effective", () => {
  const franchise = {
    ...EMPTY_BILLING_PROFILE,
    workshopName: "Atelier",
    addressLine1: "1 rue X",
    postalCode: "45000",
    city: "Orléans",
    siren: "123456789",
    siret: "123",
    vatRegime: "FRANCHISE" as const,
  };
  it("sans mention : « Mention de TVA » manque", () => {
    expect(profileReadiness({ ...franchise, vatMention: effectiveVatMention(null, null) }, "invoice").missing).toEqual(["Mention de TVA"]);
  });
  it("avec la mention du profil, le devis sans mention peut être facturé", () => {
    expect(profileReadiness({ ...franchise, vatMention: effectiveVatMention(null, "TVA non applicable") }, "invoice").ready).toBe(true);
  });
});

describe("contrat de la migration SQL", () => {
  const sql = readFileSync(
    new URL("../../../supabase/migrations/20260920100000_marketplace_binder_invoice_vat_mention.sql", import.meta.url),
    "utf8",
  ).replace(/--.*$/gm, "");

  it("fige la mention effective au lieu de recopier celle du devis", () => {
    expect(sql).toMatch(/v_vat_mention := COALESCE\(NULLIF\(btrim\(v_quote\.vat_mention\), ''\), NULLIF\(btrim\(p_vat_mention\), ''\)\)/);
    expect(sql).toMatch(/v_quote\.vat_regime, v_vat_mention, v_quote\.payment_terms/);
    expect(sql).not.toMatch(/v_quote\.vat_regime, v_quote\.vat_mention/);
  });
  it("refuse une franchise sans mention AVANT de consommer un numéro", () => {
    const raise = sql.indexOf("vat_mention_required");
    const numbering = sql.indexOf("marketplace_binder_next_document_number(");
    expect(raise).toBeGreaterThan(-1);
    expect(raise).toBeLessThan(numbering);
  });
  it("ne laisse aucune surcharge ambiguë et reste réservée au service_role", () => {
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.marketplace_binder_convert_quote_to_invoice\(UUID, UUID, DATE, TEXT, JSONB\)/);
    expect(sql).toMatch(/p_vat_mention TEXT DEFAULT NULL/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION[^;]*FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION[^;]*TO service_role/);
  });
});
