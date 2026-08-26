/**
 * Who is told when a Project Brief arrives.
 *
 * The notification used to go to every member of the workspace, with nothing to
 * change it. For a product whose whole value is how quickly someone reacts,
 * that was the most expensive missing setting — and the most uncomfortable: a
 * business that invites two sales reps and a subcontractor was emailing every
 * customer's name, address and budget to all of them.
 *
 * Pure and dependency-free so the rule can be tested without a mailbox.
 */

export const BRIEF_NOTIFICATION_MODES = ["all_members", "owners_only", "off"] as const;
export type BriefNotificationMode = (typeof BRIEF_NOTIFICATION_MODES)[number];

/** What every workspace did before the column existed. */
export const DEFAULT_BRIEF_NOTIFICATION: BriefNotificationMode = "all_members";

/**
 * Takes the raw column value because it is read straight off a Supabase row.
 * Anything unrecognised falls back to the default rather than to silence: a bad
 * value must not quietly stop a business hearing about its own customers.
 */
export function toBriefNotificationMode(value: string | null | undefined): BriefNotificationMode {
  return (BRIEF_NOTIFICATION_MODES as readonly string[]).includes(value ?? "")
    ? (value as BriefNotificationMode)
    : DEFAULT_BRIEF_NOTIFICATION;
}

export interface NotifiableMember {
  email: string | null;
  role: string;
}

/**
 * The addresses to email, deduplicated.
 *
 * `off` returns none. It is a real choice — some businesses watch the portal
 * and do not want another inbox — and it is never inferred from anything else.
 */
export function recipientsFor(members: NotifiableMember[], mode: BriefNotificationMode): string[] {
  if (mode === "off") return [];
  const eligible = mode === "owners_only" ? members.filter((m) => m.role === "owner") : members;
  return [
    ...new Set(
      eligible
        .map((m) => m.email?.trim())
        .filter((email): email is string => Boolean(email && email.length > 0)),
    ),
  ];
}

/** Operator-facing description, kept beside the rule so a new mode cannot ship without one. */
export const BRIEF_NOTIFICATION_LABEL: Record<BriefNotificationMode, string> = {
  all_members: "Everyone in this workspace",
  owners_only: "Owners only",
  off: "No one — I will check the portal",
};
