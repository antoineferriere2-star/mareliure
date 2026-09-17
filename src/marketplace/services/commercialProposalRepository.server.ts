/**
 * L'accès à `marketplace_commercial_proposals`, côté serveur uniquement —
 * RLS refuse `anon`/`authenticated` (migration 20260916100000), comme toutes
 * les tables marketplace. Ce fichier ne décide de rien : il insère un
 * snapshot déjà construit (`buildCommercialProposalSnapshot`) et applique
 * les deux seules opérations qu'une ligne acceptée autorise encore de son
 * vivant — aucune, en fait : accepter EST la dernière écriture permise sur
 * cette ligne (le trigger `marketplace_commercial_proposals_immutable_after_acceptance`
 * l'impose).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type {
  CommercialProposalSnapshot,
  CommercialTaxPolicy,
  PricebookProvenanceEntry,
  TaxBasis,
  TaxValidationSource,
} from "@/marketplace/commercial/commercialProposal";

type Supa = SupabaseClient<Database>;

export interface CommercialProposalRow extends CommercialProposalSnapshot {
  id: string;
  version: number;
  createdAt: string;
  createdBy: string | null;
  validatedAt: string | null;
  validatedBy: string | null;
  acceptedAt: string | null;
  supersededAt: string | null;
}

const COLUMNS =
  "id, case_id, version, brand, currency, pricing_mode, pricing_rule_version, pricebook_reference_cents, pricebook_provenance, brand_multiplier_bps, brand_reference_cents, binder_payout_cents, binder_vat_rate_bps, binder_vat_amount_cents, binder_payout_ttc_cents, target_margin_bps, minimum_contribution_cents, margin_floor_cents, contribution_floor_cents, price_bound_by, customer_service_price_cents, estimate_min_cents, estimate_max_cents, shipping_outbound_cents, shipping_return_cents, shipping_other_cents, shipping_total_cents, shipping_margin_cents, shipping_handling_fee_cents, tax_policy, customer_vat_rate_bps, customer_vat_amount_cents, customer_total_ht_cents, customer_total_ttc_cents, tax_country, tax_basis, tax_validation_source, tax_validated_at, tax_validated_by, deposit_type, deposit_value_bps, deposit_amount_cents, balance_due_cents, status, notes, created_at, created_by, validated_at, validated_by, accepted_at, superseded_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(row: any): CommercialProposalRow {
  return {
    id: row.id,
    caseId: row.case_id,
    version: row.version,
    brand: row.brand,
    currency: row.currency,
    pricingMode: row.pricing_mode,
    pricingRuleVersion: row.pricing_rule_version,
    pricebookReferenceCents: row.pricebook_reference_cents,
    pricebookProvenance: row.pricebook_provenance as PricebookProvenanceEntry[] | null,
    brandMultiplierBps: row.brand_multiplier_bps,
    brandReferenceCents: row.brand_reference_cents,
    binderPayoutCents: row.binder_payout_cents,
    binderVatRateBps: row.binder_vat_rate_bps,
    binderVatAmountCents: row.binder_vat_amount_cents,
    binderPayoutTtcCents: row.binder_payout_ttc_cents,
    targetMarginBps: row.target_margin_bps,
    minimumContributionCents: row.minimum_contribution_cents,
    marginFloorCents: row.margin_floor_cents,
    contributionFloorCents: row.contribution_floor_cents,
    priceBoundBy: row.price_bound_by,
    customerServicePriceCents: row.customer_service_price_cents,
    estimateMinCents: row.estimate_min_cents,
    estimateMaxCents: row.estimate_max_cents,
    shippingOutboundCents: row.shipping_outbound_cents,
    shippingReturnCents: row.shipping_return_cents,
    shippingOtherCents: row.shipping_other_cents,
    shippingTotalCents: row.shipping_total_cents,
    shippingMarginCents: row.shipping_margin_cents,
    shippingHandlingFeeCents: row.shipping_handling_fee_cents,
    taxPolicy: row.tax_policy,
    customerVatRateBps: row.customer_vat_rate_bps,
    customerVatAmountCents: row.customer_vat_amount_cents,
    customerTotalHtCents: row.customer_total_ht_cents,
    customerTotalTtcCents: row.customer_total_ttc_cents,
    taxCountry: row.tax_country,
    taxBasis: row.tax_basis,
    taxValidationSource: row.tax_validation_source,
    taxValidatedAt: row.tax_validated_at,
    taxValidatedBy: row.tax_validated_by,
    depositType: row.deposit_type,
    depositValueBps: row.deposit_value_bps,
    depositAmountCents: row.deposit_amount_cents,
    balanceDueCents: row.balance_due_cents,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    createdBy: row.created_by,
    validatedAt: row.validated_at,
    validatedBy: row.validated_by,
    acceptedAt: row.accepted_at,
    supersededAt: row.superseded_at,
  };
}

/** La prochaine version pour ce dossier — 1 si aucune proposition n'existe encore. */
export async function nextProposalVersion(sb: Supa, caseId: string): Promise<number> {
  const { data, error } = await sb
    .from("marketplace_commercial_proposals")
    .select("version")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.version ?? 0) + 1;
}

/**
 * Insère une nouvelle version — jamais une mise à jour d'une ligne
 * existante : c'est ce qui garantit qu'un snapshot déjà accepté ne peut
 * matériellement pas être celui qu'on modifie par erreur.
 */
export async function insertCommercialProposal(
  sb: Supa,
  snapshot: CommercialProposalSnapshot,
  version: number,
  createdBy: string | null,
): Promise<CommercialProposalRow> {
  const { data, error } = await sb
    .from("marketplace_commercial_proposals")
    .insert({
      case_id: snapshot.caseId,
      version,
      brand: snapshot.brand,
      currency: snapshot.currency,
      pricing_mode: snapshot.pricingMode,
      pricing_rule_version: snapshot.pricingRuleVersion,
      pricebook_reference_cents: snapshot.pricebookReferenceCents,
      pricebook_provenance: snapshot.pricebookProvenance as unknown as Json,
      brand_multiplier_bps: snapshot.brandMultiplierBps,
      brand_reference_cents: snapshot.brandReferenceCents,
      binder_payout_cents: snapshot.binderPayoutCents,
      binder_vat_rate_bps: snapshot.binderVatRateBps,
      binder_vat_amount_cents: snapshot.binderVatAmountCents,
      binder_payout_ttc_cents: snapshot.binderPayoutTtcCents,
      target_margin_bps: snapshot.targetMarginBps,
      minimum_contribution_cents: snapshot.minimumContributionCents,
      margin_floor_cents: snapshot.marginFloorCents,
      contribution_floor_cents: snapshot.contributionFloorCents,
      price_bound_by: snapshot.priceBoundBy,
      customer_service_price_cents: snapshot.customerServicePriceCents,
      estimate_min_cents: snapshot.estimateMinCents,
      estimate_max_cents: snapshot.estimateMaxCents,
      shipping_outbound_cents: snapshot.shippingOutboundCents,
      shipping_return_cents: snapshot.shippingReturnCents,
      shipping_other_cents: snapshot.shippingOtherCents,
      shipping_total_cents: snapshot.shippingTotalCents,
      shipping_margin_cents: snapshot.shippingMarginCents,
      shipping_handling_fee_cents: snapshot.shippingHandlingFeeCents,
      tax_policy: snapshot.taxPolicy,
      customer_vat_rate_bps: snapshot.customerVatRateBps,
      customer_vat_amount_cents: snapshot.customerVatAmountCents,
      customer_total_ht_cents: snapshot.customerTotalHtCents,
      customer_total_ttc_cents: snapshot.customerTotalTtcCents,
      tax_country: snapshot.taxCountry,
      tax_basis: snapshot.taxBasis,
      tax_validation_source: snapshot.taxValidationSource,
      tax_validated_at: snapshot.taxValidatedAt,
      tax_validated_by: snapshot.taxValidatedBy,
      deposit_type: snapshot.depositType,
      deposit_value_bps: snapshot.depositValueBps,
      deposit_amount_cents: snapshot.depositAmountCents,
      balance_due_cents: snapshot.balanceDueCents,
      status: snapshot.status,
      notes: snapshot.notes,
      created_by: createdBy,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toRow(data);
}

export async function loadCommercialProposalById(
  sb: Supa,
  proposalId: string,
): Promise<CommercialProposalRow | null> {
  const { data, error } = await sb
    .from("marketplace_commercial_proposals")
    .select(COLUMNS)
    .eq("id", proposalId)
    .maybeSingle();
  if (error) throw error;
  return data ? toRow(data) : null;
}

export async function loadLatestCommercialProposal(
  sb: Supa,
  caseId: string,
): Promise<CommercialProposalRow | null> {
  const { data, error } = await sb
    .from("marketplace_commercial_proposals")
    .select(COLUMNS)
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toRow(data) : null;
}

export async function loadAcceptedCommercialProposal(
  sb: Supa,
  caseId: string,
): Promise<CommercialProposalRow | null> {
  const { data, error } = await sb
    .from("marketplace_commercial_proposals")
    .select(COLUMNS)
    .eq("case_id", caseId)
    .not("accepted_at", "is", null)
    .maybeSingle();
  if (error) throw error;
  return data ? toRow(data) : null;
}

export async function listCommercialProposals(
  sb: Supa,
  caseId: string,
): Promise<CommercialProposalRow[]> {
  const { data, error } = await sb
    .from("marketplace_commercial_proposals")
    .select(COLUMNS)
    .eq("case_id", caseId)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toRow);
}

export interface TaxValidationUpdate {
  taxPolicy: CommercialTaxPolicy;
  taxCountry: string;
  customerVatRateBps: number | null;
  taxBasis: TaxBasis;
  taxValidationSource: TaxValidationSource;
  validatedBy: string;
  customerVatAmountCents: number | null;
  customerTotalTtcCents: number | null;
  balanceDueCents: number;
}

/**
 * Valide la fiscalité d'une version encore modifiable — jamais une ligne
 * déjà acceptée (`accepted_at IS NULL` dans le WHERE, en plus du trigger
 * d'immuabilité côté base). C'est la seule écriture qui touche `tax_policy`
 * après la création : la proposition elle-même ne recalcule jamais son
 * prix, seule sa fiscalité change de `MANUAL_TAX_REVIEW` à une catégorie
 * validée (§9-10 du brief du 17 septembre 2026).
 */
export async function updateProposalTaxValidation(
  sb: Supa,
  proposalId: string,
  update: TaxValidationUpdate,
): Promise<CommercialProposalRow> {
  const { data, error } = await sb
    .from("marketplace_commercial_proposals")
    .update({
      tax_policy: update.taxPolicy,
      tax_country: update.taxCountry,
      customer_vat_rate_bps: update.customerVatRateBps,
      tax_basis: update.taxBasis,
      tax_validation_source: update.taxValidationSource,
      tax_validated_by: update.validatedBy,
      tax_validated_at: new Date().toISOString(),
      customer_vat_amount_cents: update.customerVatAmountCents,
      customer_total_ttc_cents: update.customerTotalTtcCents,
      balance_due_cents: update.balanceDueCents,
    })
    .eq("id", proposalId)
    .is("accepted_at", null)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toRow(data);
}

/**
 * Accepte une version — la seule écriture qu'une ligne `draft`/`proposed`
 * subit encore après sa création, et la dernière de sa vie : le trigger
 * refuse tout UPDATE ultérieur sur cette ligne. Les autres versions non
 * acceptées du même dossier passent `superseded`, par hygiène — l'index
 * partiel garantit déjà qu'une seule ligne acceptée peut exister par
 * dossier, ce marquage ne fait que le rendre lisible.
 *
 * Exige une fiscalité déjà validée (§9-10) — vérifié ici pour un message
 * précis, et garanti de toute façon par le trigger (migration
 * 20260917090000) si ce contrôle applicatif était contourné.
 */
export async function acceptCommercialProposal(
  sb: Supa,
  proposalId: string,
): Promise<CommercialProposalRow> {
  const { data: current, error: readError } = await sb
    .from("marketplace_commercial_proposals")
    .select("id, accepted_at, tax_validated_at")
    .eq("id", proposalId)
    .maybeSingle();
  if (readError) throw readError;
  if (!current) throw new Error("proposal_not_found");
  if (current.accepted_at) throw new Error("proposal_already_accepted");
  if (!current.tax_validated_at) throw new Error("proposal_tax_not_validated");

  const { data, error } = await sb
    .from("marketplace_commercial_proposals")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", proposalId)
    .is("accepted_at", null)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  const accepted = toRow(data);

  await sb
    .from("marketplace_commercial_proposals")
    .update({ status: "superseded", superseded_at: new Date().toISOString() })
    .eq("case_id", accepted.caseId)
    .neq("id", accepted.id)
    .in("status", ["draft", "proposed"]);

  return accepted;
}
