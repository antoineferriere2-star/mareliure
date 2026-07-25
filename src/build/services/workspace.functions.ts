import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server function used to gate `/portal/*` routes. Returns basic identity
 * information for the current user, throwing 403 when they belong to no
 * workspace. Uses the caller's own RLS-scoped supabase client (from the
 * middleware) against build_workspace_members's self-select policy — never
 * the admin/service client for this authorization check. Mirrors
 * admin.functions.ts::requireBuildAdmin.
 */
export const requireWorkspaceAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;

    const { data, error } = await supabase
      .from("build_workspace_members")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      throw new Response("Forbidden", { status: 403 });
    }

    return {
      userId,
      email: (claims.email as string | undefined) ?? null,
      hasWorkspaceAccess: true as const,
    };
  });
