import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PUBLIC_BRAND, PUBLIC_BRANDS, resolvePublicBrand } from "./brand";

describe("which brand a deployment serves", () => {
  it("defaults to Métré, so an unset variable changes nothing", () => {
    // Every existing Métré Build deployment has no VITE_PUBLIC_BRAND. Adding
    // this switch must be invisible to all of them.
    expect(DEFAULT_PUBLIC_BRAND).toBe("metre");
    expect(resolvePublicBrand(undefined)).toBe("metre");
    expect(resolvePublicBrand("")).toBe("metre");
  });

  it("recognises the brands it actually ships", () => {
    expect(PUBLIC_BRANDS).toEqual(["metre", "mareliure"]);
    expect(resolvePublicBrand("mareliure")).toBe("mareliure");
    expect(resolvePublicBrand("metre")).toBe("metre");
  });

  it("falls back rather than throwing on a value it does not know", () => {
    // A typo in a deployment variable must serve the default homepage, not a
    // 500. Wrong content is noticed in seconds; a crashed root route at 3am is
    // an outage.
    expect(resolvePublicBrand("mareliure ")).toBe("metre");
    expect(resolvePublicBrand("MaReliure")).toBe("metre");
    expect(resolvePublicBrand(null)).toBe("metre");
    expect(resolvePublicBrand(42)).toBe("metre");
    expect(() => resolvePublicBrand({ brand: "mareliure" })).not.toThrow();
  });
});

/**
 * La racine du document servait l'identité de Métré sur les deux marques.
 *
 * Rien ne le signalait à la lecture d'une page Ma Reliure : le titre, l'icône,
 * la langue et les données structurées vivent dans `__root.tsx`, qu'on n'ouvre
 * jamais en travaillant sur la landing. Il a fallu qu'un visiteur remarque
 * l'icône Métré dans l'onglet de mareliure.fr.
 *
 * Ce test lit le fichier plutôt que le rendu, parce que la faute est
 * précisément une valeur écrite en dur : elle se voit dans le texte, et pas
 * dans un composant qu'on rend avec la bonne marque active.
 */
describe("la racine du document ne code aucune marque en dur", () => {
  const root = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
  const code = root.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("choisit son identité selon la marque déployée", () => {
    expect(code).toContain("isMaReliure");
    for (const champ of ["title:", "description:", "author:", "icons:", "lang:"])
      expect(code, `${champ} n'est pas décliné par marque`).toContain(champ);
  });

  /**
   * Ma Reliure et Fine Bindery partagent ce déploiement (`isMaReliure` seul
   * ne les distingue pas) — la racine doit donc trancher un cran plus bas,
   * par requête, comme `routes/index.tsx` le fait déjà (audit express
   * SEO/GEO, 15 septembre 2026, actions 1 et 3 : la racine servait le lang,
   * l'icône et les données structurées de Ma Reliure à Fine Bindery aussi).
   */
  it("résout aussi la marque marketplace, pas seulement isMaReliure vs Métré", () => {
    expect(code).toContain("getRequestMarketplaceBrand");
    expect(code).toContain("fineBinderyOrganizationSchema");
    expect(code).toContain("fineBinderyWebsiteSchema");
    expect(code).toMatch(/FINE_BINDERY_BRAND\s*=\s*\{/);
  });

  it("ne sert plus l'icône ni le titre de Métré sans condition", () => {
    // Les valeurs de Métré subsistent — dans la constante qui lui revient.
    const brandBlock = code.slice(code.indexOf("const METRE_BRAND"), code.indexOf("function NotFound"));
    expect(brandBlock).toContain("metre-icon.svg");
    expect(brandBlock).toContain('brandIcons("mareliure")');
    // Mais plus rien de Métré n'apparaît dans le <head> lui-même : il ne lit
    // plus que `BRAND.*`, résolu par requête (rootBrand), jamais une marque
    // écrite en dur.
    const head = code.slice(code.indexOf("head: ("), code.indexOf("shellComponent"));
    expect(head).not.toContain("metre-icon.svg");
    expect(head).not.toMatch(/title:\s*"Métré/);
    expect(head).not.toContain("organizationSchema)");
  });

  /**
   * Sur la garantie, pas sur l'orthographe : la première version cherchait
   * `<html lang={BRAND.lang}>` mot pour mot et a cassé en ajoutant un
   * `className` sur la même balise. Un test qui tombe quand on ajoute un
   * attribut ne protège pas la langue, il protège une ligne.
   */
  it("déclare la langue du document plutôt que de la supposer anglaise", () => {
    expect(code).toMatch(/<html[^>]*lang=\{BRAND\.lang\}/);
    expect(code).not.toMatch(/<html[^>]*lang="en"/);
  });

  /** L'habillage du tunnel descend du document, pas d'une page. */
  it("porte la classe de thème qui habille le tunnel", () => {
    expect(code).toMatch(/<html[^>]*className=\{BRAND\.themeClass\}/);
    expect(code).toContain('themeClass: "brand-mareliure"');
  });
});

/**
 * Fine Bindery servait l'icône de Ma Reliure : les deux marques partagent le
 * même déploiement, donc le même dossier public. Chaque marque a désormais
 * son dossier d'icônes, et la racine déclare celui de la marque résolue.
 */
describe("chaque marque marketplace sert ses propres icônes", () => {
  const root = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
  const block = (name: string) => root.slice(root.indexOf(`const ${name} = {`), root.indexOf("};", root.indexOf(`const ${name} = {`)));
  const FILES = ["favicon.svg", "favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "site.webmanifest"];

  it("déclare le dossier de sa marque, pas celui de l'autre", () => {
    expect(block("MARELIURE_BRAND")).toContain('brandIcons("mareliure")');
    expect(block("FINE_BINDERY_BRAND")).toContain('brandIcons("finebindery")');
    expect(block("FINE_BINDERY_BRAND")).not.toContain('brandIcons("mareliure")');
    expect(block("FINE_BINDERY_BRAND")).not.toContain("mareliure-icon");
  });

  for (const brand of ["mareliure", "finebindery"]) {
    it(`publie toutes les déclinaisons de ${brand}`, () => {
      for (const file of FILES) {
        const bytes = readFileSync(resolve(process.cwd(), "public/icons", brand, file));
        expect(bytes.length, `${brand}/${file} est vide`).toBeGreaterThan(0);
      }
      const ico = readFileSync(resolve(process.cwd(), "public/icons", brand, "favicon.ico"));
      // En-tête ICO : réservé 0, type 1, trois images (16, 32, 48).
      expect([ico.readUInt16LE(0), ico.readUInt16LE(2), ico.readUInt16LE(4)]).toEqual([0, 1, 3]);
      const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "public/icons", brand, "site.webmanifest"), "utf8"));
      for (const icon of manifest.icons) expect(icon.src).toMatch(new RegExp(`^/icons/${brand}/`));
    });
  }

  it("dessine deux icônes différentes", () => {
    const svg = (brand: string) => readFileSync(resolve(process.cwd(), "public/icons", brand, "favicon.svg"), "utf8");
    expect(svg("mareliure")).not.toEqual(svg("finebindery"));
  });
});
