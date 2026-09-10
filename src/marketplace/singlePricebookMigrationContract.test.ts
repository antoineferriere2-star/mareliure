/**
 * Le contrat de la migration de la grille unique.
 *
 * Il relit ce que rien d'autre ne peut vérifier sans base : les 45 références
 * web semées, le Pricebook initialisé à partir d'elles, le caractère additif et
 * rejouable de la migration, et les garanties dont dépend le code.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MARKETPLACE_EVENT_TYPES } from "./analytics/events";
import { WORK_ITEMS } from "./pricing/catalog";
import { MODIFIER_KINDS } from "./pricing/modifiers";
import { GRID_PROVENANCES } from "./pricing/provenance";
import { fromTtc } from "./pricing/vat";
import { webReferenceFromRange } from "./pricing/webBenchmark";

const SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260912120000_mareliure_single_pricebook.sql"),
  "utf8",
).replace(/\r\n/g, "\n");
const STATEMENTS = SQL.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");

const seedStart = STATEMENTS.indexOf("INSERT INTO public.marketplace_web_benchmarks");
const SEED = STATEMENTS.slice(seedStart, STATEMENTS.indexOf("ON CONFLICT (work_item_key)", seedStart));

const num = (value: string) => (value === "NULL" ? null : Number(value));
const ROWS = [
  ...SEED.matchAll(
    /\('([a-z_]+)', (NULL|\d+), (NULL|\d+), (NULL|\d+), '(per_book|per_hour)', (true|false),/g,
  ),
].map((match) => ({
  key: match[1],
  min: num(match[2]),
  reference: num(match[3]),
  max: num(match[4]),
  unit: match[5],
  openEnded: match[6] === "true",
}));
const byKey = new Map(ROWS.map((row) => [row.key, row]));

describe("la recherche web initiale", () => {
  it("couvre exactement les 45 opérations du catalogue, sans doublon", () => {
    expect(ROWS).toHaveLength(45);
    expect(new Set(ROWS.map((row) => row.key)).size).toBe(45);
    expect(ROWS.map((row) => row.key).sort()).toEqual(WORK_ITEMS.map((item) => item.key).sort());
  });

  it("donne une référence à toute opération tarifable", () => {
    for (const item of WORK_ITEMS.filter((candidate) => !candidate.requiresStudy)) {
      const row = byKey.get(item.key)!;
      expect(row.reference, item.key).not.toBeNull();
      expect(row.unit, item.key).toBe("per_book");
    }
  });

  it("place la référence au milieu de la fourchette observée, arrondi aux 5 €", () => {
    for (const row of ROWS.filter((candidate) => candidate.min !== null && candidate.max !== null)) {
      expect(row.min!, row.key).toBeLessThanOrEqual(row.reference!);
      expect(row.reference!, row.key).toBeLessThanOrEqual(row.max!);
      expect(row.reference, row.key).toBe(webReferenceFromRange(row.min!, row.max!));
    }
  });

  it("porte les montants de la recherche", () => {
    const expected: Record<string, number> = {
      reemboitage: 9_500,
      reparation_dos: 14_500,
      demi_cuir: 35_000,
      demi_cuir_a_coins: 42_500,
      plein_cuir: 59_000,
      dorure_titrage: 5_000,
      etui: 13_000,
      recouture_complete: 35_000,
      rebind_collector: 31_500,
      reliure_de_creation: 250_000,
    };
    for (const [key, reference] of Object.entries(expected))
      expect(byKey.get(key)!.reference, key).toBe(reference);
  });

  it("marque les hauts de fourchette ouverts (« 400 €+ »)", () => {
    expect(ROWS.filter((row) => row.openEnded).map((row) => row.key).sort()).toEqual(
      ["coffret", "decor_personnalise", "dorure_decor", "mosaique", "reliure_de_creation", "tranches"].sort(),
    );
  });

  it("garde la restauration patrimoniale et le sur-mesure hors de tout prix automatique", () => {
    expect(byKey.get("restauration_patrimoniale")).toMatchObject({
      min: null,
      reference: 8_500,
      max: null,
      unit: "per_hour",
    });
    expect(byKey.get("projet_sur_mesure")).toMatchObject({ min: null, reference: null, max: null });
    expect(SEED).toContain("Ne jamais en déduire automatiquement le prix total");
  });
});

describe("le Pricebook initial", () => {
  const start = STATEMENTS.indexOf("INSERT INTO public.marketplace_pricebook (");
  const insert = STATEMENTS.slice(start, STATEMENTS.indexOf(");", STATEMENTS.indexOf("NOT EXISTS", start)));

  it("prend la référence web comme tarif, en brouillon « référence initiale web »", () => {
    expect(insert).toContain("CASE WHEN w.requires_study THEN NULL ELSE b.web_reference_cents END");
    expect(insert).toContain("'draft',\n  'WEB_REFERENCE_INITIAL'");
    expect(insert).toContain("CASE WHEN w.requires_study THEN 'MANUAL_REVIEW' ELSE 'FIXED' END");
  });

  it("déduit le HT exactement comme vat.ts", () => {
    expect(insert).toContain("(2::bigint * b.web_reference_cents * 10000 + 12000) / (2 * 12000)");
    for (const row of ROWS.filter((candidate) => candidate.reference !== null))
      expect(Math.floor((2 * row.reference! * 10_000 + 12_000) / 24_000), row.key).toBe(
        fromTtc(row.reference!).htCents,
      );
  });

  it("ne crée pas de doublon au rejeu et n'écrase aucun prix décidé", () => {
    expect(insert).toContain("AND NOT EXISTS (");
    expect(insert).toContain("p.status IN ('draft', 'published')");
    expect(SQL).toContain("ON CONFLICT (work_item_key) DO NOTHING");
    expect(STATEMENTS).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS marketplace_pricebook_active_unique[\s\S]*?WHERE status IN \('draft', 'published'\)/,
    );
  });

  it("n'admet que deux provenances de grille, liées à l'état", () => {
    const clause = STATEMENTS.slice(
      STATEMENTS.indexOf("marketplace_pricebook_provenance_check\n    CHECK"),
      STATEMENTS.indexOf("marketplace_pricebook_status_provenance_check CHECK"),
    );
    const values = [...clause.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);
    expect(values).toEqual([...GRID_PROVENANCES]);
    expect(STATEMENTS).toContain("(status = 'draft' AND provenance = 'WEB_REFERENCE_INITIAL')");
    expect(STATEMENTS).toContain("(status = 'published' AND provenance = 'ADMIN_VALIDATED')");
  });

  it("ne rend public qu'un tarif validé", () => {
    const clause = STATEMENTS.slice(STATEMENTS.indexOf("marketplace_pricebook_public_check CHECK"));
    expect(clause.slice(0, clause.indexOf(";"))).toContain("provenance = 'ADMIN_VALIDATED'");
  });
});

describe("la migration", () => {
  it("est additive : aucune table, colonne ou donnée supprimée, aucune politique build_", () => {
    expect(STATEMENTS).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/);
    expect(STATEMENTS).not.toMatch(/\bbuild_/);
    const binderRates = [...STATEMENTS.matchAll(/[^\n]*marketplace_binder_rates[^\n]*/g)].map(
      (match) => match[0].trim(),
    );
    expect(binderRates).toEqual(["COMMENT ON TABLE public.marketplace_binder_rates IS"]);
  });

  it("est rejouable", () => {
    for (const table of ["marketplace_web_benchmarks", "marketplace_pricing_policy"])
      expect(STATEMENTS).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\(`));
    const added = [...STATEMENTS.matchAll(/ADD CONSTRAINT (\w+)/g)].map((match) => match[1]);
    expect(added.length).toBeGreaterThan(10);
    for (const name of added) expect(STATEMENTS, name).toContain(`DROP CONSTRAINT IF EXISTS ${name}`);
    for (const match of STATEMENTS.matchAll(/ADD COLUMN (?!IF NOT EXISTS)/g))
      expect.fail(`colonne sans garde : ${match[0]}`);
    for (const match of STATEMENTS.matchAll(/CREATE (?:UNIQUE )?INDEX (?!IF NOT EXISTS)/g))
      expect.fail(`index sans garde : ${match[0]}`);
  });

  it("ferme les nouvelles tables à anon et authenticated", () => {
    for (const table of ["marketplace_web_benchmarks", "marketplace_pricing_policy"]) {
      expect(STATEMENTS).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(STATEMENTS).toMatch(
        new RegExp(
          `ON public\\.${table} FOR ALL TO anon, authenticated\\s+USING \\(false\\) WITH CHECK \\(false\\)`,
        ),
      );
    }
  });

  it("sème la politique initiale de Ma Reliure sans l'écraser au rejeu : 25 %, 80 €", () => {
    expect(STATEMENTS).toContain("VALUES (1, 2500, 8000)\nON CONFLICT (id) DO NOTHING");
  });

  it("déclare exactement les formes de modificateur du code", () => {
    const clause = STATEMENTS.slice(STATEMENTS.indexOf("marketplace_pricing_modifiers_kind_check\n"));
    const values = [...clause.slice(0, clause.indexOf("),")).matchAll(/'([A-Z_]+)'/g)].map(
      (match) => match[1],
    );
    expect(values).toEqual([...MODIFIER_KINDS]);
  });

  it("n'ouvre sa fonction qu'au service, et n'écrit que des événements connus", () => {
    expect(STATEMENTS).toMatch(
      /REVOKE ALL ON FUNCTION public\.marketplace_save_pricebook_changes\(JSONB, TEXT, UUID\)\s+FROM PUBLIC, anon, authenticated/,
    );
    expect(STATEMENTS).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.marketplace_save_pricebook_changes\(JSONB, TEXT, UUID\)\s+TO service_role/,
    );
    const written = [...STATEMENTS.matchAll(/'(pricebook_\w+|pricing_\w+)',\n\s+jsonb_build_object/g)].map(
      (match) => match[1],
    );
    expect(written).toEqual(["pricebook_updated"]);
    for (const type of written) expect(MARKETPLACE_EVENT_TYPES).toContain(type);
  });

  it("refuse d'écraser un tarif modifié entre-temps", () => {
    expect(STATEMENTS).toContain("USING ERRCODE = 'serialization_failure'");
    expect(STATEMENTS).toContain("pg_advisory_xact_lock(hashtext('marketplace_pricebook:' || v_key))");
  });

  it("documente sa marche arrière", () => {
    const rollback = SQL.slice(SQL.indexOf("-- Rollback"));
    for (const object of [
      "marketplace_save_pricebook_changes",
      "marketplace_pricing_policy",
      "marketplace_web_benchmarks",
      "marketplace_pricebook_published_unique",
    ])
      expect(rollback).toContain(object);
  });
});
