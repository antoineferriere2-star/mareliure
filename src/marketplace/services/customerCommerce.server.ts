/**
 * Ce que l'espace client sait de l'aspect commercial d'un dossier — lecture
 * seule, une seule fois pour la liste et le détail.
 *
 * Ce fichier ne décide rien. Le garde-fou « ce dossier est-il payable ? » est
 * `checkoutEligibility`, appelé avec exactement les mêmes entrées que
 * `createCommercialCheckoutSession` : la liste et le détail ne peuvent donc
 * pas se contredire, et aucun des deux ne peut afficher un bouton dont le
 * Checkout échouerait à coup sûr. Il ne calcule aucun prix, aucune taxe.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import { toCustomerProposalView, type CustomerProposalView } from "@/marketplace/commercial/customerProposalView";
import { loadAcceptedCommercialProposal } from "@/marketplace/services/commercialProposalRepository.server";
import { loadCommercialPaymentState } from "@/marketplace/services/commercialPaymentRepository.server";
import { checkoutEligibility } from "@/marketplace/stripe/checkoutPlan";

export interface CustomerCommerce {
  /** Vue client de la proposition acceptée (liste blanche), ou `null`. */
  proposal: CustomerProposalView | null;
  paymentEligible: boolean;
  paidAt: string | null;
}

export async function loadCustomerCommerce(sb: Supa, caseId: string): Promise<CustomerCommerce> {
  const accepted = await loadAcceptedCommercialProposal(sb, caseId);
  if (!accepted) return { proposal: null, paymentEligible: false, paidAt: null };

  const paymentState = await loadCommercialPaymentState(sb, accepted.id);
  const paymentEligible = checkoutEligibility({
    status: accepted.status,
    acceptedAt: accepted.acceptedAt,
    taxPolicy: accepted.taxPolicy,
    taxValidatedAt: accepted.taxValidatedAt,
    customerType: accepted.customerType,
    businessName: accepted.businessName,
    alreadyPaid: !!paymentState?.paidAt,
  }).eligible;

  return {
    proposal: toCustomerProposalView(accepted),
    paymentEligible,
    paidAt: paymentState?.paidAt ?? null,
  };
}
