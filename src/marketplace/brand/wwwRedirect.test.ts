import { describe, expect, it } from "vitest";
import { wwwToApexRedirectUrl } from "./wwwRedirect";

describe("wwwToApexRedirectUrl", () => {
  it("redirige www.finebindery.com vers finebindery.com, chemin et requête conservés", () => {
    expect(wwwToApexRedirectUrl("https://www.finebindery.com/legal-notice?x=1")).toBe(
      "https://finebindery.com/legal-notice?x=1",
    );
  });

  it("redirige www.mareliure.fr vers mareliure.fr", () => {
    expect(wwwToApexRedirectUrl("https://www.mareliure.fr/tarifs")).toBe(
      "https://mareliure.fr/tarifs",
    );
  });

  it("ne redirige pas un hôte déjà canonique", () => {
    expect(wwwToApexRedirectUrl("https://finebindery.com/")).toBeNull();
    expect(wwwToApexRedirectUrl("https://mareliure.fr/")).toBeNull();
  });

  it("ne redirige pas un hôte www. inconnu — jamais deviner une marque", () => {
    expect(wwwToApexRedirectUrl("https://www.example.com/")).toBeNull();
    expect(wwwToApexRedirectUrl("https://www.metre-pro.com/")).toBeNull();
  });

  it("ne jette pas sur une URL malformée", () => {
    expect(wwwToApexRedirectUrl("not a url")).toBeNull();
  });
});
