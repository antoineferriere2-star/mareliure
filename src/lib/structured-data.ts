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

/** Builds a BreadcrumbList starting from the home page. */
export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...items].map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

/**
 * FAQPage for a page that already shows these questions and answers on
 * screen. Google requires the markup to match the visible content, so this
 * only ever takes the same array the page renders from
 * (src/build/content/publicFaq.ts) — never a second, hand-written copy.
 */
export function faqPageSchema(entries: { question: string; answer: string }[]) {
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
