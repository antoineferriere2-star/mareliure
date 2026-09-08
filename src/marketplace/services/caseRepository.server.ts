/**
 * The only server module that reads Métré's own tables on the marketplace's
 * behalf.
 *
 * Everything else in `src/marketplace/services/` calls in here and receives a
 * `CaseView` or a `CaseProfile` — never a `build_dossiers` row. That is what
 * keeps the coupling to one file (docs/reliure-marketplace-architecture.md
 * §F.1) and, day to day, what keeps a customer's e-mail from reaching a
 * relieur who has not been chosen.
 *
 * Server-only: uses the service-role client, which is the sole way to read
 * `build_*` at all — their RLS denies anon and authenticated outright, and this
 * migration changed none of it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ProjectBrief } from "@/build/schema/brief";
import type { Answers } from "@/build/schema/answers";
import { extractPhotoReferences } from "@/build/engine/visitorSummary";
import { INSPIRATION_PHOTOS_BUCKET } from "@/build/storage/inspirationPhotosBucket";
import { buildCaseProfile, type CaseProfile } from "@/marketplace/cases/caseProfile";
import { triageCase } from "@/marketplace/cases/triage";
import {
  projectCase,
  type CaseView,
  type CaseViewPhoto,
} from "@/marketplace/cases/dossierProjection";
import type { CaseDisclosure } from "@/marketplace/permissions";

type Supa = SupabaseClient<Database>;

const SIGNED_URL_TTL_SECONDS = 3600;

export interface CaseRow {
  id: string;
  dossier_id: string;
  reference: string;
  status: string;
  manual_review_required: boolean;
  heritage_flag: boolean;
  declared_value_band: string | null;
  triaged_at: string | null;
  admin_notes: string | null;
  created_at: string;
}

export interface CaseContext {
  row: CaseRow;
  brief: ProjectBrief;
  profile: CaseProfile;
  answers: Answers;
  customerEmail: string | null;
  customerName: string | null;
  invitedBinderIds: string[];
  selectedBinderId: string | null;
}

/**
 * The answers behind a Dossier, read through its runtime session.
 *
 * Raw answers rather than the Brief because the marketplace branches on stable
 * machine values, not on French labels — see caseProfile.ts. Absent for a
 * Dossier whose session was deleted, in which case the profile degrades to
 * empty rather than failing: a case with no answers is still a case an admin
 * must be able to open and cancel.
 */
async function loadAnswers(sb: Supa, sessionId: string | null): Promise<Answers> {
  if (!sessionId) return {};
  const { data } = await sb
    .from("build_runtime_sessions")
    .select("answers")
    .eq("id", sessionId)
    .maybeSingle();
  return ((data?.answers as Answers | null) ?? {}) as Answers;
}

export async function loadCaseContext(sb: Supa, caseId: string): Promise<CaseContext | null> {
  const { data: row, error } = await sb
    .from("marketplace_cases")
    .select(
      "id, dossier_id, reference, status, manual_review_required, heritage_flag, declared_value_band, triaged_at, admin_notes, created_at",
    )
    .eq("id", caseId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const { data: dossier, error: dossierError } = await sb
    .from("build_dossiers")
    .select("content, visitor_email, visitor_name, session_id")
    .eq("id", row.dossier_id)
    .maybeSingle();
  if (dossierError) throw dossierError;
  if (!dossier) return null;

  const answers = await loadAnswers(sb, dossier.session_id);

  const { data: matches, error: matchError } = await sb
    .from("marketplace_case_matches")
    .select("binder_id, state")
    .eq("case_id", caseId);
  if (matchError) throw matchError;

  return {
    row: row as CaseRow,
    brief: dossier.content as unknown as ProjectBrief,
    profile: buildCaseProfile(answers),
    answers,
    customerEmail: dossier.visitor_email,
    customerName: dossier.visitor_name,
    invitedBinderIds: (matches ?? []).map((m) => m.binder_id),
    selectedBinderId: (matches ?? []).find((m) => m.state === "selected")?.binder_id ?? null,
  };
}

/**
 * Signed URLs for the visitor's photos, from whichever bucket each one came
 * from. Storage paths are never handed to a browser — the URL expires, the
 * path would not.
 */
export async function signCasePhotos(sb: Supa, answers: Answers): Promise<CaseViewPhoto[]> {
  const refs = extractPhotoReferences(answers);
  const photos: CaseViewPhoto[] = [];
  for (const ref of refs) {
    const bucket = ref.bucket ?? INSPIRATION_PHOTOS_BUCKET;
    const { data } = await sb.storage
      .from(bucket)
      .createSignedUrl(ref.path, SIGNED_URL_TTL_SECONDS);
    photos.push({ url: data?.signedUrl ?? null, caption: ref.caption ?? null });
  }
  return photos;
}

/** The projection, at the disclosure level the caller has already been granted. */
export async function buildCaseView(
  sb: Supa,
  context: CaseContext,
  disclosure: CaseDisclosure,
): Promise<CaseView> {
  return projectCase({
    reference: context.row.reference,
    brief: context.brief,
    profile: context.profile,
    disclosure,
    photos: await signCasePhotos(sb, context.answers),
    manualReviewRequired: context.row.manual_review_required,
  });
}

/**
 * Triage every case the ingestion trigger created but nobody has classified.
 *
 * The trigger is deliberately dumb — it makes the row and computes nothing —
 * so that the marketplace's commercial policy stays in TypeScript rather than
 * in a Postgres function. This is the other half of that arrangement, run
 * whenever the admin opens the list. Idempotent: it only ever touches rows
 * where `triaged_at IS NULL`.
 */
export async function reconcileCaseTriage(sb: Supa): Promise<number> {
  const { data: pending, error } = await sb
    .from("marketplace_cases")
    .select("id, dossier_id")
    .is("triaged_at", null)
    .limit(200);
  if (error) throw error;
  if (!pending || pending.length === 0) return 0;

  let triaged = 0;
  for (const row of pending) {
    const { data: dossier } = await sb
      .from("build_dossiers")
      .select("session_id")
      .eq("id", row.dossier_id)
      .maybeSingle();
    const answers = await loadAnswers(sb, dossier?.session_id ?? null);
    const triage = triageCase(buildCaseProfile(answers));

    const { error: updateError } = await sb
      .from("marketplace_cases")
      .update({
        manual_review_required: triage.manualReviewRequired,
        heritage_flag: triage.heritageFlag,
        declared_value_band: triage.declaredValueBand,
        triaged_at: new Date().toISOString(),
        admin_notes: triage.reasons.length > 0 ? triage.reasons.join("\n") : null,
      })
      .eq("id", row.id)
      .is("triaged_at", null);
    if (updateError) throw updateError;
    triaged += 1;
  }
  return triaged;
}
