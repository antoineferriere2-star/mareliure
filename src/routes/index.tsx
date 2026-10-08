import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useForwardStrayAuthHash } from "@/hooks/use-forward-stray-auth-hash";
import { ReliureLanding } from "@/marketplace/pages/ReliureLanding";
import { FineBinderyLandingPage } from "@/marketplace/pages/fineBindery/FineBinderyLanding";
import { faqPageSchema, jsonLdScript, ORGANIZATION_ID, SITE_URL, WEBSITE_ID } from "@/lib/structured-data";
import { fineBinderyCopy } from "@/marketplace/i18n/fineBinderyCopy";
import { isMaReliure } from "@/brand";
import { MARELIURE_CANONICAL_HOME } from "@/marketplace/config";
import { MARKETPLACE_BRAND_CONFIGS, type MarketplaceBrand } from "@/marketplace/brand/brandConfig";
import { getRequestMarketplaceBrand } from "@/marketplace/brand/resolveRequestBrand.server";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";

/**
 * The root of whichever brand this deployment serves — see `src/brand.ts`.
 *
 * On a Ma Reliure deployment `/` *is* the marketplace homepage: no redirect to
 * /reliure, so the canonical stays `https://mareliure.fr/` and the first page a
 * visitor loads costs no extra round trip. On every other deployment this is
 * unchanged Métré Build.
 *
 * `isMaReliure` is a build-time constant, so the branch the deployment does not
 * take is dropped by the bundler rather than shipped and skipped.
 */

const metreTitle = "Qualify Contractor Leads Before the First Call — Métré Build";
const metreDescription =
  "Contractors lose the first call rediscovering the project. A guided intake collects scope, dimensions, photos and budget first. See a real brief.";

// Titre et description recomposés pour la recherche (octobre 2026) : les mots
// que tape quelqu'un qui cherche — reliure, restauration, relieur — et ce qui
// distingue le service, partout en France, prix annoncé avant engagement.
const reliureTitle = "Reliure et restauration de livres par des artisans — Ma Reliure";
const reliureDescription =
  "Réparation, restauration, reliure ou création : présentez votre livre en quelques minutes. Ma Reliure le confie à l'artisan relieur adapté, partout en France.";

function maReliureHead() {
  return {
    meta: [
      { title: reliureTitle },
      { name: "description", content: reliureDescription },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Ma Reliure" },
      { property: "og:title", content: reliureTitle },
      { property: "og:description", content: reliureDescription },
      { property: "og:url", content: MARELIURE_CANONICAL_HOME },
      { property: "og:locale", content: "fr_FR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: reliureTitle },
      { name: "twitter:description", content: reliureDescription },
    ],
    links: [{ rel: "canonical", href: MARELIURE_CANONICAL_HOME }, EDITORIAL_FONT_PRELOAD],
  };
}

function metreHead() {
  return {
    meta: [
      { title: metreTitle },
      { name: "description", content: metreDescription },
      { property: "og:title", content: metreTitle },
      { property: "og:description", content: metreDescription },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:image", content: `${SITE_URL}/og-image.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: metreTitle },
      { name: "twitter:description", content: metreDescription },
      { name: "twitter:image", content: `${SITE_URL}/og-image.png` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [
      jsonLdScript({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#software`,
        name: "Métré Build",
        url: `${SITE_URL}/`,
        image: `${SITE_URL}/og-image.png`,
        description: metreDescription,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: {
          "@type": "Offer",
          price: "19.99",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          url: `${SITE_URL}/private-beta`,
        },
        publisher: { "@id": ORGANIZATION_ID },
        isPartOf: { "@id": WEBSITE_ID },
      }),
    ],
  };
}

const fineBinderyTitle = "Fine Bindery — Exceptional French Bookbinding";
const fineBinderyDescription =
  "The European network for bookbinding and book conservation. Discover independent ateliers, present your project and work with the right one — opening in France.";

/**
 * La racine de finebindery.com affiche l'accueil anglais, mot pour mot celui de
 * /en. En production elle redirige en 301 vers /en (wwwRedirect.ts) : le seul
 * canonical n'avait pas suffi, Google avait retenu la racine et laissé /en
 * hors de l'index (8 octobre 2026). Cet en-tête ne sert plus qu'en local et
 * en prévisualisation, où l'hôte n'est pas un domaine de marque.
 */
function fineBinderyHead() {
  const canonical = `${MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY.seo.canonicalOrigin}/en`;
  return {
    meta: [
      { title: fineBinderyTitle },
      { name: "description", content: fineBinderyDescription },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Fine Bindery" },
      { property: "og:title", content: fineBinderyTitle },
      { property: "og:description", content: fineBinderyDescription },
      { property: "og:url", content: canonical },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: fineBinderyTitle },
      { name: "twitter:description", content: fineBinderyDescription },
    ],
    links: [{ rel: "canonical", href: canonical }, EDITORIAL_FONT_PRELOAD],
    // Les 8 questions de la section "Questions, answered" — le même tableau
    // que FineBinderyLandingPage rend, jamais une copie à part qui pourrait
    // diverger (audit express SEO/GEO, 15 septembre 2026, action 5).
    scripts: [jsonLdScript(faqPageSchema(fineBinderyCopy("en").home.faq))],
  };
}

async function loadHomeBrand(): Promise<MarketplaceBrand | null> {
  // Only the marketplace deployment ever has two brands to tell apart — on
  // the Métré deployment `isMaReliure` is `false` at build time, and this
  // branch (along with the server round-trip it would otherwise make) is
  // dropped by the bundler rather than shipped and skipped.
  return isMaReliure ? getRequestMarketplaceBrand() : null;
}

export const Route = createFileRoute("/")({
  loader: async () => ({ brand: await loadHomeBrand() }),
  head: ({ loaderData }) => {
    if (!isMaReliure) return metreHead();
    return loaderData?.brand === "FINE_BINDERY" ? fineBinderyHead() : maReliureHead();
  },
  component: HomeRoute,
});

/**
 * La page d'accueil Métré Build, chargée à la demande. Importée statiquement,
 * elle et ses démos (icônes, Project Canvas, schéma de Playbook) restaient dans
 * le paquet de l'accueil Ma Reliure : leurs effets de bord au chargement
 * empêchaient l'élagage, même une fois la branche Métré repliée.
 */
const BuildPublicHome = lazy(() =>
  import("@/build/pages/public/BuildPublicHome").then((module) => ({ default: module.BuildPublicHome })),
);

function HomeRoute() {
  const { brand } = Route.useLoaderData();
  useForwardStrayAuthHash();
  if (!isMaReliure) return <Suspense fallback={null}><BuildPublicHome /></Suspense>;
  return brand === "FINE_BINDERY" ? <FineBinderyLandingPage /> : <ReliureLanding />;
}
