import { MARELIURE_CANONICAL_HOME } from "@/marketplace/config";
import { EDITORIAL_FONT_PRELOAD, CRAFTS } from "@/marketplace/pages/landing/content";
import { breadcrumbSchema, faqPageSchema, jsonLdScript, MARELIURE_SITE_URL } from "@/lib/structured-data";
import { craftFaq, craftPage, type CraftSlug } from "./craftPages";

/**
 * L'en-tête d'une page par besoin : titre et description écrits pour la
 * recherche, adresse canonique sur mareliure.fr (la même route répond aussi
 * sur l'hôte Fine Bindery), fil d'Ariane et FAQ balisés depuis les mêmes
 * tableaux que ceux que la page affiche.
 */
export function craftHead(slug: CraftSlug) {
  const page = craftPage(slug);
  const url = `${MARELIURE_CANONICAL_HOME}${page.path.slice(1)}`;
  return {
    meta: [
      { title: page.seoTitle },
      { name: "description", content: page.seoDescription },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Ma Reliure" },
      { property: "og:title", content: page.seoTitle },
      { property: "og:description", content: page.seoDescription },
      { property: "og:url", content: url },
      { property: "og:locale", content: "fr_FR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: page.seoTitle },
      { name: "twitter:description", content: page.seoDescription },
    ],
    links: [{ rel: "canonical", href: url }, EDITORIAL_FONT_PRELOAD],
    scripts: [
      jsonLdScript(
        breadcrumbSchema(
          [
            { name: "Les savoir-faire", path: "/#savoir-faire" },
            { name: CRAFTS[page.craftIndex].title, path: page.path },
          ],
          MARELIURE_SITE_URL,
          "Accueil",
        ),
      ),
      jsonLdScript(faqPageSchema(craftFaq(page))),
    ],
  };
}
