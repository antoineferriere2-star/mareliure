import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// La résolution HTTP réelle (fetch /sitemap.xml) dépend de la façon dont
// Nitro propage process.env aux routes server.handlers en dev — repli
// documenté sur un test direct de la logique pure plutôt qu'un aller-retour
// HTTP local fragile.
const brand = vi.hoisted(() => ({ isMaReliure: true }));
vi.mock("@/brand", () => ({
  get isMaReliure() {
    return brand.isMaReliure;
  },
}));

const { sitemapFor } = await import("./sitemap[.]xml");

beforeEach(() => {
  brand.isMaReliure = true;
  vi.unstubAllEnvs();
});
afterEach(() => vi.unstubAllEnvs());

describe("sitemapFor", () => {
  it("sert les URL de metre-pro.com sur le déploiement Métré, quel que soit le Host", () => {
    brand.isMaReliure = false;
    const { baseUrl, entries } = sitemapFor("finebindery.com");
    expect(baseUrl).toBe("https://metre-pro.com");
    expect(entries.some((e) => e.path === "/pricing")).toBe(true);
  });

  it("sert les pages de Ma Reliure sur mareliure.fr", () => {
    const { baseUrl, entries } = sitemapFor("mareliure.fr");
    expect(baseUrl).toBe("https://mareliure.fr");
    expect(entries.map((e) => e.path)).toEqual([
      "/",
      "/tarifs",
      "/partenaires-relieurs",
      "/candidature-atelier",
      "/mentions-legales",
      "/confidentialite",
      "/conditions",
    ]);
  });

  it("sert les pages de Fine Bindery sur finebindery.com, jamais les pages de Ma Reliure", () => {
    const { baseUrl, entries } = sitemapFor("www.finebindery.com");
    expect(baseUrl).toBe("https://finebindery.com");
    expect(entries.map((e) => e.path)).toEqual([
      "/",
      "/professionnels",
      "/legal-notice",
      "/privacy-policy",
      "/terms-of-use",
    ]);
  });

  it("retombe sur Ma Reliure pour un Host marketplace inconnu (localhost, prévisualisation)", () => {
    expect(sitemapFor("localhost:8080").baseUrl).toBe("https://mareliure.fr");
  });

  it("respecte MARKETPLACE_BRAND_OVERRIDE, comme le reste de la résolution de marque", () => {
    vi.stubEnv("MARKETPLACE_BRAND_OVERRIDE", "FINE_BINDERY");
    expect(sitemapFor("localhost:8080").baseUrl).toBe("https://finebindery.com");
  });
});
