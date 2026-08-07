import { createFileRoute } from "@tanstack/react-router";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { generateProjectBrief } from "@/build/engine/brief";
import { computeVisibleSteps, validateField, validateFieldFormat } from "@/build/engine/validation";
import { buildVisitorProjectSummary, extractPhotoReferences } from "@/build/engine/visitorSummary";
import type { Answers, AnswerValue } from "@/build/schema/answers";
import { playbookSchema, type PlaybookField, type PlaybookSchema } from "@/build/schema/playbook";
import { missionProposalSchema } from "@/build/schema/missionProposal";
import type { DeckPreviewSnapshot } from "@/build/visualPreview/deckPreviewParams";
import { DEFAULT_LOCALE, resolveSupportedLocale } from "@/build/i18n/locales";
import { DEFAULT_MEASUREMENT_SYSTEM } from "@/build/measurements/types";
import { logOperationalError } from "@/build/services/operationalLog.server";
import { INSPIRATION_PHOTOS_BUCKET } from "@/build/storage/inspirationPhotosBucket";
import {
  PROJECT_PHOTOS_ALLOWED_MIME_TYPES,
  PROJECT_PHOTOS_BUCKET,
  PROJECT_PHOTOS_MAX_FILE_SIZE_MB,
} from "@/build/storage/projectPhotosBucket";

type Supa = SupabaseClient<Database>;

const MAX_BODY_BYTES = 32 * 1024; // 32 KB — every action except photo analysis
const MAX_PHOTO_BODY_BYTES = 12 * 1024 * 1024; // 12 MB — base64-encoded inspiration photo
const RATE_LIMIT_WINDOW_MIN = 60;
const RATE_LIMIT_MAX = 60;
const PUBLISHED_STATUS = "active";
const SESSION_SECRET_BYTES = 32;

// Public entry point is the shareable public_token ONLY. Raw mission_id must
// never be accepted here — it would let anyone who learns a mission's UUID
// (e.g. from the admin console) bypass a revoked/unshared public link.
export const bodySchema = z.union([
  z.object({ action: z.literal("get_mission"), public_token: z.string().min(16).max(160) }),
  z.object({ action: z.literal("start_session"), public_token: z.string().min(16).max(160) }),
  z.object({
    action: z.literal("resume_session"),
    session_id: z.string().uuid(),
    session_secret: z.string().min(32).max(256),
  }),
  z.object({
    action: z.literal("save_session"),
    session_id: z.string().uuid(),
    session_secret: z.string().min(32).max(256),
    answers: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("submit_session"),
    session_id: z.string().uuid(),
    session_secret: z.string().min(32).max(256),
    answers: z.record(z.string(), z.unknown()).optional(),
    // The visitor's own chosen locale — not persisted anywhere server-side
    // before submission (see publicLocaleContext.ts, which is localStorage
    // only), so the client passes it explicitly at the one point it needs
    // to be frozen into the visitor summary snapshot and email.
    locale: z.string().max(16).optional(),
  }),
  z.object({
    action: z.literal("upload_project_photo"),
    session_id: z.string().uuid(),
    session_secret: z.string().min(32).max(256),
    field_key: z.string().min(1),
    image_base64: z.string().min(1),
    media_type: z.string().min(1),
    filename: z.string().min(1).max(200),
  }),
  z.object({
    action: z.literal("analyze_inspiration_photo"),
    session_id: z.string().uuid(),
    session_secret: z.string().min(32).max(256),
    field_key: z.string().min(1),
    image_base64: z.string().min(1),
    media_type: z.string().min(1),
  }),
]);

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip") ?? "unknown";
}

function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "metre-build-ai";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

function generateSessionSecret(): string {
  return randomBytes(SESSION_SECRET_BYTES).toString("hex");
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

// Constant-time comparison so a mistyped/guessed secret can't be distinguished
// from a correct one by response timing.
function secretMatches(storedHash: string, provided: string): boolean {
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(hashSecret(provided), "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** No dedicated "business name" field exists on build_missions — fall back to the mission's own name when the workspace lookup comes up empty. */
async function resolveBusinessName(
  supabase: Supa,
  mission: Record<string, unknown>,
): Promise<string> {
  const workspaceId = mission.workspace_id as string | null;
  if (workspaceId) {
    const { data } = await supabase
      .from("build_workspaces")
      .select("name")
      .eq("id", workspaceId)
      .maybeSingle();
    if (data?.name) return data.name;
  }
  return (mission.name as string | undefined) ?? "";
}

function publicMission(m: Record<string, unknown>, workspaceName?: string | null) {
  return {
    id: m.id,
    name: m.name,
    status: m.status,
    objective: m.objective,
    playbook_id: m.playbook_id,
    playbook_name: m.playbook_name,
    proposal: m.proposal,
    /** The business the visitor thinks they are talking to. The runtime shows
     * this instead of Métré Build's own branding — the intake is embedded in
     * the customer's site and must read as theirs. */
    workspace_name: workspaceName ?? null,
  };
}

function findFieldByKey(schema: PlaybookSchema, key: string): PlaybookField | undefined {
  for (const section of schema.sections) {
    for (const step of section.steps) {
      const field = step.fields.find((f) => f.key === key);
      if (field) return field;
    }
  }
  return undefined;
}

// Sole public lookup path: must always require an unrevoked token on an
// active mission. Do not add a mission_id-only variant of this query.
export async function findPublishedMission(supabase: Supa, publicToken: string) {
  return supabase
    .from("build_missions")
    .select("*")
    .eq("status", PUBLISHED_STATUS)
    .eq("public_token", publicToken)
    .is("public_token_revoked_at", null)
    .maybeSingle();
}

async function loadPlaybookSchema(
  supabase: Supa,
  playbookVersionId: string,
): Promise<PlaybookSchema | null> {
  const { data, error } = await supabase
    .from("build_playbook_versions")
    .select("schema")
    .eq("id", playbookVersionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const parsed = playbookSchema.safeParse(data.schema);
  return parsed.success ? parsed.data : null;
}

export async function handleGetMission(supabase: Supa, publicToken: string) {
  const { data, error } = await findPublishedMission(supabase, publicToken);
  if (error) throw error;
  if (!data) return json(404, { error: "Mission not found or not published" });
  if (!data.playbook_version_id) return json(404, { error: "Mission has no published playbook" });
  const schema = await loadPlaybookSchema(supabase, data.playbook_version_id as string);
  if (!schema) return json(500, { error: "Playbook schema unavailable" });
  const workspaceName = await resolveBusinessName(supabase, data);
  return json(200, { mission: publicMission(data, workspaceName), playbook_schema: schema });
}

export async function handleStartSession(supabase: Supa, publicToken: string, ipHash: string) {
  const { data: mission, error: mErr } = await findPublishedMission(supabase, publicToken);
  if (mErr) throw mErr;
  if (!mission) return json(404, { error: "Mission not available" });
  if (!mission.playbook_version_id)
    return json(404, { error: "Mission has no published playbook" });
  const schema = await loadPlaybookSchema(supabase, mission.playbook_version_id as string);
  if (!schema) return json(500, { error: "Playbook schema unavailable" });

  const secret = generateSessionSecret();
  const { data, error } = await supabase
    .from("build_runtime_sessions")
    .insert({
      mission_id: mission.id,
      ip_hash: ipHash,
      status: "in_progress",
      session_secret_hash: hashSecret(secret),
    })
    .select("id, mission_id, status, answers, created_at")
    .single();
  if (error) throw error;
  return json(200, {
    mission: publicMission(mission, await resolveBusinessName(supabase, mission)),
    session: data,
    session_secret: secret,
    playbook_schema: schema,
  });
}

async function loadSessionSecretHash(supabase: Supa, sessionId: string) {
  return supabase
    .from("build_runtime_sessions")
    .select("id, session_secret_hash, status, mission_id, answers")
    .eq("id", sessionId)
    .maybeSingle();
}

// Verifies session_id + session_secret together. Returns the session row only
// when the secret matches; otherwise null (caller responds 404 either way so
// a bad secret can't be distinguished from an unknown session_id).
async function verifySessionSecret(supabase: Supa, sessionId: string, secret: string) {
  const { data, error } = await loadSessionSecretHash(supabase, sessionId);
  if (error) throw error;
  if (!data || !data.session_secret_hash || !secretMatches(data.session_secret_hash, secret)) {
    return null;
  }
  return data;
}

async function findExistingDossier(supabase: Supa, sessionId: string) {
  const { data, error } = await supabase
    .from("build_dossiers")
    .select("id, status, summary, content, next_questions, visitor_summary, visitor_email_sent_at")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { visitor_email_sent_at, ...rest } = data;
  return { ...rest, emailSent: visitor_email_sent_at !== null };
}

export async function handleResumeSession(supabase: Supa, sessionId: string, secret: string) {
  const session = await verifySessionSecret(supabase, sessionId, secret);
  if (!session) return json(404, { error: "Session not found" });

  const { data: mission, error: mErr } = await supabase
    .from("build_missions")
    .select("*")
    .eq("id", session.mission_id)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!mission || !mission.playbook_version_id)
    return json(404, { error: "Mission not available" });
  const schema = await loadPlaybookSchema(supabase, mission.playbook_version_id as string);
  if (!schema) return json(500, { error: "Playbook schema unavailable" });

  const sessionPayload = { id: session.id, answers: session.answers, status: session.status };

  if (session.status !== "in_progress") {
    const existing = await findExistingDossier(supabase, sessionId);
    if (existing) {
      return json(200, {
        mission: publicMission(mission, await resolveBusinessName(supabase, mission)),
        playbook_schema: schema,
        session: sessionPayload,
        dossier: existing,
      });
    }
  }

  return json(200, {
    mission: publicMission(mission, await resolveBusinessName(supabase, mission)),
    playbook_schema: schema,
    session: sessionPayload,
  });
}

export async function handleSaveSession(
  supabase: Supa,
  sessionId: string,
  secret: string,
  answers: Record<string, unknown>,
) {
  const session = await verifySessionSecret(supabase, sessionId, secret);
  if (!session) return json(404, { error: "Session not found" });

  const { data: mission, error: mErr } = await supabase
    .from("build_missions")
    .select("playbook_version_id")
    .eq("id", session.mission_id)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!mission?.playbook_version_id)
    return json(500, { error: "Mission has no published playbook" });
  const schema = await loadPlaybookSchema(supabase, mission.playbook_version_id as string);
  if (!schema) return json(500, { error: "Playbook schema unavailable" });

  // Partial validation: unknown keys are rejected outright; known keys with a
  // non-empty value must match their field's type/format. Required-ness is a
  // submit-time concern only (an interim autosave may legitimately be blank).
  const fieldErrors: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    const field = findFieldByKey(schema, key);
    if (!field) {
      fieldErrors[key] = "Unknown field.";
      continue;
    }
    const blank =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);
    if (blank) continue;
    const error = validateFieldFormat(field, value as AnswerValue);
    if (error) fieldErrors[key] = error;
  }
  if (Object.keys(fieldErrors).length > 0) {
    return json(400, { error: "Invalid answers", fieldErrors });
  }

  const { data, error } = await supabase
    .from("build_runtime_sessions")
    .update({ answers: answers as unknown as Json })
    .eq("id", sessionId)
    .eq("status", "in_progress")
    .select("id, answers, status")
    .maybeSingle();
  if (error) throw error;
  if (!data) return json(409, { error: "Session already submitted" });
  return json(200, { session: data });
}

export async function handleSubmitSession(
  supabase: Supa,
  sessionId: string,
  secret: string,
  answers?: Record<string, unknown>,
  rawLocale?: string,
) {
  const session = await verifySessionSecret(supabase, sessionId, secret);
  if (!session) return json(404, { error: "Session not found" });

  // Idempotency guard #1: session must still be in_progress to transition.
  // A session that already left in_progress means a previous submit won —
  // return that dossier instead of erroring or creating a second one.
  if (session.status !== "in_progress") {
    const existing = await findExistingDossier(supabase, sessionId);
    if (existing) return json(200, { dossier: existing });
    return json(409, { error: "Session already submitted" });
  }

  const { data: mission, error: missionErr } = await supabase
    .from("build_missions")
    .select("*")
    .eq("id", session.mission_id)
    .maybeSingle();
  if (missionErr) throw missionErr;
  if (!mission?.playbook_version_id)
    return json(500, { error: "Mission has no published playbook" });
  const schema = await loadPlaybookSchema(supabase, mission.playbook_version_id as string);
  if (!schema) return json(500, { error: "Playbook schema unavailable" });

  const finalAnswers = (answers ?? (session.answers as Record<string, unknown>) ?? {}) as Answers;

  // Full validation: every currently-visible field must satisfy its own
  // rules (required, not-sure, format) before a Dossier can be created.
  const fieldErrors: Record<string, string> = {};
  for (const { visibleFields } of computeVisibleSteps(schema, finalAnswers)) {
    for (const field of visibleFields) {
      const error = validateField(field, finalAnswers[field.key]);
      if (error) fieldErrors[field.key] = error;
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return json(422, { error: "Some required information is missing or invalid.", fieldErrors });
  }

  const update: { status: string; submitted_at: string; answers?: Json } = {
    status: "submitted",
    submitted_at: new Date().toISOString(),
  };
  if (answers) update.answers = finalAnswers as unknown as Json;

  const { data: updatedSession, error: sErr } = await supabase
    .from("build_runtime_sessions")
    .update(update)
    .eq("id", sessionId)
    .eq("status", "in_progress")
    .select("id, mission_id, answers")
    .maybeSingle();
  if (sErr) throw sErr;
  if (!updatedSession) {
    // Lost a race against a concurrent submit for the same session.
    const existing = await findExistingDossier(supabase, sessionId);
    if (existing) return json(200, { dossier: existing });
    return json(409, { error: "Session already submitted" });
  }

  const brief = generateProjectBrief(schema, updatedSession.answers as Answers, mission);
  const missingCount = brief.missingInformation.length;
  const dossierStatus = missingCount > 0 ? "draft" : "ready";
  const summary =
    missingCount > 0
      ? `Draft dossier — ${missingCount} follow-up item${missingCount > 1 ? "s" : ""} pending.`
      : "Complete dossier ready for commercial review.";

  const finalAnswersTyped = updatedSession.answers as Answers;
  const proposal = missionProposalSchema.safeParse(mission.proposal ?? {}).success
    ? missionProposalSchema.parse(mission.proposal ?? {})
    : {};
  const businessName = await resolveBusinessName(supabase, mission);
  const locale = resolveSupportedLocale(rawLocale, DEFAULT_LOCALE);

  // Visual preview: only ever computed when the Mission's own Playbook
  // opted in (old/other Missions get no visualPreview key at all — see
  // VisitorProjectSummary.visualPreview). resolveDeckPreviewParams is a
  // pure, total function (never throws), so this can never block
  // submission. Frozen into the snapshot now, not recomputed later, so a
  // subsequent Playbook edit can never silently change what a visitor
  // already submitted sees on their secure link.
  let visualPreview: DeckPreviewSnapshot | undefined;
  if (proposal.visualPreview?.enabled && proposal.visualPreview.type === "simple-deck-3d") {
    const { resolveDeckPreviewParams, DECK_PREVIEW_MODEL_VERSION } =
      await import("@/build/visualPreview/deckPreviewParams");
    visualPreview = {
      version: DECK_PREVIEW_MODEL_VERSION,
      resolution: resolveDeckPreviewParams(finalAnswersTyped, schema),
    };
  }

  const visitorSummary = buildVisitorProjectSummary(brief, proposal, {
    businessName,
    locale,
    measurementSystem: DEFAULT_MEASUREMENT_SYSTEM,
    photos: extractPhotoReferences(finalAnswersTyped),
    submittedAt: update.submitted_at,
    visualPreview,
  });
  const visitorEmail =
    typeof finalAnswersTyped.email === "string" ? finalAnswersTyped.email.trim() || null : null;
  const visitorName =
    typeof finalAnswersTyped.name === "string" ? finalAnswersTyped.name.trim() || null : null;

  const { data: dossier, error: dErr } = await supabase
    .from("build_dossiers")
    .insert({
      workspace_id: mission.workspace_id ?? null,
      mission_id: updatedSession.mission_id,
      session_id: updatedSession.id,
      status: dossierStatus,
      summary,
      content: brief as unknown as Json,
      next_questions: brief.missingInformation.map((line) => line.label),
      playbook_version_id: (mission.playbook_version_id as string | null) ?? null,
      visitor_summary: visitorSummary as unknown as Json,
      visitor_email: visitorEmail,
      visitor_name: visitorName,
    })
    .select("id, status, summary, content, next_questions, visitor_summary")
    .single();
  if (dErr) {
    // Idempotency guard #2 (belt-and-braces): the unique index on
    // build_dossiers.session_id rejects a second insert outright if two
    // submits ever raced past the status check above.
    if ((dErr as { code?: string }).code === "23505") {
      const existing = await findExistingDossier(supabase, sessionId);
      if (existing) return json(200, { dossier: existing });
    }
    throw dErr;
  }
  // Fire-and-forget notification to the Espace Client members. Never blocks
  // or fails the visitor's submission.
  const { notifyWorkspaceOfNewDossier } =
    await import("@/build/services/dossierNotification.server");
  await notifyWorkspaceOfNewDossier(supabase, {
    workspaceId: (mission.workspace_id as string | null) ?? null,
    dossierId: dossier.id,
    missionName: (mission.name as string | null) ?? null,
    summary: dossier.summary,
    nextQuestions: (dossier.next_questions as string[] | null) ?? [],
  });

  // Mint the visitor's secure summary access token — only ever attempted
  // here, in the one-time dossier-creation branch (same idempotency
  // guarantee as the email below: a resubmitted/duplicate request can
  // never mint a second token for the same dossier). Never throws; a
  // failure here must not fail the visitor's submission.
  let summaryUrl: string | null = null;
  try {
    const { generateAccessToken, hashAccessToken, accessTokenExpiryFromNow } =
      await import("@/build/services/dossierAccessToken.server");
    const { SITE_URL } = await import("@/lib/structured-data");
    const rawToken = generateAccessToken();
    const { error: tokenError } = await supabase.from("build_dossier_access_tokens").insert({
      dossier_id: dossier.id,
      token_hash: hashAccessToken(rawToken),
      expires_at: accessTokenExpiryFromNow(),
    });
    if (tokenError) throw tokenError;
    summaryUrl = `${SITE_URL}/project-summary/${rawToken}`;
  } catch (err) {
    logOperationalError("visitor-summary.token-mint-failed", err, { dossierId: dossier.id });
  }

  // Visitor's own confirmation email — awaited (unlike the workspace
  // notification above) so the response can report a true emailSent
  // outcome; the UI must never claim a copy was sent when it wasn't.
  // Never throws — see sendVisitorSummaryEmail's own contract. Only ever
  // attempted here, in the one-time dossier-creation branch, never on any
  // of the idempotent-retry paths above, so a resubmitted/duplicate
  // request can never trigger a second email.
  let emailSent = false;
  if (visitorEmail) {
    const { sendVisitorSummaryEmail } = await import("@/build/services/visitorSummaryEmail.server");
    emailSent = await sendVisitorSummaryEmail({
      dossierId: dossier.id,
      workspaceId: (mission.workspace_id as string | null) ?? null,
      missionId: updatedSession.mission_id as string,
      recipientEmail: visitorEmail,
      summary: visitorSummary,
      summaryUrl,
    });
    if (emailSent) {
      await supabase
        .from("build_dossiers")
        .update({ visitor_email_sent_at: new Date().toISOString() })
        .eq("id", dossier.id);
    }
  }

  return json(200, { dossier: { ...dossier, emailSent, summaryUrl } });
}

// Stateless: uploads the image to Storage and returns the vision agent's
// hypotheses. Never writes to build_runtime_sessions — the visitor confirms
// or corrects the hypotheses client-side, and the resulting
/**
 * Stores one file attached to a `photo` field whose Playbook asks for
 * `supabase_storage`. No AI, no analysis: this is evidence the workspace will
 * look at, not something a model reads. Stateless like the inspiration
 * upload — the returned storagePath is written into the answer by the
 * ordinary save_session call, so an abandoned session leaves an orphaned
 * object and never a half-written answer.
 */
export async function handleUploadProjectPhoto(
  supabase: Supa,
  sessionId: string,
  secret: string,
  fieldKey: string,
  imageBase64: string,
  mediaType: string,
  filename: string,
) {
  const session = await verifySessionSecret(supabase, sessionId, secret);
  if (!session) return json(404, { error: "Session not found" });
  if (session.status !== "in_progress") return json(409, { error: "Session already submitted" });

  const { data: mission, error: mErr } = await supabase
    .from("build_missions")
    .select("playbook_version_id")
    .eq("id", session.mission_id)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!mission?.playbook_version_id)
    return json(500, { error: "Mission has no published playbook" });
  const schema = await loadPlaybookSchema(supabase, mission.playbook_version_id as string);
  if (!schema) return json(500, { error: "Playbook schema unavailable" });

  // The Playbook decides what this field accepts, and it must also have asked
  // for uploads: a filename_only field has no business writing to Storage.
  const field = findFieldByKey(schema, fieldKey);
  if (!field || field.type !== "photo" || field.storage !== "supabase_storage") {
    return json(400, { error: "Unknown or invalid field for a photo upload." });
  }
  if (!field.acceptMimeTypes.includes(mediaType)) {
    return json(400, { error: "Unsupported image type." });
  }
  if (!PROJECT_PHOTOS_ALLOWED_MIME_TYPES.includes(mediaType as never)) {
    // Storage would reject it anyway; refusing here keeps the visitor out of a 500.
    return json(400, { error: "Unsupported image type." });
  }

  const buffer = Buffer.from(imageBase64, "base64");
  const maxBytes = Math.min(field.maxFileSizeMb, PROJECT_PHOTOS_MAX_FILE_SIZE_MB) * 1024 * 1024;
  if (buffer.length === 0 || buffer.length > maxBytes) {
    return json(400, { error: `Each photo must be under ${field.maxFileSizeMb} MB.` });
  }

  // The visitor's filename never becomes the object key — it is theirs, it can
  // collide, and it can carry anything. It travels as the caption instead.
  const storagePath = `sessions/${sessionId}/${randomUUID()}`;
  const { error: uploadError } = await supabase.storage
    .from(PROJECT_PHOTOS_BUCKET)
    .upload(storagePath, buffer, { contentType: mediaType, upsert: false });
  if (uploadError) {
    logOperationalError("build-runtime.project-photo-upload-failed", uploadError, {
      sessionId,
      fieldKey,
      mediaType,
      storagePath,
    });
    return json(500, { error: "Unable to store the photo." });
  }

  return json(200, {
    storagePath,
    filename: filename.slice(0, 200),
    sizeBytes: buffer.length,
    mimeType: mediaType,
  });
}

// InspirationPhotoAnswer is persisted like any other field via the ordinary
// save_session/submit_session actions above.
export async function handleAnalyzeInspirationPhoto(
  supabase: Supa,
  sessionId: string,
  secret: string,
  fieldKey: string,
  imageBase64: string,
  mediaType: string,
) {
  const session = await verifySessionSecret(supabase, sessionId, secret);
  if (!session) return json(404, { error: "Session not found" });
  if (session.status !== "in_progress") return json(409, { error: "Session already submitted" });

  const { data: mission, error: mErr } = await supabase
    .from("build_missions")
    .select("playbook_version_id")
    .eq("id", session.mission_id)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!mission?.playbook_version_id)
    return json(500, { error: "Mission has no published playbook" });
  const schema = await loadPlaybookSchema(supabase, mission.playbook_version_id as string);
  if (!schema) return json(500, { error: "Playbook schema unavailable" });

  const field = findFieldByKey(schema, fieldKey);
  if (!field || field.type !== "inspiration_photo") {
    return json(400, { error: "Unknown or invalid field for photo analysis." });
  }
  if (!field.acceptMimeTypes.includes(mediaType)) {
    return json(400, { error: "Unsupported image type." });
  }

  const buffer = Buffer.from(imageBase64, "base64");
  const maxBytes = field.maxFileSizeMb * 1024 * 1024;
  if (buffer.length === 0 || buffer.length > maxBytes) {
    return json(400, { error: `Image must be under ${field.maxFileSizeMb} MB.` });
  }

  const extension = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
  const photoPath = `sessions/${sessionId}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(INSPIRATION_PHOTOS_BUCKET)
    .upload(photoPath, buffer, { contentType: mediaType, upsert: false });
  if (uploadError) {
    logOperationalError("build-runtime.inspiration-photo-upload-failed", uploadError, {
      sessionId,
      fieldKey,
      mediaType,
      photoPath,
    });
    return json(500, { error: "Unable to store the image." });
  }

  const { runImageAnalysis } = await import("@/build/ai/imageAnalysis");
  const result = await runImageAnalysis({ base64: imageBase64, mediaType });
  if (result.status === "error" || !result.data) {
    // Still return the stored path so the client can retry analysis without re-uploading.
    return json(502, { error: result.error ?? "Image analysis unavailable.", photoPath });
  }

  return json(200, { photoPath, hypotheses: result.data });
}

export const Route = createFileRoute("/api/public/build-runtime")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > MAX_PHOTO_BODY_BYTES) return json(413, { error: "Payload too large" });

        let parsed;
        try {
          parsed = bodySchema.safeParse(JSON.parse(raw));
        } catch {
          return json(400, { error: "Invalid JSON" });
        }
        if (!parsed.success) {
          return json(400, { error: "Invalid body", details: parsed.error.flatten() });
        }
        const body = parsed.data;
        // Only the photo-analysis action may exceed the ordinary 32 KB cap.
        const isPhotoUpload =
          body.action === "analyze_inspiration_photo" || body.action === "upload_project_photo";
        if (!isPhotoUpload && raw.length > MAX_BODY_BYTES) {
          return json(413, { error: "Payload too large" });
        }

        const ipHash = hashIp(clientIp(request));
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Per-IP rate limit
        const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();
        const { count } = await supabaseAdmin
          .from("build_runtime_rate")
          .select("*", { count: "exact", head: true })
          .eq("ip_hash", ipHash)
          .gte("created_at", windowStart);
        if ((count ?? 0) >= RATE_LIMIT_MAX) {
          return json(429, { error: "Too many requests" });
        }
        await supabaseAdmin
          .from("build_runtime_rate")
          .insert({ ip_hash: ipHash, action: body.action });

        try {
          switch (body.action) {
            case "get_mission":
              return await handleGetMission(supabaseAdmin, body.public_token);
            case "start_session":
              return await handleStartSession(supabaseAdmin, body.public_token, ipHash);
            case "resume_session":
              return await handleResumeSession(supabaseAdmin, body.session_id, body.session_secret);
            case "save_session":
              return await handleSaveSession(
                supabaseAdmin,
                body.session_id,
                body.session_secret,
                body.answers,
              );
            case "submit_session":
              return await handleSubmitSession(
                supabaseAdmin,
                body.session_id,
                body.session_secret,
                body.answers,
                body.locale,
              );
            case "upload_project_photo":
              return await handleUploadProjectPhoto(
                supabaseAdmin,
                body.session_id,
                body.session_secret,
                body.field_key,
                body.image_base64,
                body.media_type,
                body.filename,
              );
            case "analyze_inspiration_photo":
              return await handleAnalyzeInspirationPhoto(
                supabaseAdmin,
                body.session_id,
                body.session_secret,
                body.field_key,
                body.image_base64,
                body.media_type,
              );
            default:
              return json(400, { error: "Unknown action" });
          }
        } catch (err) {
          logOperationalError("build-runtime.unhandled-error", err, {
            action: body.action,
          });
          return json(500, {
            error: err instanceof Error ? err.message : "Internal error",
          });
        }
      },
    },
  },
});
