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

describe("lot 2 — filet, entête mobile, contrastes", () => {
  const walk = (dir: string): string[] =>
    readdirSync(resolve(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(`${dir}/${entry.name}`) : /\.(tsx?|css)$/.test(entry.name) ? [`${dir}/${entry.name}`] : [],
    );

  it("n'emploie plus aucune couleur mr-brass, retirée de la palette : un filet invisible n'est pas un filet", () => {
    const offenders = walk("src").filter((file) => !file.endsWith(".test.ts") && /\bmr-brass\b/.test(read(file)));
    expect(offenders).toEqual([]);
    expect(read("src/marketplace/pages/landing/LandingChrome.tsx")).toContain('className="mt-1.5 h-px w-8 bg-mr-bordeaux"');
    // Parcourt tout `src/` : ~1 s seul, bien plus sous une suite complète chargée.
  }, 30_000);

  it("propose Tarifs et l'accès au compte dans l'entête mobile", () => {
    const CHROME = read("src/marketplace/pages/landing/LandingChrome.tsx");
    const mobileNav = CHROME.slice(CHROME.indexOf('aria-label="Navigation mobile"'));
    expect(mobileNav).toContain('className="border-t border-mr-rule/70 lg:hidden"');
    expect(mobileNav.slice(0, 600)).toContain('href="/tarifs"');
    expect(mobileNav.slice(0, 600)).toContain('href="/auth"');
  });

  it.each([
    "src/marketplace/pages/TarifsPage.tsx",
    "src/marketplace/pages/ReliureLanding.tsx",
    "src/marketplace/pages/partners/PartnersLanding.tsx",
    "src/marketplace/pages/landing/LandingChrome.tsx",
  ])("%s n'écrit aucun texte sous 50 %% d'encre (contraste < 4,5:1 sur le papier)", (file) => {
    expect(read(file)).not.toMatch(/\btext-mr-(ink|graphite)\/[1-4]\d\b/);
  });
});

describe("refonte des sites publics — captures produit et Fine Bindery", () => {
  it("chaque capture de l'espace atelier existe en deux largeurs et figure au registre des images", async () => {
    const { PRODUCT_SHOTS } = await import("./ProductShot");
    const registry = read("docs/content-assets.md");
    for (const shot of Object.values(PRODUCT_SHOTS)) {
      for (const size of ["960", "1600"]) {
        expect(existsSync(resolve(process.cwd(), `public/photos/product/${shot.file}-${size}.webp`)), `${shot.file}-${size}`).toBe(true);
      }
      expect(registry).toContain(shot.file);
    }
  });

  it("les boutons publics passent par une seule grammaire (actions.tsx)", () => {
    expect(read("src/marketplace/pages/landing/LandingChrome.tsx")).toContain("actionClass(");
    expect(read("src/marketplace/pages/fineBindery/FineBinderyChrome.tsx")).toContain("actionClass(");
  });

  it.each([
    "src/marketplace/pages/fineBindery/FineBinderyLanding.tsx",
    "src/marketplace/pages/fineBindery/PublicWorkshopPages.tsx",
  ])("%s habille ses pages de la palette Fine Bindery, sans couleur codée en dur", (file) => {
    const source = read(file);
    expect(source).toContain("fb-site");
    expect(source).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });

  it.each(["en", "fr", "de", "it", "es"])("Fine Bindery (%s) dit que le réseau ouvre en France, et ne parle plus de conciergerie", async (locale) => {
    const { fineBinderyCopy } = await import("@/marketplace/i18n/fineBinderyCopy");
    const copy = fineBinderyCopy(locale as never);
    expect(copy.home.networkNote.length).toBeGreaterThan(40);
    expect(copy.directory.openingNote).toBe(copy.home.networkNote);
    expect(JSON.stringify(copy)).not.toMatch(/concierge|conciergerie|Concierge|conserjer/i);
    expect(copy.home.paths).toHaveLength(2);
  });

  it("la page relieurs parle de projets Ma Reliure, jamais de « leads »", () => {
    expect(read("src/marketplace/pages/landing/partnersContent.ts")).not.toMatch(/\bLeads?\b/);
    expect(read("src/marketplace/pages/partners/PartnersLanding.tsx")).not.toMatch(/\bLeads?\b/);
  });
});
