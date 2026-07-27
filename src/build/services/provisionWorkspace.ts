// Pure, dependency-injected provisioning logic for a new client account's own
// Espace Client (workspace). Kept free of Supabase imports so it can be unit
// tested; the real wiring lives in provisionWorkspace.functions.ts.
//
// Invariants enforced here:
// - the caller's user id is the ONLY identity used (never browser-supplied);
// - Métré admins are never provisioned a client workspace;
// - a user who already belongs to a workspace is never given a second one;
// - the actual insert is idempotent at the database level (unique index on
//   build_workspaces.provisioned_for_user_id + the SECURITY DEFINER routine
//   public.provision_owner_workspace).
import { z } from "zod";

/** Browser-supplied input: company name only. The user id NEVER comes from the client. */
export const provisionInputSchema = z
  .object({
    company: z.string().trim().max(120).optional(),
  })
  .strip();

export type ProvisionInput = z.infer<typeof provisionInputSchema>;

export const DEFAULT_WORKSPACE_NAME = "My Workspace";

/**
 * Initial workspace name from the company typed at sign-up. Falls back to a
 * neutral English label the owner can rename later — never invents a trade or
 * product.
 */
export function deriveWorkspaceName(company?: string | null, email?: string | null): string {
  const trimmed = (company ?? "").trim().replace(/\s+/g, " ");
  if (trimmed.length > 0) return trimmed.slice(0, 120);
  const local = (email ?? "").split("@")[0]?.trim();
  if (local && local.length > 0) return `${local.slice(0, 100)}'s Workspace`;
  return DEFAULT_WORKSPACE_NAME;
}

export interface ProvisionDeps {
  /** True when the user is a Métré team admin. */
  isAdmin(userId: string): Promise<boolean>;
  /** Existing workspace id the user already belongs to, or null. */
  findMembership(userId: string): Promise<string | null>;
  /** Idempotent DB routine creating workspace + owner membership. */
  provision(userId: string, email: string | null, name: string): Promise<string>;
}

export type ProvisionResult =
  | { status: "admin" }
  | { status: "existing"; workspaceId: string }
  | { status: "provisioned"; workspaceId: string };

export async function ensureOwnerWorkspace(
  deps: ProvisionDeps,
  args: { userId: string; email: string | null; company?: string | null },
): Promise<ProvisionResult> {
  if (await deps.isAdmin(args.userId)) return { status: "admin" };

  const existing = await deps.findMembership(args.userId);
  if (existing) return { status: "existing", workspaceId: existing };

  const name = deriveWorkspaceName(args.company, args.email);
  const workspaceId = await deps.provision(args.userId, args.email, name);
  return { status: "provisioned", workspaceId };
}
