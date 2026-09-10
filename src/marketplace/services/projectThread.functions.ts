/**
 * Le fil d'un projet, tel que le client, l'atelier retenu et Ma Reliure s'en
 * servent.
 *
 * Chaque fonction commence par `authorizeThread` — ou `assertAdmin` pour ce qui
 * n'appartient qu'à Ma Reliure — et lit ensuite avec la clé service. Un test
 * le vérifie sur le texte de ce fichier.
 *
 * Deux règles tiennent le fil dans le cadre du service :
 *
 * - les coordonnées ne passent pas (`contactGuard.ts`), sauf pour Ma Reliure ;
 * - rien ici ne touche un prix. Une décision choisit une couleur, un imprévu
 *   décrit une découverte ; un changement de prix repasse par le Pricebook.
 *
 * Les événements écrits ne portent jamais le contenu d'un message.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { admin, assertAdmin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { CONTACT_GUARD_MESSAGE, detectContactDetails } from "@/marketplace/project/contactGuard";
import {
  allowsFreeText,
  buildDecisionOptions,
  DECISION_TYPES,
  validateDecisionAnswer,
  validateDecisionRequest,
} from "@/marketplace/project/decisions";
import { progressStep, progressStepsFor } from "@/marketplace/project/progress";
import { SCOPE_REASONS, validateScopeIssue } from "@/marketplace/project/scopeIssues";
import { customerActionFor, MESSAGE_MAX_LENGTH, UPDATE_TYPES } from "@/marketplace/project/thread";
import { notifyCustomer } from "./projectNotifications.server";
import { recordMarketplaceEvent } from "./pricingRepository.server";
import {
  attachFiles,
  authorizeThread,
  DECISION_COLUMNS,
  extensionFor,
  loadThread,
  PROJECT_FILE_MAX_BYTES,
  PROJECT_FILE_MIME_TYPES,
  PROJECT_FILES_BUCKET,
  PROJECT_FILES_PER_ITEM,
  toDecision,
  verifyUploadedFiles,
  type AuthorizedThread,
} from "./projectThreadRepository.server";

const caseInput = z.object({ caseId: z.string().uuid() });
const filePaths = z.array(z.string().max(300)).max(PROJECT_FILES_PER_ITEM).default([]);

/** Refuse un texte qui transporte des coordonnées. Ma Reliure en est exemptée. */
function guardContact(authorized: AuthorizedThread, texts: readonly (string | null | undefined)[]) {
  if (authorized.actor.role === "admin") return;
  if (texts.some((text) => typeof text === "string" && detectContactDetails(text).length > 0))
    fail(422, CONTACT_GUARD_MESSAGE);
}

// ---------------------------------------------------------------------------
// Lire
// ---------------------------------------------------------------------------

export const getProjectThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => caseInput.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const authorized = await authorizeThread(sb, context.userId, data.caseId, "read");
    const loaded = await loadThread(sb, authorized);
    const { actor, thread, access } = authorized;
    return {
      caseId: thread.id,
      reference: thread.reference,
      status: thread.status,
      access,
      role: actor.role,
      binderName: thread.binderName,
      ...loaded,
      customerAction: actor.role === "customer" ? customerActionFor(loaded.decisions) : null,
      progressSteps:
        access === "write" && actor.role !== "customer"
          ? progressStepsFor(actor.role, thread.status).map((step) => ({
              to: step.to,
              label: step.label,
            }))
          : [],
    };
  });

/**
 * Une signature de l'état du fil, pour sonder sans tout recharger. Le client
 * ne refait la lecture complète — URL signées comprises — que si elle change.
 */
export const getProjectThreadActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => caseInput.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { thread } = await authorizeThread(sb, context.userId, data.caseId, "read");
    const [messages, decisions] = await Promise.all([
      sb
        .from("marketplace_project_messages")
        .select("created_at, deleted_at", { count: "exact" })
        .eq("case_id", thread.id)
        .order("created_at", { ascending: false })
        .limit(1),
      sb
        .from("marketplace_project_decisions")
        .select("status, created_at, answered_at, cancelled_at")
        .eq("case_id", thread.id),
    ]);
    const decisionMarks = (decisions.data ?? [])
      .map((row) => `${row.status}:${row.answered_at ?? row.cancelled_at ?? row.created_at}`)
      .sort()
      .join(",");
    return {
      signature: [
        thread.status,
        messages.count ?? 0,
        messages.data?.[0]?.created_at ?? "",
        decisionMarks,
      ].join("|"),
    };
  });

export const markProjectThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => caseInput.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { actor, thread } = await authorizeThread(sb, context.userId, data.caseId, "read");

    const { data: previous } = await sb
      .from("marketplace_project_reads")
      .select("last_read_at")
      .eq("case_id", thread.id)
      .eq("user_id", actor.userId)
      .maybeSingle();
    let unreadQuery = sb
      .from("marketplace_project_messages")
      .select("id", { count: "exact", head: true })
      .eq("case_id", thread.id)
      .neq("author_user_id", actor.userId)
      .is("deleted_at", null);
    if (previous) unreadQuery = unreadQuery.gt("created_at", previous.last_read_at);
    const { count } = await unreadQuery;

    const { error } = await sb.from("marketplace_project_reads").upsert(
      {
        case_id: thread.id,
        user_id: actor.userId,
        role: actor.role,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "case_id,user_id" },
    );
    if (error) fail(500, error.message);

    if ((count ?? 0) > 0)
      await recordMarketplaceEvent(sb, {
        type: "message_read",
        actorUserId: actor.userId,
        caseId: thread.id,
        metadata: { reader_role: actor.role, message_count: count },
      });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Fichiers
// ---------------------------------------------------------------------------

/**
 * Une URL d'envoi à usage unique, dans le dossier du projet.
 *
 * Le fichier part directement du navigateur vers le stockage privé : il ne
 * transite pas par la fonction, et le chemin n'est pas choisi par le client.
 * Il ne sera rattaché à un message qu'après vérification de ce que le
 * stockage en dit (`verifyUploadedFiles`).
 */
export const createProjectUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        mimeType: z.enum(PROJECT_FILE_MIME_TYPES),
        sizeBytes: z.number().int().positive().max(PROJECT_FILE_MAX_BYTES),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { thread } = await authorizeThread(sb, context.userId, data.caseId, "write");
    const path = `cases/${thread.id}/${crypto.randomUUID()}.${extensionFor(data.mimeType)}`;
    const { data: upload, error } = await sb.storage
      .from(PROJECT_FILES_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !upload) fail(500, error?.message ?? "Envoi impossible pour le moment.");
    return { bucket: PROJECT_FILES_BUCKET, path, token: upload.token };
  });

// ---------------------------------------------------------------------------
// Écrire
// ---------------------------------------------------------------------------

export const postProjectMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        body: z.string().max(MESSAGE_MAX_LENGTH).default(""),
        kind: z.enum(["message", "update"]).default("message"),
        updateType: z.enum(UPDATE_TYPES).nullable().default(null),
        important: z.boolean().default(false),
        files: filePaths,
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const authorized = await authorizeThread(sb, context.userId, data.caseId, "write");
    const { actor, thread } = authorized;

    if (actor.role === "customer" && (data.kind === "update" || data.important))
      fail(403, "Les mises à jour d'avancement sont publiées par l'atelier.");
    const body = data.body.trim();
    if (data.kind === "message" && body === "")
      fail(
        422,
        data.files.length > 0 ? "Ajoutez quelques mots à votre photo." : "Écrivez votre message.",
      );
    if (data.kind === "update" && body === "" && data.files.length === 0)
      fail(422, "Une mise à jour porte un texte ou une photo.");
    guardContact(authorized, [body]);

    const files = await verifyUploadedFiles(sb, thread.id, data.files);
    const { data: message, error } = await sb
      .from("marketplace_project_messages")
      .insert({
        case_id: thread.id,
        author_role: actor.role,
        author_user_id: actor.userId,
        binder_id: actor.binderId,
        kind: data.kind,
        update_type: data.kind === "update" ? data.updateType : null,
        body,
        important: data.important,
      })
      .select("id")
      .single();
    if (error) fail(500, error.message);
    await attachFiles(sb, {
      caseId: thread.id,
      ownerKind: "message",
      ownerId: message.id,
      files,
      actor,
    });

    await recordMarketplaceEvent(sb, {
      type: data.kind === "update" ? "project_update_posted" : "message_sent",
      actorUserId: actor.userId,
      caseId: thread.id,
      binderId: actor.binderId,
      metadata: {
        message_id: message.id,
        author_role: actor.role,
        update_type: data.kind === "update" ? data.updateType : null,
        file_count: files.length,
        important: data.important,
      },
    });
    if (actor.role !== "customer" && data.important)
      await notifyCustomer(sb, {
        caseId: thread.id,
        notice: "binder_message",
        dedupeKey: message.id,
      });

    return { id: message.id };
  });

const decisionRequestInput = z.object({
  caseId: z.string().uuid(),
  decisionType: z.enum(DECISION_TYPES),
  question: z.string().max(300),
  description: z.string().max(2000).nullable().default(null),
  options: z
    .array(
      z.object({
        label: z.string().max(80),
        description: z.string().max(300).nullable().default(null),
        files: filePaths,
      }),
    )
    .max(6)
    .default([]),
  gildingText: z
    .object({
      lines: z.array(z.object({ position: z.string().max(40), text: z.string().max(120) })).max(8),
    })
    .nullable()
    .default(null),
  allowFreeText: z.boolean().default(false),
  supersedesDecisionId: z.string().uuid().nullable().default(null),
});

/**
 * Demander une décision au client.
 *
 * Les options sont figées à la création — un verrou en base interdit de les
 * réécrire —, chacune peut porter ses photos, et le client est prévenu par
 * e-mail sans que la question y soit recopiée.
 */
export const requestProjectDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => decisionRequestInput.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const authorized = await authorizeThread(sb, context.userId, data.caseId, "write");
    const { actor, thread } = authorized;
    if (actor.role === "customer")
      fail(403, "Les décisions sont demandées par l'atelier ou par Ma Reliure.");

    const request = {
      decisionType: data.decisionType,
      question: data.question,
      description: data.description?.trim() || null,
      options: data.options.map((option) => ({
        label: option.label,
        description: option.description,
      })),
      gildingText: data.gildingText,
      allowFreeText: data.allowFreeText,
    };
    const errors = validateDecisionRequest(request);
    if (errors.length > 0) fail(422, errors.join(" "));
    guardContact(authorized, [
      request.question,
      request.description,
      ...data.options.flatMap((option) => [option.label, option.description]),
      ...(data.gildingText?.lines.map((line) => line.text) ?? []),
    ]);

    if (data.supersedesDecisionId) {
      const { data: previous } = await sb
        .from("marketplace_project_decisions")
        .select("case_id")
        .eq("id", data.supersedesDecisionId)
        .maybeSingle();
      if (previous?.case_id !== thread.id)
        fail(422, "La décision remplacée n'appartient pas à ce projet.");
    }

    const options = buildDecisionOptions(request);
    const optionFiles = [];
    for (const option of data.options)
      optionFiles.push(await verifyUploadedFiles(sb, thread.id, option.files));

    const { data: decision, error } = await sb
      .from("marketplace_project_decisions")
      .insert({
        case_id: thread.id,
        created_by_role: actor.role,
        created_by_user_id: actor.userId,
        binder_id: actor.binderId,
        decision_type: data.decisionType,
        question: request.question.trim(),
        description: request.description,
        options: options as unknown as Json,
        gilding_text: (data.decisionType === "GILDING_TEXT"
          ? data.gildingText
          : null) as unknown as Json,
        allow_free_text: allowsFreeText(request),
        supersedes_decision_id: data.supersedesDecisionId,
      })
      .select("id")
      .single();
    if (error) fail(500, error.message);

    if (data.decisionType !== "GILDING_TEXT")
      for (const [index, files] of optionFiles.entries())
        await attachFiles(sb, {
          caseId: thread.id,
          ownerKind: "decision_option",
          ownerId: decision.id,
          optionId: options[index].id,
          files,
          actor,
        });

    for (const type of ["decision_requested", "customer_action_required"] as const)
      await recordMarketplaceEvent(sb, {
        type,
        actorUserId: actor.userId,
        caseId: thread.id,
        binderId: actor.binderId,
        metadata: {
          decision_id: decision.id,
          decision_type: data.decisionType,
          option_count: options.length,
          author_role: actor.role,
        },
      });
    await notifyCustomer(sb, {
      caseId: thread.id,
      notice: "decision_requested",
      dedupeKey: decision.id,
    });

    return { id: decision.id };
  });

/** Le client tranche. Une seule fois : la base refuse toute seconde réponse. */
export const answerProjectDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        decisionId: z.string().uuid(),
        optionId: z.string().max(40).nullable().default(null),
        freeText: z.string().max(2000).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { data: row } = await sb
      .from("marketplace_project_decisions")
      .select(DECISION_COLUMNS)
      .eq("id", data.decisionId)
      .maybeSingle();
    if (!row) fail(404, "Décision introuvable.");

    const authorized = await authorizeThread(sb, context.userId, row.case_id, "write");
    if (authorized.actor.role !== "customer")
      fail(403, "Seul le client tranche une décision sur son livre.");

    const errors = validateDecisionAnswer(toDecision(row), {
      optionId: data.optionId,
      freeText: data.freeText,
    });
    if (errors.length > 0) fail(422, errors.join(" "));
    guardContact(authorized, [data.freeText]);

    const { error } = await sb.rpc("marketplace_answer_project_decision", {
      p_decision_id: data.decisionId,
      p_selected_option_id: data.optionId,
      p_free_text_answer: data.freeText,
      p_actor_user_id: context.userId,
    });
    if (error) fail(409, "Cette décision a déjà été tranchée.");
    return { id: data.decisionId };
  });

/** Retirer une question encore ouverte. Une décision tranchée ne se retire pas. */
export const cancelProjectDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        decisionId: z.string().uuid(),
        reason: z.string().trim().max(300).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { data: row } = await sb
      .from("marketplace_project_decisions")
      .select("case_id")
      .eq("id", data.decisionId)
      .maybeSingle();
    if (!row) fail(404, "Décision introuvable.");
    const { actor } = await authorizeThread(sb, context.userId, row.case_id, "write");
    if (actor.role === "customer") fail(403, "Seul qui a posé la question peut la retirer.");

    const { data: cancelled, error } = await sb
      .from("marketplace_project_decisions")
      .update({
        status: "CANCELLED",
        cancelled_at: new Date().toISOString(),
        cancelled_by: actor.userId,
        cancel_reason: data.reason || null,
      })
      .eq("id", data.decisionId)
      .eq("status", "OPEN")
      .select("id");
    if (error) fail(409, "Cette décision est déjà tranchée.");
    if (!cancelled || cancelled.length === 0) fail(409, "Cette décision est déjà tranchée.");
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Imprévus
// ---------------------------------------------------------------------------

/**
 * L'atelier signale ce qu'il découvre. Ma Reliure reprend la main : aucun
 * montant n'est demandé, et le client n'est pas prévenu par ce chemin.
 */
export const reportScopeIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        reason: z.enum(SCOPE_REASONS),
        description: z.string().max(3000),
        files: filePaths,
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const authorized = await authorizeThread(sb, context.userId, data.caseId, "write");
    const { actor, thread } = authorized;
    if (actor.role !== "binder") fail(403, "Un imprévu est signalé par l'atelier retenu.");
    const errors = validateScopeIssue(data);
    if (errors.length > 0) fail(422, errors.join(" "));

    const files = await verifyUploadedFiles(sb, thread.id, data.files);
    const { data: issue, error } = await sb
      .from("marketplace_scope_issues")
      .insert({
        case_id: thread.id,
        binder_id: actor.binderId,
        reported_by: actor.userId,
        reason: data.reason,
        description: data.description.trim(),
      })
      .select("id")
      .single();
    if (error) fail(500, error.message);
    await attachFiles(sb, {
      caseId: thread.id,
      ownerKind: "scope_issue",
      ownerId: issue.id,
      files,
      actor,
    });

    for (const type of ["scope_issue_reported", "scope_review_required"] as const)
      await recordMarketplaceEvent(sb, {
        type,
        actorUserId: actor.userId,
        caseId: thread.id,
        binderId: actor.binderId,
        metadata: { issue_id: issue.id, reason: data.reason, file_count: files.length },
      });
    return { id: issue.id };
  });

export const updateScopeIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        issueId: z.string().uuid(),
        status: z.enum(["IN_REVIEW", "RESOLVED"]),
        note: z.string().trim().max(1000).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const resolved = data.status === "RESOLVED";
    const { error } = await sb
      .from("marketplace_scope_issues")
      .update({
        status: data.status,
        resolution_note: data.note || null,
        resolved_at: resolved ? new Date().toISOString() : null,
        resolved_by: resolved ? context.userId : null,
      })
      .eq("id", data.issueId);
    if (error) fail(500, error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Avancement
// ---------------------------------------------------------------------------

/**
 * Faire avancer le livre d'une étape.
 *
 * Seules les étapes déclarées dans `PROGRESS_STEPS` existent, chacune pour
 * son acteur : Ma Reliure confirme la commande, l'atelier confirme la
 * réception, commence et termine. L'écriture est conditionnelle au statut lu :
 * deux clics simultanés ne font pas avancer deux fois.
 */
export const advanceProjectStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        to: z.enum(["paid", "received_by_binder", "in_progress", "work_finished"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { actor, thread } = await authorizeThread(sb, context.userId, data.caseId, "write");
    if (actor.role === "customer") fail(403, "L'avancement est tenu par l'atelier et Ma Reliure.");

    const step = progressStep(actor.role, thread.status, data.to);
    if (!step) fail(409, "Cette étape n'est pas possible depuis l'état actuel du projet.");

    const { data: moved, error } = await sb
      .from("marketplace_cases")
      .update({ status: data.to })
      .eq("id", thread.id)
      .eq("status", thread.status)
      .select("id");
    if (error) fail(500, error.message);
    if (!moved || moved.length === 0)
      fail(409, "Le projet a changé entre-temps : rechargez la page.");

    await recordMarketplaceEvent(sb, {
      type: step.event,
      actorUserId: actor.userId,
      caseId: thread.id,
      binderId: thread.selectedBinderId,
      metadata: { from: thread.status, to: data.to, actor_role: actor.role },
    });
    if (step.event === "book_received" || step.event === "work_finished")
      await notifyCustomer(sb, {
        caseId: thread.id,
        notice: step.event,
        dedupeKey: `${thread.id}-${data.to}`,
      });

    return { status: data.to };
  });
