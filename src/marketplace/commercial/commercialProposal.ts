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
/**
 * `MANUAL_TAX_REVIEW` reste la seule valeur qu'une proposition puisse porter
 * sans validation humaine (garanti aussi côté base, migration 20260917090000
 * : les quatre autres exigent `tax_validated_at`). Les quatre autres sont des
 * catégories que la plateforme sait nommer (§5 du brief du 17 septembre
 * 2026) — pas encore des taux : voir taxPolicy.ts.
 */
export type CommercialTaxPolicy =
  | "MANUAL_TAX_REVIEW"
  | "FR_B2C"
  | "EU_B2C"
  | "NON_EU_B2C"
  | "NON_EU_TEMPORARY_IMPORT_REEXPORT";

/** Ce qui a été soumis à la TVA — une seule valeur aujourd'hui (§8 : ne pas présumer que le transport suit le même régime que le service tant que ce n'est pas validé, mais ne pas complexifier avant qu'un vrai cas l'exige). */
export type TaxBasis = "service_and_shipping";

/** La seule source de validation construite pour l'instant — une décision admin, tracée. Une règle automatique validée par un expert-comptable ajouterait sa propre valeur ici, jamais un remplacement silencieux de celle-ci. */
export type TaxValidationSource = "manual_admin_review";

/**
 * `CUSTOMER` par défaut (particulier) — Fine Bindery recevra à terme des
 * antiquaires, libraires, hôtels, décorateurs, sociétés, family offices
 * (brief du 17 septembre 2026, §10) : le modèle ne doit jamais présumer
 * que tout client est un particulier, même si aucune UI B2B complète
 * n'existe encore.
 */
export type CustomerType = "CUSTOMER" | "BUSINESS";

/** `NOT_CHECKED` par défaut — aucune vérification automatique de numéro de TVA n'est construite (§10 : préparer le champ, pas l'automatiser). */
export type BusinessVatValidationStatus = "NOT_CHECKED" | "VALID" | "INVALID" | "UNAVAILABLE";

/**
 * D'où vient `pricebookReferenceCents` : quelles entrées Pricebook
 * publiées, à quelle version, ont produit ce total — pour pouvoir expliquer
 * a posteriori "prix Pricebook Ma Reliure → coefficient de marque → prix
 * client" sans recalculer (§3 du brief du 16 septembre 2026). `null` quand
 * `pricebookReferenceCents` l'est aussi.
 */
export interface PricebookProvenanceEntry {
  entryId: string;
  workItemKey: string;
  sizeClass: string;
  complexityClass: string;
  version: number;
  customerPriceCents: number;
}

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
  pricebookProvenance: PricebookProvenanceEntry[] | null;
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
  /** `null` tant que `taxPolicy` vaut `MANUAL_TAX_REVIEW` (§9) — jamais un pays deviné. */
  taxCountry: string | null;
  taxBasis: TaxBasis;
  /** Les trois champs de validation vont ensemble : soit tous `null` (MANUAL_TAX_REVIEW), soit tous renseignés (garanti aussi côté base). */
  taxValidationSource: TaxValidationSource | null;
  taxValidatedAt: string | null;
  taxValidatedBy: string | null;

  /** `"CUSTOMER"` sauf décision explicite contraire — jamais deviné depuis le brand ou le pays (§10). */
  customerType: CustomerType;
  /** Renseignés seulement pour `customerType: "BUSINESS"` — `null` sinon. */
  businessName: string | null;
  businessVatNumber: string | null;
  businessVatValidationStatus: BusinessVatValidationStatus | null;
  billingCountry: string | null;

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
  pricebookProvenance: PricebookProvenanceEntry[] | null;
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
  /** `null` tant que `taxPolicy` reste MANUAL_TAX_REVIEW : jamais un TTC calculé sur un taux non validé. */
  customerTotalTtcCents: number | null;
  taxCountry: string | null;
  taxBasis: TaxBasis;
  taxValidationSource: TaxValidationSource | null;
  taxValidatedAt: string | null;
  taxValidatedBy: string | null;

  customerType: CustomerType;
  businessName: string | null;
  businessVatNumber: string | null;
  businessVatValidationStatus: BusinessVatValidationStatus | null;
  billingCountry: string | null;

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
    pricebookProvenance: input.pricebookProvenance,
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
    taxCountry: input.taxCountry,
    taxBasis: input.taxBasis,
    taxValidationSource: input.taxValidationSource,
    taxValidatedAt: input.taxValidatedAt,
    taxValidatedBy: input.taxValidatedBy,
    customerType: input.customerType,
    businessName: input.businessName,
    businessVatNumber: input.businessVatNumber,
    businessVatValidationStatus: input.businessVatValidationStatus,
    billingCountry: input.billingCountry,
    depositType: input.deposit.type,
    depositValueBps: input.deposit.valueBps,
    depositAmountCents: input.deposit.amountCents,
    balanceDueCents,
    status: input.status ?? "draft",
    notes: input.notes ?? null,
  };
}
