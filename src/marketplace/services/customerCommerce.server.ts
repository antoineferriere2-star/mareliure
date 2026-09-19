/**
 * Ce que l'espace client sait de l'aspect commercial d'un dossier — lecture
 * seule, une seule fois pour la liste et le détail.
 *
 * Ce fichier ne décide rien. Le garde-fou « ce dossier est-il payable ? » est
 * `checkoutEligibility`, appelé avec exactement les mêmes entrées que
 * `createCommercialCheckoutSession` : la liste et le détail ne peuvent donc
 * pas se contredire, et aucun des deux ne peut afficher un bouton dont le
 * Checkout échouerait à coup sûr. « Cette proposition est-elle acceptable par
 * son client ? » est `customerAcceptance`, la règle qu'applique aussi l'action
 * d'acceptation : le bouton « Accepter » n'apparaît que là où l'action réussirait.
 * Il ne calcule aucun prix, aucune taxe.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import { customerAcceptance } from "@/marketplace/commercial/customerAcceptance";
import { toCustomerProposalView, type CustomerProposalView } from "@/marketplace/commercial/customerProposalView";
import {
  loadAcceptedCommercialProposal,
  loadLatestCommercialProposal,
} from "@/marketplace/services/commercialProposalRepository.server";
import { loadCommercialPaymentState } from "@/marketplace/services/commercialPaymentRepository.server";
import { checkoutEligibility } from "@/marketplace/stripe/checkoutPlan";

export interface CustomerCommerce {
  /**
   * Vue client (liste blanche) de la proposition acceptée ou, à défaut, de celle
   * qu'on lui présente — `null` si aucune n'est présentable.
   */
  proposal: CustomerProposalView | null;
  /** La proposition affichée est celle que le client a acceptée. */
  proposalAccepted: boolean;
  /** Le client peut, maintenant, accepter la proposition affichée. */
  canAccept: boolean;
  paymentEligible: boolean;
  paidAt: string | null;
}

const NONE: CustomerCommerce = {
  proposal: null,
  proposalAccepted: false,
  canAccept: false,
  paymentEligible: false,
  paidAt: null,
};

/** Les deux faits du dossier dont dépend « peut-il accepter ? » — relus par l'appelant, jamais reçus du navigateur. */
export interface CaseCommerceFacts {
  /** `marketplace_cases.pricing_status === "validated"` — un prix validé par un humain. */
  priceValidated: boolean;
  /** `marketplace_cases.status`. */
  caseStatus: string;
}

export async function loadCustomerCommerce(
  sb: Supa,
  caseId: string,
  caseFacts: CaseCommerceFacts,
): Promise<CustomerCommerce> {
  const accepted = await loadAcceptedCommercialProposal(sb, caseId);
  if (accepted) {
    const paymentState = await loadCommercialPaymentState(sb, accepted.id);
    const paymentEligible = checkoutEligibility({
      status: accepted.status,
      acceptedAt: accepted.acceptedAt,
      taxPolicy: accepted.taxPolicy,
      taxValidatedAt: accepted.taxValidatedAt,
      customerType: accepted.customerType,
      businessName: accepted.businessName,
      alreadyPaid: !!paymentState?.paidAt,
      amount: accepted,
    }).eligible;

    return {
      proposal: toCustomerProposalView(accepted),
      proposalAccepted: true,
      canAccept: false,
      paymentEligible,
      paidAt: paymentState?.paidAt ?? null,
    };
  }

  // Aucune n'est acceptée : la dernière version est la seule que le client peut
  // voir, et seulement si elle est acceptable — une proposition en préparation
  // (fiscalité non validée, prix non validé) n'existe pas encore pour lui.
  const latest = await loadLatestCommercialProposal(sb, caseId);
  if (!latest) return NONE;
  const verdict = customerAcceptance({
    status: latest.status,
    acceptedAt: latest.acceptedAt,
    supersededAt: latest.supersededAt,
    taxPolicy: latest.taxPolicy,
    taxValidatedAt: latest.taxValidatedAt,
    customerType: latest.customerType,
    businessName: latest.businessName,
    amount: latest,
    casePriceValidated: caseFacts.priceValidated,
    caseStatus: caseFacts.caseStatus,
  });
  if (!verdict.acceptable) return NONE;

  return {
    proposal: toCustomerProposalView(latest),
    proposalAccepted: false,
    canAccept: true,
    paymentEligible: false,
    paidAt: null,
  };
}
