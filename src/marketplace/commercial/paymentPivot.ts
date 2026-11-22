/**
 * Fin des encaissements par la plateforme (pivot du 22 novembre 2026).
 *
 * Oppe ne perçoit plus aucun paiement client : son seul revenu est l'abonnement du relieur, qui
 * facture et se fait régler lui-même. Les dossiers engagés avant cette date se terminent aux
 * conditions d'origine ; seule l'ouverture de nouveaux encaissements est refusée.
 *
 * Deux règles, volontairement distinctes :
 * - un Checkout de proposition commerciale (revente Oppe) est refusé pour un dossier créé à partir
 *   de la date de bascule ;
 * - un nouveau lien de paiement d'atelier (frais de 3 %) et une nouvelle configuration Stripe
 *   Connect sont refusés ; un lien déjà ouvert continue de fonctionner jusqu'à son terme.
 */
export const PAYMENT_PIVOT_AT = "2026-11-22T00:00:00.000Z";

export const PLATFORM_PAYMENTS_RETIRED_MESSAGE =
  "Ma Reliure n'encaisse plus de paiement : l'atelier vous facture et vous règle directement avec lui.";

export const WORKSHOP_ONLINE_PAYMENT_RETIRED_MESSAGE =
  "Le paiement en ligne par la plateforme n'est plus proposé : vous facturez et êtes réglé directement.";

/**
 * Plus de nouvelle configuration Stripe Connect ni de nouveau lien de paiement d'atelier. Typé
 * `boolean` (et non littéral) pour que le code derrière reste lisible tant qu'il n'est pas retiré.
 */
export const WORKSHOP_ONLINE_PAYMENT_OPENING_RETIRED: boolean = true;

/** Vrai pour un dossier créé à partir de la bascule. Une date illisible est traitée comme récente (fail closed). */
export function createdAfterPaymentPivot(createdAt: string | null | undefined): boolean {
  const time = createdAt ? Date.parse(createdAt) : Number.NaN;
  if (!Number.isFinite(time)) return true;
  return time >= Date.parse(PAYMENT_PIVOT_AT);
}
