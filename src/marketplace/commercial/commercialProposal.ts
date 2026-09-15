/**
 * Le snapshot commercial — l'engagement, distinct de la projection.
 *
 * `marketplace_cases` reste la ligne mutable qui dit où en est un dossier
 * (statut, suggestion courante). Une ligne `marketplace_commercial_proposals`
 * est autre chose : la photographie figée d'UNE version d'une proposition
 * pour ce dossier. Avant acceptation, une nouvelle version peut en remplacer
 * une autre. Une fois `acceptedAt` posé, plus aucune écriture n'est permise
 * (garanti par un trigger Postgres, migration 20260916100000) — un
 * changement de Pricebook, de coefficient de marque ou de conditions
 * atelier survenant après coup ne doit jamais rouvrir silencieusement une
 * commande honorée.
 *
 * Ce module ne touche aucune base : il reçoit les ingrédients déjà décidés
 * (par `suggestManagedPrice` + `applyBrandServicePricing`, par un choix
 * d'acompte, par un shipping saisi à la main) et rend un objet complet, prêt
 * à insérer tel quel — jamais à recalculer plus tard à partir de la ligne.
 */
import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";
import type { PricingMode } from "@/marketplace/pricing/pricingMode";

export type CommercialProposalStatus = "draft" | "proposed" | "accepted" | "superseded" | "cancelled";
export type DepositType = "NONE" | "FIXED" | "PERCENTAGE";
export type PriceBoundBy = "reference" | "margin_floor" | "contribution_floor";
/** Une seule valeur possible aujourd'hui (brandPricing.ts) — le type reste ouvert pour la politique fiscale à venir. */
export type CommercialTaxPolicy = "TAX_REVIEW_REQUIRED";

export interface ShippingInput {
  outboundCents: number;
  returnCents: number;
  otherCents: number;
}

/**
 * La politique d'acompte réellement appliquée à CETTE proposition — jamais
 * une référence vers la règle courante (`depositCentsFor`, pricingMode.ts) :
 * si la règle change demain, cette proposition doit continuer à dire ce
 * qu'elle promettait le jour de l'offre (§12 de l'audit).
 */
export interface DepositPolicyInput {
  type: DepositType;
  /** Points de base, uniquement pour `PERCENTAGE` — `null` sinon. */
  valueBps: number | null;
  amountCents: number;
}

export interface CommercialProposalSnapshotInput {
  caseId: string;
  brand: MarketplaceBrand;
  currency: string;
  pricingMode: PricingMode;
  /** `PricingSuggestion.ruleVersion` (PRICING_POLICY.version) au moment du calcul. */
  pricingRuleVersion: string;

  /**
   * `null` tant qu'aucune correspondance Pricebook publiée n'est relue par
   * dossier (voir pricing.types.ts#pricebookReferenceCents) — pas une valeur
   * à deviner ici.
   */
  pricebookReferenceCents: number | null;
  brandMultiplierBps: number;
  /** `pricebookReferenceCents × brandMultiplierBps`, quand le premier existe. */
  brandReferenceCents: number | null;

  binderPayoutCents: number;
  binderVatRateBps: number | null;

  targetMarginBps: number;
  minimumContributionCents: number;
  marginFloorCents: number;
  contributionFloorCents: number;
  priceBoundBy: PriceBoundBy;

  customerServicePriceCents: number;
  /** Uniquement en ESTIMATE_THEN_CONFIRM. */
  estimateMinCents: number | null;
  estimateMaxCents: number | null;

  /** P0 : jamais de shipping_margin ni de handling — voir shippingMarginCents/shippingHandlingFeeCents ci-dessous, toujours 0. */
  shipping: ShippingInput;

  taxPolicy: CommercialTaxPolicy;
  customerVatRateBps: number | null;

  deposit: DepositPolicyInput;

  status?: CommercialProposalStatus;
  notes?: string | null;
}

export interface CommercialProposalSnapshot {
  caseId: string;
  brand: MarketplaceBrand;
  currency: string;
  pricingMode: PricingMode;
  pricingRuleVersion: string;

  pricebookReferenceCents: number | null;
  brandMultiplierBps: number;
  brandReferenceCents: number | null;

  binderPayoutCents: number;
  binderVatRateBps: number | null;
  binderVatAmountCents: number | null;
  binderPayoutTtcCents: number | null;

  targetMarginBps: number;
  minimumContributionCents: number;
  marginFloorCents: number;
  contributionFloorCents: number;
  priceBoundBy: PriceBoundBy;

  customerServicePriceCents: number;
  estimateMinCents: number | null;
  estimateMaxCents: number | null;

  shippingOutboundCents: number;
  shippingReturnCents: number;
  shippingOtherCents: number;
  shippingTotalCents: number;
  /** Toujours 0 en P0 (audit §8) — la colonne existe, rien ne la calcule encore. */
  shippingMarginCents: number;
  shippingHandlingFeeCents: number;

  taxPolicy: CommercialTaxPolicy;
  customerVatRateBps: number | null;
  customerVatAmountCents: number | null;
  customerTotalHtCents: number;
  /** `null` tant que `taxPolicy` reste TAX_REVIEW_REQUIRED : jamais un TTC calculé sur un taux non validé. */
  customerTotalTtcCents: number | null;

  depositType: DepositType;
  depositValueBps: number | null;
  depositAmountCents: number;
  balanceDueCents: number;

  status: CommercialProposalStatus;
  notes: string | null;
}

/**
 * Assemble un snapshot complet à partir des ingrédients déjà décidés.
 *
 * Ne lit ni ne décide rien par elle-même — la TVA, le shipping et l'acompte
 * sont des entrées, jamais recalculés ici à partir d'une config globale : le
 * jour où cette config change, les propositions déjà construites ne
 * doivent pas changer de valeur silencieusement.
 */
export function buildCommercialProposalSnapshot(
  input: CommercialProposalSnapshotInput,
): CommercialProposalSnapshot {
  const shippingTotalCents =
    input.shipping.outboundCents + input.shipping.returnCents + input.shipping.otherCents;

  const binderVatAmountCents =
    input.binderVatRateBps !== null
      ? Math.round((input.binderPayoutCents * input.binderVatRateBps) / 10_000)
      : null;
  const binderPayoutTtcCents =
    binderVatAmountCents !== null ? input.binderPayoutCents + binderVatAmountCents : null;

  const customerTotalHtCents = input.customerServicePriceCents + shippingTotalCents;
  const customerVatAmountCents =
    input.customerVatRateBps !== null
      ? Math.round((customerTotalHtCents * input.customerVatRateBps) / 10_000)
      : null;
  const customerTotalTtcCents =
    customerVatAmountCents !== null ? customerTotalHtCents + customerVatAmountCents : null;

  // HT-first : le solde se calcule sur le HT tant que la TVA reste en revue,
  // jamais sur un TTC provisoire qui laisserait croire à une décision fiscale
  // prise (audit §9).
  const balanceDueCents = Math.max(0, customerTotalHtCents - input.deposit.amountCents);

  return {
    caseId: input.caseId,
    brand: input.brand,
    currency: input.currency,
    pricingMode: input.pricingMode,
    pricingRuleVersion: input.pricingRuleVersion,
    pricebookReferenceCents: input.pricebookReferenceCents,
    brandMultiplierBps: input.brandMultiplierBps,
    brandReferenceCents: input.brandReferenceCents,
    binderPayoutCents: input.binderPayoutCents,
    binderVatRateBps: input.binderVatRateBps,
    binderVatAmountCents,
    binderPayoutTtcCents,
    targetMarginBps: input.targetMarginBps,
    minimumContributionCents: input.minimumContributionCents,
    marginFloorCents: input.marginFloorCents,
    contributionFloorCents: input.contributionFloorCents,
    priceBoundBy: input.priceBoundBy,
    customerServicePriceCents: input.customerServicePriceCents,
    estimateMinCents: input.estimateMinCents,
    estimateMaxCents: input.estimateMaxCents,
    shippingOutboundCents: input.shipping.outboundCents,
    shippingReturnCents: input.shipping.returnCents,
    shippingOtherCents: input.shipping.otherCents,
    shippingTotalCents,
    shippingMarginCents: 0,
    shippingHandlingFeeCents: 0,
    taxPolicy: input.taxPolicy,
    customerVatRateBps: input.customerVatRateBps,
    customerVatAmountCents,
    customerTotalHtCents,
    customerTotalTtcCents,
    depositType: input.deposit.type,
    depositValueBps: input.deposit.valueBps,
    depositAmountCents: input.deposit.amountCents,
    balanceDueCents,
    status: input.status ?? "draft",
    notes: input.notes ?? null,
  };
}
