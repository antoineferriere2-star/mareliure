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
import { getPaymentPreflight as loadPaymentPreflight } from "@/marketplace/stripe/paymentPreflight.server";
import { loadCaseContext } from "./caseRepository.server";
import { loadPricebook } from "./pricingRepository.server";
import {
  acceptCommercialProposal as acceptCommercialProposalRow,
  insertCommercialProposal,
  listCommercialProposals,
  loadAcceptedCommercialProposal,
  loadCommercialProposalById,
  nextProposalVersion,
  resetProposalTaxToManualReview as resetProposalTaxToManualReviewRow,
  updateProposalTaxValidation,
} from "./commercialProposalRepository.server";

const uuid = z.string().uuid();

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
});

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
export const createCommercialProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const caseContext = await loadCaseContext(sb, data.caseId);
    if (!caseContext) fail(404, "Dossier introuvable");
    const row = caseContext.row;

    if (row.service_price_cents === null || row.binder_payout_cents === null) {
      fail(409, "Ce dossier n'a pas encore de prix client calculé.");
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
      binderPayoutCents: row.binder_payout_cents,
      targetMarginBps: PRICING_POLICY.targetMarginBps,
      minimumContributionCents: PRICING_POLICY.minimumContributionCents,
      roundingIncrementCents: PRICING_POLICY.roundingIncrementCents,
      referenceCents: pricebookReferenceCents,
    });

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
      binderPayoutCents: row.binder_payout_cents,
      binderVatRateBps: null,
      targetMarginBps: PRICING_POLICY.targetMarginBps,
      minimumContributionCents: PRICING_POLICY.minimumContributionCents,
      marginFloorCents: floors.marginFloorCents,
      contributionFloorCents: floors.contributionFloorCents,
      priceBoundBy: floors.boundBy,
      customerServicePriceCents: row.service_price_cents,
      estimateMinCents: pricingMode === "ESTIMATE_THEN_CONFIRM" ? row.pricing_low_estimate_cents : null,
      estimateMaxCents: pricingMode === "ESTIMATE_THEN_CONFIRM" ? row.pricing_high_estimate_cents : null,
      shipping: data.shipping,
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
      status: "proposed",
    });

    const version = await nextProposalVersion(sb, data.caseId);
    const proposal = await insertCommercialProposal(sb, snapshot, version, context.userId);

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
      },
    });

    return proposal;
  });

export const listCaseCommercialProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uuid.parse(data))
  .handler(async ({ context, data: caseId }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    return listCommercialProposals(sb, caseId);
  });

/**
 * Fige une version — la dernière écriture que cette ligne subira jamais
 * (le trigger `marketplace_commercial_proposals_immutable_after_acceptance`
 * refuse tout UPDATE ultérieur). Réservé à l'admin dans cette phase : aucun
 * parcours client ne déclenche encore cette acceptation lui-même.
 */
export const acceptCommercialProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uuid.parse(data))
  .handler(async ({ context, data: proposalId }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();

    let accepted;
    try {
      accepted = await acceptCommercialProposalRow(sb, proposalId);
    } catch (err) {
      const messages: Record<string, string> = {
        proposal_not_found: "Cette proposition est introuvable.",
        proposal_already_accepted: "Cette proposition est déjà acceptée.",
        proposal_tax_not_validated:
          "La fiscalité de cette proposition doit être validée avant de l'accepter.",
      };
      const message = err instanceof Error ? messages[err.message] : undefined;
      fail(409, message ?? "Cette proposition est introuvable ou déjà acceptée.");
    }

    await sb.from("marketplace_events").insert({
      case_id: accepted.caseId,
      actor_user_id: context.userId,
      event_type: "commercial_proposal_accepted",
      metadata: {
        proposal_id: accepted.id,
        version: accepted.version,
        brand: accepted.brand,
        customer_service_price_cents: accepted.customerServicePriceCents,
        binder_payout_cents: accepted.binderPayoutCents,
      },
    });

    return accepted;
  });

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
export const applyAutomaticFranceTaxPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => applyAutomaticFranceTaxInput.parse(data))
  .handler(async ({ context, data }) => {
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
  });

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
