/**
 * Mise en pause des sites publics (9 novembre 2026, demande d'Antoine : couper Ma Reliure et Fine
 * Bindery temporairement, durée inconnue).
 *
 * Activée par la variable du Worker `MAINTENANCE_MODE=public` (secret Cloudflare, posé ou retiré en
 * une commande, sans nouveau build). Désactivée par défaut.
 *
 * Seules les pages publiques répondent « en pause », en 503 avec `Retry-After` : Google comprend une
 * interruption temporaire et garde l'indexation, à condition qu'elle ne dure pas des semaines.
 * Tout ce qui sert un dossier déjà engagé reste ouvert : administration, espace atelier, espace
 * client, connexion, paiements, webhooks Stripe et Sendcloud, fonctions serveur, fichiers, et les
 * pages légales qu'un client peut devoir lire avant de payer.
 *
 * Liste explicite de ce qui reste ouvert : une page publique ajoutée plus tard est coupée avec les
 * autres, sans rien à changer ici.
 */
import { FERRIERE_PUBLIC_TOKEN } from "@/build/constants";

const OPEN_PREFIXES = [
  // Espaces connectés et parcours engagés.
  "/admin", "/atelier", "/mes-livres", "/portal", "/build", "/marketplace", "/activer-mon-atelier",
  "/auth", "/invitation-atelier", "/reglement-atelier", "/project-summary",
  // Fonctions serveur, API, webhooks, fichiers.
  "/api/", "/_serverFn", "/_server", "/assets/", "/icons/",
  // Robots et plan du site restent lisibles ; pages légales pour qui paie un devis.
  "/robots.txt", "/sitemap.xml", "/favicon",
  "/conditions-generales-de-vente", "/mentions-legales", "/confidentialite", "/conditions",
  "/conditions-ateliers", "/terms", "/privacy", "/legal-notice",
] as const;

/**
 * Missions intégrées dans le site d'un atelier, qui n'est pas en pause : le parcours « Présenter mon
 * ouvrage » de reliure-ferriere.fr est servi par ce Worker dans une iframe. Chemin exact, jamais un
 * préfixe : les autres Missions `/m/…` sont des pages Ma Reliure et se mettent en pause avec elles.
 */
const OPEN_EXACT_PATHS: ReadonlySet<string> = new Set([`/m/${FERRIERE_PUBLIC_TOKEN}`]);

export const MAINTENANCE_RETRY_AFTER_SECONDS = 3600;

/**
 * Nitro appelle `src/server.ts` avec la seule requête : le second argument `env` y est vide en
 * production. Les variables et secrets du Worker arrivent dans `process.env` (nodejs_compat), comme
 * pour le reste de l'application ; `env` n'est lu qu'en premier, pour les tests et un appel direct.
 */
export function maintenanceEnabled(env: unknown, processEnv: Record<string, string | undefined> | undefined = globalThis.process?.env): boolean {
  const fromEnv = (env as { MAINTENANCE_MODE?: unknown } | null | undefined)?.MAINTENANCE_MODE;
  const value = typeof fromEnv === "string" ? fromEnv : processEnv?.MAINTENANCE_MODE;
  return typeof value === "string" && value.trim().toLowerCase() === "public";
}

export function staysOpenDuringMaintenance(pathname: string): boolean {
  if (OPEN_EXACT_PATHS.has(pathname.replace(/\/+$/, ""))) return true;
  return OPEN_PREFIXES.some((prefix) =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}.`) || pathname.startsWith(`${prefix}-`),
  );
}

function page(fineBindery: boolean): string {
  const [lang, title, heading, body] = fineBindery
    ? ["en", "Fine Bindery — back soon", "We'll be back shortly", "Our site is briefly paused. Workshops and customers with a project in progress can still sign in to their space."]
    : ["fr", "Ma Reliure — de retour bientôt", "Nous revenons très vite", "Le site est momentanément en pause. Les ateliers et les clients dont le projet est en cours peuvent toujours se connecter à leur espace."];
  const signIn = fineBindery ? "Sign in" : "Se connecter";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4efe6;color:#241a12;font-family:Georgia,serif;padding:24px}main{max-width:32rem;text-align:center}h1{font-weight:400;font-size:2rem;margin:0 0 1rem}p{font-family:system-ui,sans-serif;line-height:1.6;color:#5d5146}a{color:#7a2230}</style></head>
<body><main><h1>${heading}</h1><p>${body}</p><p><a href="/auth">${signIn}</a></p></main></body></html>`;
}

/** La réponse « en pause », ou `null` quand la requête doit être servie normalement. */
export function maintenanceResponse(request: Request, env: unknown, fineBindery: boolean): Response | null {
  if (!maintenanceEnabled(env)) return null;
  const { pathname } = new URL(request.url);
  if (staysOpenDuringMaintenance(pathname)) return null;
  return new Response(request.method === "HEAD" ? null : page(fineBindery), {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "retry-after": String(MAINTENANCE_RETRY_AFTER_SECONDS),
      "cache-control": "no-store",
    },
  });
}
