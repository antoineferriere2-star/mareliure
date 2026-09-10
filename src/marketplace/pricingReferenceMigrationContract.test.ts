/**
 * Le contrat de la migration du référentiel tarifaire.
 *
 * Il vérifie deux choses que rien d'autre ne peut vérifier sans base : que le
 * SQL est rejouable, et qu'il porte bien les garanties dont dépend le code —
 * en particulier celles qui empêchent une donnée de se prétendre plus solide
 * qu'elle ne l'est.
 *
 * La migration n'est pas encore appliquée en production ; ce test est donc la
 * seule chose qui la relit avant qu'elle y arrive.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { WORK_FAMILIES, WORK_ITEMS } from "./pricing/catalog";
import { PRICE_PROVENANCES, RATE_SOURCES } from "./pricing/provenance";
import { PRICING_CONFIDENCES } from "./pricing/confidence";
import { PRICING_METHODS } from "./pricing/pricebook";

const SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260909120000_pricing_reference_system.sql"),
  "utf8",
).replace(/\r\n/g, "\n");

/** Le SQL sans ses commentaires : un mot cité dans une explication ne prouve rien. */
const STATEMENTS = SQL.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");

const TABLES = ["marketplace_work_items", "marketplace_binder_rates", "marketplace_pricebook"];

describe("la migration du référentiel tarifaire", () => {
  it("est rejouable de bout en bout", () => {
    // Chaque table sous IF NOT EXISTS, chaque contrainte retirée avant d'être
    // reposée, chaque index et chaque politique sous garde. Une migration qui
    // ne se rejoue pas se répare à la main en production, un vendredi soir.
    for (const table of TABLES)
      expect(STATEMENTS).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\(`));

    const addedConstraints = [...STATEMENTS.matchAll(/ADD CONSTRAINT (\w+)/g)].map((m) => m[1]);
    expect(addedConstraints.length).toBeGreaterThan(8);
    for (const name of addedConstraints)
      expect(STATEMENTS, `${name} n'est pas retirée avant d'être reposée`).toContain(
        `DROP CONSTRAINT IF EXISTS ${name}`,
      );

    for (const match of STATEMENTS.matchAll(/CREATE (?:UNIQUE )?INDEX (?!IF NOT EXISTS)/g))
      expect.fail(`index sans garde : ${match[0]}`);

    for (const match of STATEMENTS.matchAll(/ADD COLUMN (?!IF NOT EXISTS)/g))
      expect.fail(`colonne sans garde : ${match[0]}`);
  });

  it("garde toutes les tables derrière un refus total", () => {
    for (const table of TABLES) {
      expect(STATEMENTS).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      expect(STATEMENTS).toContain(`DROP POLICY IF EXISTS "No direct access to ${table}"`);
    }
    expect(STATEMENTS.match(/USING \(false\) WITH CHECK \(false\)/g)?.length).toBe(TABLES.length);
  });

  /**
   * La contrainte qui porte le sens du système : une ligne ne peut pas se
   * prétendre relevée sur le terrain sans dire par qui et quand. Sans elle,
   * `REAL_VERIFIED` serait une case à cocher et la traçabilité une intention.
   */
  it("interdit une référence terrain sans témoin ni date", () => {
    expect(STATEMENTS).toContain("provenance <> 'REAL_VERIFIED'");
    expect(STATEMENTS).toContain("verified_at IS NOT NULL AND verified_by IS NOT NULL");
  });

  it("interdit un prix publié sans décision humaine tracée", () => {
    expect(STATEMENTS).toContain("status <> 'published'");
    expect(STATEMENTS).toContain("validated_at IS NOT NULL AND validated_by IS NOT NULL");
  });

  it("refuse une grille incohérente avec elle-même", () => {
    expect(STATEMENTS).toContain("minimum_payout_cents <= typical_payout_cents");
    expect(STATEMENTS).toContain("typical_payout_cents <= maximum_payout_cents");
    expect(STATEMENTS).toContain("reference_binder_payout_cents <= customer_price_cents");
  });

  /** Les vocabulaires du code et de la base ne peuvent pas diverger en silence. */
  it("connaît exactement les mêmes vocabulaires que le code", () => {
    // Les provenances ajoutées par la console de prix vivent dans sa propre
    // migration, où `pricingConsoleContract.test.ts` les confronte au code.
    const addedLater = ["HISTORICAL_TRANSACTION", "BINDER_DECLARED", "WEB_BENCHMARK"];
    for (const provenance of PRICE_PROVENANCES.filter((p) => !addedLater.includes(p)))
      expect(STATEMENTS).toContain(`'${provenance}'`);
    for (const source of RATE_SOURCES) expect(STATEMENTS).toContain(`'${source}'`);
    for (const method of PRICING_METHODS) expect(STATEMENTS).toContain(`'${method}'`);
    for (const family of WORK_FAMILIES) expect(STATEMENTS).toContain(`'${family.key}'`);
  });

  /**
   * `manual_review` doit exister comme état, sinon le refus de chiffrer n'a nulle
   * part où s'enregistrer et redevient une absence indistinguable d'un oubli.
   */
  it("fait du refus de chiffrer un état, pas une absence", () => {
    expect(STATEMENTS).toContain("'pending', 'suggested', 'validated', 'manual_review'");
    for (const confidence of PRICING_CONFIDENCES) expect(STATEMENTS).toContain(`'${confidence}'`);
  });

  it("sème le catalogue en entier, sans écraser les ajouts de l'administration", () => {
    expect(STATEMENTS).toContain("INSERT INTO public.marketplace_work_items");
    expect(STATEMENTS).toContain("ON CONFLICT (key) DO UPDATE SET");
    for (const item of WORK_ITEMS)
      expect(STATEMENTS, `${item.key} absent de la semence`).toContain(`('${item.key}',`);
  });

  it("garde une seule entrée de Pricebook publiée par travail et par classe", () => {
    expect(STATEMENTS).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS marketplace_pricebook_published_unique[\s\S]*?WHERE status = 'published'/,
    );
  });

  /** Un rollback écrit le jour de la migration, pas le jour de l'incident. */
  it("documente sa marche arrière", () => {
    const rollback = SQL.slice(SQL.indexOf("-- Rollback"));
    for (const table of TABLES) expect(rollback).toContain(`DROP TABLE IF EXISTS public.${table}`);
    expect(rollback).toContain("minimum_required_payout_cents");
  });
});
