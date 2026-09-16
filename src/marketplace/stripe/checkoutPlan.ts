/**
 * La décision "peut-on créer un Checkout pour cette proposition ?" et la
 * construction de ses lignes — pures, sans Stripe ni base de données, pour
 * rester testables sans mock lourd (§27 du brief du 16 septembre 2026).
 *
 * `marketplace_commercial_proposals` (acceptée, immuable) est la SEULE
 * source du montant (§10, §11) : ce module ne recalcule jamais un prix, il
 * traduit un snapshot déjà figé en lignes Stripe.
 */
import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";
import type { StripeProductIds } from "./stripeConfig.server";

export type CheckoutBlockReason =
  | "proposal_not_accepted"
  | "tax_review_required"
  | "already_paid";

export interface CheckoutEligibilityInput {
  status: string;
  acceptedAt: string | null;
  taxPolicy: string;
  alreadyPaid: boolean;
}

export type CheckoutEligibility =
  | { eligible: true }
  | { eligible: false; reason: CheckoutBlockReason };

/**
 * Fail closed (§22) : toute donnée essentielle manquante ou non résolue
 * bloque, jamais un "on fait au mieux". `tax_policy` reste aujourd'hui
 * toujours `TAX_REVIEW_REQUIRED` (aucun moteur fiscal construit) — cette
 * fonction bloquera donc tout Checkout tant que ça n'aura pas changé, et
 * c'est exactement l'intention : mieux vaut bloquer que facturer avec une
 * mauvaise TVA (§12).
 */
export function checkoutEligibility(input: CheckoutEligibilityInput): CheckoutEligibility {
  if (input.alreadyPaid) return { eligible: false, reason: "already_paid" };
  if (input.status !== "accepted" || !input.acceptedAt) {
    return { eligible: false, reason: "proposal_not_accepted" };
  }
  if (input.taxPolicy === "TAX_REVIEW_REQUIRED") {
    return { eligible: false, reason: "tax_review_required" };
  }
  return { eligible: true };
}

export interface CheckoutLineItem {
  productId: string;
  unitAmountCents: number;
  currency: string;
  quantity: 1;
}

export interface ProposalForCheckout {
  brand: MarketplaceBrand;
  currency: string;
  customerServicePriceCents: number;
  shippingTotalCents: number;
}

/**
 * Le service en ligne 1, le transport en ligne 2 seulement s'il y en a un —
 * jamais une ligne à 0 (§9-11). Fine Bindery ne reçoit ici que le résultat
 * final déjà multiplié : ce module ne connaît aucun coefficient de marque.
 */
export function buildCheckoutLineItems(
  proposal: ProposalForCheckout,
  productIds: StripeProductIds,
): CheckoutLineItem[] {
  const currency = proposal.currency.toLowerCase();
  const lines: CheckoutLineItem[] = [
    {
      productId:
        proposal.brand === "FINE_BINDERY" ? productIds.fineBinderyService : productIds.maReliureService,
      unitAmountCents: proposal.customerServicePriceCents,
      currency,
      quantity: 1,
    },
  ];
  if (proposal.shippingTotalCents > 0) {
    lines.push({
      productId: productIds.shipping,
      unitAmountCents: proposal.shippingTotalCents,
      currency,
      quantity: 1,
    });
  }
  return lines;
}
