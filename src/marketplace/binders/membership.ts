/**
 * Who may act for an atelier, and how someone joins it.
 *
 * `marketplace_binders.user_id UNIQUE` used to be the only relation between an
 * atelier and a person: one workshop, one account, forever. This module is
 * the other side of `marketplace_binder_members` — a workshop can have an
 * owner and, later, members, without ever changing that legacy column.
 *
 * Two states, on purpose, at two different levels (§7-§9 of the 11 September
 * brief):
 *
 * - `marketplace_binders.status` — the commercial relationship between the
 *   workshop and Ma Reliure (draft, pending_review, approved, rejected,
 *   suspended). Untouched by this migration.
 * - `marketplace_binder_members.account_status` — whether *this one person*
 *   has activated their own access. An approved workshop can have an owner
 *   whose account is `active` and a freshly invited member still `invited`.
 *   Putting this on the workshop instead would conflate two questions that
 *   answer differently the day a workshop has more than one person.
 *
 * Pure and framework-free, like ownership.ts: exercised without a database.
 */

export const MEMBER_ROLES = ["OWNER", "MEMBER"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBER_ACCOUNT_STATUSES = ["invited", "onboarding", "active", "disabled"] as const;
export type MemberAccountStatus = (typeof MEMBER_ACCOUNT_STATUSES)[number];

export const INVITATION_STATUSES = ["pending", "accepted", "expired", "revoked"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

/** How long an invitation stays usable. One number, one place — like ACCESS_TOKEN_TTL_DAYS. */
export const BINDER_INVITATION_TTL_DAYS = 7;

export interface MembershipCandidate {
  binderId: string;
  accountStatus: string;
  createdAt: string;
}

/**
 * Which membership governs a session, when a user has more than one.
 *
 * Only `active` memberships count — someone mid-onboarding on a second
 * workshop should not suddenly lose access to the one they already run. Ties
 * go to the oldest membership: whichever atelier this person joined first
 * keeps deciding what `/atelier` shows them, so switching between two active
 * workshops in the same session is never silent.
 */
export function resolveActiveMembership(
  memberships: readonly MembershipCandidate[],
): MembershipCandidate | null {
  const active = memberships.filter((m) => m.accountStatus === "active");
  if (active.length === 0) return null;
  return [...active].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
}

/** The role a newly accepted member gets: the first person into an atelier owns it. */
export function roleForNewMember(existingMemberCount: number): MemberRole {
  return existingMemberCount === 0 ? "OWNER" : "MEMBER";
}

export interface InvitationAcceptDecision {
  allowed: boolean;
  /** Say nothing about *why* beyond this — see decideClaim's reasoning. */
  reason?: string;
}

const GENERIC_INVITATION_PROBLEM =
  "Ce lien d'invitation n'est plus valable. Demandez-en un nouveau à l'atelier ou à Ma Reliure.";

/**
 * Whether an invitation can still be accepted, and by whom.
 *
 * One message for "expired", "already used" and "revoked" alike — the same
 * discipline as decideClaim's refusal: a stale link must not reveal which of
 * the three happened, only that it no longer works. `emailMismatch` gets its
 * own, more helpful message, because pointing an invited person at the
 * address the invitation actually went to is not a security leak — the
 * address is already in the e-mail they are holding.
 */
export function decideInvitationAcceptance(input: {
  status: string;
  expiresAt: string;
  invitedEmail: string;
  /** The signed-in account's own verified e-mail, if any. */
  accountEmail: string | null;
  now?: Date;
}): InvitationAcceptDecision {
  const now = input.now ?? new Date();
  if (input.status !== "pending") return { allowed: false, reason: GENERIC_INVITATION_PROBLEM };
  if (new Date(input.expiresAt).getTime() <= now.getTime()) {
    return { allowed: false, reason: GENERIC_INVITATION_PROBLEM };
  }
  if (
    input.accountEmail &&
    input.accountEmail.trim().toLowerCase() !== input.invitedEmail.trim().toLowerCase()
  ) {
    return {
      allowed: false,
      reason: `Cette invitation a été envoyée à ${input.invitedEmail}. Connectez-vous avec cette adresse pour l'accepter.`,
    };
  }
  return { allowed: true };
}
