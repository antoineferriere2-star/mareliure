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
    "Métré Build turns vague website inquiries into structured Project Briefs for project-based contractors.",
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
