/**
 * The single source of truth for "what is this workspace allowed to do right
 * now". Pure and dependency-free so it can be unit tested and called from any
 * server function — every enforcement point must go through `resolveEntitlements`
 * rather than re-deriving the rules from `subscription_status` on its own.
 *
 * Before this module, `subscription_status` was written by the Stripe webhook
 * but read by nobody: a workspace kept full access with no subscription and
 * after cancellation. The columns `max_active_missions` / `monthly_brief_quota`
 * still answer "how much" (see plans.ts); this module answers the separate
 * question "at all?".
 *
 * Deliberate non-goal: this never blocks a visitor from submitting to an
 * already-published Intake. Those URLs are embedded in a customer's own
 * website — breaking a live form punishes the visitor and the customer's
 * business for a billing problem between us and the customer.
 */

/** Days of full access a self-service signup gets before a subscription is required. */
export const TRIAL_DAYS = 14;

/**
 * Stripe subscription statuses that mean "paid and current". `trialing` is
 * Stripe's own trial (a Checkout-issued one), distinct from our local
 * pre-subscription trial below.
 */
const ACTIVE_STRIPE_STATUSES = new Set(["active", "trialing"]);

/**
 * Dunning. Stripe is still retrying the card, the customer has not churned,
 * and locking them out mid-retry is both hostile and bad for recovery.
 */
const GRACE_STRIPE_STATUSES = new Set(["past_due"]);

export type EntitlementState =
  /** No `provisioned_for_user_id`: an operator created this workspace by hand
   * (Enterprise deal, internal demo). A human already decided — never auto-gate it. */
  | "admin_managed"
  /** Paid and current. */
  | "subscribed"
  /** Payment failing but not yet churned — keep everything working. */
  | "grace_past_due"
  /** Self-service signup inside its local trial window. */
  | "trialing"
  /** Local trial elapsed and no subscription was ever started. */
  | "trial_expired"
  /** Had a subscription, no longer current (canceled / unpaid / expired). */
  | "subscription_ended"
  /** Operator kill switch (`is_active = false`). */
  | "workspace_disabled";

export interface WorkspaceEntitlementInput {
  isActive: boolean;
  /** Null for operator-created workspaces; set for self-service signups. */
  provisionedForUserId: string | null;
  subscriptionStatus: string | null;
  /** ISO timestamp; null is treated as "still trialing" (see resolveEntitlements). */
  trialEndsAt: string | null;
}

export interface Entitlements {
  state: EntitlementState;
  /** Publish a new Intake, or reactivate a paused one — both consume a plan slot. */
  canPublish: boolean;
  /** Already-published Intakes keep collecting submissions. Only the operator
   * kill switch turns this off; billing state never does. */
  canAcceptSubmissions: boolean;
  /** Whole days left in the local trial, floored at 0. Null unless state is "trialing". */
  trialDaysRemaining: number | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysUntil(iso: string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / MS_PER_DAY));
}

export function resolveEntitlements(
  input: WorkspaceEntitlementInput,
  now: Date = new Date(),
): Entitlements {
  if (!input.isActive) {
    return {
      state: "workspace_disabled",
      canPublish: false,
      canAcceptSubmissions: false,
      trialDaysRemaining: null,
    };
  }

  // Operator-created workspaces have no self-serve subscription by design
  // (Enterprise has no Stripe price at all — see PLAN_DEFAULTS.enterprise).
  if (input.provisionedForUserId === null) {
    return {
      state: "admin_managed",
      canPublish: true,
      canAcceptSubmissions: true,
      trialDaysRemaining: null,
    };
  }

  const status = input.subscriptionStatus;

  if (status && ACTIVE_STRIPE_STATUSES.has(status)) {
    return {
      state: "subscribed",
      canPublish: true,
      canAcceptSubmissions: true,
      trialDaysRemaining: null,
    };
  }

  if (status && GRACE_STRIPE_STATUSES.has(status)) {
    return {
      state: "grace_past_due",
      canPublish: true,
      canAcceptSubmissions: true,
      trialDaysRemaining: null,
    };
  }

  // Any other non-null status (canceled, unpaid, incomplete_expired, paused,
  // incomplete...) means a subscription existed and is not current. Listing
  // "ended" states explicitly would silently grant access to any future status
  // string Stripe adds, so this is deliberately the fallback branch.
  if (status) {
    return {
      state: "subscription_ended",
      canPublish: false,
      canAcceptSubmissions: true,
      trialDaysRemaining: null,
    };
  }

  // No subscription was ever started: local trial. A null `trialEndsAt` on a
  // self-service row means the column default did not fire — that is our bug,
  // not abuse, so fail open rather than lock a legitimate signup out.
  if (input.trialEndsAt === null) {
    return {
      state: "trialing",
      canPublish: true,
      canAcceptSubmissions: true,
      trialDaysRemaining: null,
    };
  }

  const remaining = daysUntil(input.trialEndsAt, now);
  if (remaining > 0) {
    return {
      state: "trialing",
      canPublish: true,
      canAcceptSubmissions: true,
      trialDaysRemaining: remaining,
    };
  }

  return {
    state: "trial_expired",
    canPublish: false,
    canAcceptSubmissions: true,
    trialDaysRemaining: 0,
  };
}

/**
 * Operator-facing explanation for a refused publish. Kept beside the state
 * machine so a new state can never ship without a message.
 */
export const PUBLISH_BLOCKED_MESSAGE: Record<EntitlementState, string | null> = {
  admin_managed: null,
  subscribed: null,
  grace_past_due: null,
  trialing: null,
  trial_expired:
    "Your free trial has ended. Choose a plan to publish your Project Intake — Intakes already online keep collecting submissions.",
  subscription_ended:
    "Your subscription is no longer active. Reactivate it to publish again — Intakes already online keep collecting submissions.",
  workspace_disabled: "This workspace is disabled. Contact us to reactivate it.",
};
