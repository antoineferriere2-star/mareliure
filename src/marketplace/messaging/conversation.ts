/**
 * Who may read and write in a case's conversation, and what counts as unread.
 *
 * Deliberately its own access decision, not a reuse of permissions.ts'
 * canViewCase — a relieur sollicité mais non retenu keeps a
 * marketplace_case_matches row after being passed over (state moves to
 * 'declined' or 'cancelled', the row itself is not deleted), and canViewCase
 * treats "has any match row" as "may view". That is correct for the case
 * record itself, but a conversation carries what the customer and the
 * selected atelier actually said to each other — an atelier that lost the
 * job must not keep reading it (§72: "BINDER sollicité mais non retenu perd
 * l'accès au contenu privé approprié"). So this module only ever considers
 * binder ids whose match is still live (`offered` or `accepted`) plus
 * whichever one was `selected`.
 *
 * Pure and framework-free, like permissions.ts.
 */
import type { Viewer } from "@/marketplace/permissions";

/** Match states that still give a workshop a live stake in the case. */
export const LIVE_MATCH_STATES = ["offered", "accepted", "selected"] as const;

export interface ConversationAccessFacts {
  /** binder_ids whose match is offered/accepted/selected — never declined or cancelled. */
  liveBinderIds: readonly string[];
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
      return (
        facts.liveBinderIds.includes(viewer.binderId) ||
        facts.selectedBinderId === viewer.binderId
      );
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

/**
 * Ce que le client d'une marque lit dans le fil de son dossier.
 *
 * Ma Reliure : tout — le fil est partagé entre le client, son atelier et
 * l'équipe. Fine Bindery (`customerWorkshopDirectMessaging: false`, modèle
 * concierge) : jamais un message d'atelier — son seul interlocuteur est le
 * concierge, qui relaie. Un message d'atelier n'est donc ni envoyé au navigateur
 * de ce client, ni compté dans ses non-lus.
 *
 * Ceci ne décide que de ce que LIT le client. Ce que lit l'atelier (le fil
 * entier, messages du client compris) n'est pas touché ici : voir la section
 * « modèle concierge » de docs/CODEX_HANDOFF.md.
 */
export function customerVisibleSenderRoles(directWorkshopMessaging: boolean): readonly SenderRole[] {
  return directWorkshopMessaging ? ["customer", "binder", "admin"] : ["customer", "admin"];
}

/** Les rôles d'auteur dont un client ne reçoit aucun message — le complément du précédent. */
export function hiddenSenderRolesForCustomer(directWorkshopMessaging: boolean): readonly SenderRole[] {
  const visible = customerVisibleSenderRoles(directWorkshopMessaging);
  return (["customer", "binder", "admin"] as const).filter((role) => !visible.includes(role));
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
