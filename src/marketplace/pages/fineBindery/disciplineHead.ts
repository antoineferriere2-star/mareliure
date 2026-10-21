import { faqPageSchema, jsonLdScript } from "@/lib/structured-data";
import { fineBinderyHeadCopy } from "@/marketplace/i18n/fineBinderyHeadCopy";
import { fineBinderyCopy } from "@/marketplace/i18n/fineBinderyCopy";
import type { FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { fineBinderyLocalizedHead } from "@/marketplace/i18n/fineBinderySeo";
import { discipline, type DisciplineSlug } from "./disciplines";

/**
 * En-tête d'une page par discipline : titre et description de la langue, canonique et alternatives
 * hreflang sur le chemin commun, fil d'Ariane et questions balisés depuis les tableaux affichés.
 */
export function fineBinderyDisciplineHead(locale: FineBinderyLocale, slug: DisciplineSlug) {
  const page = discipline(slug);
  const offer = fineBinderyCopy(locale).home.offers[page.offerIndex];
  return {
    ...fineBinderyLocalizedHead(locale, { title: page.seoTitle[locale], description: page.seoDescription[locale], pathWithoutLocale: slug }),
    scripts: [
      jsonLdScript({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Fine Bindery", item: `https://finebindery.com/${locale}` },
        { "@type": "ListItem", position: 2, name: offer.title, item: `https://finebindery.com/${locale}/${slug}` },
      ] }),
      jsonLdScript(faqPageSchema(fineBinderyHeadCopy(locale).faq)),
    ],
  };
}
