export interface WorkspaceBillingRefs {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export type BillingAction = "checkout" | "portal";

export function resolveBillingAction(workspace: WorkspaceBillingRefs): BillingAction {
  return workspace.stripe_customer_id || workspace.stripe_subscription_id ? "portal" : "checkout";
}

export function canCreateCheckout(workspace: WorkspaceBillingRefs): boolean {
  return resolveBillingAction(workspace) === "checkout";
}
