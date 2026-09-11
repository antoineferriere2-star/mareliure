/**
 * Binder membership and invitations — the server-only half of
 * src/marketplace/binders/membership.ts.
 *
 * Same shape as caseRepository.server.ts: this file touches the database, the
 * decisions it makes are pure functions imported from membership.ts, and it
 * is the only place that reads or writes marketplace_binder_members and
 * marketplace_binder_invitations.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  BINDER_INVITATION_TTL_DAYS,
  decideInvitationAcceptance,
  resolveActiveMembership,
  roleForNewMember,
} from "@/marketplace/binders/membership";

type Supa = SupabaseClient<Database>;

export interface CreatedInvitation {
  id: string;
  /** The raw token — returned exactly once, never stored. */
  token: string;
  expiresAt: string;
}

export type AcceptInvitationResult =
  | { ok: true; binderId: string }
  | { ok: false; reason: string };

/**
 * The atelier this account currently runs, resolved through membership
 * rather than the legacy `marketplace_binders.user_id`.
 *
 * A backfilled OWNER row makes every existing account resolve to exactly the
 * workshop it already ran — this function is the one place that changed so
 * the four call sites that used to read `user_id` directly did not have to.
 */
export async function findActiveBinderMembership(
  sb: Supa,
  userId: string,
): Promise<{ binderId: string; role: string } | null> {
  const { data } = await sb
    .from("marketplace_binder_members")
    .select("binder_id, role, account_status, created_at")
    .eq("user_id", userId)
    .eq("account_status", "active");
  if (!data || data.length === 0) return null;
  const resolved = resolveActiveMembership(
    data.map((row) => ({
      binderId: row.binder_id,
      accountStatus: row.account_status,
      createdAt: row.created_at,
    })),
  );
  if (!resolved) return null;
  const role = data.find((row) => row.binder_id === resolved.binderId)?.role ?? "MEMBER";
  return { binderId: resolved.binderId, role };
}

/**
 * Create a single-use, expiring, hashed invitation for an atelier.
 *
 * Reuses Métré's own token primitive (build_dossier_access_tokens'
 * generateAccessToken/hashAccessToken — 256-bit, hex, SHA-256) rather than
 * inventing a second one: the entropy and hashing discipline this needs
 * already exists and is already exercised by every visitor's summary link.
 */
export async function createBinderInvitation(
  sb: Supa,
  input: { binderId: string; email: string; invitedBy: string },
): Promise<CreatedInvitation> {
  const { generateAccessToken, hashAccessToken } = await import(
    "@/build/services/dossierAccessToken.server"
  );
  const token = generateAccessToken();
  const expiresAt = new Date(
    Date.now() + BINDER_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await sb
    .from("marketplace_binder_invitations")
    .insert({
      binder_id: input.binderId,
      email: input.email.trim().toLowerCase(),
      token_hash: hashAccessToken(token),
      invited_by: input.invitedBy,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error) throw error;

  await sb.from("marketplace_events").insert({
    binder_id: input.binderId,
    actor_user_id: input.invitedBy,
    event_type: "binder_member_invited",
    metadata: { email: input.email.trim().toLowerCase() },
  });

  return { id: data.id, token, expiresAt };
}

/**
 * Accept an invitation and become a member of its atelier.
 *
 * Race-safe the same way assignCaseOwner is: the UPDATE that flips the
 * invitation to `accepted` only succeeds `WHERE status = 'pending'`, so two
 * concurrent accepts of the same token can never both win. The membership
 * write that follows only runs for the request that actually won that race.
 */
export async function acceptBinderInvitation(
  sb: Supa,
  input: { rawToken: string; userId: string; accountEmail: string | null },
): Promise<AcceptInvitationResult> {
  const { hashAccessToken } = await import("@/build/services/dossierAccessToken.server");
  const tokenHash = hashAccessToken(input.rawToken);

  const { data: invitation } = await sb
    .from("marketplace_binder_invitations")
    .select("id, binder_id, email, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  // Unknown token: the same generic refusal an expired or consumed one gets.
  if (!invitation) {
    return { ok: false, reason: "Ce lien d'invitation n'est plus valable." };
  }

  const decision = decideInvitationAcceptance({
    status: invitation.status,
    expiresAt: invitation.expires_at,
    invitedEmail: invitation.email,
    accountEmail: input.accountEmail,
  });
  if (!decision.allowed) return { ok: false, reason: decision.reason! };

  const now = new Date().toISOString();
  const { data: won } = await sb
    .from("marketplace_binder_invitations")
    .update({ status: "accepted", accepted_at: now, accepted_by_user_id: input.userId })
    .eq("id", invitation.id)
    .eq("status", "pending")
    .select("id");
  if (!won || won.length === 0) {
    return { ok: false, reason: "Ce lien d'invitation n'est plus valable." };
  }

  const { count } = await sb
    .from("marketplace_binder_members")
    .select("id", { count: "exact", head: true })
    .eq("binder_id", invitation.binder_id);

  const { error: memberError } = await sb.from("marketplace_binder_members").upsert(
    {
      binder_id: invitation.binder_id,
      user_id: input.userId,
      role: roleForNewMember(count ?? 0),
      account_status: "active",
    },
    { onConflict: "binder_id,user_id" },
  );
  if (memberError) throw memberError;

  await sb.from("marketplace_events").insert([
    {
      binder_id: invitation.binder_id,
      actor_user_id: input.userId,
      event_type: "binder_member_invitation_accepted",
      metadata: {},
    },
    {
      binder_id: invitation.binder_id,
      actor_user_id: input.userId,
      event_type: "binder_member_activated",
      metadata: {},
    },
  ]);

  return { ok: true, binderId: invitation.binder_id };
}
