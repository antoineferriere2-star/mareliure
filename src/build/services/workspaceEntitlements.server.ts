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
import { admin } from "./adminAuth.server";
import { fail } from "./serverError";

export async function getWorkspaceEntitlements(workspaceId: string): Promise<Entitlements> {
  const sb = await admin();
  const { data: workspace, error } = await sb
    .from("build_workspaces")
    .select("is_active, provisioned_for_user_id, subscription_status, trial_ends_at")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) fail(500, error.message);
  if (!workspace) fail(404, "Workspace not found.");

  return resolveEntitlements({
    isActive: workspace.is_active,
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
