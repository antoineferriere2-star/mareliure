/**
 * Quand un client peut accepter lui-même une proposition commerciale.
 *
 * Pure : aucune lecture, aucune écriture, aucun prix. Le serveur lui donne les
 * faits qu'il vient de relire en base ; elle répond oui ou pourquoi non.
 *
 * Une proposition n'est acceptable par son client que si l'accepter mène à un
 * état réellement payable. C'est pourquoi la fiscalité et l'identité
 * professionnelle sont jugées par `checkoutEligibility` — la même fonction que
 * le Checkout —, appelée comme si la proposition était déjà acceptée : la règle
 * n'est écrite qu'une fois, et un bouton « Accepter » ne peut pas conduire à un
 * client bloqué devant un « Payer » qui échouerait.
 */
import type { AmountDueInput } from "@/marketplace/stripe/amountDue";
import { checkoutEligibility } from "@/marketplace/stripe/checkoutPlan";

export type AcceptanceBlock =
  | "already_accepted"
  | "not_open"
  | "case_closed"
  | "price_not_validated"
  | "tax_review_required"
  | "business_identity_incomplete"
  /** Le montant exigible n'est pas payable (TVA non résolue, snapshot incohérent, acompte non supporté). */
  | "not_payable";

export type CustomerAcceptance = { acceptable: true } | { acceptable: false; reason: AcceptanceBlock };

export interface CustomerAcceptanceInput {
  status: string;
  acceptedAt: string | null;
  supersededAt: string | null;
  taxPolicy: string;
  taxValidatedAt: string | null;
  customerType: string;
  businessName: string | null;
  /** Le snapshot dont dépend le montant : accepter ne doit jamais mener à une commande impayable. */
  amount: AmountDueInput;
  /** Le prix du dossier a été validé par un humain (`marketplace_cases.pricing_status`). */
  casePriceValidated: boolean;
  /** `marketplace_cases.status` : on n'accepte pas une proposition sur un projet clos. */
  caseStatus: string;
}

const CLOSED_CASE_STATUSES: readonly string[] = ["cancelled", "completed", "delivered"];

export function customerAcceptance(input: CustomerAcceptanceInput): CustomerAcceptance {
  if (input.acceptedAt) return { acceptable: false, reason: "already_accepted" };
  // `proposed` est la seule étape où une proposition est présentée à un client :
  // `draft` est interne, `superseded` et `cancelled` sont remplacées ou retirées.
  if (input.status !== "proposed" || input.supersededAt) return { acceptable: false, reason: "not_open" };
  if (CLOSED_CASE_STATUSES.includes(input.caseStatus)) return { acceptable: false, reason: "case_closed" };
  if (!input.casePriceValidated) return { acceptable: false, reason: "price_not_validated" };

  const afterAcceptance = checkoutEligibility({
    status: "accepted",
    acceptedAt: "pending-acceptance",
    taxPolicy: input.taxPolicy,
    taxValidatedAt: input.taxValidatedAt,
    customerType: input.customerType,
    businessName: input.businessName,
    alreadyPaid: false,
    amount: input.amount,
  });
  if (!afterAcceptance.eligible) {
    if (afterAcceptance.reason === "business_identity_incomplete") {
      return { acceptable: false, reason: "business_identity_incomplete" };
    }
    if (afterAcceptance.reason !== "tax_review_required") return { acceptable: false, reason: "not_payable" };
    return { acceptable: false, reason: "tax_review_required" };
  }
  return { acceptable: true };
}
