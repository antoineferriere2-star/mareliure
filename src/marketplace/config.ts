/**
 * The marketplace's own settings, in one place so no number is ever typed
 * twice. Nothing here belongs to Métré Build: the engine does not know a
 * marketplace exists.
 */

/**
 * Platform commission, in basis points of the quote amount. 1500 bps = 15 %.
 *
 * Basis points rather than 0.15 on purpose: money is integer cents everywhere
 * in this domain, and a float rate is the shortest path to a payout that is
 * one cent off and an artisan who stops trusting the platform.
 *
 * Read it through `commissionBps()` rather than importing the constant, so a
 * negotiated rate per relieur or per case has exactly one place to land.
 */
export const DEFAULT_COMMISSION_BPS = 1500;

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
