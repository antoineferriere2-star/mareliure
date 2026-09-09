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
    for (const champ of ["title:", "description:", "author:", "icon:", "lang:"])
      expect(code, `${champ} n'est pas décliné par marque`).toContain(champ);
  });

  it("ne sert plus l'icône ni le titre de Métré sans condition", () => {
    // Les valeurs de Métré subsistent — dans la branche qui lui revient.
    const brandBlock = code.slice(code.indexOf("const BRAND"), code.indexOf("function NotFound"));
    expect(brandBlock).toContain("metre-icon.svg");
    expect(brandBlock).toContain("mareliure-icon.svg");
    // Mais plus rien de Métré n'apparaît dans le <head> lui-même.
    const head = code.slice(code.indexOf("head: () => ({"), code.indexOf("shellComponent"));
    expect(head).not.toContain("metre-icon.svg");
    expect(head).not.toMatch(/title:\s*"Métré/);
    expect(head).not.toContain("organizationSchema)");
  });

  it("déclare la langue du document plutôt que de la supposer anglaise", () => {
    expect(code).toContain("<html lang={BRAND.lang}>");
    expect(code).not.toContain('<html lang="en">');
  });
});
