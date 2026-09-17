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
  | "business_identity_incomplete"
  | "already_paid";

export interface CheckoutEligibilityInput {
  status: string;
  acceptedAt: string | null;
  taxPolicy: string;
  /** `null` tant que personne n'a validé la fiscalité (§9-10 du brief du 17 septembre 2026) — jamais déduit du seul `taxPolicy`. */
  taxValidatedAt: string | null;
  /** `"CUSTOMER"` ou `"BUSINESS"` (§10, §15 du brief du 17 septembre 2026) — le modèle ne présume jamais qu'un client est un particulier. */
  customerType: string;
  /** Requis quand `customerType` vaut `"BUSINESS"` — `null` sinon. Garanti cohérent en base (contrainte CHECK, migration 20260917100000) ; revérifié ici, jamais supposé. */
  businessName: string | null;
  alreadyPaid: boolean;
}

export type CheckoutEligibility =
  | { eligible: true }
  | { eligible: false; reason: CheckoutBlockReason };

/**
 * Fail closed (§22) : toute donnée essentielle manquante ou non résolue
 * bloque, jamais un "on fait au mieux". Tant qu'une proposition n'a pas une
 * fiscalité validée (`taxPolicy` différent de `MANUAL_TAX_REVIEW` ET
 * `taxValidatedAt` renseigné — les deux, jamais l'un sans l'autre, même si
 * la base garantit déjà leur cohérence), cette fonction bloque tout
 * Checkout : mieux vaut bloquer que facturer avec une mauvaise TVA (§12).
 */
export function checkoutEligibility(input: CheckoutEligibilityInput): CheckoutEligibility {
  if (input.alreadyPaid) return { eligible: false, reason: "already_paid" };
  if (input.status !== "accepted" || !input.acceptedAt) {
    return { eligible: false, reason: "proposal_not_accepted" };
  }
  if (input.taxPolicy === "MANUAL_TAX_REVIEW" || !input.taxValidatedAt) {
    return { eligible: false, reason: "tax_review_required" };
  }
  if (input.customerType === "BUSINESS" && !input.businessName) {
    return { eligible: false, reason: "business_identity_incomplete" };
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

/**
 * Le suffixe de relevé bancaire par marque (paiements carte) — jamais
 * fourni par le navigateur, toujours dérivé côté serveur de
 * `commercialProposal.brand` (brief du 16 septembre 2026, correction
 * technique de l'utilisateur : `PaymentIntent.statement_descriptor` ne
 * s'applique pas aux cartes, Stripe impose `statement_descriptor_suffix`,
 * combiné par Stripe avec le préfixe raccourci du compte
 * — cible « OPPE » — pour donner par exemple `OPPE* MARELIURE`).
 *
 * Contraintes Stripe (préfixe + suffixe) : 22 caractères combinés au
 * maximum, au moins une lettre, aucun caractère parmi `< > \ ' "`, mis en
 * majuscules automatiquement. Avec le préfixe cible « OPPE » (4
 * caractères) : `OPPE* MARELIURE` = 15 caractères, `OPPE* FINEBINDERY` =
 * 17 caractères — les deux tiennent largement sous la limite.
 */
export function statementDescriptorSuffixForBrand(brand: MarketplaceBrand): string {
  return brand === "FINE_BINDERY" ? "FINEBINDERY" : "MARELIURE";
}
