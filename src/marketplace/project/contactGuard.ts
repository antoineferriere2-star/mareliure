/**
 * Les coordonnées ne passent pas par la conversation.
 *
 * Ma Reliure organise l'acheminement du livre et le paiement ; un numéro ou
 * une adresse échangés dans le fil, c'est la transaction qui sort du cadre, et
 * le client qui perd la protection qu'il est venu chercher. La garde est
 * volontairement simple : elle attrape l'échange accidentel — « appelez-moi au
 * 06… » —, pas la personne décidée à contourner, qui trouvera toujours une
 * façon d'écrire son numéro. Pas de modération par IA.
 *
 * Elle refuse l'envoi et dit pourquoi, plutôt que de masquer en silence : un
 * message tronqué sans explication fait croire à une panne.
 */

export type ContactKind = "email" | "phone" | "messaging_link";

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;

/**
 * Un numéro français (06 12 34 56 78, 06.12.34.56.78, 0612345678) ou
 * international (+33 6 12 34 56 78, 0033…). Les dates et les références de
 * dossier n'ont ni l'indicatif ni les cinq paires de chiffres.
 */
const PHONE_FR = /(?<!\d)0[1-9](?:[\s.-]?\d{2}){4}(?!\d)/;
const PHONE_INTL = /(?:\+|\b00)\s?[1-9]\d{0,2}(?:[\s.-]?\d){8,12}(?!\d)/;

const MESSAGING = /\b(?:wa\.me|whatsapp|telegram|t\.me|signal\.me|m\.me|messenger)\b/i;

export function detectContactDetails(text: string): ContactKind[] {
  const kinds: ContactKind[] = [];
  if (EMAIL.test(text)) kinds.push("email");
  if (PHONE_FR.test(text) || PHONE_INTL.test(text)) kinds.push("phone");
  if (MESSAGING.test(text)) kinds.push("messaging_link");
  return kinds;
}

export const CONTACT_GUARD_MESSAGE =
  "Les coordonnées ne passent pas par la conversation : Ma Reliure organise l'acheminement de votre livre et le paiement. Retirez l'adresse e-mail, le numéro ou le lien de messagerie pour envoyer votre message.";
