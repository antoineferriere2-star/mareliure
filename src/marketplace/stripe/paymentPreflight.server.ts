/**
 * L'écran de vérification avant le premier vrai paiement (§13 du brief du
 * 17 septembre 2026) — un instantané de tout ce qui doit être vrai à la fois
 * pour qu'un Checkout serve une vraie commande, jamais une répétition du
 * calcul de `checkoutEligibility` (réutilisée telle quelle) : ce module
 * ajoute la lecture des à-côtés (compte Stripe, Products, webhook) que la
 * fonction pure ne peut pas connaître.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loadCaseContext } from "@/marketplace/services/caseRepository.server";
import { loadAcceptedCommercialProposal } from "@/marketplace/services/commercialProposalRepository.server";
import { loadCommercialPaymentState } from "@/marketplace/services/commercialPaymentRepository.server";
import { checkoutEligibility, statementDescriptorSuffixForBrand } from "./checkoutPlan";
import { getStripeProductIds, type StripeProductIds } from "./stripeConfig.server";
import { assertExpectedStripeAccount } from "./stripeClient.server";

type Supa = SupabaseClient<Database>;

export interface PaymentPreflightResult {
  found: boolean;
  ready: boolean;
  blockedReasons: string[];
  brand: string | null;
  caseReference: string | null;
  customerEmail: string | null;
  customerName: string | null;
  proposalStatus: string | null;
  serviceHtCents: number | null;
  shippingHtCents: number | null;
  totalHtCents: number | null;
  taxPolicy: string | null;
  taxCountry: string | null;
  customerVatRateBps: number | null;
  customerVatAmountCents: number | null;
  totalTtcCents: number | null;
  alreadyPaid: boolean;
  stripeExpectedAccountId: string | null;
  stripeAccountOk: boolean;
  stripeProductIds: StripeProductIds | null;
  statementDescriptorSuffix: string | null;
  webhookConfigured: boolean;
}

export async function getPaymentPreflight(sb: Supa, caseId: string): Promise<PaymentPreflightResult> {
  const blockedReasons: string[] = [];

  const caseContext = await loadCaseContext(sb, caseId);
  if (!caseContext) {
    return {
      found: false,
      ready: false,
      blockedReasons: ["case_not_found"],
      brand: null,
      caseReference: null,
      customerEmail: null,
      customerName: null,
      proposalStatus: null,
      serviceHtCents: null,
      shippingHtCents: null,
      totalHtCents: null,
      taxPolicy: null,
      taxCountry: null,
      customerVatRateBps: null,
      customerVatAmountCents: null,
      totalTtcCents: null,
      alreadyPaid: false,
      stripeExpectedAccountId: process.env.STRIPE_EXPECTED_ACCOUNT_ID ?? null,
      stripeAccountOk: false,
      stripeProductIds: null,
      statementDescriptorSuffix: null,
      webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
    };
  }

  const proposal = await loadAcceptedCommercialProposal(sb, caseId);
  if (!proposal) blockedReasons.push("no_accepted_proposal");

  const paymentState = proposal ? await loadCommercialPaymentState(sb, proposal.id) : null;
  const alreadyPaid = !!paymentState?.paidAt;

  let stripeAccountOk = false;
  try {
    await assertExpectedStripeAccount();
    stripeAccountOk = true;
  } catch {
    blockedReasons.push("stripe_account_mismatch_or_unreachable");
  }

  let stripeProductIds: StripeProductIds | null = null;
  try {
    stripeProductIds = getStripeProductIds();
  } catch {
    blockedReasons.push("stripe_products_not_configured");
  }

  const webhookConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookConfigured) blockedReasons.push("stripe_webhook_not_configured");

  if (proposal) {
    const eligibility = checkoutEligibility({
      status: proposal.status,
      acceptedAt: proposal.acceptedAt,
      taxPolicy: proposal.taxPolicy,
      taxValidatedAt: proposal.taxValidatedAt,
      alreadyPaid,
    });
    if (!eligibility.eligible) blockedReasons.push(eligibility.reason);
  }

  const ready = blockedReasons.length === 0;

  return {
    found: true,
    ready,
    blockedReasons,
    brand: proposal?.brand ?? caseContext.row.brand,
    caseReference: caseContext.row.reference,
    customerEmail: caseContext.customerEmail,
    customerName: caseContext.customerName,
    proposalStatus: proposal?.status ?? null,
    serviceHtCents: proposal?.customerServicePriceCents ?? null,
    shippingHtCents: proposal?.shippingTotalCents ?? null,
    totalHtCents: proposal?.customerTotalHtCents ?? null,
    taxPolicy: proposal?.taxPolicy ?? null,
    taxCountry: proposal?.taxCountry ?? null,
    customerVatRateBps: proposal?.customerVatRateBps ?? null,
    customerVatAmountCents: proposal?.customerVatAmountCents ?? null,
    totalTtcCents: proposal?.customerTotalTtcCents ?? null,
    alreadyPaid,
    stripeExpectedAccountId: process.env.STRIPE_EXPECTED_ACCOUNT_ID ?? null,
    stripeAccountOk,
    stripeProductIds,
    statementDescriptorSuffix: proposal ? statementDescriptorSuffixForBrand(proposal.brand) : null,
    webhookConfigured,
  };
}
