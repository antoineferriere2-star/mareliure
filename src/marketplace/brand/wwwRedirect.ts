/**
 * `www.` vers l'apex, pour les seuls domaines marketplace — jamais l'inverse,
 * jamais un domaine inconnu.
 *
 * Cloudflare accepte `www.finebindery.com` et `finebindery.com` comme deux
 * Custom Domains distincts sur le même Worker (même chose pour Ma Reliure) :
 * les deux répondent, sans redirection de l'une vers l'autre. Un visiteur ou
 * un moteur qui atterrit sur la version `www.` — jamais liée nulle part dans
 * ce produit, mais toujours joignable — voit une page dupliquée de celle que
 * le `<link rel="canonical">` désigne déjà comme la bonne (audit express
 * SEO/GEO, 15 septembre 2026, action 4).
 *
 * `KNOWN_APEX_HOSTS` vient de `seo.canonicalOrigin`, jamais d'une déduction
 * "commence par www." : un Host falsifié qui n'appartient à aucune marque
 * connue ne doit jamais recevoir une redirection vers un domaine réel.
 */
import { MARKETPLACE_BRAND_CONFIGS } from "./brandConfig";
import { publicPageOwner, type PageOwner } from "./brandPages";

const APEX_HOST_BY_BRAND: Record<PageOwner, string> = {
  MA_RELIURE: new URL(MARKETPLACE_BRAND_CONFIGS.MA_RELIURE.seo.canonicalOrigin).hostname,
  FINE_BINDERY: new URL(MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY.seo.canonicalOrigin).hostname,
};

const KNOWN_APEX_HOSTS = new Set(
  Object.values(MARKETPLACE_BRAND_CONFIGS).map(
    (config) => new URL(config.seo.canonicalOrigin).hostname,
  ),
);

/**
 * L'adresse canonique d'une requête marketplace : `https://` et sans `www.`,
 * en un seul saut.
 *
 * Le schéma compte autant que l'hôte : `http://mareliure.fr` répondait 200 avec
 * la page entière (constaté le 5 octobre 2026), un double de chaque URL que le
 * `<link rel="canonical">` désigne en `https://`. Cloudflare transmet au Worker
 * le schéma vu par le visiteur, d'où la redirection ici plutôt qu'un réglage de
 * zone qui vivrait hors du dépôt.
 *
 * Deux corrections de chemin s'y ajoutent, constatées dans Search Console le
 * 8 octobre 2026 :
 * - la racine de finebindery.com servait l'accueil anglais en 200, mot pour mot
 *   celui de /en ; malgré le canonical vers /en, Google avait retenu la racine
 *   et laissé /en hors de l'index. Elle redirige désormais vers /en ;
 * - une page propre à une marque (brandPages.ts) demandée sur le domaine de
 *   l'autre redirige vers son domaine : finebindery.com/tarifs servait la page
 *   française de Ma Reliure en 200.
 *
 * `null` quand aucune redirection n'est due — URL déjà canonique, hôte inconnu
 * (localhost, prévisualisation, Host falsifié).
 */
export function canonicalRedirectUrl(requestUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const apex = host.startsWith("www.") ? host.slice(4) : host;
  if (!KNOWN_APEX_HOSTS.has(apex)) return null;
  const owner = publicPageOwner(url.pathname);
  const targetHost = owner ? APEX_HOST_BY_BRAND[owner] : apex;
  const targetPath = targetHost === APEX_HOST_BY_BRAND.FINE_BINDERY && url.pathname === "/" ? "/en" : url.pathname;
  if (host === targetHost && url.protocol === "https:" && targetPath === url.pathname) return null;
  url.protocol = "https:";
  url.hostname = targetHost;
  url.port = "";
  url.pathname = targetPath;
  return url.toString();
}
