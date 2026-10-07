export const WORKSHOP_SUBSCRIPTION_TERMS = "oppe-workshop-2026-10-07-v2";
export const WORKSHOP_PRICE_LOOKUP_KEY = "oppe_workshop_monthly_15_eur_v1";

export function workshopCanCreate(
  subscription: { legacy_free: boolean; status: string; current_period_end: string | null },
  open: boolean,
  now = Date.now(),
): boolean {
  return (
    !open ||
    subscription.legacy_free ||
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
