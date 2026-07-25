// Plan catalog for Espace Client workspaces. These numbers only pre-fill
// build_workspaces.max_active_missions / monthly_brief_quota when an admin
// picks a plan — enforcement always reads those two columns directly off
// the workspace row, never this table, so Enterprise deals and "extra
// active Mission" add-ons never need special-casing at the enforcement
// layer. No Stripe/pricing wiring here — this is the quota mechanic only.
export const PLAN_IDS = ["launch", "growth", "pro", "business", "enterprise"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanDefaults {
  label: string;
  /** null = no numeric default; Enterprise limits are negotiated per deal. */
  maxActiveMissions: number | null;
  monthlyBriefQuota: number | null;
}

export const PLAN_DEFAULTS: Record<PlanId, PlanDefaults> = {
  launch: { label: "Launch", maxActiveMissions: 1, monthlyBriefQuota: 50 },
  growth: { label: "Growth", maxActiveMissions: 3, monthlyBriefQuota: 250 },
  pro: { label: "Pro", maxActiveMissions: 8, monthlyBriefQuota: 1000 },
  business: { label: "Business", maxActiveMissions: 20, monthlyBriefQuota: 5000 },
  enterprise: { label: "Enterprise", maxActiveMissions: null, monthlyBriefQuota: null },
};

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

export function getPlanDefaults(plan: string): PlanDefaults {
  return isPlanId(plan) ? PLAN_DEFAULTS[plan] : PLAN_DEFAULTS.launch;
}
