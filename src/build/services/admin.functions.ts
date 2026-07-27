import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fail } from "./serverError";

/**
 * Server function used to gate `/build/*` routes. Returns basic identity
 * information for the current user, throwing 403 when they are not admin.
 * Uses the caller's own RLS-scoped supabase client (from the middleware) to
 * check `user_roles` — never uses the admin/service client for authorization.
 */
export const requireBuildAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (error) {
      fail(403, "Forbidden");
    }
    if (!data) {
      fail(403, "Forbidden");
    }

    return {
      userId,
      email: (claims.email as string | undefined) ?? null,
      isAdmin: true as const,
    };
  });
