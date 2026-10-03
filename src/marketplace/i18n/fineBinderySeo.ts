import { faqPageSchema, jsonLdScript } from "@/lib/structured-data";
import { fineBinderyCopy } from "./fineBinderyCopy";
import { fineBinderyAlternates, HTML_LOCALE, type FineBinderyLocale } from "./fineBinderyLocale";

const OG_LOCALE: Record<FineBinderyLocale, string> = { en: "en_GB", fr: "fr_FR", de: "de_DE", it: "it_IT", es: "es_ES" };

export function fineBinderyLocalizedHead(locale: FineBinderyLocale, options: { title: string; description: string; pathWithoutLocale?: string; type?: "website" | "profile"; image?: string | null; noindex?: boolean }) {
  const suffix = options.pathWithoutLocale ? `/${options.pathWithoutLocale}` : "";
  const canonical = `https://finebindery.com/${locale}${suffix}`;
  return {
    meta: [
      { title: options.title }, { name: "description", content: options.description }, { name: "robots", content: options.noindex ? "noindex, follow" : "index, follow" },
      { property: "og:type", content: options.type ?? "website" }, { property: "og:site_name", content: "Fine Bindery" },
      { property: "og:title", content: options.title }, { property: "og:description", content: options.description },
      { property: "og:url", content: canonical }, { property: "og:locale", content: OG_LOCALE[locale] },
      ...fineBinderyAlternates(options.pathWithoutLocale).filter((item) => item.locale !== locale && item.locale !== "x-default").map((item) => ({ property: "og:locale:alternate", content: OG_LOCALE[item.locale as FineBinderyLocale] })),
      ...(options.image ? [{ property: "og:image", content: options.image }] : []),
    ],
    links: [
      { rel: "canonical", href: canonical },
      ...fineBinderyAlternates(options.pathWithoutLocale).map((item) => ({ rel: "alternate", hrefLang: item.locale, href: item.href })),
    ],
  };
}

/** L'accueil affiche ses questions fréquentes : le balisage reprend le même tableau, dans la langue de la page. */
export function fineBinderyHomeHead(locale: FineBinderyLocale) {
  const copy = fineBinderyCopy(locale);
  return { ...fineBinderyLocalizedHead(locale, { title: copy.seo.homeTitle, description: copy.seo.homeDescription }), scripts: [jsonLdScript(faqPageSchema(copy.home.faq))] };
}

/**
 * Fil d'Ariane localisé : l'accueil de la langue, puis l'annuaire.
 * Tant qu'aucun atelier n'est publié, l'annuaire n'est qu'une page d'attente
 * d'une centaine de mots, dans cinq langues : `noindex` pour ne pas présenter
 * aux moteurs cinq pages vides. Elle redevient indexable dès le premier atelier.
 */
export function fineBinderyDirectoryHead(locale: FineBinderyLocale, options: { empty?: boolean } = {}) {
  const copy = fineBinderyCopy(locale);
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Fine Bindery", item: `https://finebindery.com/${locale}` },
    { "@type": "ListItem", position: 2, name: copy.nav.workshops, item: `https://finebindery.com/${locale}/professionals` },
  ] };
  return { ...fineBinderyLocalizedHead(locale, { title: copy.seo.directoryTitle, description: copy.seo.directoryDescription, pathWithoutLocale: "professionals", noindex: options.empty }), scripts: [jsonLdScript(breadcrumb)] };
}

export function fineBinderyDocumentLanguage(locale: FineBinderyLocale): string { return HTML_LOCALE[locale]; }
