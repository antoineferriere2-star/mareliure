import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { isMaReliure } from "@/brand";
import { MARKETPLACE_BRAND_CONFIGS } from "@/marketplace/brand/brandConfig";
import { resolveMarketplaceBrandForRequest } from "@/marketplace/brand/resolveRequestBrand.server";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

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

/**
 * Ma Reliure et Fine Bindery partagent ce déploiement (audit multi-brand,
 * 12 septembre 2026) mais jamais un sitemap : chaque marque n'a de sens que
 * sous son propre domaine, avec ses propres pages (audit express SEO/GEO,
 * 15 septembre 2026, action commune aux deux — le fichier servait jusqu'ici
 * les URL de metre-pro.com sur les trois domaines, sans distinction).
 */
const MARELIURE_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/tarifs", changefreq: "monthly", priority: "0.8" },
  { path: "/partenaires-relieurs", changefreq: "monthly", priority: "0.7" },
  { path: "/candidature-atelier", changefreq: "monthly", priority: "0.6" },
  { path: "/mentions-legales", changefreq: "yearly", priority: "0.3" },
  { path: "/confidentialite", changefreq: "yearly", priority: "0.3" },
  { path: "/conditions", changefreq: "yearly", priority: "0.3" },
];

const FINE_BINDERY_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  ...(["en", "fr", "de", "it", "es"] as const).flatMap((locale) => [
    { path: `/${locale}`, changefreq: "weekly" as const, priority: locale === "en" ? "1.0" : "0.9" },
    { path: `/${locale}/professionals`, changefreq: "weekly" as const, priority: "0.9" },
  ]),
  { path: "/legal-notice", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms-of-use", changefreq: "yearly", priority: "0.3" },
];

/**
 * One lastmod for the whole file, resolved at request time.
 *
 * A per-page date would be a lie: nothing in the build tracks when each
 * marketing page last changed, and inventing one per URL is exactly the
 * signal crawlers learn to ignore. The build date is true and useful — it is
 * the last moment any of these pages could have changed.
 */
const LAST_MODIFIED = new Date().toISOString().slice(0, 10);

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
            resolvedEntries = [...entries, ...profileEntries];
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
