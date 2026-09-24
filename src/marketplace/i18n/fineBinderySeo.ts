import { fineBinderyCopy } from "./fineBinderyCopy";
import { fineBinderyAlternates, HTML_LOCALE, type FineBinderyLocale } from "./fineBinderyLocale";

const OG_LOCALE: Record<FineBinderyLocale, string> = { en: "en_GB", fr: "fr_FR", de: "de_DE", it: "it_IT", es: "es_ES" };

export function fineBinderyLocalizedHead(locale: FineBinderyLocale, options: { title: string; description: string; pathWithoutLocale?: string; type?: "website" | "profile"; image?: string | null }) {
  const suffix = options.pathWithoutLocale ? `/${options.pathWithoutLocale}` : "";
  const canonical = `https://finebindery.com/${locale}${suffix}`;
  return {
    meta: [
      { title: options.title }, { name: "description", content: options.description }, { name: "robots", content: "index, follow" },
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

export function fineBinderyHomeHead(locale: FineBinderyLocale) {
  const copy = fineBinderyCopy(locale);
  return fineBinderyLocalizedHead(locale, { title: copy.seo.homeTitle, description: copy.seo.homeDescription });
}

export function fineBinderyDirectoryHead(locale: FineBinderyLocale) {
  const copy = fineBinderyCopy(locale);
  return fineBinderyLocalizedHead(locale, { title: copy.seo.directoryTitle, description: copy.seo.directoryDescription, pathWithoutLocale: "professionals" });
}

export function fineBinderyDocumentLanguage(locale: FineBinderyLocale): string { return HTML_LOCALE[locale]; }
