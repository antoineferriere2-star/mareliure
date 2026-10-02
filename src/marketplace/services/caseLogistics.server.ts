/**
 * Parcours d'acheminement d'un livre, côté serveur, pour les trois rôles.
 *
 * Client : choisit le mode avant l'accord, renseigne adresses, colis et livre, reconfirme son
 * adresse avant le retour, télécharge l'étiquette ALLER. Atelier : accepte ou refuse la réception,
 * déclare le retour prêt avec le colis retour mesuré, télécharge l'étiquette RETOUR. Opérateur :
 * voit tout, dépose les étiquettes achetées à la main, consigne annulations et frais réels, ouvre
 * ou ferme l'automatisation.
 *
 * Toute règle décisive est en base (20261002090000) ; ce module vérifie l'identité de l'appelant,
 * ne reçoit jamais d'atelier, de prix ni de version du navigateur, et ne renvoie à chacun que ce
 * qui le concerne. Les tables de cette branche ne sont pas dans les types générés : frontière
 * validée ici.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Supa } from "@/build/services/adminAuth.server";
import { loadCaseContext } from "./caseRepository.server";
import { loadAcceptedCommercialProposal, loadLatestCommercialProposal } from "./commercialProposalRepository.server";
import { loadCommercialPaymentState } from "./commercialPaymentRepository.server";
import { requireBinderId } from "./binderQuotes.server";
import {
  effectiveReturnAddress, logisticsErrorCode, planColumns, planFromRow, roundTripPlanBlock,
  type LogisticsErrorCode, type LogisticsPlan, type Parcel, type PlanInput, type PostalAddress, type RoundTripBlock,
} from "@/marketplace/shipping/logisticsPlan";
import { isPdf, LABEL_MAX_BYTES, type LabelDirection } from "@/marketplace/shipping/labelProvider";
import { ROUND_TRIP_LABELS_BUCKET, supabaseLabelStore } from "@/marketplace/shipping/roundTripLabelStore.server";

type Db = SupabaseClient;
const raw = (sb: Supa) => sb as unknown as Db;

export class LogisticsError extends Error {
  constructor(public readonly code: LogisticsErrorCode, public readonly status = 409) {
    super(code);
    this.name = "LogisticsError";
  }
}
const refuse = (code: LogisticsErrorCode, status = 409): never => { throw new LogisticsError(code, status); };

/** Erreur Postgres → code stable ; toute autre erreur reste une panne (503), jamais un succès. */
function fromDb(error: { message?: string } | null): never {
  const code = logisticsErrorCode(String(error?.message ?? ""));
  throw new LogisticsError(code ?? "provider_unavailable", code ? 409 : 503);
}

export interface JobRow {
  id: string; direction: LabelDirection; status: "claimed" | "ambiguous" | "confirmed" | "failed" | "cancelled";
  fulfilment: "automatic" | "manual"; provider: string | null; provider_label_id: string | null; carrier: string | null;
  tracking: string | null; method_label: string | null; charged_cost_ttc_cents: number | null;
  refunded_cost_ttc_cents: number | null; cancelled_at: string | null; created_at: string; updated_at: string;
  private_label_path: string | null; proposal_id: string; binder_id: string;
}
type Scalar = string | number | boolean | null;
export interface JobEvent { job_id: string; kind: string; details: Record<string, Scalar>; provider_event_id: string | null; created_at: string }

const JOB_COLUMNS = "id,direction,status,fulfilment,provider,provider_label_id,carrier,tracking,method_label," +
  "charged_cost_ttc_cents,refunded_cost_ttc_cents,cancelled_at,created_at,updated_at,private_label_path,proposal_id,binder_id";
const ACTIVE = new Set(["claimed", "ambiguous", "confirmed"]);

/** Le sens courant : la réservation active la plus récente, sinon la plus récente tout court. */
export function currentJob(jobs: JobRow[], direction: LabelDirection): JobRow | null {
  const leg = jobs.filter((j) => j.direction === direction).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return leg.find((j) => ACTIVE.has(j.status)) ?? leg[0] ?? null;
}

async function loadPlan(sb: Supa, caseId: string): Promise<LogisticsPlan | null> {
  const { data, error } = await raw(sb).from("marketplace_case_logistics_plans").select("*").eq("case_id", caseId).maybeSingle();
  if (error) fromDb(error);
  return planFromRow(data);
}
async function loadJobs(sb: Supa, caseId: string): Promise<JobRow[]> {
  const { data, error } = await raw(sb).from("marketplace_round_trip_label_jobs").select(JOB_COLUMNS).eq("case_id", caseId);
  if (error) fromDb(error);
  return (data ?? []) as unknown as JobRow[];
}
async function loadEvents(sb: Supa, jobIds: string[]): Promise<JobEvent[]> {
  if (!jobIds.length) return [];
  const { data, error } = await raw(sb).from("marketplace_round_trip_label_events")
    .select("job_id,kind,details,provider_event_id,created_at").in("job_id", jobIds).order("created_at", { ascending: true });
  if (error) fromDb(error);
  return (data ?? []) as JobEvent[];
}
async function journalKinds(sb: Supa, caseId: string, binderId: string | null): Promise<{ kind: string; created_at: string }[]> {
  if (!binderId) return [];
  const { data: work, error } = await sb.from("marketplace_binder_works").select("id").eq("case_id", caseId).eq("binder_id", binderId).maybeSingle();
  if (error) fromDb(error);
  if (!work) return [];
  const { data, error: journalError } = await sb.from("marketplace_work_logistics_events")
    .select("kind,created_at").eq("work_id", work.id).order("sequence", { ascending: true });
  if (journalError) fromDb(journalError);
  return data ?? [];
}

async function commerce(sb: Supa, caseId: string) {
  const accepted = await loadAcceptedCommercialProposal(sb, caseId);
  const latest = accepted ?? await loadLatestCommercialProposal(sb, caseId);
  const payment = accepted ? await loadCommercialPaymentState(sb, accepted.id) : null;
  const offerKind = latest && latest.status !== "superseded" && latest.status !== "cancelled" ? latest.shippingOfferKind : null;
  return {
    accepted: Boolean(accepted),
    offerKind,
    /** Paiement plateforme constaté par Stripe : jamais un règlement déclaré à l'atelier. */
    paid: Boolean(payment?.paidAt && payment.stripePaymentIntentId && payment.stripeCheckoutSessionId),
  };
}

/** Le plan vu comme « accepté par l'atelier » seulement pour SA version courante. */
const currentDecision = (plan: LogisticsPlan | null) =>
  plan?.workshop && plan.workshop.planVersion === plan.version ? plan.workshop : null;

export interface LegView {
  state: "preparing" | "ready" | "cancelled";
  carrier: string | null;
  tracking: string | null;
  method: string | null;
}
function legView(job: JobRow | null): LegView | null {
  if (!job) return null;
  if (job.status === "confirmed")
    return { state: "ready", carrier: job.carrier, tracking: job.tracking, method: job.method_label };
  return { state: ACTIVE.has(job.status) ? "preparing" : "cancelled", carrier: null, tracking: null, method: null };
}

/** Événements transporteur relus chez le fournisseur : codes seulement, jamais de détail privé. */
function carrierEvents(jobs: JobRow[], events: JobEvent[]) {
  const direction = new Map(jobs.map((j) => [j.id, j.direction]));
  return events.filter((e) => e.kind === "tracking_update").map((e) => ({
    direction: direction.get(e.job_id)!, at: e.created_at, code: String(e.details.code ?? "unknown").slice(0, 60),
  }));
}

export type CustomerNext =
  | "choose_mode" | "await_workshop" | "workshop_declined" | "await_proposal" | "pay"
  | "await_outbound_label" | "drop_parcel" | "send_or_bring" | "outbound_in_transit" | "in_workshop" | "confirm_return_address"
  | "await_return" | "return_in_transit" | "completed";

export function customerNextStep(input: {
  plan: LogisticsPlan | null; accepted: boolean; paid: boolean; offerKind: string | null;
  outbound: LegView | null; journal: string[]; returnConfirmed: boolean;
}): CustomerNext {
  const { plan, journal } = input;
  if (journal.includes("completed")) return "completed";
  if (journal.includes("return")) return "return_in_transit";
  if (!plan) return "choose_mode";
  const decision = currentDecision(plan);
  if (!input.accepted) {
    if (!decision) return "await_workshop";
    if (decision.decision === "declined") return "workshop_declined";
    return "await_proposal";
  }
  if (!input.paid) return "pay";
  const organized = input.offerKind === "book_round_trip_fr";
  if (!journal.includes("received")) {
    // Livré selon le transporteur ≠ reçu : on attend la confirmation physique de l'atelier.
    if (journal.includes("outbound") || journal.includes("carrier_delivered")) return "outbound_in_transit";
    if (!organized) return "send_or_bring";
    return input.outbound?.state === "ready" ? "drop_parcel" : "await_outbound_label";
  }
  if (organized && plan.returnReady && !input.returnConfirmed) return "confirm_return_address";
  return plan.returnReady ? "await_return" : "in_workshop";
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
async function ownedCase(sb: Supa, userId: string, caseId: string) {
  const context = await loadCaseContext(sb, caseId);
  if (!context) refuse("not_found", 404);
  if (!context!.customerUserId || context!.customerUserId !== userId) refuse("forbidden", 403);
  return context!;
}

export async function customerLogistics(sb: Supa, userId: string, caseId: string) {
  const context = await ownedCase(sb, userId, caseId);
  const [plan, money, jobs] = await Promise.all([loadPlan(sb, caseId), commerce(sb, caseId), loadJobs(sb, caseId)]);
  const events = await loadEvents(sb, jobs.map((j) => j.id));
  const journal = money.paid ? (await journalKinds(sb, caseId, context.selectedBinderId)).map((j) => j.kind) : [];
  const outbound = legView(currentJob(jobs, "outbound"));
  const back = legView(currentJob(jobs, "return"));
  const decision = currentDecision(plan);
  const locked = money.accepted || money.offerKind === "book_round_trip_fr";
  const returnConfirmed = Boolean(plan && plan.returnAddressConfirmedVersion === plan.version);
  return {
    brand: context.row.brand,
    plan: plan && {
      ...plan,
      // L'atelier n'est révélé au client qu'une fois la proposition acceptée, et seulement son adresse de réception.
      workshop: decision ? {
        decision: decision.decision,
        reception: money.accepted && decision.decision === "accepted" ? decision.reception : null,
      } : null,
    },
    block: plan ? roundTripPlanBlock(plan, context.row.brand, context.selectedBinderId) : null,
    locked,
    accepted: money.accepted,
    paid: money.paid,
    offerKind: money.offerKind,
    outbound: outbound && { ...outbound, downloadable: outbound.state === "ready" },
    return: back,
    carrierEvents: carrierEvents(jobs, events),
    returnConfirmed,
    canConfirmReturnAddress: Boolean(plan?.returnReady && money.offerKind === "book_round_trip_fr" && !returnConfirmed
      && back?.state !== "ready"),
    next: customerNextStep({ plan, accepted: money.accepted, paid: money.paid, offerKind: money.offerKind,
      outbound, journal, returnConfirmed }),
  };
}
export type CustomerLogisticsView = Awaited<ReturnType<typeof customerLogistics>>;

export async function saveCustomerPlan(sb: Supa, userId: string, caseId: string, input: PlanInput): Promise<void> {
  await ownedCase(sb, userId, caseId);
  const columns = { ...planColumns(input), conditions_accepted_at: new Date().toISOString(), submitted_by: userId,
    submitted_at: new Date().toISOString() };
  const { data: existing, error } = await raw(sb).from("marketplace_case_logistics_plans").select("case_id").eq("case_id", caseId).maybeSingle();
  if (error) fromDb(error);
  const write = existing
    ? await raw(sb).from("marketplace_case_logistics_plans").update(columns).eq("case_id", caseId)
    : await raw(sb).from("marketplace_case_logistics_plans").insert({ case_id: caseId, ...columns });
  // Deux enregistrements simultanés du premier plan : le second relit et met à jour.
  if (write.error && !existing && /duplicate key/i.test(String(write.error.message))) {
    const retry = await raw(sb).from("marketplace_case_logistics_plans").update(columns).eq("case_id", caseId);
    if (retry.error) fromDb(retry.error);
    return;
  }
  if (write.error) fromDb(write.error);
}

export async function confirmCustomerReturnAddress(sb: Supa, userId: string, caseId: string): Promise<void> {
  await ownedCase(sb, userId, caseId);
  const plan = await loadPlan(sb, caseId);
  if (!plan) refuse("logistics_plan_required");
  if (!plan!.returnReady) refuse("return_not_ready");
  const { error } = await raw(sb).from("marketplace_case_logistics_plans")
    .update({ return_address_confirmed_at: new Date().toISOString(), return_address_confirmed_version: plan!.version })
    .eq("case_id", caseId).eq("version", plan!.version);
  if (error) fromDb(error);
}

// ---------------------------------------------------------------------------
// Atelier
// ---------------------------------------------------------------------------
async function workshopCase(sb: Supa, userId: string, caseId: string) {
  const binderId = await requireBinderId(sb, userId).catch(() => refuse("forbidden", 403));
  const { data: binder, error } = await sb.from("marketplace_binders").select("status").eq("id", binderId).single();
  if (error) fromDb(error);
  if (binder.status !== "approved") refuse("forbidden", 403);
  const context = await loadCaseContext(sb, caseId);
  if (!context) refuse("not_found", 404);
  if (!context!.invitedBinderIds.includes(binderId) && context!.selectedBinderId !== binderId) refuse("forbidden", 403);
  return { context: context!, binderId };
}

export async function workshopLogistics(sb: Supa, userId: string, caseId: string) {
  const { context, binderId } = await workshopCase(sb, userId, caseId);
  const selected = context.selectedBinderId === binderId;
  const [plan, money] = await Promise.all([loadPlan(sb, caseId), commerce(sb, caseId)]);
  // Un autre atelier invité ne voit ni les étiquettes ni le journal de l'atelier retenu.
  const jobs = selected ? await loadJobs(sb, caseId) : [];
  const journal = selected ? (await journalKinds(sb, caseId, binderId)).map((j) => j.kind) : [];
  const decision = currentDecision(plan);
  const ownDecision = decision && decision.binderId === binderId ? decision : null;
  const back = legView(currentJob(jobs, "return"));
  const area = plan?.contact ? { postalCode: plan.contact.postalCode, city: plan.contact.city, countryCode: plan.contact.countryCode } : null;
  return {
    selected,
    plan: plan && {
      version: plan.version, mode: plan.mode, bookDescription: plan.bookDescription, bookKind: plan.bookKind,
      declaredValueCents: plan.declaredValueCents, parcel: plan.parcel,
      // Adresse complète du client jamais transmise à l'atelier : l'étiquette la porte.
      customerArea: area,
      returnReady: plan.returnReady,
    },
    decision: ownDecision ? { decision: ownDecision.decision, reception: ownDecision.reception, decidedAt: ownDecision.decidedAt } : null,
    decidedByOtherWorkshop: Boolean(decision && decision.binderId !== binderId),
    canDecide: Boolean(plan) && !money.accepted && money.offerKind !== "book_round_trip_fr",
    accepted: money.accepted,
    paid: money.paid,
    offerKind: money.offerKind,
    outbound: legView(currentJob(jobs, "outbound")),
    return: back && { ...back, downloadable: back.state === "ready" },
    received: journal.includes("received"),
    returned: journal.includes("return"),
    returnAddressConfirmed: Boolean(plan && plan.returnAddressConfirmedVersion === plan.version),
    canDeclareReturnReady: selected && money.accepted && journal.includes("received") && !journal.includes("return")
      && !(back && back.state !== "cancelled"),
  };
}
export type WorkshopLogisticsView = Awaited<ReturnType<typeof workshopLogistics>>;

export async function decideWorkshopReception(sb: Supa, userId: string, caseId: string, input: {
  decision: "accepted" | "declined"; reception: (PostalAddress & { phone: string | null }) | null;
}): Promise<void> {
  const { binderId } = await workshopCase(sb, userId, caseId);
  const plan = await loadPlan(sb, caseId);
  if (!plan) refuse("logistics_plan_required");
  if (input.decision === "accepted" && !input.reception) refuse("invalid_input", 400);
  const r = input.decision === "accepted" ? input.reception : null;
  const { data, error } = await raw(sb).from("marketplace_case_logistics_plans").update({
    workshop_binder_id: binderId, workshop_decision: input.decision, workshop_plan_version: plan!.version,
    workshop_decided_by: userId, workshop_decided_at: new Date().toISOString(),
    workshop_reception_name: r?.name ?? null, workshop_address_line1: r?.line1 ?? null, workshop_address_line2: r?.line2 || null,
    workshop_postal_code: r?.postalCode ?? null, workshop_city: r?.city ?? null, workshop_country_code: r?.countryCode ?? null,
    workshop_phone: r?.phone || null,
  }).eq("case_id", caseId).eq("version", plan!.version).select("case_id");
  if (error) fromDb(error);
  // Le client a modifié son plan entre la lecture et l'accord : l'atelier doit relire.
  if (!data?.length) refuse("logistics_plan_version_stale");
}

export async function declareReturnReady(sb: Supa, userId: string, caseId: string, parcel: Parcel): Promise<{ parcelOk: boolean }> {
  const { binderId } = await workshopCase(sb, userId, caseId);
  const { data, error } = await raw(sb).rpc("marketplace_round_trip_return_ready", {
    p_case: caseId, p_binder: binderId, p_actor: userId, p_weight: parcel.weightGrams,
    p_length: parcel.lengthMm, p_width: parcel.widthMm, p_height: parcel.heightMm,
  });
  if (error) fromDb(error);
  return { parcelOk: Boolean((data as { parcel_ok?: boolean } | null)?.parcel_ok) };
}

// ---------------------------------------------------------------------------
// Opérateur (l'appelant a déjà été vérifié administrateur)
// ---------------------------------------------------------------------------
export async function automationState(sb: Supa) {
  const { data, error } = await raw(sb).from("marketplace_round_trip_automation").select("enabled,evidence,changed_at").eq("id", true).single();
  if (error) fromDb(error);
  return {
    enabled: Boolean(data.enabled),
    evidence: (data.evidence ?? {}) as Record<string, string>,
    changedAt: data.changed_at as string | null,
    providerConfigured: Boolean(process.env.SENDCLOUD_PUBLIC_KEY && process.env.SENDCLOUD_SECRET_KEY && process.env.SENDCLOUD_WEBHOOK_SECRET),
  };
}

export async function operatorLogistics(sb: Supa, caseId: string) {
  const context = await loadCaseContext(sb, caseId);
  if (!context) refuse("not_found", 404);
  const [plan, money, jobs, automation] = await Promise.all([
    loadPlan(sb, caseId), commerce(sb, caseId), loadJobs(sb, caseId), automationState(sb)]);
  const events = await loadEvents(sb, jobs.map((j) => j.id));
  const journal = await journalKinds(sb, caseId, context!.selectedBinderId);
  return {
    brand: context!.row.brand,
    plan,
    block: plan ? roundTripPlanBlock(plan, context!.row.brand, context!.selectedBinderId) : ("logistics_plan_required" as const),
    selectedBinderId: context!.selectedBinderId,
    accepted: money.accepted, paid: money.paid, offerKind: money.offerKind,
    jobs: jobs.sort((a, b) => a.created_at.localeCompare(b.created_at)).map((job) => ({
      ...job, events: events.filter((e) => e.job_id === job.id),
    })),
    journal,
    automation,
  };
}
export type OperatorLogisticsView = Awaited<ReturnType<typeof operatorLogistics>>;
export type { RoundTripBlock };

type ReserveOutcome = { outcome: "claim" | "existing" | "review_required" | "replacement_confirmation_required"; id?: string; status?: string };

export async function operatorReserveManual(sb: Supa, actor: string, caseId: string, direction: LabelDirection, replace: boolean): Promise<ReserveOutcome> {
  const { data, error } = await raw(sb).rpc("marketplace_reserve_round_trip_label_manual",
    { p_case: caseId, p_direction: direction, p_actor: actor, p_replace: replace });
  if (error) fromDb(error);
  return data as ReserveOutcome;
}

export interface ManualLabelDetails {
  carrier: string; tracking: string; method: string; providerReference: string;
  chargedCostTtcCents: number; deficitAcknowledged: boolean;
}

/**
 * Étiquette achetée hors plateforme par l'opérateur : réservation (ou reprise de la sienne),
 * dépôt privé du PDF sans écrasement, puis confirmation. Un double envoi retrouve la même
 * réservation et les mêmes octets ; un envoi concurrent déjà confirmé est rendu tel quel.
 */
export async function operatorConfirmManual(sb: Supa, actor: string, caseId: string, direction: LabelDirection,
  pdf: Uint8Array, details: ManualLabelDetails, replace = false): Promise<{ outcome: "confirmed" | "existing"; deficitTtcCents: number | null }> {
  if (!isPdf(pdf) || pdf.length > LABEL_MAX_BYTES) refuse("label_pdf_invalid", 400);
  const reserved = await operatorReserveManual(sb, actor, caseId, direction, replace);
  if (reserved.outcome === "existing") return { outcome: "existing", deficitTtcCents: null };
  if (reserved.outcome === "replacement_confirmation_required") refuse("replacement_confirmation_required");
  if (reserved.outcome !== "claim" || !reserved.id) refuse("round_trip_offer_required");
  const store = supabaseLabelStore(sb);
  // Réservation manuelle encore « claimed » : l'étiquette n'est exposée à personne avant confirmation,
  // un PDF corrigé remplace donc celui d'une tentative non confirmée (jamais après confirmation).
  const uploaded = await sb.storage.from(ROUND_TRIP_LABELS_BUCKET)
    .upload(`${reserved.id}/label.pdf`, pdf, { contentType: "application/pdf", upsert: true });
  if (uploaded.error) refuse("provider_unavailable", 503);
  try {
    const result = await store.transition(reserved.id!, "label_confirmed", {
      provider: "manual", provider_label_id: details.providerReference, carrier: details.carrier,
      tracking: details.tracking, method: details.method, charged_cost_ttc_cents: details.chargedCostTtcCents,
      deficit_acknowledged: details.deficitAcknowledged, actor,
    }) as { deficit_ttc_cents?: number | null };
    return { outcome: "confirmed", deficitTtcCents: result.deficit_ttc_cents ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("label_transition_invalid:confirmed")) return { outcome: "existing", deficitTtcCents: null };
    // La même référence d'achat ou le même suivi sur une autre étiquette : erreur de saisie, jamais un doublon accepté.
    if (message.includes("provider_label_uidx") || message.includes("duplicate key")) refuse("label_reference_duplicate");
    const code = logisticsErrorCode(message.replace(/^label_transition_failed:/, ""));
    throw new LogisticsError(code ?? "provider_unavailable", code ? 409 : 503);
  }
}

const NOTE_KINDS = ["purchase_failed", "cancellation_requested", "cancelled", "cost_adjusted", "unused", "operator_note"] as const;
export type OperatorNoteKind = (typeof NOTE_KINDS)[number];

/** Annulation, frais réellement facturés ou remboursés, étiquette inutilisée : constatés, jamais présumés. */
export async function operatorRecordJobEvent(sb: Supa, actor: string, caseId: string, jobId: string, kind: OperatorNoteKind,
  details: { note?: string; reference?: string; chargedCostTtcCents?: number; refundedCostTtcCents?: number }): Promise<void> {
  const jobs = await loadJobs(sb, caseId);
  if (!jobs.some((j) => j.id === jobId)) refuse("not_found", 404);
  const payload: Record<string, unknown> = { actor, provider: "operator" };
  if (details.note) payload.note = details.note.slice(0, 500);
  if (details.reference) payload.reference = details.reference.slice(0, 160);
  if (details.chargedCostTtcCents !== undefined) payload.charged_cost_ttc_cents = details.chargedCostTtcCents;
  if (details.refundedCostTtcCents !== undefined) payload.refunded_cost_ttc_cents = details.refundedCostTtcCents;
  try {
    await supabaseLabelStore(sb).transition(jobId, kind, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/label_transition_invalid|cancellation_reference_required|private_details_refused/.test(message)) refuse("invalid_input", 400);
    throw new LogisticsError("provider_unavailable", 503);
  }
}

export async function operatorSetAutomation(sb: Supa, actor: string, enabled: boolean, evidence: Record<string, string>): Promise<void> {
  const { error } = await raw(sb).rpc("marketplace_set_round_trip_automation", { p_actor: actor, p_enabled: enabled, p_evidence: evidence });
  if (error) fromDb(error);
}

// ---------------------------------------------------------------------------
// Étiquette privée : URL signée de 60 secondes
// ---------------------------------------------------------------------------
export type LabelViewer = { role: "customer"; userId: string } | { role: "workshop"; userId: string } | { role: "operator" };

/**
 * Aller : le propriétaire du dossier. Retour : l'atelier retenu. Opérateur : les deux.
 * L'identité est relue avant toute recherche d'étiquette ; connaître l'UUID d'un dossier ne suffit pas.
 */
export async function labelUrl(sb: Supa, viewer: LabelViewer, caseId: string, direction: LabelDirection): Promise<{ url: string; expiresInSeconds: 60 }> {
  if (viewer.role === "customer") {
    await ownedCase(sb, viewer.userId, caseId);
    if (direction !== "outbound") refuse("forbidden", 403);
  } else if (viewer.role === "workshop") {
    const { context, binderId } = await workshopCase(sb, viewer.userId, caseId);
    if (direction !== "return" || context.selectedBinderId !== binderId) refuse("forbidden", 403);
  }
  const accepted = await loadAcceptedCommercialProposal(sb, caseId);
  if (!accepted || accepted.shippingOfferKind !== "book_round_trip_fr") refuse("not_found", 404);
  // Défense en profondeur : la réservation a déjà exigé le paiement Stripe ; on le relit quand même.
  const payment = await loadCommercialPaymentState(sb, accepted!.id);
  if (!payment?.paidAt || !payment.stripePaymentIntentId || !payment.stripeCheckoutSessionId) refuse("not_found", 404);
  const job = currentJob(await loadJobs(sb, caseId), direction);
  if (!job || job.status !== "confirmed" || job.proposal_id !== accepted!.id || job.private_label_path !== `${job.id}/label.pdf`)
    refuse("not_found", 404);
  const { data, error } = await sb.storage.from(ROUND_TRIP_LABELS_BUCKET).createSignedUrl(`${job!.id}/label.pdf`, 60);
  if (error || !data?.signedUrl) refuse("provider_unavailable", 503);
  return { url: data!.signedUrl, expiresInSeconds: 60 };
}

/** Adresse effective de retour, pour l'achat automatique et l'empreinte du tarif revu. */
export { effectiveReturnAddress };
