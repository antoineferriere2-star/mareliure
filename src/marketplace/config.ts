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
