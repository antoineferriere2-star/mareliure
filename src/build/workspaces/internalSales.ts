/**
 * Métré Sales / Demos — the rules that make a workspace *ours* rather than a
 * customer's.
 *
 * An internal sales workspace exists so a Métré agent can build a real,
 * personalised demonstration from a prospect's own website: analyse the site,
 * generate the Playbook, brand it, publish it, and send the public link. It
 * runs on exactly the same machinery as a customer's Espace Client — same
 * wizard, same publish routine, same /m/:token URL, same row-level isolation.
 *
 * Everything specific to it is in this file, and it is all one of three things:
 *   - it is never billed (no Stripe surface at all, not just an exemption);
 *   - it runs the site analysis far more often than a customer ever would;
 *   - its Missions and Project Briefs are demonstrations, so they must not be
 *     counted as business activity.
 *
 * Pure and dependency-free on purpose: the predicate below is the single
 * definition of "internal", and every enforcement point imports it rather than
 * re-deriving the answer. Nothing here may ever key on the workspace *name* —
 * names are editable free text, and a rename would silently hand a customer an
 * unbilled account.
 */

export const WORKSPACE_TYPES = ["client", "internal_sales"] as const;
export type WorkspaceType = (typeof WORKSPACE_TYPES)[number];

export const INTERNAL_SALES: WorkspaceType = "internal_sales";

/** The name the operator gives the workspace. Cosmetic — never load-bearing. */
export const INTERNAL_SALES_WORKSPACE_NAME = "Métré Sales / Demos";

/**
 * The one definition of "internal". Takes the raw column value because it is
 * called on rows straight out of Supabase, where the type is `string`.
 * Anything that is not exactly `internal_sales` is a customer: an unknown
 * value must fail towards the *stricter* side, never towards free access.
 */
export function isInternalSales(workspaceType: string | null | undefined): boolean {
  return workspaceType === INTERNAL_SALES;
}

// ------------------------------------------------------------- AI run budget

/**
 * Site analyses per hour, per workspace, per action.
 *
 * A customer sets their intake up once: `AI_RUNS_PER_HOUR = 8` is deliberately
 * low there, because a ninth run in an hour means something is wrong. An agent
 * working a prospect list does one analysis *per prospect*, so the same ceiling
 * stops the work at the ninth company. This is the only quota an internal
 * workspace raises in code rather than in data — every other limit
 * (max_active_missions, monthly_brief_quota) is already a column on the
 * workspace row and needs no special case.
 *
 * Still a real ceiling: each run costs an AI call and fetches a third-party
 * website, so a runaway loop is capped rather than unbounded.
 */
export const INTERNAL_SALES_AI_RUNS_PER_HOUR = 60;

/** The hourly AI budget for a workspace of this type. */
export function aiRunsPerHourFor(workspaceType: string | null | undefined, clientLimit: number) {
  return isInternalSales(workspaceType) ? INTERNAL_SALES_AI_RUNS_PER_HOUR : clientLimit;
}

/**
 * Seed limits for a new internal workspace. Not exemptions: they are written
 * into the same `max_active_missions` / `monthly_brief_quota` columns every
 * workspace has, so the ceiling stays visible in the admin UI and adjustable
 * without a deploy. One live demo per prospect being worked, and enough Project
 * Briefs that walking one's own demo never trips a quota.
 */
export const INTERNAL_SALES_ACTIVE_MISSIONS = 50;
export const INTERNAL_SALES_MONTHLY_BRIEFS = 500;

// ------------------------------------------------------------ Prospect demos

/**
 * Where a demo stands. Not a CRM pipeline — deliberately four values that
 * answer one question ("can I send this link, and did I?"). Anything richer
 * (sequences, scoring, tasks) belongs in a real CRM, not here.
 */
export const PROSPECT_STATUSES = ["draft", "ready", "sent", "archived"] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

/** `draft` until the demo is published; `publishMyDraft` promotes it to `ready`. */
export const INITIAL_PROSPECT_STATUS: ProspectStatus = "draft";

export function isProspectStatus(value: unknown): value is ProspectStatus {
  return typeof value === "string" && (PROSPECT_STATUSES as readonly string[]).includes(value);
}

/**
 * The prospect's domain, derived rather than stored — `final_url` is already on
 * the setup row, and a stored copy would be a second truth to keep in sync.
 * `www.` is dropped so the same company reads the same way whichever address
 * the agent pasted.
 */
export function prospectDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/**
 * A fallback company name for a demo the agent has not named yet, so the list
 * never shows a blank row. Never invents anything: it is the domain, or the
 * absence of one stated plainly.
 */
export function prospectDisplayName(
  companyName: string | null | undefined,
  finalUrl: string | null | undefined,
): string {
  const trimmed = (companyName ?? "").trim();
  if (trimmed) return trimmed;
  return prospectDomain(finalUrl) ?? "Unnamed prospect";
}
