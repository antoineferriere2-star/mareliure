/**
 * Ce qui suit un paiement vérifié d'une commande Oppe (activité A). Chaque étape est
 * idempotente : un webhook rejoué, ou deux événements Stripe pour le même paiement
 * (session et PaymentIntent), ne produisent jamais deux commandes.
 *
 *   1. ouvrir la commande et son affectation atelier (marketplace_open_oppe_order) ;
 *
 * Une étape qui échoue fait répondre le webhook en erreur : Stripe le rejoue, les étapes déjà
 * faites ne se refont pas.
 */
import type { Supa } from "@/build/services/adminAuth.server";

export async function onOppePaymentConfirmed(
  sb: Supa,
  input: { caseId: string; proposalId: string; paymentIntentId: string; paidAt?: string },
): Promise<{ orderOpened: boolean }> {
  const { data, error } = await sb.rpc("marketplace_open_oppe_order", {
    p_proposal_id: input.proposalId,
    p_paid_at: input.paidAt ?? new Date().toISOString(),
  });
  if (error) throw error;
  return { orderOpened: data === true };
}
