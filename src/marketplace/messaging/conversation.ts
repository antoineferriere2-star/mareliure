/**
 * Who may read and write in a case's conversation, and what counts as unread.
 *
 * Deliberately its own access decision, not a reuse of permissions.ts'
 * canViewCase — a relieur sollicité mais non retenu keeps a
 * marketplace_case_matches row (state 'offered', 'accepted', 'declined',
 * 'cancelled'…), and canViewCase treats "has any match row" as "may view".
 * That is correct for the case record itself, but a conversation carries what
 * the customer and the platform actually said — an atelier that is merely
 * INVITED (`offered`) or available (`accepted`) has no right to it yet
 * (Phase 0 / P1-6; before, both could read and write the whole thread), and
 * one that lost the job must not keep reading it (§72). So the only workshop
 * that ever enters a conversation is the one that was `selected`.
 *
 * What each party READS inside the conversation is bounded by the message's
 * persisted audience — see audience.ts.
 *
 * Pure and framework-free, like permissions.ts.
 */
import type { Viewer } from "@/marketplace/permissions";

export interface ConversationAccessFacts {
  /**
   * The workshop whose match is `selected` AND that is still in good standing
   * (a suspended or rejected workshop is `null` here) — the only one that may enter.
   */
  selectedBinderId: string | null;
  customerUserId: string | null;
}

export function canAccessConversation(viewer: Viewer, facts: ConversationAccessFacts): boolean {
  switch (viewer.role) {
    case "admin":
      return true;
    case "customer":
      return facts.customerUserId !== null && facts.customerUserId === viewer.userId;
    case "binder":
      return facts.selectedBinderId !== null && facts.selectedBinderId === viewer.binderId;
    case "anonymous":
      return false;
  }
}

export type SenderRole = "customer" | "binder" | "admin";

/** The role a message is attributed to, from the same Viewer that authorises it. */
export function senderRoleFor(viewer: Viewer): SenderRole | null {
  switch (viewer.role) {
    case "admin":
      return "admin";
    case "customer":
      return "customer";
    case "binder":
      return "binder";
    case "anonymous":
      return null;
  }
}

export interface ConversationMessageFacts {
  senderUserId: string | null;
  createdAt: string;
}

/**
 * How many messages this viewer has not yet seen.
 *
 * Their own messages never count — sending one is not "reading" in the
 * blue-tick sense this product deliberately avoids (§18), but a person does
 * not need to be told they have an unread message they wrote themselves.
 * `lastReadAt` of `null` (never opened the thread) counts everything from
 * someone else.
 */
export function unreadCount(
  messages: readonly ConversationMessageFacts[],
  viewerUserId: string,
  lastReadAt: string | null,
): number {
  const threshold = lastReadAt ? new Date(lastReadAt).getTime() : -Infinity;
  return messages.filter(
    (message) =>
      message.senderUserId !== viewerUserId && new Date(message.createdAt).getTime() > threshold,
  ).length;
}
