// Single source of truth for "what do the plan/quota columns on
// build_workspaces become when the plan changes to X" — used both by the
// admin-triggered plan dropdown (admin.data.functions.ts) and by the
// Stripe webhook, so the two code paths can never drift apart.
import { type PlanId, getPlanDefaults } from "./plans";

export interface PlanColumnsUpdate {
  plan: PlanId;
  max_active_missions: number;
  monthly_brief_quota: number;
}

export function resolvePlanColumnsUpdate(
  plan: PlanId,
  overrides?: { max_active_missions?: number; monthly_brief_quota?: number },
): PlanColumnsUpdate {
  const defaults = getPlanDefaults(plan);
  return {
    plan,
    max_active_missions: overrides?.max_active_missions ?? defaults.maxActiveMissions ?? 1,
    monthly_brief_quota: overrides?.monthly_brief_quota ?? defaults.monthlyBriefQuota ?? 50,
  };
}
