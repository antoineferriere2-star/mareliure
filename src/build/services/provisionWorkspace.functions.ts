// Server-side, idempotent provisioning of a new client's own Espace Client.
// The user id ALWAYS comes from the validated bearer token (context.userId),
// never from the request body. The actual write goes through the service-role
// client calling the SECURITY DEFINER routine public.provision_owner_workspace,
// which is revoked from anon/authenticated and idempotent at the DB level
// (unique index on build_workspaces.provisioned_for_user_id).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ensureOwnerWorkspace,
  provisionInputSchema,
  type ProvisionDeps,
} from "./provisionWorkspace";
import { fail } from "./serverError";

export const ensureMyWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => provisionInputSchema.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId, claims } = context;
    const email = (claims.email as string | undefined) ?? null;
    // Company typed at sign-up is kept in the user's metadata: when the
    // account needs email confirmation, the sign-in that finally provisions
    // the workspace no longer carries it in the request body.
    const metadata = (claims.user_metadata ?? {}) as { company?: unknown };
    const metadataCompany = typeof metadata.company === "string" ? metadata.company : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const deps: ProvisionDeps = {
      // Role check runs on the caller's own RLS-scoped client, never on admin.
      isAdmin: async (uid) => {
        const { data: role } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .eq("role", "admin")
          .maybeSingle();
        return Boolean(role);
      },
      findMembership: async (uid) => {
        const { data: member, error } = await supabaseAdmin
          .from("build_workspace_members")
          .select("workspace_id")
          .eq("user_id", uid)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (error) fail(500, error.message);
        return member?.workspace_id ?? null;
      },
      provision: async (uid, mail, name) => {
        const { data: workspaceId, error } = await supabaseAdmin.rpc("provision_owner_workspace", {
          _user_id: uid,
          _email: mail ?? "",
          _workspace_name: name,
        });
        if (error) {
          console.error("[provisioning] failed for user", uid, error.message);
          fail(500, "Workspace provisioning failed");
        }
        return workspaceId as string;
      },
    };

    const result = await ensureOwnerWorkspace(deps, {
      userId,
      email,
      company: data.company ?? metadataCompany,
    });
    return result;
  });
