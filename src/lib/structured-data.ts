// Shared schema.org (JSON-LD) helpers for public routes.
export const SITE_URL = "https://metre-pro.com";
export const SITE_NAME = "Métré Build";

/**
 * No Métré Build-branded mailbox has been provisioned yet (contact messages
 * are currently routed, server-side only, to a legacy off-brand address —
 * see the "to" recipient in src/lib/email-templates/public-contact.tsx).
 * Rather than display that off-brand address publicly, or invent a Métré
 * Build address that may not exist/be monitored, the public surface routes
 * visitors to the /contact form instead. Set this once a real, monitored
 * Métré Build mailbox exists to have it appear in structured data and
 * public copy again.
 */
export const PUBLIC_CONTACT_EMAIL: string | null = null;

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

/** Convenience: a JSON-LD script entry for a TanStack route `head()`. */
export function jsonLdScript(schema: unknown) {
  return {
    type: "application/ld+json",
    children: JSON.stringify(schema),
  };
}
