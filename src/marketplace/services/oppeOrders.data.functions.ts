/**
 * La commande Oppe après paiement (activité A) : cycle de réalisation et réattribution.
 *
 * Toutes les transitions passent par les fonctions SQL de la migration 20261005120000, qui
 * vérifient l'acteur (administrateur, ou membre actif de l'atelier affecté) et l'ordre des
 * étapes. Ce fichier ne décide de rien : il authentifie, transmet, et traduit les refus.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertAdmin, type Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { findActiveBinderMembership } from "./binderMembership.server";

const ORDER_REFUSALS: Record<string, string> = {
  order_not_found: "Aucune commande payée pour ce dossier.",
  order_transition_forbidden: "Cette étape n'est pas possible depuis l'état actuel de la commande.",
  admin_required: "Seule l'administration peut faire cela.",
  forbidden: "Cette commande n'est pas affectée à votre atelier.",
  reassignment_reason_required: "Motivez la réattribution en une phrase.",
  order_not_reassignable: "Une commande terminée ou annulée ne se réattribue pas.",
  reassignment_same_workshop: "Choisissez un autre atelier que l'atelier actuel.",
  workshop_agreement_required: "Le nouvel atelier doit d'abord accepter la prestation, sa rémunération et son délai.",
  cancel_reason: "Motivez l'annulation en une phrase.",
};

function refuse(message: string | undefined): never {
  const code = Object.keys(ORDER_REFUSALS).find((key) => (message ?? "").includes(key));
  fail(409, code ? ORDER_REFUSALS[code] : "L'opération n'a pas pu aboutir.");
}

export type OppeOrderStatus = "paid" | "in_production" | "completed" | "cancelled";

export interface OppeOrderView {
  status: OppeOrderStatus;
  paidAt: string;
  inProductionAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  assignments: {
    binderId: string;
    workshopName: string | null;
    payoutCents: number;
    leadTimeDays: number | null;
    startedAt: string;
    endedAt: string | null;
    endReason: string | null;
  }[];
  acceptance: { acceptedAt: string; termsVersion: string; snapshotSha256: string } | null;
}

export async function loadOppeOrder(sb: Supa, caseId: string): Promise<OppeOrderView | null> {
  const { data: order, error } = await sb
    .from("marketplace_oppe_orders")
    .select("proposal_id, status, paid_at, in_production_at, completed_at, cancelled_at, cancel_reason")
    .eq("case_id", caseId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return null;
  const [{ data: assignments, error: aError }, { data: acceptance, error: pError }] = await Promise.all([
    sb.from("marketplace_oppe_order_assignments")
      .select("binder_id, payout_cents, lead_time_days, started_at, ended_at, end_reason")
      .eq("case_id", caseId)
      .order("started_at", { ascending: true }),
    sb.from("marketplace_proposal_acceptances")
      .select("accepted_at, terms_version, snapshot_sha256")
      .eq("proposal_id", order.proposal_id)
      .maybeSingle(),
  ]);
  if (aError) throw aError;
  if (pError) throw pError;
  const binderIds = [...new Set((assignments ?? []).map((a) => a.binder_id))];
  const { data: binders } = binderIds.length
    ? await sb.from("marketplace_binders").select("id, workshop_name, display_name").in("id", binderIds)
    : { data: [] as { id: string; workshop_name: string | null; display_name: string }[] };
  const nameOf = new Map((binders ?? []).map((b) => [b.id, b.workshop_name || b.display_name]));
  return {
    status: order.status as OppeOrderStatus,
    paidAt: order.paid_at,
    inProductionAt: order.in_production_at,
    completedAt: order.completed_at,
    cancelledAt: order.cancelled_at,
    cancelReason: order.cancel_reason,
    assignments: (assignments ?? []).map((a) => ({
      binderId: a.binder_id,
      workshopName: nameOf.get(a.binder_id) ?? null,
      payoutCents: a.payout_cents,
      leadTimeDays: a.lead_time_days,
      startedAt: a.started_at,
      endedAt: a.ended_at,
      endReason: a.end_reason,
    })),
    acceptance: acceptance
      ? { acceptedAt: acceptance.accepted_at, termsVersion: acceptance.terms_version, snapshotSha256: acceptance.snapshot_sha256 }
      : null,
  };
}

const caseInput = z.object({ caseId: z.string().uuid() });

export const getOppeOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => caseInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return loadOppeOrder(await admin(), data.caseId);
  });

export const advanceOppeOrderAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      caseId: z.string().uuid(),
      status: z.enum(["in_production", "completed", "cancelled"]),
      reason: z.string().trim().max(500).nullable().default(null),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.status === "cancelled" && (data.reason ?? "").length < 12) refuse("cancel_reason");
    const sb = await admin();
    const { data: result, error } = await sb.rpc("marketplace_advance_oppe_order", {
      p_case_id: data.caseId,
      p_status: data.status,
      p_actor_user_id: context.userId,
      p_actor_role: "admin",
      p_reason: data.reason ?? "",
    });
    if (error) refuse(error.message);
    return { status: result };
  });

/** L'atelier affecté déclare le début puis la fin du travail. */
export const advanceMyOppeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ caseId: z.string().uuid(), status: z.enum(["in_production", "completed"]) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { data: result, error } = await sb.rpc("marketplace_advance_oppe_order", {
      p_case_id: data.caseId,
      p_status: data.status,
      p_actor_user_id: context.userId,
      p_actor_role: "binder",
      p_reason: "",
    });
    if (error) refuse(error.message);
    return { status: result };
  });

/** Ce que l'atelier voit de la commande : son état et son propre engagement, jamais le prix client. */
export const getMyOppeOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => caseInput.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const membership = await findActiveBinderMembership(sb, context.userId);
    if (!membership) fail(403, "Aucun atelier n'est associé à ce compte.");
    const binder = { id: membership!.binderId };
    const order = await loadOppeOrder(sb, data.caseId);
    if (!order) return null;
    const mine = order.assignments.find((a) => a.binderId === binder!.id && a.endedAt === null);
    if (!mine) return null;
    return {
      status: order.status,
      paidAt: order.paidAt,
      inProductionAt: order.inProductionAt,
      completedAt: order.completedAt,
      payoutCents: mine.payoutCents,
      leadTimeDays: mine.leadTimeDays,
    };
  });

/**
 * Réattribution, étape 1 : proposer le travail à un autre atelier, avec la rémunération que
 * l'administration valide pour lui. Un atelier qui avait déjà accepté ce dossier (offre annulée
 * par la première sélection) retrouve son accord tel quel : un accord accepté ne se réécrit pas.
 */
export const offerOppeOrderToWorkshop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      caseId: z.string().uuid(),
      binderId: z.string().uuid(),
      payoutCents: z.number().int().positive(),
      serviceDescription: z.string().trim().min(10).max(2000),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const order = await loadOppeOrder(sb, data.caseId);
    if (!order || !["paid", "in_production"].includes(order.status)) refuse("order_not_reassignable");
    const { data: existing, error } = await sb
      .from("marketplace_quotes")
      .select("id, state, agreement_version, binder_payout_cents")
      .eq("case_id", data.caseId)
      .eq("binder_id", data.binderId)
      .maybeSingle();
    if (error) fail(500, error.message);
    const now = new Date().toISOString();
    if (existing?.agreement_version) {
      if (existing.binder_payout_cents !== data.payoutCents)
        fail(409, "Cet atelier a déjà accepté ce dossier à une autre rémunération : son accord ne se réécrit pas.");
      const { error: reError } = await sb.from("marketplace_quotes").update({ state: "accepted", updated_at: now }).eq("id", existing.id);
      if (reError) fail(500, reError.message);
    } else if (existing) {
      const { error: upError } = await sb.from("marketplace_quotes").update({
        state: "offered", binder_payout_cents: data.payoutCents, amount_cents: data.payoutCents,
        service_description: data.serviceDescription, offered_at: now, accepted_at: null, declined_at: null,
        decline_reason_code: null, decline_reason_detail: null, updated_at: now,
      }).eq("id", existing.id);
      if (upError) fail(500, upError.message);
    } else {
      const { error: insError } = await sb.from("marketplace_quotes").insert({
        case_id: data.caseId, binder_id: data.binderId, description: "Offre Oppe (réattribution)",
        amount_cents: data.payoutCents, currency: "EUR", state: "offered", customer_price_cents: null,
        binder_payout_cents: data.payoutCents, service_description: data.serviceDescription, offered_at: now,
      });
      if (insError) fail(500, insError.message);
    }
    await sb.from("marketplace_case_matches").upsert(
      { case_id: data.caseId, binder_id: data.binderId, state: existing?.agreement_version ? "accepted" : "offered", binder_payout_cents: data.payoutCents, currency: "EUR", offered_at: now },
      { onConflict: "case_id,binder_id" },
    );
    await sb.from("marketplace_events").insert({
      case_id: data.caseId, binder_id: data.binderId, actor_user_id: context.userId,
      event_type: "reassignment_offer_sent", metadata: { binder_payout_cents: data.payoutCents },
    });
    return { reactivated: Boolean(existing?.agreement_version) };
  });

/** Réattribution, étape 2 : le nouvel atelier a accepté ; l'administration bascule la commande. */
export const reassignOppeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ caseId: z.string().uuid(), binderId: z.string().uuid(), reason: z.string().trim().min(12).max(500) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: assignmentId, error } = await sb.rpc("marketplace_reassign_oppe_order", {
      p_case_id: data.caseId,
      p_new_binder_id: data.binderId,
      p_reason: data.reason,
      p_actor_user_id: context.userId,
    });
    if (error) refuse(error.message);
    return { assignmentId };
  });
