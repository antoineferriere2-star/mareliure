import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { BuildPublicHome } from "@/build/pages/public/BuildPublicHome";
import { ReliureLanding } from "@/marketplace/pages/ReliureLanding";
import { FineBinderyLandingPage } from "@/marketplace/pages/fineBindery/FineBinderyLanding";
import { jsonLdScript, ORGANIZATION_ID, SITE_URL, WEBSITE_ID } from "@/lib/structured-data";
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

const reliureTitle = "Ma Reliure — Reliure et restauration de livres";
const reliureDescription =
  "Confiez votre livre à l'artisan adapté à votre projet de reliure, restauration ou transformation.";

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
  "The international concierge for exceptional French bookbinding. Entrust your book to selected independent workshops in France — Fine Bindery manages every step.";

function fineBinderyHead() {
  const canonical = MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY.seo.canonicalOrigin;
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

// Supabase's configured Site URL sends magic-link / email-confirmation
// redirects here instead of the app page we requested via `emailRedirectTo`
// (its Redirect URLs allowlist needs that page added - a dashboard config
// fix, not something this code can control). Until then, catch a stray
// unprocessed session token in the hash and hand it to /auth, which already
// knows how to detect the session and route to /build or /portal.
function HomeRoute() {
  const { brand } = Route.useLoaderData();
  useEffect(() => {
    if (window.location.hash.includes("access_token")) {
      window.location.replace(`/auth${window.location.hash}`);
    }
  }, []);
  if (!isMaReliure) return <BuildPublicHome />;
  return brand === "FINE_BINDERY" ? <FineBinderyLandingPage /> : <ReliureLanding />;
}
