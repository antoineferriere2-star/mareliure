/**
 * Contrat : AUCUNE donnée tarifaire collectée (les prix publics observés) n'entre dans l'application.
 *
 *  - pas importée dans le code, ni dans la ressource `reliure-fr-v1`, ni dans le catalogue produit ;
 *  - pas exposée au navigateur (le bundle, quand il est construit, ne contient aucun de leurs marqueurs) ;
 *  - pas utilisée par le moteur de prix, jamais un prix conseillé, jamais un tarif prérempli.
 *
 * Les marqueurs sont les noms de colonnes du fichier de prix publics : tant qu'ils n'apparaissent nulle
 * part, ses données n'ont pas pu être importées.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadReference } from "./index";

const ROOT = process.cwd();
/** Les colonnes du fichier de prix publics : partout interdites. */
const MARKERS = [
  "observation_id", "price_min_eur", "price_max_eur", "price_eur", "operation_as_published", "canonical_operation_hint",
  "observed-public-prices", "observed_public_prices", "observedPublicPrice", "publicPrice", "publicPrices",
];
/**
 * Le vocabulaire du « prix conseillé » : interdit dans le référentiel et le catalogue de l'atelier. (La tarification
 * PLATEFORME — propositions commerciales gérées — a son propre `suggestedPrice`, sans rapport avec des prix publics.)
 */
const ADVICE_MARKERS = ["suggestedPrice", "recommendedPrice", "suggested_price", "recommended_price", "priceRange", "price_range", "defaultPrice", "default_price", "prefillPrice", "prix conseill", "prix indicatif", "fourchette de prix"];
const CATALOG_SCOPE = ["src/marketplace/reference", "src/marketplace/pages/binder/quotes/catalog"];
const CATALOG_FILES = ["src/marketplace/services/binderReferenceCatalog.server.ts", "src/marketplace/services/binderReferenceCatalog.data.functions.ts"];

function walk(dir: string, accept: (file: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (["node_modules", ".git", ".output", ".wrangler", "dist"].includes(name)) continue;
      walk(path, accept, out);
    } else if (accept(path)) out.push(path);
  }
  return out;
}

/** Les fichiers de test décrivent ces marqueurs (pour les interdire) : ils ne comptent pas comme du code produit. */
const isProductSource = (file: string) => /\.(ts|tsx|mjs|js|json|sql|md)$/.test(file) && !/\.test\.tsx?$/.test(file) && !file.endsWith("routeTree.gen.ts");

describe("aucun prix public dans l'application", () => {
  it("aucun fichier source du produit ne contient un marqueur des prix publics observés", () => {
    const files = walk(resolve(ROOT, "src"), isProductSource);
    expect(files.length).toBeGreaterThan(200);
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const marker of MARKERS) if (text.includes(marker)) offenders.push(`${file.replace(ROOT, "")}: ${marker}`);
    }
    expect(offenders).toEqual([]);
  });

  it("ni le référentiel, ni le catalogue de l'atelier n'ont de vocabulaire de prix conseillé, indicatif, par défaut ou prérempli", () => {
    const files = [...CATALOG_SCOPE.flatMap((d) => walk(resolve(ROOT, d), isProductSource)), ...CATALOG_FILES.map((f) => resolve(ROOT, f))]
      // La normalisation cite ces mots dans son journal pour dire qu'ils sont ABSENTS : la ressource, elle, est vérifiée ci-dessous.
      .filter((f) => !f.includes("normalization-journal"));
    expect(files.length).toBeGreaterThan(8);
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const marker of ADVICE_MARKERS) if (text.toLowerCase().includes(marker.toLowerCase())) offenders.push(`${file.replace(ROOT, "")}: ${marker}`);
    }
    expect(offenders).toEqual([]);
  });

  it("le champ « prix » du mini-formulaire part vide : aucun état initial ne le remplit", () => {
    const form = readFileSync(resolve(ROOT, "src/marketplace/pages/binder/quotes/catalog/ServiceForm.tsx"), "utf8");
    expect(form).toMatch(/price: "", \/\/ JAMAIS prérempli/);
    expect(form).not.toMatch(/price:\s*(String|centsToEuro|format)/);
  });

  it("la ressource du référentiel n'a que les champs autorisés — un nouveau champ (a fortiori un prix) fait échouer ce test", async () => {
    const { operations } = await loadReference();
    const ALLOWED = [
      "active", "canonicalName", "confidence", "customerDescription", "customerName", "customerVisible", "domain", "family", "fineBinderyRelevant",
      "gildingRelated", "internalNotes", "interventionModes", "key", "kind", "needsBinderValidation", "pricingModes", "restorationRelated",
      "searchKeywords", "sources", "standalone", "subfamily", "synonyms", "technicalDescription", "unitCandidates", "variantOf", "version",
    ].sort();
    for (const operation of operations) expect(Object.keys(operation).sort(), operation.key).toEqual(ALLOWED);
    // `pricingModes` est un MODE (à l'unité, à l'heure, au forfait, sur devis), jamais un montant.
    for (const operation of operations) for (const mode of operation.pricingModes) expect(["per_unit", "hourly", "fixed", "on_quote"]).toContain(mode);
  });

  it("le script de normalisation ne lit QUE les deux fichiers d'opérations : jamais le fichier de prix, ni celui des matériaux", () => {
    const script = readFileSync(resolve(ROOT, "scripts/buildReliureReference.mjs"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const read = [...script.matchAll(/readBytes\("([^"]+)"\)/g)].map((m) => m[1]).sort();
    expect([...new Set(read)]).toEqual(["operations-relations.json", "operations-reliure.json"]);
    expect(script).not.toMatch(/observed|\.csv|materials-reliure/i);
  });

  it("la migration du catalogue n'a aucune colonne de prix suggéré ni de source de prix", () => {
    const sql = readFileSync(resolve(ROOT, "supabase/migrations/20260921100000_marketplace_binder_reference_links.sql"), "utf8").replace(/^\s*--.*$/gm, "");
    expect(sql).not.toMatch(/price|prix|cents|amount|suggest|recommend/i);
  });

  it("le bundle construit (s'il existe) ne contient aucun marqueur des prix publics ni aucune donnée tarifaire du référentiel", () => {
    const dir = resolve(ROOT, ".output/public/assets");
    if (!existsSync(dir)) return; // construit par `npm run build:mareliure` ; la CI le vérifie après le build
    const files = readdirSync(dir).filter((f) => /\.(js|css)$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const f of files) {
      const text = readFileSync(join(dir, f), "utf8");
      for (const marker of MARKERS) if (text.includes(marker)) offenders.push(`${f}: ${marker}`);
    }
    expect(offenders).toEqual([]);
  });

  it("aucun texte du référentiel ne ressemble à un tarif (« 45 € », « 30 euros de l'heure »)", async () => {
    const { operations, relations, manifest } = await loadReference();
    const text = JSON.stringify({ operations, relations, manifest });
    expect(text).not.toMatch(/\d\s?(€|eur\b|euros?\b)/i);
    expect(text).not.toMatch(/€/);
  });
});
