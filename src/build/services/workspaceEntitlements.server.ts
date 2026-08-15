// Loads a workspace's billing row and resolves it through the entitlements
// state machine. Every server function that grants a paid capability must go
// through `assertCanPublish` rather than reading `subscription_status` itself
// — the rules live in one place (src/build/billing/entitlements.ts) so a new
// state can never be handled correctly in one call site and forgotten in
// another.
import {
  PUBLISH_BLOCKED_MESSAGE,
  resolveEntitlements,
  type Entitlements,
} from "@/build/billing/entitlements";
import { isInternalSales } from "@/build/workspaces/internalSales";
import { admin } from "./adminAuth.server";
import { fail } from "./serverError";

export async function getWorkspaceEntitlements(workspaceId: string): Promise<Entitlements> {
  const sb = await admin();
  const { data: workspace, error } = await sb
    .from("build_workspaces")
    .select(
      "is_active, workspace_type, provisioned_for_user_id, subscription_status, trial_ends_at",
    )
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) fail(500, error.message);
  if (!workspace) fail(404, "Workspace not found.");

  return resolveEntitlements({
    isActive: workspace.is_active,
    workspaceType: workspace.workspace_type,
    provisionedForUserId: workspace.provisioned_for_user_id,
    subscriptionStatus: workspace.subscription_status,
    trialEndsAt: workspace.trial_ends_at,
  });
}

/**
 * Guard for any action that puts an Intake live (first publish, or
 * reactivating a paused one — both consume a plan slot). Throws a
 * client-visible 402 so the portal can route the owner to checkout.
 */
export async function assertCanPublish(workspaceId: string): Promise<Entitlements> {
  const entitlements = await getWorkspaceEntitlements(workspaceId);
  if (!entitlements.canPublish) {
    fail(402, PUBLISH_BLOCKED_MESSAGE[entitlements.state] ?? "This workspace cannot publish.");
  }
  return entitlements;
}

/**
 * Guard for every Stripe-touching surface. An internal Sales / Demos workspace
 * has no billing to show, no plan to choose and no card to store — so the
 * answer is 404, not 403: the agent is not being denied a permission, the
 * surface does not exist for this workspace.
 *
 * Enforced here rather than by role, because the agent has to be an `owner` to
 * run the setup wizard at all, and owner is exactly what the billing functions
 * check.
 */
export async function assertBillingSurface(workspaceId: string): Promise<void> {
  const sb = await admin();
  const { data: workspace, error } = await sb
    .from("build_workspaces")
    .select("workspace_type")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) fail(500, error.message);
  if (!workspace) fail(404, "Workspace not found.");
  if (isInternalSales(workspace.workspace_type)) {
    fail(404, "This workspace has no billing.");
  }
}
