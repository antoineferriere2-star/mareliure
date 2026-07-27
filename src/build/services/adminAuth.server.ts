// Shared admin-auth helpers for build.*.data.functions.ts server functions.
// Never import from client code.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { fail } from "./serverError";

export type Supa = SupabaseClient<Database>;

/**
 * Verify the caller is admin using their own RLS-scoped client. Never uses
 * the service-role client for authorization.
 */
export async function assertAdmin(supabase: Supa, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) fail(403, "Forbidden");
}

export async function admin(): Promise<Supa> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
