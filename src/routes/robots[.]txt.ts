import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { isMaReliure } from "@/brand";
import { MARKETPLACE_BRAND_CONFIGS } from "@/marketplace/brand/brandConfig";
import { resolveMarketplaceBrandForRequest } from "@/marketplace/brand/resolveRequestBrand.server";

/**
 * Chemins qui ne mènent jamais à une page qu'un moteur doit indexer, quelle
 * que soit la marque servie par ce déploiement (audit express SEO/GEO,
 * 15 septembre 2026) : `/build`, `/portal`, `/marketplace`, `/mes-livres` et
 * `/atelier` sont sous `_authenticated` (routeTree.gen.ts) — un robot qui les
 * visite n'atteint qu'une redirection de connexion, jamais le contenu.
 * Disallow une même règle sur un chemin qui n'existe pas pour telle marque ne
 * coûte rien ; l'omettre coûterait une page de connexion indexée.
 */
const DISALLOW = [
  "/build/",
  "/portal/",
  "/marketplace/",
  "/mes-livres",
  "/atelier/",
  "/auth",
  "/api/",
  "/m/",
  "/project-summary/",
];

export function baseUrlFor(host: string | null): string {
  if (!isMaReliure) return "https://metre-pro.com";
  const brand = resolveMarketplaceBrandForRequest(host, process.env.MARKETPLACE_BRAND_OVERRIDE);
  return MARKETPLACE_BRAND_CONFIGS[brand].seo.canonicalOrigin;
}

function robotsTxt(baseUrl: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    ...DISALLOW.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${baseUrl}/sitemap.xml`,
    "",
  ].join("\n");
}

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const baseUrl = baseUrlFor(request.headers.get("host"));
        return new Response(robotsTxt(baseUrl), {
          headers: {
            "Content-Type": "text/plain; charset=UTF-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
