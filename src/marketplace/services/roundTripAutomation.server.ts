/**
 * Achat automatique d'une étiquette — FERMÉ par défaut.
 *
 * Trois verrous cumulés, relus à chaque appel : la table `marketplace_round_trip_automation`
 * (ouverture justifiée, fermeture immédiate), les clés fournisseur présentes dans le Worker, et
 * un tarif revu pour CE dossier (adresses identifiées par empreinte, coûts ≤ 15 € TTC, coût
 * économique ≤ 12,50 € HT). La réservation SQL précède tout appel ; l'orchestrateur ne rachète
 * jamais après une réponse ambiguë sans relire le fournisseur.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Supa } from "@/build/services/adminAuth.server";
import { effectiveReturnAddress, logisticsErrorCode, planFromRow, type PostalAddress } from "@/marketplace/shipping/logisticsPlan";
import { purchaseLeg, type LegResult } from "@/marketplace/shipping/labelOrchestrator";
import type { LabelDirection, LabelProvider, LabelRequest, PostalParty } from "@/marketplace/shipping/labelProvider";
import { createSendcloudProvider, fetchSendcloudShippingOptions, type ShippingOptionView } from "@/marketplace/shipping/sendcloudProvider.server";
import { supabaseLabelStore } from "@/marketplace/shipping/roundTripLabelStore.server";
import { LogisticsError, automationState } from "./caseLogistics.server";
import { loadAcceptedCommercialProposal } from "./commercialProposalRepository.server";

const raw = (sb: Supa) => sb as unknown as SupabaseClient;

/** Empreinte d'une adresse validée : la revue tarifaire ne recopie pas l'adresse elle-même. */
export async function addressSha256(address: PostalAddress): Promise<string> {
  const canonical = JSON.stringify([address.name, address.line1, address.line2 ?? "", address.postalCode, address.city, address.countryCode]
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, " ")));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function providerFromEnv(): LabelProvider | null {
  const publicKey = process.env.SENDCLOUD_PUBLIC_KEY, secretKey = process.env.SENDCLOUD_SECRET_KEY;
  return publicKey && secretKey ? createSendcloudProvider({ publicKey, secretKey }) : null;
}

async function loadPlanRow(sb: Supa, caseId: string) {
  const { data, error } = await raw(sb).from("marketplace_case_logistics_plans").select("*").eq("case_id", caseId).maybeSingle();
  if (error) throw new LogisticsError("provider_unavailable", 503);
  const plan = planFromRow(data);
  if (!plan) throw new LogisticsError("logistics_plan_required");
  return plan;
}

export interface RateApprovalInput {
  outboundOptionCode: string; returnOptionCode: string; providerQuoteReference: string; coverageEvidenceReference: string;
  outboundCostTtcCents: number; returnCostTtcCents: number; allOtherCostsTtcCents: number;
  estimatedEconomicCostCents: number; economicCostEvidenceReference: string; validUntil: string;
}

/** Revue tarifaire d'un dossier : saisie par l'opérateur à partir d'un devis réel, refusée au-delà du forfait. */
export async function recordRateApproval(sb: Supa, actor: string, caseId: string, input: RateApprovalInput): Promise<void> {
  const plan = await loadPlanRow(sb, caseId);
  const proposal = await loadAcceptedCommercialProposal(sb, caseId);
  if (!proposal || proposal.shippingOfferKind !== "book_round_trip_fr") throw new LogisticsError("round_trip_offer_required");
  const back = effectiveReturnAddress(plan);
  if (!plan.contact || !back || !plan.parcel || !plan.workshop) throw new LogisticsError("logistics_plan_required");
  // Le code saisi doit sortir du devis réel de ce dossier : l'achat n'envoie aucun point relais.
  const live = await liveShippingOptions(plan);
  if (!isPurchasableMethod(live.outbound, input.outboundOptionCode) || !isPurchasableMethod(live.return, input.returnOptionCode))
    throw new LogisticsError("rate_method_unavailable");
  const dims = (p: { lengthMm: number; widthMm: number; heightMm: number }) => [p.lengthMm, p.widthMm, p.heightMm].sort((a, b) => b - a);
  const returnParcel = plan.returnReady?.parcel ?? plan.parcel;
  const { error } = await raw(sb).from("marketplace_round_trip_rate_approvals").insert({
    case_id: caseId, proposal_id: proposal.id, binder_id: plan.workshop.binderId,
    outbound_address_sha256: await addressSha256(plan.contact), return_address_sha256: await addressSha256(back),
    outbound_weight_grams: plan.parcel.weightGrams, return_weight_grams: returnParcel.weightGrams,
    outbound_dimensions_mm: dims(plan.parcel), return_dimensions_mm: dims(returnParcel),
    outbound_method: input.outboundOptionCode.trim(), return_method: input.returnOptionCode.trim(),
    provider_quote_reference: input.providerQuoteReference, coverage_evidence_reference: input.coverageEvidenceReference,
    outbound_cost_ttc_cents: input.outboundCostTtcCents, return_cost_ttc_cents: input.returnCostTtcCents,
    all_other_costs_ttc_cents: input.allOtherCostsTtcCents, estimated_economic_cost_cents: input.estimatedEconomicCostCents,
    economic_cost_evidence_reference: input.economicCostEvidenceReference, valid_until: input.validUntil, reviewed_by: actor,
  });
  // Contraintes de la table : coûts ≤ 15 € TTC, coût économique ≤ 12,50 €, colis dans le plafond.
  if (error) throw new LogisticsError("invalid_input", 400);
}

const party = (a: PostalAddress, phone: string | null): PostalParty => ({
  name: a.name, addressLine1: a.line1, addressLine2: a.line2, postalCode: a.postalCode, city: a.city, countryCode: a.countryCode, phone,
});

/** Achat déclenché par l'opérateur, seulement si les trois verrous sont ouverts. */
export async function purchaseAutomatically(sb: Supa, caseId: string, direction: LabelDirection,
  provider: LabelProvider | null = providerFromEnv()): Promise<LegResult> {
  const automation = await automationState(sb);
  if (!automation.enabled) throw new LogisticsError("automation_closed");
  if (!provider || !automation.providerConfigured) throw new LogisticsError("provider_unavailable", 503);
  const plan = await loadPlanRow(sb, caseId);
  const back = effectiveReturnAddress(plan);
  const reception = plan.workshop?.reception;
  if (!plan.contact || !back || !reception || !plan.parcel) throw new LogisticsError("logistics_plan_required");
  const { data: reserved, error } = await raw(sb).rpc("marketplace_reserve_round_trip_label", {
    p_case: caseId, p_direction: direction,
    p_outbound_address_sha256: await addressSha256(plan.contact), p_return_address_sha256: await addressSha256(back),
  });
  if (error) {
    const code = logisticsErrorCode(String(error.message));
    throw new LogisticsError(code ?? "provider_unavailable", code ? 409 : 503);
  }
  const outcome = reserved as { outcome: string; id: string; status?: string; fulfilment?: string };
  if (outcome.outcome === "existing") return { state: "confirmed", costReviewRequired: false };
  // Seule une réservation automatique en attente se reprend ; un échec ou une annulation passe par l'opérateur.
  if (outcome.outcome === "review_required" && !(outcome.fulfilment === "automatic" && ["claimed", "ambiguous"].includes(outcome.status ?? "")))
    return { state: "review_required", code: `job_${outcome.status}` };
  const { data: rate, error: rateError } = await raw(sb).from("marketplace_round_trip_rate_approvals")
    .select("outbound_method,return_method").eq("case_id", caseId).maybeSingle();
  if (rateError || !rate) throw new LogisticsError("provider_unavailable", 503);
  const parcel = direction === "outbound" ? plan.parcel : plan.returnReady!.parcel;
  const request = async (): Promise<LabelRequest> => ({
    reference: outcome.id, direction,
    shippingOptionCode: direction === "outbound" ? rate.outbound_method : rate.return_method,
    from: direction === "outbound" ? party(plan.contact!, plan.contact!.phone) : party(reception, reception.phone),
    to: direction === "outbound" ? party(reception, reception.phone) : party(back, plan.contact!.phone),
    parcel: { weightGrams: parcel.weightGrams, dimensionsMm: [parcel.lengthMm, parcel.widthMm, parcel.heightMm] },
  });
  return purchaseLeg(provider, supabaseLabelStore(sb), outcome.id, request);
}

/**
 * Méthodes et prix réellement proposés par le compte Sendcloud pour les deux trajets d'un dossier
 * (codes postaux et mesures du plan seulement). Lecture seule : sert à choisir les codes du tarif revu
 * et à vérifier le coût complet avant toute ouverture.
 */
export async function roundTripShippingOptions(sb: Supa, caseId: string) {
  return { ...(await liveShippingOptions(await loadPlanRow(sb, caseId))), queriedAt: new Date().toISOString() };
}

/** Achetable par `purchaseAutomatically` : présent au devis, chiffré en EUR, sans point relais à désigner. */
export function isPurchasableMethod(options: ShippingOptionView[], code: string): boolean {
  const option = options.find((o) => o.code === code.trim());
  return Boolean(option && !option.servicePointRequired && option.priceCents !== null && option.currency?.toUpperCase() === "EUR");
}

async function liveShippingOptions(plan: Awaited<ReturnType<typeof loadPlanRow>>) {
  const publicKey = process.env.SENDCLOUD_PUBLIC_KEY, secretKey = process.env.SENDCLOUD_SECRET_KEY;
  if (!publicKey || !secretKey) throw new LogisticsError("provider_unavailable", 503);
  const back = effectiveReturnAddress(plan);
  const reception = plan.workshop?.reception;
  if (!plan.contact || !back || !reception || !plan.parcel) throw new LogisticsError("logistics_plan_required");
  const dims = (p: { lengthMm: number; widthMm: number; heightMm: number }): [number, number, number] => [p.lengthMm, p.widthMm, p.heightMm];
  const returnParcel = plan.returnReady?.parcel ?? plan.parcel;
  const [outbound, back2] = await Promise.all([
    fetchSendcloudShippingOptions({ publicKey, secretKey }, { fromCountry: plan.contact.countryCode, fromPostalCode: plan.contact.postalCode,
      toCountry: reception.countryCode, toPostalCode: reception.postalCode, weightGrams: plan.parcel.weightGrams, dimensionsMm: dims(plan.parcel) }),
    fetchSendcloudShippingOptions({ publicKey, secretKey }, { fromCountry: reception.countryCode, fromPostalCode: reception.postalCode,
      toCountry: back.countryCode, toPostalCode: back.postalCode, weightGrams: returnParcel.weightGrams, dimensionsMm: dims(returnParcel) }),
  ]);
  if (outbound === "unavailable" || back2 === "unavailable") throw new LogisticsError("provider_unavailable", 503);
  return { outbound, return: back2 };
}
