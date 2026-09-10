/**
 * Le fil d'un projet, côté serveur uniquement.
 *
 * Les tables du fil refusent `anon` et `authenticated`. Ce fichier est le seul
 * chemin : il identifie qui demande (admin, atelier retenu, client), applique
 * `projectThreadAccess`, puis lit avec la clé service. Un fichier n'est jamais
 * servi autrement que par une URL signée d'une heure, délivrée après ce
 * contrôle.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import {
  binderAccessFacts,
  projectThreadAccess,
  type CaseAccessFacts,
  type ThreadAccess,
  type Viewer,
} from "@/marketplace/permissions";
import {
  decisionOutcome,
  type DecisionOption,
  type DecisionStatus,
  type DecisionType,
  type GildingText,
  type ProjectDecision,
} from "@/marketplace/project/decisions";
import {
  SCOPE_REASON_LABELS,
  SCOPE_STATUS_LABELS,
  type ScopeReason,
  type ScopeStatus,
} from "@/marketplace/project/scopeIssues";
import {
  authorLabel,
  countUnread,
  type AuthorRole,
  type ThreadFile,
  type ThreadMessage,
  type UpdateType,
} from "@/marketplace/project/thread";

import {
  PROJECT_FILE_MAX_BYTES,
  PROJECT_FILE_MIME_TYPES,
  PROJECT_FILES_PER_ITEM,
} from "@/marketplace/project/thread";

export { PROJECT_FILE_MAX_BYTES, PROJECT_FILE_MIME_TYPES, PROJECT_FILES_PER_ITEM };
export const PROJECT_FILES_BUCKET = "marketplace-project-files";
const SIGNED_URL_TTL_SECONDS = 3600;

export interface ThreadActor {
  userId: string;
  role: AuthorRole;
  viewer: Viewer;
  binderId: string | null;
}

export interface ThreadCase {
  id: string;
  reference: string;
  status: string;
  customerUserId: string | null;
  selectedBinderId: string | null;
  binderName: string | null;
  facts: CaseAccessFacts;
}

export interface AuthorizedThread {
  actor: ThreadActor;
  thread: ThreadCase;
  access: ThreadAccess;
}

async function isAdminUser(sb: Supa, userId: string): Promise<boolean> {
  const { data } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}

export async function loadThreadCase(sb: Supa, caseId: string): Promise<ThreadCase | null> {
  const { data: row } = await sb
    .from("marketplace_cases")
    .select("id, reference, status, customer_user_id")
    .eq("id", caseId)
    .maybeSingle();
  if (!row) return null;

  const { data: matches } = await sb
    .from("marketplace_case_matches")
    .select("binder_id, state")
    .eq("case_id", caseId);
  const facts = binderAccessFacts({
    matches: (matches ?? []).map((match) => ({ binderId: match.binder_id, state: match.state })),
    customerUserId: row.customer_user_id,
  });

  let binderName: string | null = null;
  if (facts.selectedBinderId) {
    const { data: binder } = await sb
      .from("marketplace_binders")
      .select("display_name, workshop_name")
      .eq("id", facts.selectedBinderId)
      .maybeSingle();
    binderName = binder ? (binder.workshop_name ?? binder.display_name) : null;
  }

  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    customerUserId: row.customer_user_id,
    selectedBinderId: facts.selectedBinderId,
    binderName,
    facts,
  };
}

/**
 * Qui demande, et ce qu'il peut faire dans ce fil.
 *
 * L'ordre compte : un administrateur est reconnu d'abord ; un compte d'atelier
 * n'est traité en atelier que s'il est **l'atelier retenu** de ce dossier ;
 * tout autre compte est examiné comme client, et n'entre que s'il possède le
 * dossier.
 */
export async function authorizeThread(
  sb: Supa,
  userId: string,
  caseId: string,
  need: "read" | "write",
): Promise<AuthorizedThread> {
  const thread = await loadThreadCase(sb, caseId);
  if (!thread) fail(404, "Projet introuvable.");

  let actor: ThreadActor;
  if (await isAdminUser(sb, userId)) {
    actor = { userId, role: "admin", viewer: { role: "admin" }, binderId: null };
  } else {
    const { data: binder } = await sb
      .from("marketplace_binders")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    actor =
      binder && binder.id === thread.selectedBinderId
        ? {
            userId,
            role: "binder",
            viewer: { role: "binder", binderId: binder.id },
            binderId: binder.id,
          }
        : { userId, role: "customer", viewer: { role: "customer", userId }, binderId: null };
  }

  const access = projectThreadAccess(actor.viewer, { ...thread.facts, status: thread.status });
  if (access === "none") fail(403, "Ce projet ne vous est pas ouvert.");
  if (need === "write" && access !== "write")
    fail(403, "Ce projet est archivé : son fil reste lisible, mais n'accepte plus d'échange.");
  return { actor, thread, access };
}

// ---------------------------------------------------------------------------
// Fichiers
// ---------------------------------------------------------------------------

type FileRow = {
  id: string;
  owner_kind: string;
  owner_id: string;
  option_id: string | null;
  storage_path: string;
  mime_type: string;
};

export async function signFiles(
  sb: Supa,
  rows: readonly FileRow[],
): Promise<Map<string, ThreadFile>> {
  if (rows.length === 0) return new Map();
  const { data } = await sb.storage.from(PROJECT_FILES_BUCKET).createSignedUrls(
    rows.map((row) => row.storage_path),
    SIGNED_URL_TTL_SECONDS,
  );
  const urls = new Map((data ?? []).map((item) => [item.path ?? "", item.signedUrl ?? null]));
  return new Map(
    rows.map((row) => [
      row.id,
      { id: row.id, url: urls.get(row.storage_path) ?? null, mimeType: row.mime_type },
    ]),
  );
}

export function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "pdf";
  }
}

export interface VerifiedFile {
  path: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Vérifie des fichiers déposés par URL signée avant de les rattacher.
 *
 * Le navigateur annonce un chemin ; on ne croit ni le chemin, ni le type, ni
 * la taille. Le chemin doit appartenir à ce dossier, l'objet doit exister, et
 * ce que le stockage en dit — pas ce que le client a déclaré — doit respecter
 * la liste des types et la taille maximale.
 */
export async function verifyUploadedFiles(
  sb: Supa,
  caseId: string,
  paths: readonly string[],
): Promise<VerifiedFile[]> {
  if (paths.length > PROJECT_FILES_PER_ITEM)
    fail(422, `Au plus ${PROJECT_FILES_PER_ITEM} fichiers par envoi.`);
  const folder = `cases/${caseId}`;
  const verified: VerifiedFile[] = [];
  for (const path of paths) {
    const name = path.slice(folder.length + 1);
    if (!path.startsWith(`${folder}/`) || name === "" || name.includes("/"))
      fail(422, "Ce fichier n'appartient pas à ce projet.");
    const { data } = await sb.storage.from(PROJECT_FILES_BUCKET).list(folder, { search: name });
    const object = (data ?? []).find((item) => item.name === name);
    const metadata = (object?.metadata ?? {}) as { size?: number; mimetype?: string };
    if (!object || typeof metadata.size !== "number" || typeof metadata.mimetype !== "string")
      fail(422, "Un fichier n'a pas été reçu. Réessayez l'envoi.");
    if (!(PROJECT_FILE_MIME_TYPES as readonly string[]).includes(metadata.mimetype!))
      fail(422, "Seules les photos (JPEG, PNG, WebP, HEIC) et les PDF sont acceptés.");
    if (metadata.size! > PROJECT_FILE_MAX_BYTES) fail(422, "Un fichier dépasse 10 Mo.");
    verified.push({ path, mimeType: metadata.mimetype!, sizeBytes: metadata.size! });
  }
  return verified;
}

export async function attachFiles(
  sb: Supa,
  input: {
    caseId: string;
    ownerKind: "message" | "decision_option" | "scope_issue";
    ownerId: string;
    optionId?: string | null;
    files: readonly VerifiedFile[];
    actor: ThreadActor;
  },
): Promise<void> {
  if (input.files.length === 0) return;
  const { error } = await sb.from("marketplace_project_files").insert(
    input.files.map((file) => ({
      case_id: input.caseId,
      owner_kind: input.ownerKind,
      owner_id: input.ownerId,
      option_id: input.ownerKind === "decision_option" ? (input.optionId ?? null) : null,
      storage_path: file.path,
      mime_type: file.mimeType,
      size_bytes: file.sizeBytes,
      uploaded_by: input.actor.userId,
      uploaded_role: input.actor.role,
    })),
  );
  if (error) fail(500, error.message);
}

// ---------------------------------------------------------------------------
// Lecture du fil
// ---------------------------------------------------------------------------

type MessageRow = {
  id: string;
  author_role: string;
  author_user_id: string | null;
  kind: string;
  update_type: string | null;
  body: string;
  important: boolean;
  created_at: string;
  deleted_at: string | null;
};

type DecisionRow = {
  id: string;
  case_id: string;
  created_by_role: string;
  decision_type: string;
  question: string;
  description: string | null;
  options: unknown;
  gilding_text: unknown;
  allow_free_text: boolean;
  status: string;
  selected_option_id: string | null;
  free_text_answer: string | null;
  answered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  supersedes_decision_id: string | null;
  created_at: string;
};

export const DECISION_COLUMNS =
  "id, case_id, created_by_role, decision_type, question, description, options, gilding_text, allow_free_text, status, selected_option_id, free_text_answer, answered_at, cancelled_at, cancel_reason, supersedes_decision_id, created_at";

export function toDecision(row: DecisionRow): ProjectDecision {
  return {
    id: row.id,
    caseId: row.case_id,
    createdByRole: row.created_by_role as ProjectDecision["createdByRole"],
    decisionType: row.decision_type as DecisionType,
    question: row.question,
    description: row.description,
    options: (Array.isArray(row.options) ? row.options : []) as DecisionOption[],
    gildingText: (row.gilding_text ?? null) as GildingText | null,
    allowFreeText: row.allow_free_text,
    status: row.status as DecisionStatus,
    selectedOptionId: row.selected_option_id,
    freeTextAnswer: row.free_text_answer,
    answeredAt: row.answered_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    supersedesDecisionId: row.supersedes_decision_id,
    createdAt: row.created_at,
  };
}

export interface DecisionView extends ProjectDecision {
  askedBy: string;
  outcome: string | null;
  optionFiles: Record<string, ThreadFile[]>;
}

export interface ScopeIssueView {
  id: string;
  reason: ScopeReason;
  reasonLabel: string;
  description: string;
  status: ScopeStatus;
  statusLabel: string;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  files: ThreadFile[];
}

export interface LoadedThread {
  messages: ThreadMessage[];
  decisions: DecisionView[];
  /** Vide pour le client : un imprévu ne lui parvient que par Ma Reliure. */
  scopeIssues: ScopeIssueView[];
  lastReadAt: string | null;
  unread: number;
}

export async function loadThread(sb: Supa, authorized: AuthorizedThread): Promise<LoadedThread> {
  const { actor, thread } = authorized;
  const [messagesResult, decisionsResult, readResult, issuesResult] = await Promise.all([
    sb
      .from("marketplace_project_messages")
      .select(
        "id, author_role, author_user_id, kind, update_type, body, important, created_at, deleted_at",
      )
      .eq("case_id", thread.id)
      .order("created_at", { ascending: true }),
    sb
      .from("marketplace_project_decisions")
      .select(DECISION_COLUMNS)
      .eq("case_id", thread.id)
      .order("created_at", { ascending: true }),
    sb
      .from("marketplace_project_reads")
      .select("last_read_at")
      .eq("case_id", thread.id)
      .eq("user_id", actor.userId)
      .maybeSingle(),
    actor.role === "customer"
      ? Promise.resolve({ data: [] as never[] })
      : sb
          .from("marketplace_scope_issues")
          .select("id, reason, description, status, resolution_note, created_at, resolved_at")
          .eq("case_id", thread.id)
          .order("created_at", { ascending: false }),
  ]);

  const messageRows = (messagesResult.data ?? []) as MessageRow[];
  const decisionRows = (decisionsResult.data ?? []) as DecisionRow[];
  const issueRows = (issuesResult.data ?? []) as {
    id: string;
    reason: string;
    description: string;
    status: string;
    resolution_note: string | null;
    created_at: string;
    resolved_at: string | null;
  }[];

  const ownerIds = [
    ...messageRows.map((m) => m.id),
    ...decisionRows.map((d) => d.id),
    ...issueRows.map((i) => i.id),
  ];
  const { data: fileRows } =
    ownerIds.length === 0
      ? { data: [] as FileRow[] }
      : await sb
          .from("marketplace_project_files")
          .select("id, owner_kind, owner_id, option_id, storage_path, mime_type")
          .eq("case_id", thread.id)
          .in("owner_id", ownerIds);
  const files = (fileRows ?? []) as FileRow[];
  const signed = await signFiles(sb, files);
  const filesOf = (ownerId: string, optionId?: string) =>
    files
      .filter(
        (file) =>
          file.owner_id === ownerId && (optionId === undefined || file.option_id === optionId),
      )
      .map((file) => signed.get(file.id)!)
      .filter(Boolean);

  const messages: ThreadMessage[] = messageRows.map((row) => {
    const deleted = row.deleted_at !== null;
    return {
      id: row.id,
      authorRole: row.author_role as AuthorRole,
      authorLabel: authorLabel({
        authorRole: row.author_role as AuthorRole,
        authorUserId: row.author_user_id,
        viewerUserId: actor.userId,
        binderName: thread.binderName,
      }),
      mine: row.author_user_id === actor.userId,
      kind: row.kind as ThreadMessage["kind"],
      updateType: row.update_type as UpdateType | null,
      // Un message retiré ne se relit plus que par Ma Reliure.
      body: deleted && actor.role !== "admin" ? "" : row.body,
      important: row.important,
      createdAt: row.created_at,
      deleted,
      files: deleted && actor.role !== "admin" ? [] : filesOf(row.id),
    };
  });

  const decisions: DecisionView[] = decisionRows.map((row) => {
    const decision = toDecision(row);
    return {
      ...decision,
      askedBy:
        decision.createdByRole === "admin" ? "Ma Reliure" : (thread.binderName ?? "L'atelier"),
      outcome: decisionOutcome(decision),
      optionFiles: Object.fromEntries(
        decision.options.map((option) => [option.id, filesOf(decision.id, option.id)]),
      ),
    };
  });

  const scopeIssues: ScopeIssueView[] = issueRows.map((row) => ({
    id: row.id,
    reason: row.reason as ScopeReason,
    reasonLabel: SCOPE_REASON_LABELS[row.reason as ScopeReason] ?? row.reason,
    description: row.description,
    status: row.status as ScopeStatus,
    statusLabel: SCOPE_STATUS_LABELS[row.status as ScopeStatus] ?? row.status,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    files: filesOf(row.id),
  }));

  const lastReadAt = readResult.data?.last_read_at ?? null;
  return {
    messages,
    decisions,
    scopeIssues,
    lastReadAt,
    unread: countUnread(
      messageRows.map((row) => ({
        authorUserId: row.author_user_id,
        createdAt: row.created_at,
        deleted: row.deleted_at !== null,
      })),
      actor.userId,
      lastReadAt,
    ),
  };
}

// ---------------------------------------------------------------------------
// Résumés pour les tableaux
// ---------------------------------------------------------------------------

export interface ThreadSummary {
  unread: number;
  openDecisions: {
    id: string;
    question: string;
    createdAt: string;
    createdByRole: "binder" | "admin";
    status: "OPEN";
  }[];
  /** Décisions tranchées par le client depuis la dernière lecture de l'atelier. */
  answeredSinceRead: number;
  lastActivityAt: string | null;
}

/**
 * Non-lus, questions ouvertes et dernière activité, pour une liste de dossiers
 * déjà autorisés. Trois requêtes quel que soit le nombre de dossiers.
 */
export async function threadSummaries(
  sb: Supa,
  caseIds: readonly string[],
  userId: string,
): Promise<Map<string, ThreadSummary>> {
  const summaries = new Map<string, ThreadSummary>();
  if (caseIds.length === 0) return summaries;

  const [messages, decisions, reads] = await Promise.all([
    sb
      .from("marketplace_project_messages")
      .select("case_id, author_user_id, created_at, deleted_at")
      .in("case_id", caseIds),
    sb
      .from("marketplace_project_decisions")
      .select("id, case_id, question, status, created_at, created_by_role, answered_at")
      .in("case_id", caseIds),
    sb
      .from("marketplace_project_reads")
      .select("case_id, last_read_at")
      .eq("user_id", userId)
      .in("case_id", caseIds),
  ]);

  const lastRead = new Map((reads.data ?? []).map((row) => [row.case_id, row.last_read_at]));
  for (const caseId of caseIds) {
    const caseMessages = (messages.data ?? []).filter((row) => row.case_id === caseId);
    const caseDecisions = (decisions.data ?? []).filter((row) => row.case_id === caseId);
    const readAt = lastRead.get(caseId) ?? null;
    const since = readAt ? new Date(readAt).getTime() : Number.NEGATIVE_INFINITY;
    summaries.set(caseId, {
      unread: countUnread(
        caseMessages.map((row) => ({
          authorUserId: row.author_user_id,
          createdAt: row.created_at,
          deleted: row.deleted_at !== null,
        })),
        userId,
        readAt,
      ),
      openDecisions: caseDecisions
        .filter((row) => row.status === "OPEN")
        .map((row) => ({
          id: row.id,
          question: row.question,
          createdAt: row.created_at,
          createdByRole: row.created_by_role as "binder" | "admin",
          status: "OPEN" as const,
        })),
      answeredSinceRead: caseDecisions.filter(
        (row) => row.answered_at !== null && new Date(row.answered_at).getTime() > since,
      ).length,
      lastActivityAt:
        [
          ...caseMessages.map((row) => row.created_at),
          ...caseDecisions.map((row) => row.answered_at ?? row.created_at),
        ]
          .sort()
          .pop() ?? null,
    });
  }
  return summaries;
}
