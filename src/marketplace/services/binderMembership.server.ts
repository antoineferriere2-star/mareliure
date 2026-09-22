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

type PendingInvitation = {
  id: string;
  binder_id: string;
  email: string;
  status: string;
  expires_at: string;
};

/**
 * An existing, verified account can find invitations addressed to its own
 * e-mail. No token or invitation for another address is disclosed.
 */
export async function findPendingBinderInvitations(sb: Supa, verifiedEmail: string) {
  const { data, error } = await sb
    .from("marketplace_binder_invitations")
    .select("id, binder_id, email, status, expires_at")
    .eq("email", verifiedEmail.trim().toLowerCase())
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at");
  if (error) throw error;
  const invitations = data ?? [];
  if (invitations.length === 0) return [];

  const { data: binders, error: binderError } = await sb
    .from("marketplace_binders")
    .select("id, display_name, workshop_name")
    .in("id", invitations.map((invitation) => invitation.binder_id));
  if (binderError) throw binderError;
  const names = new Map((binders ?? []).map((binder) => [
    binder.id,
    binder.workshop_name ?? binder.display_name,
  ]));
  return invitations.map((invitation) => ({
    id: invitation.id,
    workshopName: names.get(invitation.binder_id) ?? "Atelier partenaire",
    expiresAt: invitation.expires_at,
  }));
}

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
 * Resolve the e-mail address a pending, unexpired invitation was sent to —
 * nothing else about it. Public by design: the page that creates or signs
 * in an account for this invitation locks its e-mail field to this value,
 * so that step can no longer be used to attach a password to a *different*,
 * already-existing account (see `acceptBinderInvitation`'s doc comment: the
 * token proves the invitation, this closes the gap between "an account gets
 * created/updated" and "the invitation is actually checked").
 */
export async function resolvePendingInvitationEmail(
  sb: Supa,
  rawToken: string,
): Promise<string | null> {
  const { hashAccessToken } = await import("@/build/services/dossierAccessToken.server");
  const tokenHash = hashAccessToken(rawToken);
  const { data: invitation } = await sb
    .from("marketplace_binder_invitations")
    .select("email, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!invitation) return null;
  if (invitation.status !== "pending") return null;
  if (new Date(invitation.expires_at).getTime() <= Date.now()) return null;
  return invitation.email;
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

  return activateInvitation(sb, invitation, input.userId);
}

/**
 * The fallback when the invitation e-mail never reaches an existing account:
 * the account must have a confirmed address matching the invitation. The
 * caller chooses a specific invitation on the activation screen.
 */
export async function acceptVerifiedEmailBinderInvitation(
  sb: Supa,
  input: { invitationId: string; userId: string; verifiedEmail: string },
): Promise<AcceptInvitationResult> {
  const { data: invitation, error } = await sb
    .from("marketplace_binder_invitations")
    .select("id, binder_id, email, status, expires_at")
    .eq("id", input.invitationId)
    .maybeSingle();
  if (error) throw error;
  if (!invitation || invitation.email.trim().toLowerCase() !== input.verifiedEmail.trim().toLowerCase()) {
    return { ok: false, reason: "Aucune invitation valable pour ce compte." };
  }
  const decision = decideInvitationAcceptance({
    status: invitation.status,
    expiresAt: invitation.expires_at,
    invitedEmail: invitation.email,
    accountEmail: input.verifiedEmail,
  });
  if (!decision.allowed) return { ok: false, reason: decision.reason! };
  return activateInvitation(sb, invitation, input.userId);
}

async function activateInvitation(
  sb: Supa,
  invitation: PendingInvitation,
  userId: string,
): Promise<AcceptInvitationResult> {
  const now = new Date().toISOString();
  const { data: won } = await sb
    .from("marketplace_binder_invitations")
    .update({ status: "accepted", accepted_at: now, accepted_by_user_id: userId })
    .eq("id", invitation.id)
    .eq("status", "pending")
    .gt("expires_at", now)
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
      user_id: userId,
      role: roleForNewMember(count ?? 0),
      account_status: "active",
    },
    { onConflict: "binder_id,user_id" },
  );
  if (memberError) throw memberError;

  await sb.from("marketplace_events").insert([
    {
      binder_id: invitation.binder_id,
      actor_user_id: userId,
      event_type: "binder_member_invitation_accepted",
      metadata: {},
    },
    {
      binder_id: invitation.binder_id,
      actor_user_id: userId,
      event_type: "binder_member_activated",
      metadata: {},
    },
  ]);

  return { ok: true, binderId: invitation.binder_id };
}
