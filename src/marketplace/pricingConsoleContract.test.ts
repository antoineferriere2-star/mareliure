/**
 * Ce que la console de prix ne doit jamais devenir, vérifié sur le texte.
 *
 * Trois couches séparées, des droits réservés à l'administration, un public
 * qui ne lit que le Pricebook, une migration additive. Des garanties qu'un
 * test de comportement ne voit pas : elles tiennent à ce que le code *ne fait
 * pas*, et c'est en le lisant qu'on s'assure qu'il continue de ne pas le faire.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MARKETPLACE_EVENT_TYPES } from "./analytics/events";
import { PRICING_MODES } from "./pricing/pricingModes";
import { RATE_PROVENANCES } from "./pricing/provenance";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SQL = read("supabase/migrations/20260910120000_pricing_admin_console.sql");
const STATEMENTS = SQL.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");

/** Découpe un fichier de server functions en blocs, un par `createServerFn`. */
function serverFunctions(source: string): { name: string; body: string }[] {
  const matches = [...source.matchAll(/export const (\w+) = createServerFn/g)];
  return matches.map((match, index) => ({
    name: match[1],
    body: source.slice(match.index, matches[index + 1]?.index ?? source.length),
  }));
}

describe("les droits", () => {
  it("chaque server function de la console vérifie le rôle admin", () => {
    const functions = serverFunctions(read("src/marketplace/services/pricing.data.functions.ts"));
    expect(functions.length).toBeGreaterThanOrEqual(10);
    for (const fn of functions)
      expect(fn.body, fn.name).toContain("await assertAdmin(context.supabase, context.userId)");
  });

  it("la composition et la validation d'un dossier aussi", () => {
    const functions = serverFunctions(
      read("src/marketplace/services/marketplace.data.functions.ts"),
    );
    for (const name of [
      "composeCasePricing",
      "validateMarketplacePricing",
      "generateMarketplacePricing",
    ]) {
      const fn = functions.find((candidate) => candidate.name === name);
      expect(fn, name).toBeDefined();
      expect(fn!.body, name).toContain("await assertAdmin(context.supabase, context.userId)");
    }
  });
});

describe("les trois couches", () => {
  it("le public ne lit que le Pricebook", () => {
    const publicCode = code(read("src/marketplace/services/publicPricing.functions.ts"));
    expect(publicCode).not.toMatch(/benchmark/i);
    expect(publicCode).not.toMatch(/binder_rates|loadActiveRates|aggregat/i);
    expect(publicCode).not.toContain("requireSupabaseAuth");
    const loader = read("src/marketplace/services/pricingRepository.server.ts");
    const publicLoader = loader.slice(loader.indexOf("export async function loadPublicPricebook"));
    expect(publicLoader.slice(0, publicLoader.indexOf("\n}\n"))).toMatch(
      /\.eq\("public_visible", true\)/,
    );
  });

  it("aucun module de prix ne lit le benchmark", () => {
    for (const file of [
      "composition.ts",
      "publicPrices.ts",
      "snapshot.ts",
      "pricebookInput.ts",
      "pricebook.ts",
    ])
      expect(code(read(`src/marketplace/pricing/${file}`)), file).not.toMatch(
        /from "\.\/benchmark"/,
      );
  });

  it("la publication au Pricebook ne reçoit aucun montant du benchmark", () => {
    const source = read("src/marketplace/services/pricing.data.functions.ts");
    const publish = serverFunctions(source).find((fn) => fn.name === "publishPricebookEntry")!;
    expect(publish.body).not.toMatch(/benchmark/i);
  });

  it("la liste « Mes livres » ne renvoie plus un prix non validé", () => {
    const source = read("src/marketplace/services/marketplace.data.functions.ts");
    expect(source).toMatch(
      /customerPriceCents: row\.pricing_status === "validated" \? row\.customer_price_cents : null/,
    );
  });
});

describe("la migration de la console", () => {
  it("est additive : aucune table ni colonne supprimée, aucune politique build_ touchée", () => {
    expect(STATEMENTS).not.toMatch(/DROP TABLE|DROP COLUMN/);
    // `\b` : `jsonb_build_object` n'est pas une table `build_*`.
    expect(STATEMENTS).not.toMatch(/\bbuild_/);
  });

  it("est rejouable", () => {
    for (const table of ["marketplace_price_benchmarks", "marketplace_pricing_modifiers"])
      expect(STATEMENTS).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\(`));
    const added = [...STATEMENTS.matchAll(/ADD CONSTRAINT (\w+)/g)].map((match) => match[1]);
    expect(added.length).toBeGreaterThan(15);
    for (const name of added)
      expect(STATEMENTS, name).toContain(`DROP CONSTRAINT IF EXISTS ${name}`);
    for (const column of [...STATEMENTS.matchAll(/ADD COLUMN (\w+)/g)])
      expect(column[1], "ADD COLUMN sans garde").toBe("IF");
  });

  it("n'admet sur les grilles que les provenances d'atelier, jamais le repère web", () => {
    const clause = STATEMENTS.slice(
      STATEMENTS.indexOf("marketplace_binder_rates_provenance_check CHECK"),
      STATEMENTS.indexOf("marketplace_binder_rates_historical_check CHECK"),
    );
    const values = [...clause.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);
    expect(new Set(values)).toEqual(new Set(RATE_PROVENANCES));
    expect(values).not.toContain("WEB_BENCHMARK");
  });

  it("verrouille la table du benchmark sur WEB_BENCHMARK", () => {
    expect(STATEMENTS).toMatch(
      /marketplace_price_benchmarks_provenance_check\s+CHECK \(provenance = 'WEB_BENCHMARK'\)/,
    );
  });

  it("déclare exactement les modes de tarification du code", () => {
    const clause = STATEMENTS.slice(STATEMENTS.indexOf("marketplace_pricebook_mode_check CHECK"));
    const values = [...clause.slice(0, clause.indexOf("))")).matchAll(/'([A-Z_]+)'/g)].map(
      (match) => match[1],
    );
    expect(values).toEqual([...PRICING_MODES]);
  });

  it("sème les modificateurs désactivés et sans valeur", () => {
    const seed = STATEMENTS.slice(
      STATEMENTS.indexOf("INSERT INTO public.marketplace_pricing_modifiers"),
    );
    const statement = seed.slice(0, seed.indexOf(";"));
    expect(statement).toMatch(/\(axis, class_key\)/);
    expect(statement).not.toMatch(/enabled|percent_bps|fixed_cents|true/i);
    expect(statement).toContain("DO NOTHING");
  });

  it("ferme les nouvelles tables à anon et authenticated", () => {
    for (const table of ["marketplace_price_benchmarks", "marketplace_pricing_modifiers"]) {
      expect(STATEMENTS).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(STATEMENTS).toMatch(
        new RegExp(
          `ON public\\.${table} FOR ALL TO anon, authenticated\\s+USING \\(false\\) WITH CHECK \\(false\\)`,
        ),
      );
    }
  });

  it("ne rend ses fonctions exécutables que par le service", () => {
    for (const fn of [
      "marketplace_publish_pricebook_entry",
      "marketplace_validate_pricing_snapshot",
    ]) {
      expect(STATEMENTS).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\)\\s+FROM PUBLIC, anon, authenticated`,
        ),
      );
      expect(STATEMENTS).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\)\\s+TO service_role`),
      );
    }
  });

  it("n'écrit que des événements connus du code", () => {
    const written = [
      ...STATEMENTS.matchAll(/'(pricing_\w+|pricebook_\w+)',\n\s+jsonb_build_object/g),
    ].map((m) => m[1]);
    expect(written.length).toBeGreaterThanOrEqual(3);
    for (const type of written) expect(MARKETPLACE_EVENT_TYPES, type).toContain(type);
  });

  it("valide un prix une seule fois et exige une raison à chaque nouvelle version", () => {
    expect(STATEMENTS).toContain("AND pricing_status <> 'validated'");
    expect(STATEMENTS).toContain("CHECK (version = 1 OR change_reason IS NOT NULL)");
  });
});
