// Shared schema.org (JSON-LD) helpers for public routes.
export const SITE_URL = "https://metre-pro.com";
export const SITE_NAME = "Métré Build";

/** The real, monitored Métré Build mailbox — single source of truth for
 * every public-facing mention of a contact address (structured data,
 * /contact, Privacy, Terms). Backend delivery (public-contact.tsx) sends
 * here too. */
export const PUBLIC_CONTACT_EMAIL: string | null = "contact@metre-pro.com";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/metre-icon.svg`,
  },
  image: `${SITE_URL}/og-image.png`,
  description:
    "Métré Build turns vague website inquiries into structured Project Briefs for teams that sell configurable projects.",
  ...(PUBLIC_CONTACT_EMAIL ? { email: PUBLIC_CONTACT_EMAIL } : {}),
  sameAs: ["https://www.linkedin.com/in/antoine-ferriere-53113048/"],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "sales",
      url: `${SITE_URL}/contact`,
      ...(PUBLIC_CONTACT_EMAIL ? { email: PUBLIC_CONTACT_EMAIL } : {}),
      availableLanguage: ["en", "es"],
    },
  ],
};

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  inLanguage: "en",
  publisher: { "@id": ORGANIZATION_ID },
};

/**
 * Builds a BreadcrumbList starting from the home page. `baseUrl` defaults to
 * Métré Build's own origin — every existing caller is a Métré route — so a
 * new caller on another domain (Ma Reliure, Fine Bindery) must pass its own
 * explicitly rather than silently inherit metre-pro.com's.
 */
export function breadcrumbSchema(items: { name: string; path: string }[], baseUrl: string = SITE_URL) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...items].map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.path}`,
    })),
  };
}

/**
 * FAQPage for a page that already shows these questions and answers on
 * screen. Google requires the markup to match the visible content, so this
 * only ever takes the same array the page renders from
 * (src/build/content/publicFaq.ts) — never a second, hand-written copy.
 */
export function faqPageSchema(entries: readonly { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

/** Convenience: a JSON-LD script entry for a TanStack route `head()`. */
export function jsonLdScript(schema: unknown) {
  return {
    type: "application/ld+json",
    children: JSON.stringify(schema),
  };
}

// ---------------------------------------------------------------------------
// Ma Reliure
// ---------------------------------------------------------------------------

/**
 * L'identité déclarée aux moteurs par le déploiement Ma Reliure.
 *
 * Elle existe parce que la racine servait `organizationSchema` sans condition :
 * mareliure.fr annonçait à Google être Métré Build, hébergé sur metre-pro.com.
 * Deux marques partagent le code, jamais l'identité.
 *
 * Volontairement minimale. Pas d'adresse, pas de téléphone, pas de note, pas
 * d'effectif : les données structurées sont lues par des machines qui les
 * republient, et une donnée inventée y devient une affirmation publique.
 */
export const MARELIURE_SITE_URL = "https://mareliure.fr";
export const MARELIURE_ORGANIZATION_ID = `${MARELIURE_SITE_URL}/#organization`;
export const MARELIURE_WEBSITE_ID = `${MARELIURE_SITE_URL}/#website`;

export const mareliureOrganizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": MARELIURE_ORGANIZATION_ID,
  name: "Ma Reliure",
  url: `${MARELIURE_SITE_URL}/`,
  logo: {
    "@type": "ImageObject",
    url: `${MARELIURE_SITE_URL}/mareliure-icon.svg`,
  },
  description:
    "Service de reliure, restauration et création de livres, confié à des artisans relieurs indépendants installés en France.",
  areaServed: { "@type": "Country", name: "France" },
} as const;

export const mareliureWebsiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": MARELIURE_WEBSITE_ID,
  name: "Ma Reliure",
  url: `${MARELIURE_SITE_URL}/`,
  inLanguage: "fr-FR",
  publisher: { "@id": MARELIURE_ORGANIZATION_ID },
} as const;

// ---------------------------------------------------------------------------
// Fine Bindery
// ---------------------------------------------------------------------------

/**
 * L'identité déclarée aux moteurs par finebindery.com.
 *
 * Existe parce que la racine servait `mareliureOrganizationSchema` sans
 * condition sur le sous-domaine marketplace : un visiteur anglophone de
 * finebindery.com recevait des données structurées annonçant "Ma Reliure",
 * en français, hébergée sur mareliure.fr (audit express SEO/GEO,
 * 15 septembre 2026, action 1). Même discipline que Ma Reliure : minimale,
 * rien d'inventé.
 */
export const FINE_BINDERY_SITE_URL = "https://finebindery.com";
export const FINE_BINDERY_ORGANIZATION_ID = `${FINE_BINDERY_SITE_URL}/#organization`;
export const FINE_BINDERY_WEBSITE_ID = `${FINE_BINDERY_SITE_URL}/#website`;

export const fineBinderyOrganizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": FINE_BINDERY_ORGANIZATION_ID,
  name: "Fine Bindery",
  url: `${FINE_BINDERY_SITE_URL}/`,
  logo: {
    "@type": "ImageObject",
    url: `${FINE_BINDERY_SITE_URL}/mareliure-icon.svg`,
  },
  description:
    "International concierge for exceptional French bookbinding, restoration and bespoke creation, entrusted to independent workshops in France.",
} as const;

export const fineBinderyWebsiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": FINE_BINDERY_WEBSITE_ID,
  name: "Fine Bindery",
  url: `${FINE_BINDERY_SITE_URL}/`,
  inLanguage: "en-US",
  publisher: { "@id": FINE_BINDERY_ORGANIZATION_ID },
} as const;
