/**
 * Les pages publiques et indexables de chaque marque marketplace.
 *
 * Une seule liste sert deux usages qui ne doivent jamais diverger : le plan du
 * site de chaque domaine (routes/sitemap[.]xml.ts) et la redirection d'une page
 * demandée sur le domaine de l'autre marque (wwwRedirect.ts). Le même Worker
 * répond sur les deux domaines : sans cette redirection, finebindery.com/tarifs
 * servait la page française de Ma Reliure en 200, avec un canonical vers
 * mareliure.fr que Google traite comme un simple indice (Search Console,
 * 8 octobre 2026).
 */
import { FINE_BINDERY_LOCALES } from "@/marketplace/i18n/fineBinderyLocale";

export interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const MARELIURE_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/tarifs", changefreq: "monthly", priority: "0.8" },
  // Les pages par besoin (pages/crafts/craftPages.ts).
  { path: "/reparation-de-livres", changefreq: "monthly", priority: "0.8" },
  { path: "/restauration-de-livres-anciens", changefreq: "monthly", priority: "0.8" },
  { path: "/reliure-de-livres", changefreq: "monthly", priority: "0.8" },
  { path: "/dorure-et-finitions", changefreq: "monthly", priority: "0.8" },
  { path: "/reliure-de-creation", changefreq: "monthly", priority: "0.8" },
  { path: "/etuis-et-boites", changefreq: "monthly", priority: "0.8" },
  { path: "/partenaires-relieurs", changefreq: "monthly", priority: "0.7" },
  { path: "/candidature-atelier", changefreq: "monthly", priority: "0.6" },
  { path: "/mentions-legales", changefreq: "yearly", priority: "0.3" },
  { path: "/confidentialite", changefreq: "yearly", priority: "0.3" },
  { path: "/conditions", changefreq: "yearly", priority: "0.3" },
  { path: "/conditions-generales-de-vente", changefreq: "yearly", priority: "0.3" },
];

// La racine de finebindery.com redirige vers /en (wwwRedirect.ts) : elle n'est
// pas listée.
export const FINE_BINDERY_ENTRIES: SitemapEntry[] = [
  ...FINE_BINDERY_LOCALES.flatMap((locale) => [
    { path: `/${locale}`, changefreq: "weekly" as const, priority: locale === "en" ? "1.0" : "0.9" },
    { path: `/${locale}/professionals`, changefreq: "weekly" as const, priority: "0.9" },
  ]),
  { path: "/legal-notice", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms-of-use", changefreq: "yearly", priority: "0.3" },
  { path: "/terms-of-sale", changefreq: "yearly", priority: "0.3" },
];

export type PageOwner = "MA_RELIURE" | "FINE_BINDERY";

const MARELIURE_ONLY_PATHS = new Set(MARELIURE_ENTRIES.map((entry) => entry.path).filter((path) => path !== "/"));
const FINE_BINDERY_ONLY_PATHS = new Set(FINE_BINDERY_ENTRIES.map((entry) => entry.path));
// /en, /fr/professionals, /de/<atelier>… : tout chemin ouvert par une langue
// appartient à Fine Bindery (routes/$locale.*).
const FINE_BINDERY_LOCALE_PREFIX = new RegExp(`^/(${FINE_BINDERY_LOCALES.join("|")})(/|$)`);

/**
 * La marque à laquelle appartient une page publique, ou `null` pour tout ce qui
 * est partagé ou hors périmètre : la racine, /auth, /portal, les fonctions
 * serveur, les ressources statiques. Ne jamais deviner : une page absente de
 * ces listes n'est jamais redirigée.
 */
export function publicPageOwner(pathname: string): PageOwner | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (MARELIURE_ONLY_PATHS.has(path)) return "MA_RELIURE";
  if (FINE_BINDERY_ONLY_PATHS.has(path) || FINE_BINDERY_LOCALE_PREFIX.test(path)) return "FINE_BINDERY";
  return null;
}
