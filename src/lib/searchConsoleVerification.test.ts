import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Fichier de validation Google Search Console (compte contact@oppe.fr), servi à la racine
// de mareliure.fr et de finebindery.com. Le supprimer retire le statut de propriétaire.
describe("la validation Search Console", () => {
  it("reste publiée, au format attendu par Google", () => {
    expect(readFileSync(resolve(process.cwd(), "public/googleb5cce85083e70ff1.html"), "utf8")).toBe(
      "google-site-verification: googleb5cce85083e70ff1.html",
    );
  });
});
