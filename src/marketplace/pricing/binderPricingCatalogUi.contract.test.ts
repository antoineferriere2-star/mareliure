import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(fileURLToPath(new URL("../pages/binder/quotes/catalog/PricingCatalogEditor.tsx", import.meta.url)), "utf8");

describe("écran de la grille tarifaire atelier", () => {
  it("présente le catalogue complet et les actions attendues", () => {
    for (const text of ["Mes prestations et mes prix", "Prix personnalisés", "Sur étude", "Ajuster plusieurs tarifs", "Réinitialiser des tarifs", "Revenir au tarif Ma Reliure", "Mes prestations personnalisées"]) expect(source).toContain(text);
  });

  it("utilise des lignes desktop et des cartes sans tableau horizontal sur mobile", () => {
    expect(source).toContain("hidden grid-cols-");
    expect(source).toContain("md:hidden");
    expect(source).not.toContain("overflow-x-auto\"><table");
  });
});
