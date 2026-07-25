// Shared workspace-auth helper for portal.data.functions.ts server functions
// (the Espace Client portal). Mirrors adminAuth.server.ts::assertAdmin, but
// scopes access to a single build_workspaces row instead of the whole app.
// Never imports from client code.
import type { Supa } from "./adminAuth.server";

/**
 * Verify the caller belongs to the given workspace using their own
 * RLS-scoped client. Never uses the service-role client for authorization.
 */
export async function assertWorkspaceMember(supabase: Supa, userId: string, workspaceId: string) {
  const { data, error } = await supabase
    .from("build_workspace_members")
    .select("id")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error || !data) throw new Response("Forbidden", { status: 403 });
}
