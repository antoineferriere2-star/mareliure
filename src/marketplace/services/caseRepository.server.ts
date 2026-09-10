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
import type { PricingComponent } from "@/marketplace/pricing/pricing.types";
import type { PricingSnapshot } from "@/marketplace/pricing/snapshot";
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
  triage_flags: string[];
  triaged_at: string | null;
  admin_notes: string | null;
  customer_user_id: string | null;
  claimed_at: string | null;
  claim_method: string | null;
  pricing_status: string;
  suggested_customer_price_cents: number | null;
  suggested_binder_payout_cents: number | null;
  customer_price_cents: number | null;
  binder_payout_cents: number | null;
  pricing_currency: string;
  pricing_confidence: string | null;
  pricing_reason_codes: string[];
  pricing_components: PricingComponent[] | null;
  pricing_low_estimate_cents: number | null;
  pricing_high_estimate_cents: number | null;
  pricing_reference_count: number | null;
  pricing_rule_version: string | null;
  price_includes: string[];
  pricing_generated_at: string | null;
  pricing_validated_at: string | null;
  pricing_validated_by: string | null;
  customer_price_ttc_cents: number | null;
  pricing_vat_rate_bps: number | null;
  /** La photographie figée à la validation. `null` tant que le prix n'est pas validé. */
  pricing_snapshot: PricingSnapshot | null;
  created_at: string;
}

export interface OwnedDossier {
  dossierId: string;
  caseId: string;
  currentOwnerId: string | null;
}

export interface CaseContext {
  row: CaseRow;
  brief: ProjectBrief;
  profile: CaseProfile;
  answers: Answers;
  /** Canonical ownership — the only thing that authorises a customer. */
  customerUserId: string | null;
  /**
   * From the Dossier, for display to the admin and to the chosen relieur only.
   * Never an authorisation input: see permissions.ts.
   */
  customerEmail: string | null;
  customerName: string | null;
  invitedBinderIds: string[];
  selectedBinderId: string | null;
  /** L'état de chaque sollicitation, pour décider ce qu'un atelier peut encore ouvrir. */
  matchStates: { binderId: string; state: string }[];
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
      "id, dossier_id, reference, status, manual_review_required, heritage_flag, declared_value_band, triage_flags, triaged_at, admin_notes, customer_user_id, claimed_at, claim_method, pricing_status, suggested_customer_price_cents, suggested_binder_payout_cents, customer_price_cents, binder_payout_cents, pricing_currency, pricing_confidence, pricing_reason_codes, pricing_components, pricing_low_estimate_cents, pricing_high_estimate_cents, pricing_reference_count, pricing_rule_version, price_includes, pricing_generated_at, pricing_validated_at, pricing_validated_by, customer_price_ttc_cents, pricing_vat_rate_bps, pricing_snapshot, created_at",
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
    customerUserId: row.customer_user_id,
    customerEmail: dossier.visitor_email,
    customerName: dossier.visitor_name,
    invitedBinderIds: (matches ?? []).map((m) => m.binder_id),
    selectedBinderId: (matches ?? []).find((m) => m.state === "selected")?.binder_id ?? null,
    matchStates: (matches ?? []).map((m) => ({ binderId: m.binder_id, state: m.state })),
  };
}

/**
 * Resolve Métré's own summary access token to the case behind it.
 *
 * This is the possession proof the claim rests on, and it deliberately reuses
 * `build_dossier_access_tokens` — the 256-bit, hashed, expiring, revocable
 * token Métré already mints for every submission — rather than introducing a
 * second token system the marketplace would have to secure, rotate and revoke
 * on its own.
 *
 * Returns null for every failure alike: unknown, revoked, expired, or pointing
 * at a Dossier with no case. A caller must never be able to tell which,
 * because that distinction would turn this into an oracle for guessing tokens.
 */
export async function resolveCaseByAccessToken(
  sb: Supa,
  rawToken: string,
): Promise<OwnedDossier | null> {
  const { hashAccessToken } = await import("@/build/services/dossierAccessToken.server");

  const { data: token } = await sb
    .from("build_dossier_access_tokens")
    .select("dossier_id, expires_at, revoked_at")
    .eq("token_hash", hashAccessToken(rawToken))
    .maybeSingle();
  if (!token || token.revoked_at) return null;
  if (token.expires_at && new Date(token.expires_at).getTime() <= Date.now()) return null;

  const { data: row } = await sb
    .from("marketplace_cases")
    .select("id, dossier_id, customer_user_id")
    .eq("dossier_id", token.dossier_id)
    .maybeSingle();
  if (!row) return null;

  return { dossierId: row.dossier_id, caseId: row.id, currentOwnerId: row.customer_user_id };
}

/**
 * Write the claim, conditionally.
 *
 * The `is("customer_user_id", null)` filter is the whole safety property: two
 * accounts racing to claim the same case cannot both win, whatever the
 * decision function concluded a moment earlier. A zero-row result means
 * somebody else got there first, and the caller reports the refusal.
 */
export async function assignCaseOwner(
  sb: Supa,
  caseId: string,
  userId: string,
  method: "access_token" | "verified_email",
): Promise<boolean> {
  const { data } = await sb
    .from("marketplace_cases")
    .update({
      customer_user_id: userId,
      claimed_at: new Date().toISOString(),
      claim_method: method,
    })
    .eq("id", caseId)
    .is("customer_user_id", null)
    .select("id");
  return (data ?? []).length > 0;
}

/**
 * Attach every unclaimed case whose Dossier carries this verified address.
 *
 * The one place e-mail still does anything. It runs when a customer opens
 * their own list, so the account they just created finds the book they
 * submitted before it existed. Only ever touches rows nobody owns, and only
 * with an address the identity provider says it verified — see
 * `verifiedEmailFromClaims`.
 */
export async function claimCasesByVerifiedEmail(
  sb: Supa,
  userId: string,
  verifiedEmail: string,
): Promise<number> {
  const { data: dossiers } = await sb
    .from("build_dossiers")
    .select("id")
    .ilike("visitor_email", verifiedEmail);
  const dossierIds = (dossiers ?? []).map((d) => d.id);
  if (dossierIds.length === 0) return 0;

  const { data: claimed } = await sb
    .from("marketplace_cases")
    .update({
      customer_user_id: userId,
      claimed_at: new Date().toISOString(),
      claim_method: "verified_email",
    })
    .in("dossier_id", dossierIds)
    .is("customer_user_id", null)
    .select("id");
  return (claimed ?? []).length;
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
  // Repair first, triage second. The ingestion trigger swallows its own
  // failures so it can never roll back a visitor's submission, which means a
  // Dossier can exist with no case — and so can every Dossier submitted before
  // its Mission was enrolled. This makes both whole before anything is
  // classified. The reference sequence lives in Postgres, so the backfill does
  // too rather than allocating references from two places.
  const { error: repairError } = await sb.rpc("marketplace_ingest_missing_cases");
  if (repairError) throw repairError;

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
        // Stable codes, never sentences. `admin_notes` stays what a human
        // wrote: an earlier version stuffed generated French in there and the
        // back-office split it back apart on newlines — prose used as an API.
        triage_flags: triage.flags,
        triaged_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .is("triaged_at", null);
    if (updateError) throw updateError;
    triaged += 1;
  }
  return triaged;
}
