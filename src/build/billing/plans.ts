// Plan catalog for Espace Client workspaces. These numbers only pre-fill
// build_workspaces.max_active_missions / monthly_brief_quota when an admin
// picks a plan — enforcement always reads those two columns directly off
// the workspace row, never this table, so Enterprise deals and "extra
// active Mission" add-ons never need special-casing at the enforcement
// layer. No Stripe/pricing wiring here — this is the quota mechanic only.
export const PLAN_IDS = ["launch", "growth", "pro", "business", "enterprise"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface MonthlyUsdPrice {
  currency: "USD";
  amountCents: number;
}

export interface PlanDefaults {
  label: string;
  /** null = no numeric default; Enterprise limits are negotiated per deal. */
  maxActiveMissions: number | null;
  monthlyBriefQuota: number | null;
  /** Stripe Price lookup_key (stable across test/live) — null for Enterprise, which has no self-serve price. */
  stripeLookupKey: string | null;
  monthlyUsdPrice: MonthlyUsdPrice | null;
}

// LOT5B: paid extra-Mission add-ons are not implemented yet. Until then,
// negotiated limits continue to use the existing admin quota overrides.
export const PLAN_DEFAULTS: Record<PlanId, PlanDefaults> = {
  launch: {
    label: "Launch",
    maxActiveMissions: 1,
    monthlyBriefQuota: 50,
    stripeLookupKey: "launch_monthly",
    monthlyUsdPrice: { currency: "USD", amountCents: 1999 },
  },
  growth: {
    label: "Growth",
    maxActiveMissions: 3,
    monthlyBriefQuota: 250,
    stripeLookupKey: "growth_monthly",
    monthlyUsdPrice: { currency: "USD", amountCents: 5900 },
  },
  pro: {
    label: "Pro",
    maxActiveMissions: 8,
    monthlyBriefQuota: 1000,
    stripeLookupKey: "pro_monthly",
    monthlyUsdPrice: { currency: "USD", amountCents: 14900 },
  },
  business: {
    label: "Business",
    maxActiveMissions: 20,
    monthlyBriefQuota: 5000,
    stripeLookupKey: "business_monthly",
    monthlyUsdPrice: { currency: "USD", amountCents: 29900 },
  },
  enterprise: {
    label: "Enterprise",
    maxActiveMissions: null,
    monthlyBriefQuota: null,
    stripeLookupKey: null,
    monthlyUsdPrice: null,
  },
};

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

export function getPlanDefaults(plan: string): PlanDefaults {
  return isPlanId(plan) ? PLAN_DEFAULTS[plan] : PLAN_DEFAULTS.launch;
}

/** Reverse lookup used by the Stripe webhook handler to map a Price lookup_key back to a PlanId. */
export function getPlanByStripeLookupKey(lookupKey: string): PlanId | null {
  const entry = (Object.entries(PLAN_DEFAULTS) as [PlanId, PlanDefaults][]).find(
    ([, defaults]) => defaults.stripeLookupKey === lookupKey,
  );
  return entry ? entry[0] : null;
}

export function formatMonthlyUsdPrice(price: MonthlyUsdPrice | null): string {
  if (!price) return "Custom pricing";
  const hasCents = price.amountCents % 100 !== 0;
  return `${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency,
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(price.amountCents / 100)}/mo`;
}
