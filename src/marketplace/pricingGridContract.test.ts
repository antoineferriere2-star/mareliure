/**
 * Ce que la grille tarifaire unique ne doit jamais redevenir, vérifié sur le
 * texte du code.
 *
 * Plus aucune grille d'atelier, un seul chemin de prix pour le simulateur et
 * les dossiers, un benchmark web qui ne sort pas du back-office, un client qui
 * ne voit que son prix et un atelier qui ne voit que sa rémunération. Des
 * garanties qu'un test de comportement ne voit pas : elles tiennent à ce que
 * le code *ne fait pas*.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

function files(dir: string): string[] {
  return readdirSync(resolve(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(resolve(ROOT, path)).isDirectory() ? files(path) : [path.replace(/\\/g, "/")];
  });
}

function serverFunctions(source: string): { name: string; body: string }[] {
  const matches = [...source.matchAll(/export const (\w+) = createServerFn/g)];
  return matches.map((match, index) => ({
    name: match[1],
    body: source.slice(match.index, matches[index + 1]?.index ?? source.length),
  }));
}

const SERVICE = read("src/marketplace/services/marketplace.data.functions.ts");
const section = (from: string, to: string) =>
  SERVICE.slice(SERVICE.indexOf(from), SERVICE.indexOf(to));

describe("plus aucune grille d'atelier", () => {
  const runtime = [...files("src"), ...files("scripts")]
    .filter((path) => /\.(ts|tsx|mjs)$/.test(path))
    .filter((path) => !/\.test\.ts$/.test(path))
    .filter((path) => !path.endsWith("integrations/supabase/types.ts"))
    .filter((path) => !path.endsWith("routeTree.gen.ts"));

  it("aucun code actif ne lit ni n'écrit les tables dépréciées", () => {
    for (const path of runtime)
      expect(code(read(path)), path).not.toMatch(
        /marketplace_binder_rates|marketplace_price_benchmarks|marketplace_publish_pricebook_entry/,
      );
  });

  it("aucun code actif ne dépend de l'ancienne agrégation", () => {
    for (const path of runtime)
      expect(code(read(path)), path).not.toMatch(
        /rateCard|aggregatesFrom|aggregateRates|loadActiveRates|loadBinderRates|getBinderRateCard|saveBinderRate|removeBinderRate|PUBLISHABLE_MINIMUM_REFERENCES|detectDrift|referenceCount|suggestManagedPrice/,
      );
  });

  it("les provenances d'atelier ne sont plus proposées nulle part", () => {
    for (const path of runtime.filter((candidate) => !candidate.endsWith("pricing/provenance.ts")))
      expect(code(read(path)), path).not.toMatch(/REAL_VERIFIED|BINDER_DECLARED/);
  });

  it("la saisie de grille par atelier a disparu, route et liens compris", () => {
    for (const path of [
      "src/routes/_authenticated/marketplace/pricing.$binderId.tsx",
      "src/marketplace/pages/admin/RateCardPage.tsx",
      "src/marketplace/pages/admin/pricing/PricingConsolePage.tsx",
      "src/marketplace/pricing/rateCard.ts",
      "scripts/seedWebBenchmarks.ts",
    ])
      expect(existsSync(resolve(ROOT, path)), path).toBe(false);
    expect(read("src/marketplace/pages/admin/BinderListPage.tsx")).not.toContain("/marketplace/pricing");
    expect(read("src/routeTree.gen.ts")).not.toContain("pricing/$binderId");
  });
});

describe("un seul chemin de prix", () => {
  it("chaque fonction de la grille vérifie le rôle admin", () => {
    const functions = serverFunctions(read("src/marketplace/services/pricing.data.functions.ts"));
    expect(functions.map((fn) => fn.name).sort()).toEqual(
      [
        "getPricingGrid",
        "saveModifier",
        "savePricebookChanges",
        "savePricingPolicy",
        "updateWorkItem",
        "validateInitialGrid",
      ].sort(),
    );
    for (const fn of functions)
      expect(fn.body, fn.name).toContain("await assertAdmin(context.supabase, context.userId)");
  });

  it("le dossier compose et valide avec le moteur de la grille, sous contrôle admin", () => {
    const functions = serverFunctions(SERVICE);
    expect(functions.find((fn) => fn.name === "generateMarketplacePricing")).toBeUndefined();
    for (const name of ["composeCasePricing", "validateMarketplacePricing"]) {
      const fn = functions.find((candidate) => candidate.name === name)!;
      expect(fn.body, name).toContain("await assertAdmin(context.supabase, context.userId)");
      expect(fn.body, name).toContain("priceProject(");
      expect(fn.body, name).toContain("toPricingGrid(await loadPricingData(sb))");
    }
  });

  it("le simulateur utilise le moteur de la grille, pas un calcul à lui", () => {
    const simulator = code(read("src/marketplace/pages/admin/pricing/PricingSimulatorPage.tsx"));
    expect(simulator).toContain("priceProject(");
    expect(simulator).toContain("getPricingGrid");
    expect(simulator).not.toMatch(/reduce\(|\* line\.quantity/);
  });

  it("le moteur ne lit pas le benchmark web", () => {
    for (const file of ["composition.ts", "pricing.engine.ts", "snapshot.ts", "payout.ts", "publicPrices.ts"])
      expect(code(read(`src/marketplace/pricing/${file}`)), file).not.toMatch(/webBenchmark|WebBenchmark/);
    expect(code(read("src/marketplace/services/pricingContext.server.ts"))).toMatch(
      /export function toPricingGrid[\s\S]*?entries: data\.entries\.filter\(isActiveEntry\)/,
    );
  });

  it("un refus d'atelier s'enregistre sur le dossier sans toucher la grille", () => {
    const respond = serverFunctions(SERVICE).find((fn) => fn.name === "respondToBinderOffer")!;
    expect(respond.body).toContain("minimum_required_payout_cents");
    expect(code(respond.body)).not.toMatch(/pricebook|marketplace_save_pricebook_changes/i);
  });
});

describe("chacun ne voit que ce qui le concerne", () => {
  it("le public ne lit que des tarifs validés et cochés publics", () => {
    const publicCode = code(read("src/marketplace/services/publicPricing.functions.ts"));
    expect(publicCode).not.toMatch(/benchmark/i);
    expect(publicCode).not.toContain("requireSupabaseAuth");
    const repository = read("src/marketplace/services/pricingRepository.server.ts");
    const loader = repository.slice(repository.indexOf("export async function loadPublicPricebook"));
    const body = loader.slice(0, loader.indexOf("\n}\n"));
    expect(body).toContain('.eq("status", "published")');
    expect(body).toContain('.eq("provenance", "ADMIN_VALIDATED")');
    expect(body).toContain('.eq("public_visible", true)');
  });

  it("le client ne voit jamais le benchmark web", () => {
    const customer = [
      ...files("src/marketplace/pages/customer"),
      "src/marketplace/pages/TarifsPage.tsx",
    ].map((path) => code(read(path)));
    customer.push(code(section("// Customer — their own books", "export const claimMarketplaceCase")));
    for (const source of customer)
      expect(source).not.toMatch(/benchmark|webReference|web_reference|getPricingGrid/i);
  });

  it("l'atelier ne voit jamais la grille : seulement sa rémunération", () => {
    const binder = [
      ...files("src/marketplace/pages/binder"),
      "src/marketplace/services/projectThread.functions.ts",
    ].map((path) => code(read(path)));
    binder.push(code(section("// Relieur — their own dashboard", "// Customer — their own books")));
    for (const source of binder)
      expect(source).not.toMatch(
        /pricebook|getPricingGrid|loadPricingData|pricingRepository|benchmark|customer_price/i,
      );
  });
});
