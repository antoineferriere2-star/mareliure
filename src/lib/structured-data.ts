// Shared schema.org (JSON-LD) helpers for public routes.
export const SITE_URL = "https://metre-pro.com";
export const SITE_NAME = "Métré Build";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/metre-icon.svg`,
  description:
    "Métré Build turns vague website inquiries into sales-ready project briefs for project-based businesses.",
  email: "contact@oppe.fr",
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "sales",
      email: "contact@oppe.fr",
      availableLanguage: ["en", "fr"],
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
    itemListElement: [{ name: "Home", path: "/" }, ...items].map(
      (item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: `${SITE_URL}${item.path}`,
      }),
    ),
  };
}

/** Convenience: a JSON-LD script entry for a TanStack route `head()`. */
export function jsonLdScript(schema: unknown) {
  return {
    type: "application/ld+json",
    children: JSON.stringify(schema),
  };
}
