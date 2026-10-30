/**
 * Phase 0 / P1-8 — la règle « quelle mention de TVA est figée dans la facture ».
 * Le scénario complet (devis → profil complété → conversion) est dans
 * binderQuotes.server.test.ts ; la fonction SQL est vérifiée sur Postgres lors du contrôle de migration.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { effectiveVatMention, mentionForRegime, profileReadiness, EMPTY_BILLING_PROFILE } from "./quoteBuild";

describe("effectiveVatMention", () => {
  it("la mention du devis prime (elle a été promise au client)", () => {
    expect(effectiveVatMention("Mention du devis", "Mention du profil", "FRANCHISE")).toBe("Mention du devis");
  });
  it("à défaut, celle du profil", () => {
    expect(effectiveVatMention(null, "Mention du profil", "FRANCHISE")).toBe("Mention du profil");
  });
  it("une chaîne blanche vaut absence, des deux côtés", () => {
    expect(effectiveVatMention("   ", "Mention du profil", "FRANCHISE")).toBe("Mention du profil");
    expect(effectiveVatMention(null, "  ", "FRANCHISE")).toBeNull();
    expect(effectiveVatMention("", null, "FRANCHISE")).toBeNull();
  });
  it("rogne les espaces", () => {
    expect(effectiveVatMention("  TVA non applicable  ", null, "FRANCHISE")).toBe("TVA non applicable");
  });
});

describe("la facture en franchise exige la mention effective", () => {
  const franchise = {
    ...EMPTY_BILLING_PROFILE,
    workshopName: "Atelier",
    addressLine1: "1 rue X",
    postalCode: "45000",
    city: "Orléans",
    siren: "732829320",
    siret: "73282932000009",
    vatRegime: "FRANCHISE" as const,
  };
  it("sans mention : le profil est prêt, la mention de l'article 293 B étant posée d'office à l'émission", () => {
    expect(profileReadiness({ ...franchise, vatMention: effectiveVatMention(null, null, "FRANCHISE") }, "invoice")).toEqual({ ready: true, missing: [] });
  });
  it("assujetti : le régime d'imposition et des identifiants valides sont exigés, comme à l'émission", () => {
    const liable = { ...franchise, vatRegime: "VAT_LIABLE" as const, vatNumber: "FR40732829320", vatFilingRegime: null, siren: "732829321" };
    expect(profileReadiness(liable as never, "invoice").missing).toEqual(["SIREN (clé de contrôle)", "Régime d'imposition"]);
  });
  it("avec la mention du profil, le devis sans mention peut être facturé", () => {
    expect(profileReadiness({ ...franchise, vatMention: effectiveVatMention(null, "TVA non applicable", "FRANCHISE") }, "invoice").ready).toBe(true);
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

describe("passage de la franchise à la TVA", () => {
  it("la mention de franchise ne suit pas un atelier assujetti", () => {
    expect(mentionForRegime("VAT_LIABLE", "TVA non applicable, art. 293 B du CGI")).toBeNull();
    expect(effectiveVatMention(null, "TVA non applicable, art. 293B du CGI", "VAT_LIABLE")).toBeNull();
  });
  it("toute autre mention reste, et la franchise garde la sienne", () => {
    expect(mentionForRegime("VAT_LIABLE", "TVA acquittée sur les encaissements")).toBe("TVA acquittée sur les encaissements");
    expect(mentionForRegime("FRANCHISE", "TVA non applicable, art. 293 B du CGI")).toContain("293 B");
  });
});
