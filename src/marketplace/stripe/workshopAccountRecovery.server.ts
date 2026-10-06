import { getMarketplaceStripeClient } from "./stripeClient.server";

/** Recover lost account-create responses even after Stripe's idempotency retention window. */
export async function findWorkshopCustomerAccount(binderId: string) {
  let found: string | null = null;
  for await (const account of getMarketplaceStripeClient().v2.core.accounts.list({ limit: 20 })) {
    if (account.metadata?.binder_id !== binderId) continue;
    if (found && found !== account.id) throw new Error("workshop_accounts_require_reconciliation");
    found = account.id;
  }
  return found;
}
