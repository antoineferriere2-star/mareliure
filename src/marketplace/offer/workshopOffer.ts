/**
 * L'offre faite aux ateliers (modèle Oppe du 5 octobre 2026) : une seule source pour les montants
 * et l'état d'ouverture, lue par la page « Pour les relieurs », la FAQ et les conditions.
 *
 * Pivot du 22 novembre 2026 : Oppe n'encaisse plus aucun paiement client et ne prélève plus de frais.
 *
 * - Abonnement : 19,90 € HT par mois (19,90 $ pour Fine Bindery), page vitrine incluse, 14 jours
 *   d'essai sans carte. Les ateliers déjà inscrits restent gratuits tant qu'ils n'ont pas accepté
 *   expressément la transition. Aucun volume de commandes n'est garanti.
 * - Paiement en ligne (ancienne activité C, frais de 3 %) : fermé. `platformFeeBps` ne sert qu'à lire
 *   les paiements engagés avant le 22 novembre, qui se terminent aux conditions d'origine.
 *
 * `subscriptionOpen` et `onlinePaymentOpen` passent à `true` quand la configuration externe
 * correspondante est faite et vérifiée (produit Stripe de l'abonnement ; plateforme Connect
 * et recette hébergée). Chaque atelier doit activer ses capacités Stripe avant d'encaisser.
 * Tant qu'ils valent `false`, les pages le disent et rien ne s'achète.
 */
export const WORKSHOP_OFFER = {
  subscriptionHtCents: 1_990,
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
