// Shared workspace-auth helper for portal.data.functions.ts server functions
// (the Espace Client portal). Mirrors adminAuth.server.ts::assertAdmin, but
// scopes access to a single build_workspaces row instead of the whole app.
// Never imports from client code.
import type { Supa } from "./adminAuth.server";
import { fail } from "./serverError";

/**
 * Verify the caller belongs to the given workspace using their own
 * RLS-scoped client. Never uses the service-role client for authorization.
 */
export async function assertWorkspaceMember(supabase: Supa, userId: string, workspaceId: string) {
  const { data, error } = await supabase
    .from("build_workspace_members")
    .select("id, role")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error || !data) fail(403, "Forbidden");
  return { role: data.role as string };
}

/**
 * Billing-level guard: only an `owner` of the workspace may start a Stripe
 * checkout or open the billing portal. Members keep read-only visibility.
 */
export async function assertWorkspaceOwner(supabase: Supa, userId: string, workspaceId: string) {
  const { role } = await assertWorkspaceMember(supabase, userId, workspaceId);
  if (role !== "owner") {
    fail(403, "Only the workspace owner can do this.");
  }
}

