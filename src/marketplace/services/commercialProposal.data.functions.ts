/**
 * La couche commerciale immuable — séparée de `marketplace.data.functions.ts`
 * pour la même raison que `pricing.data.functions.ts` : un métier différent.
 * Ici on fige un engagement, on ne fait pas avancer un dossier.
 *
 * Réservé à l'administration dans cette phase (audit du 15 septembre 2026,
 * Phase 1) : aucun parcours client n'accepte encore une proposition
 * lui-même — ce sera la Phase Checkout. "Accepter" ici correspond à ce que
 * `marketplace_validate_pricing` fait déjà pour la ligne `marketplace_cases`
 * (une décision humaine, tracée), appliqué à la nouvelle couche snapshot.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertAdmin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { isMarketplaceBrand } from "@/marketplace/brand/brandConfig";
import { PRICING_POLICY } from "@/marketplace/pricing/pricing.rules";
import { authoritativeServicePrice } from "@/marketplace/commercial/authoritativePrice";
import { REPRICE_BLOCK_MESSAGES } from "@/marketplace/cases/engagement";
import { lookupPricebookReference, resolveServicePriceFloors } from "@/marketplace/pricing/pricebook";
import { resolveWork } from "@/marketplace/pricing/workResolver";
import { PRICING_MODES, type PricingMode } from "@/marketplace/pricing/pricingMode";
import {
  buildCommercialProposalSnapshot,
  type CommercialTaxPolicy,
  type DepositPolicyInput,
  type PricebookProvenanceEntry,
} from "@/marketplace/commercial/commercialProposal";
import {
  isCommercialTaxPolicy,
  recomputeProposalTax,
  resolveAutomaticTaxPolicy,
  validateTaxPolicySelection,
} from "@/marketplace/commercial/taxPolicy";
import { SERVICE_TAX_CATEGORIES, computeLineTax } from "@/marketplace/commercial/taxMatrix";
import { administrativeRateApproval } from "@/marketplace/commercial/administrativeTaxApproval";
import { shippingTaxQualificationError } from "@/marketplace/commercial/shippingTaxQualification";
import { getPaymentPreflight as loadPaymentPreflight } from "@/marketplace/stripe/paymentPreflight.server";
import { loadCaseContext } from "./caseRepository.server";
import { ROUND_TRIP_HT_CENTS, ROUND_TRIP_PRODUCT, logisticsErrorCode } from "@/marketplace/shipping/logisticsPlan";
import { CIRCUIT_REFUSALS, circuitRefusal, commercialOriginOf } from "@/marketplace/cases/commercialOrigin";
import { loadPricebook } from "./pricingRepository.server";
import { assertProposalPriceCurrent } from "./pricingGuards.server";
import {
  insertCommercialProposal,
  listCommercialProposals,
  loadAcceptedCommercialProposal,
  loadCommercialProposalById,
  nextProposalVersion,
  resetProposalTaxToManualReview as resetProposalTaxToManualReviewRow,
  updateProposalTaxValidation,
} from "./commercialProposalRepository.server";

const uuid = z.string().uuid();

/** Les refus SQL de l'accord atelier (migration 20261005120000), dits à l'administration. */
const AGREEMENT_REFUSALS: Record<string, string> = {
  workshop_agreement_required: "L'atelier retenu doit d'abord accepter la prestation, sa rémunération et son délai.",
  workshop_payout_mismatch: "La rémunération du devis doit être celle que l'atelier a acceptée.",
  margin_below_target_without_derogation:
    "La marge est inférieure à 25 % du prix de vente HT : appliquez le prix cible ou motivez une dérogation.",
  proposal_agreement_immutable: "Les termes de cette proposition sont figés : créez une nouvelle version.",
  customer_acceptance_required: "Seul le client peut accepter cette proposition, depuis son espace.",
};

function agreementRefusal(message: string): string | null {
  const code = Object.keys(AGREEMENT_REFUSALS).find((key) => message.includes(key));
  return code ? AGREEMENT_REFUSALS[code] : null;
}

/** L'offre retenue et acceptée par l'atelier : la seule source des termes atelier d'un devis. */
export async function loadSelectedWorkshopAgreement(sb: Awaited<ReturnType<typeof admin>>, caseId: string) {
  const { data, error } = await sb
    .from("marketplace_quotes")
    .select("id, binder_id, binder_payout_cents, lead_time_days, service_description, agreement_version, accepted_at, selected_at")
    .eq("case_id", caseId)
    .eq("state", "selected")
    .not("agreement_version", "is", null)
    .order("selected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.binder_payout_cents === null) return null;
  return {
    offerId: data.id,
    binderId: data.binder_id,
    binderPayoutCents: data.binder_payout_cents,
    leadTimeDays: data.lead_time_days,
    serviceDescription: data.service_description,
    acceptedAt: data.accepted_at,
  };
}

/** Ce que les fonctions « cœur » lisent du contexte authentifié : de quoi vérifier le rôle admin et tracer l'auteur. */
export type AdminCallContext = { supabase: Parameters<typeof assertAdmin>[0]; userId: string };


const shippingInput = z
  .object({
    outboundCents: z.number().int().min(0).default(0),
    returnCents: z.number().int().min(0).default(0),
    otherCents: z.number().int().min(0).default(0),
  })
  .default({ outboundCents: 0, returnCents: 0, otherCents: 0 });

const createInput = z.object({
  caseId: uuid,
  shipping: shippingInput,
  /**
   * Produit transport explicite. `book_round_trip_fr` ajoute la ligne « Transport aller-retour —
   * 15 € TTC » (12,50 € HT) et lie la proposition à la version du plan logistique ; la base refuse
   * si le plan n'est pas éligible. Jamais déduit d'un montant saisi.
   */
  shippingOffer: z.enum(["manual", ROUND_TRIP_PRODUCT]).default("manual"),
});

const ROUND_TRIP_REFUSALS: Record<string, string> = {
  logistics_plan_required: "Le client n'a pas encore choisi l'acheminement de son livre.",
  brand_unsupported: "Le transport aller-retour n'est proposé que sur les dossiers Ma Reliure et Fine Bindery.",
  mode_not_organized: "Le client n'a pas choisi l'expédition organisée.",
  valuable_book: "Livre ancien, unique ou de valeur déclarée ≥ 100 € : traitement adapté, pas de forfait.",
  workshop_acceptance_required: "L'atelier retenu n'a pas accepté la réception pour la version actuelle du plan.",
  outside_mainland: "Une adresse est hors France métropolitaine (Corse, outre-mer, étranger) : devis distinct.",
  parcel_review: "Colis emballé au-delà de 500 g ou 35 × 25 × 8 cm : traitement adapté.",
};

/**
 * Construit et enregistre une nouvelle version de proposition à partir du
 * prix courant du dossier (`marketplace_cases`). Ne recalcule aucun prix :
 * elle fige ce que `generateMarketplacePricing`/`saveMarketplacePricing` ont
 * déjà décidé, au moment où elle est créée.
 *
 * Les planchers (`marginFloorCents`/`contributionFloorCents`/`priceBoundBy`)
 * sont recalculés ici depuis la rémunération atelier et la politique
 * courante — un choix délibéré : `marketplace_cases` ne conserve pas cette
 * décomposition, et la recalculer donne la même réponse tant que la
 * politique n'a pas changé depuis la génération du prix. Une fois la
 * proposition enregistrée, elle ne bougera plus, quoi qu'il arrive ensuite
 * à la politique.
 */
export async function createCommercialProposalCore(context: AdminCallContext, data: z.infer<typeof createInput>) {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const caseContext = await loadCaseContext(sb, data.caseId);
    if (!caseContext) fail(404, "Dossier introuvable");
    const row = caseContext.row;
    // Le client propre d'un atelier achète à l'atelier, jamais à Oppe (garde SQL identique).
    if (commercialOriginOf(row.acquisition_origin) === "workshop_client")
      fail(409, CIRCUIT_REFUSALS.oppe_sale_forbidden_on_workshop_client);

    // Une proposition acceptée fige le dossier : une évolution commerciale n'est jamais un simple
    // « nouvelle version » silencieuse sur une commande déjà acceptée (P1-5).
    if (await loadAcceptedCommercialProposal(sb, data.caseId)) fail(409, REPRICE_BLOCK_MESSAGES.proposal_accepted);

    // Modèle Oppe : le devis client reprend l'accord de l'atelier retenu (prestation, rémunération,
    // délai). La base l'impose aussi (b_marketplace_bind_proposal_to_agreement).
    const agreement = await loadSelectedWorkshopAgreement(sb, data.caseId);
    if (!agreement)
      fail(409, "L'atelier retenu doit d'abord accepter la prestation, sa rémunération et son délai.");
    if (agreement.binderPayoutCents !== row.binder_payout_cents)
      fail(409, "La rémunération acceptée par l'atelier diffère de celle du prix validé : revalidez le prix avant le devis.");

    // UNE autorité de prix (P1-4) : le prix client RETENU et VALIDÉ par un humain — jamais la sortie
    // brute du moteur (`service_price_cents`), qui peut avoir été corrigée depuis.
    const price = authoritativeServicePrice({
      pricingStatus: row.pricing_status,
      customerPriceCents: row.customer_price_cents,
      binderPayoutCents: row.binder_payout_cents,
      suggestedCustomerPriceCents: row.suggested_customer_price_cents,
    });
    if (!price.ok) {
      fail(
        409,
        price.reason === "price_not_validated"
          ? "Le prix de ce dossier doit d'abord être validé avant de construire une proposition."
          : "Ce dossier n'a pas de prix client validé.",
      );
    }
    const pricingMode: PricingMode = PRICING_MODES.includes(row.pricing_mode as PricingMode)
      ? (row.pricing_mode as PricingMode)
      : "MANUAL_STUDY";

    // Relue ici plutôt que devinée depuis marketplace_cases : la ligne ne
    // conserve pas la décomposition par travail, mais le profil du dossier
    // (answers) suffit à la reconstruire — resolveWork est déjà ce que
    // suggestManagedPrice appelle pour produire workItemKeys/sizeClass/
    // complexityClass, jamais un second calcul divergent.
    const work = resolveWork(caseContext.profile);
    const pricebookEntries = await loadPricebook(sb);
    const pricebookMatch = lookupPricebookReference(
      pricebookEntries,
      work.workItemKeys,
      work.sizeClass,
      work.complexityClass,
    );
    const pricebookReferenceCents = pricebookMatch?.referenceCents ?? null;
    const brandMultiplierBps = row.brand_multiplier_bps ?? 10_000;
    // Même arrondi que applyBrandServicePricing (toujours vers le haut) :
    // c'est ce que ce multiplicateur produirait sur la référence Pricebook,
    // jamais une seconde règle d'arrondi pour la même marque.
    const brandReferenceCents =
      pricebookReferenceCents !== null
        ? Math.ceil(
            (pricebookReferenceCents * brandMultiplierBps) /
              10_000 /
              PRICING_POLICY.roundingIncrementCents,
          ) * PRICING_POLICY.roundingIncrementCents
        : null;
    const pricebookProvenance: PricebookProvenanceEntry[] | null = pricebookMatch
      ? pricebookMatch.matches.map((m) => ({
          entryId: m.entry.id,
          workItemKey: m.entry.workItemKey,
          sizeClass: m.entry.sizeClass,
          complexityClass: m.entry.complexityClass,
          version: m.entry.version,
          customerPriceCents: m.entry.customerPriceCents,
        }))
      : null;

    const floors = resolveServicePriceFloors({
      binderPayoutCents: price.binderPayoutCents,
      targetMarginBps: PRICING_POLICY.targetMarginBps,
      minimumContributionCents: PRICING_POLICY.minimumContributionCents,
      roundingIncrementCents: PRICING_POLICY.roundingIncrementCents,
      // v6 : la référence Pricebook est un repère, jamais un plancher imposé au client.
      referenceCents: PRICING_POLICY.pricebookBindsPrice ? pricebookReferenceCents : null,
    });

    const roundTrip = data.shippingOffer === ROUND_TRIP_PRODUCT;
    // L'offre aller-retour est un forfait payé en une fois au circuit de revente : pas d'acompte.
    if (roundTrip && pricingMode === "ESTIMATE_THEN_CONFIRM" && row.deposit_cents)
      fail(409, "Le transport aller-retour n'est pas proposé avec un acompte : traitez le transport manuellement.");
    const deposit: DepositPolicyInput =
      pricingMode === "ESTIMATE_THEN_CONFIRM" && row.deposit_cents
        ? {
            type: "PERCENTAGE",
            valueBps: PRICING_POLICY.depositPercentageBps,
            amountCents: row.deposit_cents,
          }
        : { type: "NONE", valueBps: null, amountCents: 0 };

    const snapshot = buildCommercialProposalSnapshot({
      caseId: data.caseId,
      brand: isMarketplaceBrand(row.brand) ? row.brand : "MA_RELIURE",
      currency: row.pricing_currency,
      pricingMode,
      pricingRuleVersion: row.pricing_rule_version ?? PRICING_POLICY.version,
      pricebookReferenceCents,
      pricebookProvenance,
      brandMultiplierBps,
      brandReferenceCents,
      binderPayoutCents: price.binderPayoutCents,
      binderVatRateBps: null,
      targetMarginBps: PRICING_POLICY.targetMarginBps,
      minimumContributionCents: PRICING_POLICY.minimumContributionCents,
      marginFloorCents: floors.marginFloorCents,
      contributionFloorCents: floors.contributionFloorCents,
      priceBoundBy: floors.boundBy,
      customerServicePriceCents: price.priceCents,
      estimateMinCents: pricingMode === "ESTIMATE_THEN_CONFIRM" ? row.pricing_low_estimate_cents : null,
      estimateMaxCents: pricingMode === "ESTIMATE_THEN_CONFIRM" ? row.pricing_high_estimate_cents : null,
      shipping: roundTrip ? { outboundCents: 0, returnCents: 0, otherCents: ROUND_TRIP_HT_CENTS } : data.shipping,
      taxPolicy: "MANUAL_TAX_REVIEW",
      customerVatRateBps: null,
      taxCountry: null,
      taxBasis: "service_and_shipping",
      taxValidationSource: null,
      taxValidatedAt: null,
      taxValidatedBy: null,
      // L'identité client se finalise avec la fiscalité, avant acceptation
      // (validateCommercialProposalTax) — jamais devinée à la création
      // (§10 du brief du 17 septembre 2026 : un client est CUSTOMER par
      // défaut, jamais présumé BUSINESS).
      customerType: "CUSTOMER",
      businessName: null,
      businessVatNumber: null,
      businessVatValidationStatus: null,
      billingCountry: null,
      deposit,
      // Brouillon : visible du client seulement une fois envoyé (markCommercialProposalSent).
      status: "draft",
    });

    const version = await nextProposalVersion(sb, data.caseId);
    let proposal: Awaited<ReturnType<typeof insertCommercialProposal>>;
    try {
      proposal = await insertCommercialProposal(sb, snapshot, version, context.userId, data.shippingOffer, row.pricing_derogation_reason ?? null);
    } catch (error) {
      const message = String((error as { message?: string })?.message ?? "");
      const refusal = circuitRefusal(message) ?? agreementRefusal(message);
      if (refusal) fail(409, refusal);
      const code = logisticsErrorCode(message);
      if (!code) throw error;
      fail(409, ROUND_TRIP_REFUSALS[message.split(":")[1]?.trim() ?? ""] ?? ROUND_TRIP_REFUSALS[code] ??
        "Le transport aller-retour ne peut pas être proposé pour ce dossier.");
    }

    await sb.from("marketplace_events").insert({
      case_id: data.caseId,
      actor_user_id: context.userId,
      event_type: version === 1 ? "commercial_proposal_created" : "commercial_proposal_revised",
      metadata: {
        proposal_id: proposal.id,
        version: proposal.version,
        brand: proposal.brand,
        customer_service_price_cents: proposal.customerServicePriceCents,
        binder_payout_cents: proposal.binderPayoutCents,
        price_bound_by: proposal.priceBoundBy,
        // Traçabilité : la suggestion initiale du moteur et la correction humaine éventuelle.
        suggested_price_cents: price.suggestedPriceCents,
        price_corrected_by_human: price.correctedByHuman,
      },
    });

    return proposal;
}

export const createCommercialProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createInput.parse(data))
  .handler(async ({ context, data }) => createCommercialProposalCore(context, data));

export const listCaseCommercialProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uuid.parse(data))
  .handler(async ({ context, data: caseId }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    return listCommercialProposals(sb, caseId);
  });

// L'acceptation n'appartient qu'au client (customerProposalAcceptance.server.ts) : aucune
// fonction d'administration ne peut plus accepter une proposition à sa place (modèle Oppe,
// 5 octobre 2026 ; garde SQL a_marketplace_require_customer_acceptance).

export const getAcceptedCommercialProposal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uuid.parse(data))
  .handler(async ({ context, data: caseId }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    return loadAcceptedCommercialProposal(sb, caseId);
  });

const validateTaxInput = z.object({
  proposalId: uuid,
  taxPolicy: z.string(),
  taxCountry: z.string().trim().min(1),
  // Points de base (1/100 de %) — jamais un pourcentage flottant, même
  // convention que le reste du snapshot (customerVatRateBps).
  customerVatRateBps: z.number().int().min(0).nullable(),
  // L'identité client se finalise ici, avec la fiscalité — les deux sont
  // figées ensemble avant acceptation (§10-11 du brief du 17 septembre
  // 2026). "CUSTOMER" par défaut : ne jamais présumer BUSINESS.
  customerType: z.enum(["CUSTOMER", "BUSINESS"]).default("CUSTOMER"),
  businessName: z.string().trim().min(1).nullable().default(null),
  businessVatNumber: z.string().trim().min(1).nullable().default(null),
  billingCountry: z.string().trim().min(1).nullable().default(null),
});

/**
 * L'unique écriture qui fait passer une proposition de `MANUAL_TAX_REVIEW`
 * à une catégorie fiscale nommée (§6, §9-10 du brief du 17 septembre 2026) —
 * une décision humaine, jamais une règle automatique : ce serveur ne calcule
 * aucun taux, il enregistre celui que l'admin a choisi et recalcule
 * uniquement l'arithmétique HT→TTC qui en découle. Réservé à une proposition
 * pas encore acceptée (voir updateProposalTaxValidation, garde-fou en base).
 */
export const validateCommercialProposalTax = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => validateTaxInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (!isCommercialTaxPolicy(data.taxPolicy)) fail(400, "Politique fiscale inconnue.");
    const taxPolicy: CommercialTaxPolicy = data.taxPolicy;

    const check = validateTaxPolicySelection({
      policy: taxPolicy,
      country: data.taxCountry,
      vatRateBps: data.customerVatRateBps,
    });
    if (!check.ok) {
      const messages: Record<string, string> = {
        manual_review_is_not_a_validated_policy:
          "MANUAL_TAX_REVIEW n'est pas une politique validée — choisissez une catégorie concrète.",
        country_required: "Le pays de taxation est requis pour valider la fiscalité.",
        vat_rate_out_of_range: "Le taux de TVA saisi est hors limites raisonnables.",
      };
      fail(400, messages[check.reason]);
    }

    // Même garde-fou que la contrainte CHECK en base (migration
    // 20260917100000) — vérifié aussi ici pour un message clair plutôt
    // qu'une erreur Postgres brute (§10-11 du brief du 17 septembre 2026).
    if (data.customerType === "BUSINESS" && !data.businessName) {
      fail(400, "La raison sociale est requise pour un client professionnel (BUSINESS).");
    }

    const sb = await admin();
    const proposal = await loadCommercialProposalById(sb, data.proposalId);
    if (!proposal) fail(404, "Proposition introuvable.");
    if (proposal.acceptedAt) fail(409, "Cette proposition est déjà acceptée et donc immuable.");
    if (proposal.contractVersion) fail(409, "Un devis Oppe se valide par qualification de la prestation et taux de chaque ligne.");
    // 15 € TTC n'existe qu'à la TVA française de 20 % : un autre régime exige une nouvelle version sans forfait.
    if (proposal.shippingOfferKind === ROUND_TRIP_PRODUCT &&
      (data.customerVatRateBps !== 2000 || data.taxCountry.trim().toUpperCase() !== "FR"))
      fail(409, "Le transport aller-retour à 15 € TTC suppose la TVA française à 20 %. Créez une version sans forfait pour un autre régime.");

    const recomputed = recomputeProposalTax(
      {
        customerServicePriceCents: proposal.customerServicePriceCents,
        shippingTotalCents: proposal.shippingTotalCents,
        depositAmountCents: proposal.depositAmountCents,
      },
      data.customerVatRateBps,
    );

    const updated = await updateProposalTaxValidation(sb, data.proposalId, {
      taxPolicy,
      taxCountry: data.taxCountry,
      customerVatRateBps: data.customerVatRateBps,
      taxBasis: "service_and_shipping",
      taxValidationSource: "manual_admin_review",
      validatedBy: context.userId,
      customerVatAmountCents: recomputed.customerVatAmountCents,
      customerTotalTtcCents: recomputed.customerTotalTtcCents,
      balanceDueCents: recomputed.balanceDueCents,
      customerType: data.customerType,
      businessName: data.businessName,
      businessVatNumber: data.businessVatNumber,
      businessVatValidationStatus: data.businessVatNumber ? "NOT_CHECKED" : null,
      billingCountry: data.billingCountry,
    });

    await sb.from("marketplace_events").insert({
      case_id: updated.caseId,
      actor_user_id: context.userId,
      event_type: "commercial_proposal_tax_validated",
      metadata: {
        proposal_id: updated.id,
        tax_policy: updated.taxPolicy,
        tax_country: updated.taxCountry,
        customer_vat_rate_bps: updated.customerVatRateBps,
        customer_type: updated.customerType,
      },
    });

    return updated;
  });

const validateLineTaxInput = z
  .object({
    proposalId: uuid,
    /** Catégorie fiscale de la politique (pays du client) : FR_B2C, EU_B2C, NON_EU_B2C… */
    taxPolicy: z.string(),
    taxCountry: z.string().trim().length(2),
    serviceTaxCategory: z.enum(SERVICE_TAX_CATEGORIES),
    /** Taux de la ligne de prestation, saisi et confirmé par l'administrateur (points de base). */
    serviceVatRateBps: z.number().int().min(0).max(3000),
    /** Taux de la ligne de transport ; obligatoire quand le devis comporte du transport. */
    shippingVatRateBps: z.number().int().min(0).max(3000).nullable(),
    shippingTaxNature: z.enum(["autonomous", "accessory", "manual_review"]).nullable().optional(),
    justification: z.string().trim().min(12).max(1000),
    customerType: z.enum(["CUSTOMER", "BUSINESS"]).default("CUSTOMER"),
    businessName: z.string().trim().min(1).nullable().default(null),
    businessVatNumber: z.string().trim().min(1).nullable().default(null),
  })
  .strict();

/**
 * Validation fiscale d'un devis Oppe : qualification de la prestation, taux de chaque ligne,
 * justification tracée. Aucun taux n'est choisi en silence : la matrice ne fait que suggérer.
 */
export async function validateOppeProposalTaxCore(context: AdminCallContext, data: z.infer<typeof validateLineTaxInput>) {
  await assertAdmin(context.supabase, context.userId);
  if (!isCommercialTaxPolicy(data.taxPolicy) || data.taxPolicy === "MANUAL_TAX_REVIEW") fail(400, "Choisissez une catégorie fiscale concrète.");
  const taxPolicy: CommercialTaxPolicy = data.taxPolicy;
  if (data.customerType === "BUSINESS" && !data.businessName) fail(400, "La raison sociale est requise pour un client professionnel.");
  const sb = await admin();
  const proposal = await loadCommercialProposalById(sb, data.proposalId);
  if (!proposal) fail(404, "Proposition introuvable.");
  if (proposal.acceptedAt) fail(409, "Cette proposition est déjà acceptée et donc immuable.");
  if (!proposal.contractVersion) fail(409, "Cette proposition historique suit l'ancienne validation fiscale.");
  if (proposal.shippingTotalCents > 0 && data.shippingVatRateBps === null) fail(422, "Indiquez le taux de la ligne de transport.");
  const shippingError = shippingTaxQualificationError({ shippingCents: proposal.shippingTotalCents,
    nature: data.shippingTaxNature, serviceRateBps: data.serviceVatRateBps,
    shippingRateBps: data.shippingVatRateBps, country: data.taxCountry });
  if (shippingError) fail(422, shippingError);
  if (proposal.shippingOfferKind === ROUND_TRIP_PRODUCT && data.shippingTaxNature !== "autonomous")
    fail(409, "Le forfait existant de 12,50 € HT/15 € TTC exige un transport qualifié d’autonome. Pour un accessoire ou un cas ambigu, créez une version sans ce forfait avec un transport chiffré et qualifié individuellement.");
  if (proposal.shippingOfferKind === ROUND_TRIP_PRODUCT && (data.shippingVatRateBps !== 2000 || data.taxCountry.toUpperCase() !== "FR"))
    fail(409, "Le forfait de transport aller-retour à 15 € TTC suppose 20 % sur sa ligne et une exécution facturée en France.");
  const tax = computeLineTax({
    serviceCents: proposal.customerServicePriceCents,
    shippingCents: proposal.shippingTotalCents,
    serviceRateBps: data.serviceVatRateBps,
    shippingRateBps: data.shippingVatRateBps,
  });
  const updated = await updateProposalTaxValidation(sb, data.proposalId, {
    taxPolicy,
    taxCountry: data.taxCountry.toUpperCase(),
    customerVatRateBps: data.serviceVatRateBps,
    taxBasis: "service_and_shipping",
    taxValidationSource: "manual_admin_review",
    validatedBy: context.userId,
    customerVatAmountCents: tax.vatCents,
    customerTotalTtcCents: tax.totalTtcCents,
    balanceDueCents: Math.max(0, tax.totalHtCents - proposal.depositAmountCents),
    customerType: data.customerType,
    businessName: data.businessName,
    businessVatNumber: data.businessVatNumber,
    businessVatValidationStatus: data.businessVatNumber ? "NOT_CHECKED" : null,
    billingCountry: data.taxCountry.toUpperCase(),
    shippingVatRateBps: data.shippingVatRateBps,
    serviceTaxCategory: data.serviceTaxCategory,
    taxJustification: proposal.shippingTotalCents > 0
      ? `[Transport ${data.shippingTaxNature}] ${data.justification}` : data.justification,
  });
  await sb.from("marketplace_events").insert({
    case_id: updated.caseId,
    actor_user_id: context.userId,
    event_type: "commercial_proposal_tax_validated",
    metadata: {
      proposal_id: updated.id, tax_policy: taxPolicy, tax_country: updated.taxCountry, service_tax_category: data.serviceTaxCategory,
      service_vat_rate_bps: data.serviceVatRateBps, shipping_vat_rate_bps: data.shippingVatRateBps,
      shipping_tax_nature: data.shippingTaxNature ?? null, justification: data.justification,
      total_ttc_cents: tax.totalTtcCents,
      administrative_rate_approval: administrativeRateApproval({
        category: data.serviceTaxCategory,
        serviceRateBps: data.serviceVatRateBps,
        shippingCents: proposal.shippingTotalCents,
        shippingRateBps: data.shippingVatRateBps,
        shippingNature: data.shippingTaxNature,
      }),
    },
  });
  return updated;
}

export const validateOppeProposalTax = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => validateLineTaxInput.parse(data))
  .handler(async ({ context, data }) => validateOppeProposalTaxCore(context, data));

const applyAutomaticFranceTaxInput = z.object({
  proposalId: uuid,
  billingCountry: z.string().trim().min(1),
  customerType: z.enum(["CUSTOMER", "BUSINESS"]).default("CUSTOMER"),
  businessName: z.string().trim().min(1).nullable().default(null),
  businessVatNumber: z.string().trim().min(1).nullable().default(null),
});

/**
 * La seule règle fiscale automatisée à ce jour — décision opérationnelle
 * temporaire de l'utilisateur (18 septembre 2026, "Décision fiscale
 * temporaire validée") : la TVA française standard (20 %) pour tout
 * dossier facturé en France, particulier ou professionnel. Refuse tout
 * autre pays (fail closed, §7 du brief) — ce n'est pas
 * `validateCommercialProposalTax` avec une valeur pré-remplie, c'est une
 * porte séparée, volontairement étroite, qui ne peut matériellement pas
 * s'appliquer à un dossier international.
 */
export async function applyAutomaticFranceTaxPolicyCore(context: AdminCallContext, data: z.infer<typeof applyAutomaticFranceTaxInput>) {
    await assertAdmin(context.supabase, context.userId);

    const automatic = resolveAutomaticTaxPolicy(data.billingCountry);
    if (!automatic) {
      fail(
        400,
        "La règle automatique ne s'applique qu'aux dossiers facturés en France (billing_country = FR).",
      );
    }
    if (data.customerType === "BUSINESS" && !data.businessName) {
      fail(400, "La raison sociale est requise pour un client professionnel (BUSINESS).");
    }

    const sb = await admin();
    const proposal = await loadCommercialProposalById(sb, data.proposalId);
    if (!proposal) fail(404, "Proposition introuvable.");
    if (proposal.acceptedAt) fail(409, "Cette proposition est déjà acceptée et donc immuable.");
    // Modèle Oppe : le taux dépend de la nature de la prestation et de l'ouvrage, jamais d'un pays.
    if (proposal.contractVersion) fail(409, "La TVA d'un devis Oppe se valide par qualification de la prestation et taux de chaque ligne.");

    const recomputed = recomputeProposalTax(
      {
        customerServicePriceCents: proposal.customerServicePriceCents,
        shippingTotalCents: proposal.shippingTotalCents,
        depositAmountCents: proposal.depositAmountCents,
      },
      automatic.vatRateBps,
    );

    const updated = await updateProposalTaxValidation(sb, data.proposalId, {
      taxPolicy: automatic.policy,
      taxCountry: "FR",
      customerVatRateBps: automatic.vatRateBps,
      taxBasis: "service_and_shipping",
      taxValidationSource: automatic.validationSource,
      // Volontairement `null` : ce n'est pas un admin qui valide (§4 du
      // brief du 18 septembre 2026) — voir commercialProposal.ts.
      validatedBy: null,
      customerVatAmountCents: recomputed.customerVatAmountCents,
      customerTotalTtcCents: recomputed.customerTotalTtcCents,
      balanceDueCents: recomputed.balanceDueCents,
      customerType: data.customerType,
      businessName: data.businessName,
      businessVatNumber: data.businessVatNumber,
      businessVatValidationStatus: data.businessVatNumber ? "NOT_CHECKED" : null,
      billingCountry: data.billingCountry.trim().toUpperCase(),
    });

    await sb.from("marketplace_events").insert({
      case_id: updated.caseId,
      actor_user_id: context.userId,
      event_type: "commercial_proposal_tax_auto_validated",
      metadata: {
        proposal_id: updated.id,
        tax_policy: updated.taxPolicy,
        tax_validation_source: updated.taxValidationSource,
        customer_type: updated.customerType,
      },
    });

    return updated;
}

export const applyAutomaticFranceTaxPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => applyAutomaticFranceTaxInput.parse(data))
  .handler(async ({ context, data }) => applyAutomaticFranceTaxPolicyCore(context, data));

/**
 * La porte de sortie que l'admin garde toujours (§2, §8 du brief du
 * 18 septembre 2026) : revenir à `MANUAL_TAX_REVIEW` sur une proposition
 * que la règle automatique (ou une validation manuelle) avait fixée, si
 * un cas particulier apparaît avant acceptation.
 */
export const resetProposalTaxToManualReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uuid.parse(data))
  .handler(async ({ context, data: proposalId }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const proposal = await loadCommercialProposalById(sb, proposalId);
    if (!proposal) fail(404, "Proposition introuvable.");
    if (proposal.acceptedAt) fail(409, "Cette proposition est déjà acceptée et donc immuable.");

    const updated = await resetProposalTaxToManualReviewRow(sb, proposalId);

    await sb.from("marketplace_events").insert({
      case_id: updated.caseId,
      actor_user_id: context.userId,
      event_type: "commercial_proposal_tax_reset_to_manual_review",
      metadata: { proposal_id: updated.id },
    });

    return updated;
  });

/**
 * L'écran de vérification avant le premier vrai paiement (§13) — jamais
 * calculé côté client : tout ce qu'il affiche vient d'une relecture
 * serveur, y compris l'appel réel à `assertExpectedStripeAccount`.
 */
export const getPaymentPreflight = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uuid.parse(data))
  .handler(async ({ context, data: caseId }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    return loadPaymentPreflight(sb, caseId);
  });
