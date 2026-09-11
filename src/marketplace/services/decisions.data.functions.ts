/**
 * Structured decisions (§20-§22) — server functions. Same shape as
 * messaging.data.functions.ts: prove who the caller is, decide with a pure
 * function (decisions.ts), then read/write with the service-role client.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, type Supa } from "@/build/services/adminAuth.server";
import type { Json } from "@/integrations/supabase/types";
import { fail } from "@/build/services/serverError";
import { logOperationalError } from "@/build/services/operationalLog.server";
import {
  canAnswerDecision,
  canRequestDecision,
  canReviseDecision,
  DECISION_KINDS,
  decideAnswer,
} from "@/marketplace/decisions/decisions";
import { resolveViewer } from "./marketplace.data.functions";

const uuid = z.object({ caseId: z.string().uuid() });

async function loadCaseParties(
  sb: Supa,
  caseId: string,
): Promise<{ selectedBinderId: string | null; customerUserId: string | null }> {
  const [{ data: matches }, { data: row }] = await Promise.all([
    sb.from("marketplace_case_matches").select("binder_id, state").eq("case_id", caseId),
    sb.from("marketplace_cases").select("customer_user_id").eq("id", caseId).maybeSingle(),
  ]);
  return {
    selectedBinderId: (matches ?? []).find((m) => m.state === "selected")?.binder_id ?? null,
    customerUserId: row?.customer_user_id ?? null,
  };
}

async function notifyCustomerOfDecisionRequest(
  sb: Supa,
  caseId: string,
  customerUserId: string | null,
): Promise<void> {
  if (!customerUserId) return;
  try {
    const { data: auth } = await sb.auth.admin.getUserById(customerUserId);
    const email = auth?.user?.email;
    if (!email) return;
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const { MARELIURE_CANONICAL_ORIGIN } = await import("@/marketplace/config");
    await sendTemplateEmail("case-activity", email, {
      templateData: {
        heading: "Une confirmation vous est demandée",
        intro: "Votre atelier a besoin d'une précision pour avancer sur votre livre.",
        ctaLabel: "Répondre",
        ctaUrl: `${MARELIURE_CANONICAL_ORIGIN}/mes-livres/${caseId}`,
      },
    });
  } catch (err) {
    logOperationalError("decisions.notify-customer-failed", err, { caseId });
  }
}

export const listCaseDecisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uuid.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const viewer = await resolveViewer(context.supabase, sb, context.userId);
    const parties = await loadCaseParties(sb, data.caseId);
    // Same access as the case itself (permissions.ts' canViewCase would also
    // grant this to an invited-but-not-selected binder; a decision only ever
    // exists once an atelier is assigned, so requiring the same authority as
    // requesting one is the correct, narrower gate for reading them too).
    const authorised =
      viewer.role === "admin" ||
      (viewer.role === "customer" &&
        parties.customerUserId !== null &&
        parties.customerUserId === viewer.userId) ||
      (viewer.role === "binder" && parties.selectedBinderId === viewer.binderId);
    if (!authorised) fail(403, "Ces décisions ne vous sont pas accessibles.");

    const { data: rows, error } = await sb
      .from("marketplace_decisions")
      .select(
        "id, kind, question, options, status, answer, answered_at, cancelled_at, superseded_by, created_at",
      )
      .eq("case_id", data.caseId)
      .order("created_at", { ascending: false });
    if (error) fail(500, error.message);
    return rows ?? [];
  });

export const requestCaseDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        kind: z.enum(DECISION_KINDS),
        question: z.string().trim().min(1).max(1000),
        options: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const viewer = await resolveViewer(context.supabase, sb, context.userId);
    const parties = await loadCaseParties(sb, data.caseId);
    if (!canRequestDecision(viewer, parties)) {
      fail(403, "Vous ne pouvez pas demander de décision sur ce dossier.");
    }
    const requestedRole = viewer.role === "admin" ? "admin" : "binder";

    const { data: inserted, error } = await sb
      .from("marketplace_decisions")
      .insert({
        case_id: data.caseId,
        kind: data.kind,
        question: data.question,
        options: data.options,
        requested_by: context.userId,
        requested_role: requestedRole,
      })
      .select("id")
      .single();
    if (error) fail(500, error.message);

    await sb.from("marketplace_events").insert({
      case_id: data.caseId,
      actor_user_id: context.userId,
      event_type: "decision_requested",
      metadata: { kind: data.kind },
    });

    await notifyCustomerOfDecisionRequest(sb, data.caseId, parties.customerUserId);

    return { id: inserted!.id };
  });

export const answerCaseDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        decisionId: z.string().uuid(),
        // Free-form JSON on purpose: a colour is a string, titrage (§21) is
        // {title, author, tome} — the shape is the decision kind's business,
        // never this server function's.
        answer: z.record(z.string(), z.unknown()),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const viewer = await resolveViewer(context.supabase, sb, context.userId);

    const { data: decision } = await sb
      .from("marketplace_decisions")
      .select("id, case_id, status")
      .eq("id", data.decisionId)
      .maybeSingle();
    if (!decision) fail(404, "Décision introuvable.");

    const parties = await loadCaseParties(sb, decision!.case_id);
    if (!canAnswerDecision(viewer, parties)) {
      fail(403, "Vous ne pouvez pas répondre à cette décision.");
    }
    const permission = decideAnswer(decision!);
    if (!permission.allowed) fail(409, permission.reason!);

    const now = new Date().toISOString();
    // Conditional on status='open': the immutability guarantee (§20) — two
    // concurrent answers can never both win, and an already-answered
    // decision can never be silently overwritten by a retry.
    const { data: updated, error } = await sb
      .from("marketplace_decisions")
      .update({
        status: "answered",
        answer: data.answer as unknown as Json,
        answered_by: context.userId,
        answered_at: now,
      })
      .eq("id", data.decisionId)
      .eq("status", "open")
      .select("id");
    if (error) fail(500, error.message);
    if (!updated || updated.length === 0) fail(409, "Cette décision n'est plus ouverte.");

    await sb.from("marketplace_events").insert({
      case_id: decision!.case_id,
      actor_user_id: context.userId,
      event_type: "decision_answered",
      metadata: {},
    });

    return { ok: true };
  });

export const cancelCaseDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ decisionId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const viewer = await resolveViewer(context.supabase, sb, context.userId);
    const { data: decision } = await sb
      .from("marketplace_decisions")
      .select("id, case_id, status")
      .eq("id", data.decisionId)
      .maybeSingle();
    if (!decision) fail(404, "Décision introuvable.");
    const parties = await loadCaseParties(sb, decision!.case_id);
    if (!canRequestDecision(viewer, parties)) {
      fail(403, "Vous ne pouvez pas annuler cette décision.");
    }
    if (decision!.status !== "open") fail(409, "Seule une décision ouverte peut être annulée.");

    const { error } = await sb
      .from("marketplace_decisions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", data.decisionId)
      .eq("status", "open");
    if (error) fail(500, error.message);
    return { ok: true };
  });

/**
 * Correct an already-answered decision — never edits the old answer, always
 * creates a new decision and links the old one forward to it (§20).
 */
export const reviseCaseDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        decisionId: z.string().uuid(),
        question: z.string().trim().min(1).max(1000),
        options: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const viewer = await resolveViewer(context.supabase, sb, context.userId);
    const { data: previous } = await sb
      .from("marketplace_decisions")
      .select("id, case_id, kind, status, superseded_by")
      .eq("id", data.decisionId)
      .maybeSingle();
    if (!previous) fail(404, "Décision introuvable.");
    const parties = await loadCaseParties(sb, previous!.case_id);
    if (!canReviseDecision(viewer, previous!, parties)) {
      fail(403, "Vous ne pouvez pas corriger cette décision.");
    }
    if (previous!.superseded_by) fail(409, "Cette décision a déjà été corrigée.");

    const requestedRole = viewer.role === "admin" ? "admin" : "binder";
    const { data: revised, error } = await sb
      .from("marketplace_decisions")
      .insert({
        case_id: previous!.case_id,
        kind: previous!.kind,
        question: data.question,
        options: data.options,
        requested_by: context.userId,
        requested_role: requestedRole,
      })
      .select("id")
      .single();
    if (error) fail(500, error.message);

    const { error: linkError } = await sb
      .from("marketplace_decisions")
      .update({ superseded_by: revised!.id })
      .eq("id", data.decisionId)
      .is("superseded_by", null);
    if (linkError) fail(500, linkError.message);

    await sb.from("marketplace_events").insert({
      case_id: previous!.case_id,
      actor_user_id: context.userId,
      event_type: "decision_requested",
      metadata: { kind: previous!.kind, revises: data.decisionId },
    });

    return { id: revised!.id };
  });
