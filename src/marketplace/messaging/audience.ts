/**
 * À QUI s'adresse un message d'un dossier — persisté, décidé côté serveur (Phase 0 / P1-6).
 *
 * Défaut corrigé : un dossier n'avait qu'UN fil. En modèle concierge (Fine Bindery) le client n'écrit
 * qu'au concierge et ne lit jamais l'atelier — mais c'était un filtre de LECTURE sur le rôle de
 * l'auteur, pas une séparation des messages : l'atelier lisait le fil entier, échanges privés
 * client ↔ concierge compris. Pire, un atelier simplement INVITÉ (`offered`) ou disponible
 * (`accepted`) avait accès à ce fil (et pouvait y écrire) avant d'avoir aucun droit sur le client.
 *
 * Trois audiences, stockées sur chaque message (`marketplace_messages.audience`) :
 *
 * - `shared` — le fil partagé client · atelier retenu · plateforme. Modèle DIRECT (Ma Reliure), tel
 *   qu'avant. Aussi la valeur des messages existants d'un dossier Ma Reliure.
 * - `customer_concierge` — client ↔ plateforme (le concierge). Jamais lu par un atelier.
 * - `workshop_platform` — atelier retenu ↔ plateforme. Jamais lu par le client.
 *
 * Qui lit quoi est une propriété de l'AUDIENCE et du modèle de marque, jamais un masquage d'interface.
 * Pur : aucune lecture, aucune écriture.
 */
import type { SenderRole } from "./conversation";

export const MESSAGE_AUDIENCES = ["shared", "customer_concierge", "workshop_platform"] as const;
export type MessageAudience = (typeof MESSAGE_AUDIENCES)[number];

export function isMessageAudience(value: unknown): value is MessageAudience {
  return typeof value === "string" && (MESSAGE_AUDIENCES as readonly string[]).includes(value);
}

/**
 * Les audiences qu'un lecteur reçoit. `directWorkshopMessaging` : Ma Reliure (`true`) ou concierge
 * (`false`). Un atelier n'y est autorisé qu'une fois RETENU — la vérification d'accès au fil
 * (`canAccessConversation`) l'exige ; ce qu'il lit ensuite est borné ici.
 */
export function readableAudiences(role: SenderRole, directWorkshopMessaging: boolean): readonly MessageAudience[] {
  switch (role) {
    case "admin":
      return MESSAGE_AUDIENCES;
    case "customer":
      return directWorkshopMessaging ? ["shared", "customer_concierge"] : ["customer_concierge"];
    case "binder":
      return directWorkshopMessaging ? ["shared", "workshop_platform"] : ["workshop_platform"];
  }
}

/** Un client d'une marque ne doit jamais être notifié d'un message qu'il ne peut pas lire. */
export function customerCanReadAudience(audience: MessageAudience, directWorkshopMessaging: boolean): boolean {
  return readableAudiences("customer", directWorkshopMessaging).includes(audience);
}

export type AudienceDecision = { ok: true; audience: MessageAudience } | { ok: false; reason: "audience_not_allowed" };

/**
 * L'audience d'un NOUVEAU message — décidée ici, jamais choisie par un client ou un atelier :
 * ils écrivent dans leur seul canal. Seule la plateforme (admin) choisit son canal ; par défaut celui
 * du client. `shared` n'existe pas en modèle concierge (personne ne le lirait).
 */
export function audienceForNewMessage(input: {
  senderRole: SenderRole;
  directWorkshopMessaging: boolean;
  /** Le canal demandé — n'est écouté que pour la plateforme. */
  requested?: MessageAudience | null;
}): AudienceDecision {
  const { senderRole, directWorkshopMessaging } = input;
  if (senderRole === "customer") {
    return { ok: true, audience: directWorkshopMessaging ? "shared" : "customer_concierge" };
  }
  if (senderRole === "binder") {
    return { ok: true, audience: directWorkshopMessaging ? "shared" : "workshop_platform" };
  }
  // admin
  const audience = input.requested ?? (directWorkshopMessaging ? "shared" : "customer_concierge");
  if (audience === "shared" && !directWorkshopMessaging) return { ok: false, reason: "audience_not_allowed" };
  return { ok: true, audience };
}
