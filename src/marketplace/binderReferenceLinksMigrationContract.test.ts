// La migration « liens du référentiel » (PR 2a), lue comme un contrat sur le texte du SQL — même approche que
// binderWorksMigrationContract.test.ts. Le comportement réel (CHECK, replay, devis, facture, isolation) a été
// rejoué sur un vrai Postgres (pglite) : voir le compte rendu de la PR.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { QUOTE_ITEM_ROW_KEYS } from "./quotes/quoteBuild";

const DIR = resolve(process.cwd(), "supabase/migrations");
const NAME = "20260921100000_marketplace_binder_reference_links.sql";
const RAW = readFileSync(resolve(DIR, NAME), "utf8").replace(/\r\n/g, "\n");
const SQL = RAW.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");
const timestamp = (file: string) => file.slice(0, "20260921100000".length);

describe("migration liens du référentiel", () => {
  it("est additive : aucune table, fonction, politique, droit ou trigger créé, modifié ou supprimé", () => {
    expect(SQL).not.toMatch(/\bCREATE\s+(TABLE|FUNCTION|TRIGGER|POLICY|OR\s+REPLACE)\b/i);
    expect(SQL).not.toMatch(/\bDROP\s+(TABLE|COLUMN|FUNCTION|TRIGGER|POLICY|SCHEMA)\b/i);
    expect(SQL).not.toMatch(/\b(GRANT|REVOKE|TRUNCATE|ALTER\s+COLUMN|RENAME)\b/i);
    expect(SQL).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(SQL).not.toMatch(/^\s*(UPDATE|INSERT)\b/im);
    expect(SQL).not.toMatch(/ENABLE\s+ROW\s+LEVEL|DISABLE\s+ROW/i);
    expect(SQL).not.toMatch(/SECURITY\s+DEFINER/i);
  });

  it("ne touche que deux tables : les prestations de l'atelier et les lignes de devis", () => {
    const altered = [...SQL.matchAll(/\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?public\.(\w+)/gi)].map((m) => m[1]);
    expect([...new Set(altered)].sort()).toEqual(["marketplace_binder_quote_items", "marketplace_binder_services"]);
    for (const untouched of ["marketplace_binder_invoices", "marketplace_binder_invoice_items", "marketplace_binder_quotes", "marketplace_binder_clients", "marketplace_binder_works", "marketplace_binder_document_counters"]) {
      expect(SQL, untouched).not.toMatch(new RegExp(`\\b${untouched}\\b`));
    }
    expect(SQL).not.toMatch(/marketplace_binder_convert_quote_to_invoice|marketplace_binder_create_quote|marketplace_binder_update_quote|immutab/i);
  });

  it("ajoute exactement 3 + 2 colonnes, nullables (sauf le favori, avec son défaut)", () => {
    const services = SQL.match(/ALTER TABLE public\.marketplace_binder_services\s+ADD COLUMN([^;]*);/i)![1];
    expect(services).toContain("IF NOT EXISTS reference_version TEXT");
    expect(services).toContain("IF NOT EXISTS reference_operation_key TEXT");
    expect(services).toMatch(/IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false/);
    expect((services.match(/NOT NULL/g) ?? []).length).toBe(1);
    const items = SQL.match(/ALTER TABLE public\.marketplace_binder_quote_items\s+ADD COLUMN([^;]*);/i)![1];
    expect(items).toContain("IF NOT EXISTS reference_version TEXT");
    expect(items).toContain("IF NOT EXISTS reference_operation_key TEXT");
    expect(items).not.toMatch(/NOT NULL|DEFAULT/i);
  });

  it("(version, clé) : tous deux présents ou tous deux absents, la clé est stable (jamais un slug) — sur les deux tables", () => {
    for (const table of ["marketplace_binder_services", "marketplace_binder_quote_items"]) {
      expect(SQL).toContain(`DROP CONSTRAINT IF EXISTS ${table}_reference_link_check`);
      expect(SQL).toContain(`ADD CONSTRAINT ${table}_reference_link_check`);
    }
    expect(SQL.match(/\(reference_version IS NULL\) = \(reference_operation_key IS NULL\)/g)).toHaveLength(2);
    expect(SQL.match(/reference_operation_key ~ '\^OPR-\[0-9\]\{4\}\$'/g)).toHaveLength(2);
    expect(SQL.match(/reference_version ~ '\^\[a-z0-9\]\[a-z0-9-\]\{1,39\}\$'/g)).toHaveLength(2);
  });

  it("le lien n'est PAS une clé étrangère : une nouvelle version du référentiel ne peut casser aucune ligne", () => {
    expect(SQL).not.toMatch(/REFERENCES\s+public\.\w*reference/i);
    expect(SQL).not.toMatch(/reference_(version|operation_key)[^,;]*REFERENCES/i);
    expect(SQL).not.toMatch(/FOREIGN\s+KEY/i);
  });

  it("aucun prix, aucun montant, aucune table de référentiel", () => {
    expect(SQL).not.toMatch(/price|prix|cents|amount|eur\b|CREATE\s+TABLE/i);
  });

  it("les index sont partiels (favoris et liens seulement)", () => {
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS marketplace_binder_services_favorite_idx\s+ON public\.marketplace_binder_services\(binder_id\) WHERE is_favorite/);
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS marketplace_binder_services_reference_idx[\s\S]*WHERE reference_operation_key IS NOT NULL/);
  });

  it("la provenance reste HORS des clés du devis calculé : un devis sans lien envoie exactement ce qu'il envoyait", () => {
    expect(QUOTE_ITEM_ROW_KEYS as readonly string[]).not.toContain("reference_version");
    expect(QUOTE_ITEM_ROW_KEYS as readonly string[]).not.toContain("reference_operation_key");
  });

  it("le pied de fichier documente le retour arrière", () => {
    expect(RAW).toMatch(/Retour arrière/);
    expect(RAW).toMatch(/DROP COLUMN IF EXISTS reference_version/);
  });
});

describe("l'historique des migrations", () => {
  it("la migration existe et conserve un timestamp correctement ordonné", () => {
    const names = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
    const index = names.indexOf(NAME);
    expect(index).toBeGreaterThan(-1);
    expect(names.slice(0, index).every((file) => timestamp(file) < timestamp(NAME))).toBe(true);
    expect(names.slice(index + 1).every((file) => timestamp(file) > timestamp(NAME))).toBe(true);
  });

  it("aucune migration antérieure ne mentionne ces colonnes (rien d'appliqué n'a été réécrit)", () => {
    for (const file of readdirSync(DIR).filter(
      (file) => file.endsWith(".sql") && timestamp(file) < timestamp(NAME),
    )) {
      expect(readFileSync(resolve(DIR, file), "utf8"), file).not.toMatch(/reference_operation_key|is_favorite/);
    }
  });
});
