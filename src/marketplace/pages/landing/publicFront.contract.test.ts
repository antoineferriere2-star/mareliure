// Ce que le front public de Ma Reliure ne doit plus perdre (audit du 24 septembre 2026),
// vérifié sur le texte des sources, comme landingHonesty.test.ts.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
/** Les commentaires racontent l'historique (« Page not found »…) : seul le code rendu compte. */
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const METRE_ONLY_ROUTES = ["contact", "how-it-works", "pricing", "deck-builders", "example-project-brief", "free-inquiry-audit", "demo.deck-project", "private-beta", "privacy", "terms"];

describe("les pages de Métré Build sur mareliure.fr", () => {
  it.each(METRE_ONLY_ROUTES)("/%s est introuvable sur le déploiement Ma Reliure", (file) => {
    expect(read(`src/routes/${file}.tsx`)).toContain("beforeLoad: metreOnly");
  });

  it("la garde ne touche aucune page Ma Reliure", () => {
    const guarded = readdirSync(resolve(process.cwd(), "src/routes"))
      .filter((file) => file.endsWith(".tsx") && read(`src/routes/${file}`).includes("beforeLoad: metreOnly"))
      .map((file) => file.replace(/\.tsx$/, ""))
      .sort();
    expect(guarded).toEqual([...METRE_ONLY_ROUTES].sort());
    expect(read("src/lib/metreOnlyRoute.ts")).toContain("if (isMaReliure) throw notFound();");
  });
});

describe("la page introuvable et la page d'erreur", () => {
  const PAGES = stripComments(read("src/marketplace/pages/landing/MaReliureFallbackPages.tsx"));
  const ROOT = read("src/routes/__root.tsx");

  it("sont celles de Ma Reliure, en français, sur ce déploiement", () => {
    expect(ROOT).toContain("if (brand === \"MARELIURE\") return <MaReliureNotFound />;");
    expect(ROOT).toContain("if (brand === \"MARELIURE\") return <MaReliureError onRetry={retry} />;");
    expect(PAGES).toContain("Cette page n'existe pas, ou plus.");
    expect(PAGES).not.toMatch(/Page not found|Go home|Try again/);
  });

  it("offrent les sorties utiles : présenter son livre, les tarifs, l'accueil", () => {
    expect(PAGES).toContain("<IntakeCta />");
    expect(PAGES).toContain('href="/tarifs"');
    expect(PAGES).toContain('href="/"');
  });
});

describe("le pied de page", () => {
  it("n'annonce plus comme à venir des CGV déjà publiées", () => {
    expect(read("src/marketplace/pages/landing/LandingChrome.tsx")).not.toContain("publiées avant l'ouverture du paiement");
  });
});

describe("le vocabulaire des pages lues par les ateliers", () => {
  it.each([
    "src/routes/candidature-atelier.tsx",
    "src/marketplace/pages/partners/PartnersLanding.tsx",
    "src/marketplace/pages/auth/MaReliureAuthPage.tsx",
  ])("%s ne parle ni de leads ni de formulaire", (file) => {
    const text = stripComments(read(file));
    // `lead=` est la prop « chapô » de SectionHead, pas le mot anglais.
    expect(text).not.toMatch(/\bleads\b|\b(le|un|du|des|les|aux) lead\b/i);
    expect(text).not.toMatch(/\bformulaire\b/i);
  });
});

describe("la candidature atelier", () => {
  const ROUTE = read("src/routes/candidature-atelier.tsx");

  it("est rendue côté serveur, puisqu'elle figure au plan du site", () => {
    expect(ROUTE).not.toMatch(/ssr:\s*false/);
    expect(read("src/routes/sitemap[.]xml.ts")).toContain("candidature-atelier");
  });

  it("déclare son adresse canonique", () => {
    expect(ROUTE).toContain('{ rel: "canonical", href: `${MARELIURE_CANONICAL_HOME}candidature-atelier` }');
  });
});

describe("l'image de partage", () => {
  it("existe, est déclarée au registre des images et annoncée par la racine", () => {
    expect(existsSync(resolve(process.cwd(), "public/og/mareliure-1200x630.png"))).toBe(true);
    expect(read("docs/content-assets.md")).toContain("public/og/mareliure-1200x630.png");
    const ROOT = read("src/routes/__root.tsx");
    expect(ROOT).toContain("og/mareliure-1200x630.png");
    expect(ROOT).toContain('{ property: "og:image", content: MARELIURE_OG_IMAGE }');
    expect(ROOT).toContain('{ property: "og:locale", content: "fr_FR" }');
  });
});
