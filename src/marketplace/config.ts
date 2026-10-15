/**
 * The marketplace's own settings, in one place so no number is ever typed
 * twice. Nothing here belongs to Métré Build: the engine does not know a
 * marketplace exists.
 */

/**
 * How many relieurs a single case may ever be sent to (§32). Enforced three
 * times over — here, in the server function, and by a database trigger —
 * because the failure it prevents (fifteen artisans quoting for free on the
 * same book) is the kind that kills supply and cannot be undone by apologising.
 */
export const MAX_BINDERS_PER_CASE = 3;

/**
 * Méthodes Sendcloud « Retour » (ex. Chrono 2Shop Retour) pour l'aller vers l'atelier. Fermé :
 * Sendcloud refuse de les créer sur ce compte (« Unable to announce labels », 14 et 15 octobre 2026,
 * contrat direct transporteur probablement requis). Fermé, l'admin ne les voit pas et le tarif les
 * refuse ; le code d'achat par l'API des retours reste prêt pour le jour où Sendcloud les active.
 */
export const SENDCLOUD_RETURN_METHODS_ENABLED = false;

/**
 * L'atelier coché d'office sur l'écran d'envoi aux ateliers, tant que le réseau
 * n'en compte qu'un en activité (Reliure Ferrière, décidé le 13 octobre 2026).
 * Une présélection seulement : l'admin peut le décocher, rien ne part sans
 * son clic. `null` pour revenir à une liste vierge.
 */
export const DEFAULT_WORKSHOP_ID: string | null = "2619269f-a422-4612-9bb7-d8df52a5d5e8";

export const MARKETPLACE_CURRENCY = "EUR";

/** The Métré vertical this marketplace consumes. */
export const MARKETPLACE_VERTICAL_ID = "bookbinding";

/**
 * The brand as the public reads it. The internal vocabulary stays
 * `bookbinding` / `marketplace_*` / `MARKETPLACE_VERTICAL_ID` — renaming stable
 * identifiers for a marketing decision is how a schema ends up telling the
 * story of every rebrand it has lived through.
 */
export const MARELIURE_BRAND = "Ma Reliure";

/**
 * Canonical origin, no trailing slash, no path.
 *
 * `www` redirects here permanently and never the other way round, so this is
 * the single URL that may appear in a canonical tag, an Open Graph `og:url` or
 * a Supabase Auth Site URL.
 */
export const MARELIURE_CANONICAL_ORIGIN = "https://mareliure.fr";

/**
 * The homepage's canonical URL, with its trailing slash.
 *
 * `/reliure` points its canonical here too: on a Ma Reliure deployment the two
 * paths render the same landing, and telling search engines they are two pages
 * would split the domain's authority between them.
 */
export const MARELIURE_CANONICAL_HOME = `${MARELIURE_CANONICAL_ORIGIN}/`;
