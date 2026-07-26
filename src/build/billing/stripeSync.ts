// Pure logic for mapping a Stripe webhook event to a PlanId / workspace id.
// Kept structural (not `Stripe.Event`/`Stripe.Price`) so it stays trivially
// testable with plain fixtures and only reads the fields it actually needs.
import { type PlanId, getPlanByStripeLookupKey } from "./plans";

export interface StripePriceLike {
  id: string;
  lookup_key?: string | null;
  metadata?: Record<string, string> | null;
}

/** Resolves a Stripe Price to a PlanId — lookup_key first, then the lovable_external_id fallback. Never guesses off price.id. */
export function mapLookupKeyToPlan(price: StripePriceLike): PlanId | null {
  if (price.lookup_key) {
    const plan = getPlanByStripeLookupKey(price.lookup_key);
    if (plan) return plan;
  }
  const externalId = price.metadata?.lovable_external_id;
  if (externalId) {
    const plan = getPlanByStripeLookupKey(externalId);
    if (plan) return plan;
  }
  return null;
}

export interface HasMetadata {
  metadata?: Record<string, string> | null;
}

/** workspace_id is never provided by Stripe/Lovable — it only exists because we set it ourselves at checkout time (metadata + subscription_data.metadata). */
export function resolveWorkspaceId(object: HasMetadata): string | null {
  return object.metadata?.workspace_id ?? null;
}
