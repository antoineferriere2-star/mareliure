export const WORKSHOP_SUBSCRIPTION_TERMS = "oppe-workshop-2026-10-07-v2";
export const WORKSHOP_PRICE_LOOKUP_KEY = "oppe_workshop_monthly_15_eur_v1";

/** Essai gratuit offert à l'inscription d'un atelier, sans carte bancaire (pivot du 22 novembre 2026). */
export const WORKSHOP_TRIAL_DAYS = 15;

type TrialSubscription = { legacy_free: boolean; trial_ends_at?: string | null };

/**
 * État de l'essai gratuit. Un atelier exempté (`legacy_free`) n'a pas d'essai : il n'est jamais
 * limité. `daysLeft` est arrondi au jour supérieur (il reste « 1 jour » jusqu'à la dernière minute).
 */
export function workshopTrial(
  subscription: TrialSubscription,
  now = Date.now(),
): { applies: boolean; active: boolean; endsAt: string | null; daysLeft: number } {
  const endsAt = subscription.trial_ends_at ?? null;
  if (subscription.legacy_free || !endsAt || !Number.isFinite(Date.parse(endsAt))) {
    return { applies: false, active: false, endsAt: null, daysLeft: 0 };
  }
  const remaining = Date.parse(endsAt) - now;
  return { applies: true, active: remaining > 0, endsAt, daysLeft: remaining > 0 ? Math.ceil(remaining / 86_400_000) : 0 };
}

export function workshopCanCreate(
  subscription: { legacy_free: boolean; status: string; current_period_end: string | null; trial_ends_at?: string | null },
  open: boolean,
  now = Date.now(),
): boolean {
  return (
    !open ||
    subscription.legacy_free ||
    workshopTrial(subscription, now).active ||
    (["active", "trialing"].includes(subscription.status) &&
      subscription.current_period_end !== null &&
      Date.parse(subscription.current_period_end) > now)
  );
}

/** Les retours Stripe sont construits côté serveur ; aucune URL fournie par le navigateur. */
export function workshopOrigin(): string {
  const origin = process.env.MARKETPLACE_PUBLIC_ORIGIN ?? "https://mareliure.fr";
  const url = new URL(origin);
  if (
    url.protocol !== "https:" &&
    !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname))
  ) {
    throw new Error("workshop_origin_invalid");
  }
  return url.origin;
}
