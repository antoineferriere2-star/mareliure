import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { isMaReliure } from "@/brand";
import { MARKETPLACE_BRAND_CONFIGS } from "@/marketplace/brand/brandConfig";
import { FINE_BINDERY_ENTRIES, MARELIURE_ENTRIES, type SitemapEntry } from "@/marketplace/brand/brandPages";
import { resolveMarketplaceBrandForRequest } from "@/marketplace/brand/resolveRequestBrand.server";

// Public, indexable routes only — authenticated (/build, /portal), API,
// visitor-token and demo-session routes are intentionally excluded.
//
// "Indexable" is the whole rule: a page listed here must not carry noindex.
// /demo/deck-project used to sit in this list while serving
// <meta name="robots" content="noindex">, a contradiction Search Console
// reports as "Submitted URL marked noindex". Both halves were individually
// correct, which is why nothing caught it — sitemap.contract.test.ts does now.
const METRE_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/how-it-works", changefreq: "monthly", priority: "0.8" },
  { path: "/pricing", changefreq: "monthly", priority: "0.8" },
  { path: "/deck-builders", changefreq: "monthly", priority: "0.8" },
  { path: "/example-project-brief", changefreq: "monthly", priority: "0.7" },
  { path: "/free-inquiry-audit", changefreq: "monthly", priority: "0.7" },
  { path: "/private-beta", changefreq: "monthly", priority: "0.7" },
  { path: "/contact", changefreq: "yearly", priority: "0.5" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
];

// Ma Reliure et Fine Bindery partagent ce déploiement (audit multi-brand,
// 12 septembre 2026) mais jamais un sitemap : chaque marque n'a de sens que
// sous son propre domaine, avec ses propres pages (audit express SEO/GEO,
// 15 septembre 2026). Les listes vivent dans brandPages.ts, partagées avec la
// redirection inter-domaines.

/**
 * One lastmod for the whole file: the build date.
 *
 * A per-page date would be a lie: nothing in the build tracks when each
 * marketing page last changed, and inventing one per URL is exactly the
 * signal crawlers learn to ignore. The build date is true and useful — it is
 * the last moment any of these pages could have changed.
 */
//
// Écrite au moment de la construction (vite.config.ts) : dans un Worker, l'horloge
// vaut 0 tant qu'aucune requête n'est en cours, et `new Date()` évalué au chargement
// du module donnait 1970-01-01 sur toutes les URL (constaté le 4 octobre 2026).
const BUILD_DATE = import.meta.env.VITE_BUILD_DATE as string | undefined;
export const LAST_MODIFIED =
  BUILD_DATE && /^\d{4}-\d{2}-\d{2}$/.test(BUILD_DATE) && BUILD_DATE > "2026-01-01"
    ? BUILD_DATE
    : new Date().toISOString().slice(0, 10);

export function sitemapFor(host: string | null): { baseUrl: string; entries: SitemapEntry[] } {
  if (!isMaReliure) return { baseUrl: "https://metre-pro.com", entries: METRE_ENTRIES };
  // Même résolution que le reste de l'app (Host, avec le même repli
  // MARKETPLACE_BRAND_OVERRIDE qu'en local) — jamais une seconde logique de
  // reconnaissance de marque qui pourrait diverger de celle des pages.
  const brand = resolveMarketplaceBrandForRequest(host, process.env.MARKETPLACE_BRAND_OVERRIDE);
  return brand === "FINE_BINDERY"
    ? { baseUrl: MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY.seo.canonicalOrigin, entries: FINE_BINDERY_ENTRIES }
    : { baseUrl: MARKETPLACE_BRAND_CONFIGS.MA_RELIURE.seo.canonicalOrigin, entries: MARELIURE_ENTRIES };
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { baseUrl, entries } = sitemapFor(request.headers.get("host"));
        let resolvedEntries = entries;
        if (baseUrl === MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY.seo.canonicalOrigin) {
          try {
            const { listPublicFineBinderyProfiles } = await import("@/marketplace/services/fineBinderyProfile.data.functions");
            const profiles = await listPublicFineBinderyProfiles();
            const profileEntries = profiles.flatMap((profile) => ["en", "fr", "de", "it", "es"].map((locale) => ({ path: `/${locale}/${profile.slug}`, changefreq: "weekly" as const, priority: "0.8" })));
            // Annuaire vide : ses pages sont en noindex (fineBinderyDirectoryHead),
            // elles ne figurent donc pas au plan du site tant qu'aucun atelier n'est publié.
            const listed = profiles.length === 0 ? entries.filter((entry) => !entry.path.endsWith("/professionals")) : entries;
            resolvedEntries = [...listed, ...profileEntries];
          } catch {
            // The static multilingual pages remain valid if the public
            // directory is temporarily unavailable. The sitemap never emits
            // a guessed workshop URL.
          }
        }
        const urls = resolvedEntries.map((e) =>
          [
            `  <url>`,
            `    <loc>${baseUrl}${e.path}</loc>`,
            `    <lastmod>${LAST_MODIFIED}</lastmod>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=UTF-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
