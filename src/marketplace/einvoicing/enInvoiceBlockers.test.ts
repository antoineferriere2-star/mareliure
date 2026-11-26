import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EN_INVOICE_BLOCKERS, blockersFixedByAtelier, describeEnInvoiceBlockers } from "./enInvoiceBlockers";

const SOURCE = readFileSync(resolve(process.cwd(), "src/marketplace/einvoicing/enInvoice.ts"), "utf8");

describe("catalogue des refus de la traduction EN 16931", () => {
  it("décrit chaque refus que la traduction peut produire, et aucun autre", () => {
    const produced = new Set([...SOURCE.matchAll(/blockers\.add\("([a-z0-9_]+)"\)|\["?blockers"?[^\]]*"([a-z0-9_]+)"\]|\.\.\.blockers, "([a-z0-9_]+)"/g)].map((m) => m[1] ?? m[2] ?? m[3]));
    expect(produced.size).toBeGreaterThan(8);
    for (const name of produced) expect(Object.keys(EN_INVOICE_BLOCKERS), name).toContain(name);
    // Le type union de enInvoice.ts et le catalogue doivent rester identiques.
    const union = [...SOURCE.slice(SOURCE.indexOf("export type EnInvoiceBlocker"), SOURCE.indexOf("export interface EnInvoiceContext")).matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]);
    expect(Object.keys(EN_INVOICE_BLOCKERS).sort()).toEqual([...union].sort());
  });

  it("donne à chaque refus une phrase pour l'atelier et un type valide", () => {
    for (const [name, info] of Object.entries(EN_INVOICE_BLOCKERS)) {
      expect(info.message.length, name).toBeGreaterThan(20);
      expect(["atelier_data", "accounting_decision", "reporting_only", "out_of_scope", "integrity"]).toContain(info.kind);
    }
  });

  it("n'emploie aucun mot du vocabulaire interdit dans les phrases adressées à l'atelier", () => {
    const text = Object.values(EN_INVOICE_BLOCKERS).map((info) => info.message).join(" ");
    expect(text).not.toMatch(/formulaire|questionnaire|\blead\b|utilisateur|prompt/i);
  });

  it("garde en attente d'une décision comptable les cas fiscaux, sans les trancher", () => {
    for (const name of ["vat_on_debits_not_mapped", "deposit_not_mapped", "b2c_mixed"] as const) {
      expect(EN_INVOICE_BLOCKERS[name].kind).toBe("accounting_decision");
    }
    expect(EN_INVOICE_BLOCKERS.international_reporting_only.kind).toBe("reporting_only");
  });

  it("dit si l'atelier peut tout corriger lui-même", () => {
    expect(blockersFixedByAtelier(["missing_buyer_identity", "missing_client_type"])).toBe(true);
    expect(blockersFixedByAtelier(["missing_buyer_identity", "deposit_not_mapped"])).toBe(false);
    expect(describeEnInvoiceBlockers(["deposit_not_mapped"])[0]).toMatchObject({ kind: "accounting_decision" });
  });
});
