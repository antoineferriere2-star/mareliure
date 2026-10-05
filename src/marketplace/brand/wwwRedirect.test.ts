import { describe, expect, it } from "vitest";
import { canonicalRedirectUrl } from "./wwwRedirect";

describe("canonicalRedirectUrl", () => {
  it("redirige www.finebindery.com vers finebindery.com, chemin et requête conservés", () => {
    expect(canonicalRedirectUrl("https://www.finebindery.com/legal-notice?x=1")).toBe(
      "https://finebindery.com/legal-notice?x=1",
    );
  });

  it("redirige www.mareliure.fr vers mareliure.fr", () => {
    expect(canonicalRedirectUrl("https://www.mareliure.fr/tarifs")).toBe(
      "https://mareliure.fr/tarifs",
    );
  });

  it("ne redirige pas un hôte déjà canonique", () => {
    expect(canonicalRedirectUrl("https://finebindery.com/")).toBeNull();
    expect(canonicalRedirectUrl("https://mareliure.fr/")).toBeNull();
  });

  it("ne redirige pas un hôte www. inconnu — jamais deviner une marque", () => {
    expect(canonicalRedirectUrl("https://www.example.com/")).toBeNull();
    expect(canonicalRedirectUrl("https://www.metre-pro.com/")).toBeNull();
  });

  it("passe en https les domaines connus, avec ou sans www., en un seul saut", () => {
    expect(canonicalRedirectUrl("http://mareliure.fr/tarifs?x=1")).toBe("https://mareliure.fr/tarifs?x=1");
    expect(canonicalRedirectUrl("http://www.finebindery.com/fr")).toBe("https://finebindery.com/fr");
  });

  it("ne touche jamais au http d'un hôte inconnu (développement local, prévisualisation)", () => {
    expect(canonicalRedirectUrl("http://localhost:8098/")).toBeNull();
    expect(canonicalRedirectUrl("http://example.com/")).toBeNull();
  });

  it("ne jette pas sur une URL malformée", () => {
    expect(canonicalRedirectUrl("not a url")).toBeNull();
  });
});
