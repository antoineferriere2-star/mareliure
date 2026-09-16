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
  type DepositPolicyInput,
  type PricebookProvenanceEntry,
} from "@/marketplace/commercial/commercialProposal";
import { loadCaseContext } from "./caseRepository.server";
import { loadPricebook } from "./pricingRepository.server";
import {
  acceptCommercialProposal as acceptCommercialProposalRow,
  insertCommercialProposal,
  listCommercialProposals,
  loadAcceptedCommercialProposal,
  nextProposalVersion,
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
      taxPolicy: "TAX_REVIEW_REQUIRED",
      customerVatRateBps: null,
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
    } catch {
      fail(409, "Cette proposition est introuvable ou déjà acceptée.");
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
