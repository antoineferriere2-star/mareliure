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

  it("ne redirige pas une URL déjà canonique", () => {
    expect(canonicalRedirectUrl("https://finebindery.com/en")).toBeNull();
    expect(canonicalRedirectUrl("https://finebindery.com/fr/professionals")).toBeNull();
    expect(canonicalRedirectUrl("https://finebindery.com/legal-notice")).toBeNull();
    expect(canonicalRedirectUrl("https://mareliure.fr/")).toBeNull();
    expect(canonicalRedirectUrl("https://mareliure.fr/tarifs")).toBeNull();
  });

  it("redirige la racine de finebindery.com vers /en, requête conservée", () => {
    expect(canonicalRedirectUrl("https://finebindery.com/")).toBe("https://finebindery.com/en");
    expect(canonicalRedirectUrl("https://finebindery.com/?utm_source=x")).toBe("https://finebindery.com/en?utm_source=x");
    expect(canonicalRedirectUrl("http://www.finebindery.com/")).toBe("https://finebindery.com/en");
  });

  it("renvoie une page propre à une marque vers son domaine", () => {
    expect(canonicalRedirectUrl("https://finebindery.com/tarifs")).toBe("https://mareliure.fr/tarifs");
    expect(canonicalRedirectUrl("https://finebindery.com/partenaires-relieurs")).toBe("https://mareliure.fr/partenaires-relieurs");
    expect(canonicalRedirectUrl("http://www.finebindery.com/mentions-legales")).toBe("https://mareliure.fr/mentions-legales");
    expect(canonicalRedirectUrl("https://mareliure.fr/en")).toBe("https://finebindery.com/en");
    expect(canonicalRedirectUrl("https://mareliure.fr/de/professionals")).toBe("https://finebindery.com/de/professionals");
    expect(canonicalRedirectUrl("https://mareliure.fr/terms-of-sale")).toBe("https://finebindery.com/terms-of-sale");
  });

  it("laisse sur place les pages partagées par les deux marques", () => {
    for (const path of ["/auth", "/portal", "/mes-livres", "/atelier/x", "/_serverFn/abc", "/assets/app.js", "/sitemap.xml", "/english"]) {
      expect(canonicalRedirectUrl(`https://finebindery.com${path}`)).toBeNull();
      expect(canonicalRedirectUrl(`https://mareliure.fr${path}`)).toBeNull();
    }
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
