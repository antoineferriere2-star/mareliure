/**
 * L'offre faite aux ateliers (modèle Oppe du 5 octobre 2026) : une seule source pour les montants
 * et l'état d'ouverture, lue par la page « Pour les relieurs », la FAQ et les conditions.
 *
 * - Activité B : abonnement de 15 € HT par mois, page vitrine incluse, pour les NOUVEAUX ateliers.
 *   Les ateliers déjà inscrits restent gratuits tant qu'ils n'ont pas accepté expressément la
 *   transition. Aucun volume de commandes du réseau n'est garanti.
 * - Activité C : frais plateforme de 3 % du TTC encaissé en ligne, TVA comprise ; frais Stripe séparés, à la
 *   charge de l'atelier. Un règlement direct ne coûte rien.
 *
 * `subscriptionOpen` et `onlinePaymentOpen` passent à `true` quand la configuration externe
 * correspondante est faite et vérifiée (produit Stripe de l'abonnement ; compte Connect de
 * l'atelier). Tant qu'ils valent `false`, les pages le disent et rien ne s'achète.
 */
export const WORKSHOP_OFFER = {
  subscriptionHtCents: 1_500,
  subscriptionOpen: true,
  platformFeeBps: 300,
  onlinePaymentOpen: false,
  /** Délai de règlement d'un atelier par Oppe, à compter de l'émission d'une facture conforme. */
  workshopPaymentDays: 30,
} as const;

export const formatHtPrice = (cents: number): string =>
  `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: cents % 100 === 0 ? 0 : 2 })} € HT`;

export const SUBSCRIPTION_LABEL = `${formatHtPrice(WORKSHOP_OFFER.subscriptionHtCents)} par mois`;
export const PLATFORM_FEE_LABEL = `${WORKSHOP_OFFER.platformFeeBps / 100} %`;
