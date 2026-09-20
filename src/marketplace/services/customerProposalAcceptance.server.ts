/**
 * Un client accepte la proposition qu'on lui présente.
 *
 * C'est la même écriture que l'acceptation admin (`acceptCommercialProposal`,
 * dans le dépôt de propositions) — celle qui pose `accepted_at` et rend la ligne
 * immuable par trigger. Ce fichier ne change ni cette écriture ni aucune de ses
 * garanties : il ajoute seulement, devant elle, ce qui fait qu'un client peut
 * la déclencher pour SON dossier et rien d'autre.
 *
 * Ce que le navigateur envoie : un `caseId` et le `proposalId` qu'il a sous les
 * yeux. Jamais un montant, une taxe, un statut. Le serveur recharge tout, dans
 * cet ordre — le dossier et son propriétaire, la proposition acceptée s'il y en
 * a une, la proposition demandée, la dernière version, puis la règle
 * d'acceptabilité — et n'écrit qu'ensuite.
 *
 *  - un autre compte que le propriétaire : refusé, rien n'est lu ni écrit ;
 *  - une proposition qui n'est plus la dernière (l'équipe l'a révisée pendant
 *    que le client la lisait) : refusée, le client relit la nouvelle — il
 *    n'accepte jamais un prix qu'il n'a pas vu ;
 *  - une seconde acceptation de la même proposition (double clic, deux onglets,
 *    course) : un succès qui ne change rien, sans second événement ;
 *  - après succès, la possibilité de payer est RECALCULÉE par
 *    `checkoutEligibility` (voir customerCommerce.server.ts), jamais supposée.
 */
import { z } from "zod";
import type { Supa } from "@/build/services/adminAuth.server";
import { customerAcceptance } from "@/marketplace/commercial/customerAcceptance";
import { proposalCarriesCurrentPrice } from "@/marketplace/commercial/authoritativePrice";
import { canViewCase } from "@/marketplace/permissions";
import { loadCaseContext } from "@/marketplace/services/caseRepository.server";
import {
  acceptCommercialProposal,
  loadAcceptedCommercialProposal,
  loadCommercialProposalById,
  loadLatestCommercialProposal,
} from "@/marketplace/services/commercialProposalRepository.server";
import { loadCustomerCommerce, type CustomerCommerce } from "@/marketplace/services/customerCommerce.server";

/**
 * `.strict()` : un champ en plus — un `amountCents`, un `status` — est refusé
 * plutôt qu'ignoré en silence. Le contrat est : deux identifiants, rien d'autre.
 */
export const acceptProposalInput = z
  .object({ caseId: z.string().uuid(), proposalId: z.string().uuid() })
  .strict();

export type AcceptProposalInput = z.infer<typeof acceptProposalInput>;

export type CustomerAcceptanceErrorCode =
  | "case_not_found"
  | "forbidden"
  | "proposal_not_found"
  | "proposal_changed"
  | "not_acceptable"
  | "accept_failed";

const STATUS_BY_CODE: Record<CustomerAcceptanceErrorCode, number> = {
  case_not_found: 404,
  forbidden: 403,
  proposal_not_found: 404,
  proposal_changed: 409,
  not_acceptable: 409,
  accept_failed: 500,
};

export class CustomerAcceptanceError extends Error {
  readonly code: CustomerAcceptanceErrorCode;
  readonly status: number;
  constructor(code: CustomerAcceptanceErrorCode) {
    super(code);
    this.name = "CustomerAcceptanceError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export interface AcceptProposalResult {
  /** `already_accepted` : rien n'a été écrit, la proposition l'était déjà. */
  outcome: "accepted" | "already_accepted";
  commerce: CustomerCommerce;
}

export async function acceptProposalForCustomer(
  sb: Supa,
  input: AcceptProposalInput & { userId: string },
): Promise<AcceptProposalResult> {
  const caseContext = await loadCaseContext(sb, input.caseId);
  if (!caseContext) throw new CustomerAcceptanceError("case_not_found");

  // La même décision d'accès que le détail et le Checkout : le propriétaire du
  // dossier (`customer_user_id`), et personne d'autre — pas même un atelier
  // invité, pas même un admin par ce chemin (l'admin a le sien).
  const allowed = canViewCase(
    { role: "customer", userId: input.userId },
    {
      invitedBinderIds: caseContext.invitedBinderIds,
      selectedBinderId: caseContext.selectedBinderId,
      customerUserId: caseContext.customerUserId,
    },
  );
  if (!allowed) throw new CustomerAcceptanceError("forbidden");

  const caseFacts = {
    priceValidated: caseContext.row.pricing_status === "validated",
    customerPriceCents: caseContext.row.customer_price_cents,
    caseStatus: caseContext.row.status,
  };
  const alreadyAccepted = async (): Promise<AcceptProposalResult> => ({
    outcome: "already_accepted",
    commerce: await loadCustomerCommerce(sb, input.caseId, caseFacts),
  });

  const accepted = await loadAcceptedCommercialProposal(sb, input.caseId);
  if (accepted) {
    // Idempotent pour la proposition que le client a acceptée ; une autre
    // proposition n'est plus la sienne à accepter.
    if (accepted.id === input.proposalId) return alreadyAccepted();
    throw new CustomerAcceptanceError("proposal_changed");
  }

  const proposal = await loadCommercialProposalById(sb, input.proposalId);
  // Une proposition d'un autre dossier reçoit la même réponse qu'une proposition
  // inexistante : cette action ne sert pas à sonder les identifiants.
  if (!proposal || proposal.caseId !== input.caseId) throw new CustomerAcceptanceError("proposal_not_found");

  const latest = await loadLatestCommercialProposal(sb, input.caseId);
  if (latest?.id !== proposal.id) throw new CustomerAcceptanceError("proposal_changed");

  const verdict = customerAcceptance({
    status: proposal.status,
    acceptedAt: proposal.acceptedAt,
    supersededAt: proposal.supersededAt,
    taxPolicy: proposal.taxPolicy,
    taxValidatedAt: proposal.taxValidatedAt,
    customerType: proposal.customerType,
    businessName: proposal.businessName,
    amount: proposal,
    casePriceValidated: caseFacts.priceValidated,
    proposalPriceCurrent: proposalCarriesCurrentPrice(proposal.customerServicePriceCents, {
      pricingStatus: caseFacts.priceValidated ? "validated" : null,
      customerPriceCents: caseFacts.customerPriceCents,
    }),
    caseStatus: caseFacts.caseStatus,
  });
  if (!verdict.acceptable) throw new CustomerAcceptanceError("not_acceptable");

  let done;
  try {
    done = await acceptCommercialProposal(sb, proposal.id);
  } catch {
    // Une acceptation concurrente de cette même proposition (deux onglets) a pu
    // passer entre notre lecture et notre écriture : c'est un succès, pas un échec.
    const now = await loadAcceptedCommercialProposal(sb, input.caseId);
    if (now?.id === proposal.id) return alreadyAccepted();
    throw new CustomerAcceptanceError(now ? "proposal_changed" : "accept_failed");
  }

  await sb.from("marketplace_events").insert({
    case_id: done.caseId,
    actor_user_id: input.userId,
    event_type: "commercial_proposal_accepted",
    metadata: {
      proposal_id: done.id,
      version: done.version,
      brand: done.brand,
      accepted_by: "customer",
    },
  });

  return {
    outcome: "accepted",
    commerce: await loadCustomerCommerce(sb, input.caseId, caseFacts),
  };
}
