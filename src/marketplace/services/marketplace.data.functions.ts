/**
 * Every marketplace read and write a browser can reach.
 *
 * Same shape as `src/build/services/admin.data.functions.ts`, deliberately:
 * TanStack server functions that first prove who the caller is with *their own*
 * RLS-scoped client, and only then use the service-role client. The
 * `marketplace_*` tables deny anon and authenticated outright, exactly like
 * `build_*`, so this file is the only way in — and it decides, per caller, how
 * much of a case is disclosed.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertAdmin, type Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { MAX_BINDERS_PER_CASE } from "@/marketplace/config";
import { canSendToBinders, isCaseStatus, type CaseStatus } from "@/marketplace/cases/state";
import { planBinderSelection } from "@/marketplace/matching/selection";
import { rankBinders, type BinderMatchProfile } from "@/marketplace/matching/score";
import { caseDisclosure, canViewCase, type Viewer } from "@/marketplace/permissions";
import {
  canBinderQuote,
  orderQuotesForComparison,
  validateQuote,
} from "@/marketplace/quotes/rules";
import {
  decideClaim,
  extractAccessToken,
  verifiedEmailFromClaims,
} from "@/marketplace/cases/ownership";
import { triageMessages } from "@/marketplace/cases/triage";
import {
  assignCaseOwner,
  buildCaseView,
  claimCasesByVerifiedEmail,
  loadCaseContext,
  reconcileCaseTriage,
  resolveCaseByAccessToken,
} from "./caseRepository.server";

const BINDER_LIST_COLUMNS =
  "id, user_id, display_name, workshop_name, city, postal_code, bio, years_experience, training, avatar_path, status, capacity_slots, accepted_project_types, min_project_cents, max_project_cents, response_rate, rating_avg, rating_count, is_demo";

const CASE_LIST_COLUMNS =
  "id, dossier_id, reference, status, manual_review_required, heritage_flag, declared_value_band, triage_flags, admin_notes, customer_user_id, created_at";

/** States that mean a workshop currently has something on its bench. */
const BUSY_MATCH_STATES = ["invited", "quoted", "selected"];

const uuid = z.object({ caseId: z.string().uuid() });

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------

/** The relieur profile attached to the signed-in account, if there is one. */
async function findBinderForUser(sb: Supa, userId: string) {
  const { data } = await sb
    .from("marketplace_binders")
    .select(BINDER_LIST_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

async function isAdmin(supabase: Supa, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}

/**
 * Who this request is, from the marketplace's point of view. Resolved server
 * side from the session, never from anything the client sent.
 */
async function resolveViewer(supabase: Supa, sb: Supa, userId: string): Promise<Viewer> {
  if (await isAdmin(supabase, userId)) return { role: "admin" };
  const binder = await findBinderForUser(sb, userId);
  if (binder) return { role: "binder", binderId: binder.id };
  return { role: "customer", userId };
}

/** How many cases each of these workshops is currently holding. */
async function activeLoadByBinder(sb: Supa, binderIds: string[]): Promise<Map<string, number>> {
  const load = new Map<string, number>();
  if (binderIds.length === 0) return load;
  const { data } = await sb
    .from("marketplace_case_matches")
    .select("binder_id")
    .in("binder_id", binderIds)
    .in("state", BUSY_MATCH_STATES);
  for (const row of data ?? []) {
    load.set(row.binder_id, (load.get(row.binder_id) ?? 0) + 1);
  }
  return load;
}

async function skillsByBinder(sb: Supa, binderIds: string[]): Promise<Map<string, string[]>> {
  const skills = new Map<string, string[]>();
  if (binderIds.length === 0) return skills;
  const { data } = await sb
    .from("marketplace_binder_skills")
    .select("binder_id, skill_slug")
    .in("binder_id", binderIds);
  for (const row of data ?? []) {
    skills.set(row.binder_id, [...(skills.get(row.binder_id) ?? []), row.skill_slug]);
  }
  return skills;
}

// ---------------------------------------------------------------------------
// Admin — the back-office
// ---------------------------------------------------------------------------

export const listMarketplaceCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();

    // Triage anything the ingestion trigger created since the last visit. The
    // trigger makes rows; this is what gives them meaning.
    await reconcileCaseTriage(sb);

    const { data: cases, error } = await sb
      .from("marketplace_cases")
      .select(CASE_LIST_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) fail(500, error.message);

    const ids = (cases ?? []).map((c) => c.id);
    const counts = new Map<string, { invited: number; quotes: number }>();
    if (ids.length > 0) {
      const [{ data: matches }, { data: quotes }] = await Promise.all([
        sb.from("marketplace_case_matches").select("case_id").in("case_id", ids),
        sb.from("marketplace_quotes").select("case_id").in("case_id", ids).eq("state", "submitted"),
      ]);
      for (const row of matches ?? []) {
        const entry = counts.get(row.case_id) ?? { invited: 0, quotes: 0 };
        counts.set(row.case_id, { ...entry, invited: entry.invited + 1 });
      }
      for (const row of quotes ?? []) {
        const entry = counts.get(row.case_id) ?? { invited: 0, quotes: 0 };
        counts.set(row.case_id, { ...entry, quotes: entry.quotes + 1 });
      }
    }

    // The book's title lives in the Dossier, not on the case row. Read it here
    // rather than denormalising it: one source of truth for the qualification.
    const dossierIds = (cases ?? []).map((c) => c.dossier_id);
    const titles = new Map<string, string>();
    if (dossierIds.length > 0) {
      const { data: dossiers } = await sb
        .from("build_dossiers")
        .select("id, content")
        .in("id", dossierIds);
      for (const row of dossiers ?? []) {
        const name = (row.content as { missionName?: unknown } | null)?.missionName;
        if (typeof name === "string" && name.trim()) titles.set(row.id, name.trim());
      }
    }

    return (cases ?? []).map((row) => ({
      ...row,
      title: titles.get(row.dossier_id) ?? row.reference,
      invitedCount: counts.get(row.id)?.invited ?? 0,
      quoteCount: counts.get(row.id)?.quotes ?? 0,
    }));
  });

export const getMarketplaceCase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uuid.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();

    const caseContext = await loadCaseContext(sb, data.caseId);
    if (!caseContext) fail(404, "Dossier introuvable");

    const view = await buildCaseView(sb, caseContext, "full");

    const { data: binders } = await sb
      .from("marketplace_binders")
      .select(BINDER_LIST_COLUMNS)
      .eq("status", "approved");
    const binderRows = binders ?? [];
    const ids = binderRows.map((b) => b.id);
    const [skills, load] = await Promise.all([
      skillsByBinder(sb, ids),
      activeLoadByBinder(sb, ids),
    ]);

    const profiles: BinderMatchProfile[] = binderRows.map((b) => ({
      id: b.id,
      status: b.status,
      skills: skills.get(b.id) ?? [],
      acceptedProjectTypes: b.accepted_project_types ?? [],
      minProjectCents: b.min_project_cents,
      maxProjectCents: b.max_project_cents,
      capacitySlots: b.capacity_slots,
      activeLoad: load.get(b.id) ?? 0,
      responseRate: b.response_rate,
      ratingAvg: b.rating_avg,
    }));

    const ranked = rankBinders(caseContext.profile, profiles).map((entry) => {
      const row = binderRows.find((b) => b.id === entry.binder.id)!;
      return {
        id: row.id,
        displayName: row.display_name,
        workshopName: row.workshop_name,
        city: row.city,
        avatarPath: row.avatar_path,
        yearsExperience: row.years_experience,
        ratingAvg: row.rating_avg,
        ratingCount: row.rating_count,
        responseRate: row.response_rate,
        skills: skills.get(row.id) ?? [],
        activeLoad: load.get(row.id) ?? 0,
        capacitySlots: row.capacity_slots,
        score: entry.total,
        breakdown: entry.breakdown,
        missingSkills: entry.missingSkills,
        alreadyInvited: caseContext.invitedBinderIds.includes(row.id),
      };
    });

    const { data: matches } = await sb
      .from("marketplace_case_matches")
      .select("binder_id, state, match_score, invited_at, responded_at, decline_reason")
      .eq("case_id", data.caseId);

    const { data: quotes } = await sb
      .from("marketplace_quotes")
      .select("*")
      .eq("case_id", data.caseId);

    return {
      case: caseContext.row,
      view,
      // Rendered from the stored codes, never from stored prose.
      triageMessages: triageMessages(caseContext.row.triage_flags ?? []),
      requiredSkills: caseContext.profile.requiredSkills,
      candidates: ranked,
      matches: matches ?? [],
      quotes: quotes ?? [],
      remainingInvitations: Math.max(0, MAX_BINDERS_PER_CASE - caseContext.invitedBinderIds.length),
    };
  });

export const clearCaseManualReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uuid.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    // Clearing the hold is the human decision the flag exists to force. It is
    // recorded by moving the case on, never by deleting the reasons.
    const { error } = await sb
      .from("marketplace_cases")
      .update({ manual_review_required: false, status: "matching" })
      .eq("id", data.caseId)
      .eq("status", "under_review");
    if (error) fail(500, error.message);
    return { ok: true };
  });

export const sendCaseToBinders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        binderIds: z.array(z.string().uuid()).min(1).max(MAX_BINDERS_PER_CASE),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();

    const caseContext = await loadCaseContext(sb, data.caseId);
    if (!caseContext) fail(404, "Dossier introuvable");

    const status = caseContext.row.status;
    if (!isCaseStatus(status)) fail(500, `Statut de dossier inconnu : ${status}`);
    if (
      !canSendToBinders({
        status: status as CaseStatus,
        manualReviewRequired: caseContext.row.manual_review_required,
        reviewCleared: false,
      })
    ) {
      fail(
        409,
        caseContext.row.manual_review_required
          ? "Ce dossier est en attente de revue manuelle."
          : "Ce dossier n'est plus au stade de la sélection.",
      );
    }

    const { data: candidates } = await sb
      .from("marketplace_binders")
      .select("id, status")
      .in("id", data.binderIds);

    const decision = planBinderSelection({
      selectedIds: data.binderIds,
      candidates: candidates ?? [],
      alreadyInvitedIds: caseContext.invitedBinderIds,
    });
    if (!decision.allowed) fail(422, decision.problems.join(" "));

    const { error } = await sb.from("marketplace_case_matches").insert(
      decision.binderIds.map((binderId) => ({
        case_id: data.caseId,
        binder_id: binderId,
      })),
    );
    // The database enforces the same ceiling with a trigger. Reaching it here
    // means two admins acted at once; say so rather than showing a raw error.
    if (error) {
      fail(
        409,
        error.message.includes("at most 3")
          ? `Un dossier est envoyé à ${MAX_BINDERS_PER_CASE} relieurs au maximum.`
          : error.message,
      );
    }

    const { error: statusError } = await sb
      .from("marketplace_cases")
      .update({ status: "sent_to_binders" })
      .eq("id", data.caseId);
    if (statusError) fail(500, statusError.message);

    return { invited: decision.binderIds.length };
  });

export const listMarketplaceBinders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data, error } = await sb
      .from("marketplace_binders")
      .select(BINDER_LIST_COLUMNS)
      .order("display_name");
    if (error) fail(500, error.message);
    const skills = await skillsByBinder(
      sb,
      (data ?? []).map((b) => b.id),
    );
    return (data ?? []).map((b) => ({ ...b, skills: skills.get(b.id) ?? [] }));
  });

export const setBinderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        binderId: z.string().uuid(),
        status: z.enum(["draft", "pending_review", "approved", "rejected", "suspended"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb
      .from("marketplace_binders")
      .update({ status: data.status })
      .eq("id", data.binderId);
    if (error) fail(500, error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Relieur — their own dashboard
// ---------------------------------------------------------------------------

export const getMyBinderProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const binder = await findBinderForUser(sb, context.userId);
    if (!binder) return null;
    const skills = await skillsByBinder(sb, [binder.id]);
    const { data: portfolio } = await sb
      .from("marketplace_binder_portfolio")
      .select("*")
      .eq("binder_id", binder.id)
      .order("position");
    return { ...binder, skills: skills.get(binder.id) ?? [], portfolio: portfolio ?? [] };
  });

export const listMyBinderCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const binder = await findBinderForUser(sb, context.userId);
    if (!binder) fail(403, "Aucun profil de relieur n'est associé à ce compte.");

    const { data: matches, error } = await sb
      .from("marketplace_case_matches")
      .select("case_id, state, invited_at")
      .eq("binder_id", binder!.id)
      .order("invited_at", { ascending: false });
    if (error) fail(500, error.message);
    if (!matches || matches.length === 0) return [];

    const caseIds = matches.map((m) => m.case_id);
    const [{ data: cases }, { data: quotes }] = await Promise.all([
      sb.from("marketplace_cases").select("id, reference, status, dossier_id").in("id", caseIds),
      sb
        .from("marketplace_quotes")
        .select("case_id, amount_cents, lead_time_weeks, state")
        .eq("binder_id", binder!.id)
        .in("case_id", caseIds),
    ]);

    // Titles again come from the Dossier the case points at, never from a copy.
    const titles = new Map<string, string>();
    const photoCount = new Map<string, number>();
    const summaries = new Map<string, string>();
    for (const row of cases ?? []) {
      const { data: dossier } = await sb
        .from("build_dossiers")
        .select("content, visitor_summary")
        .eq("id", row.dossier_id)
        .maybeSingle();
      const content = dossier?.content as {
        missionName?: unknown;
        projectSummary?: unknown;
      } | null;
      if (typeof content?.missionName === "string") titles.set(row.id, content.missionName);
      if (typeof content?.projectSummary === "string")
        summaries.set(row.id, content.projectSummary);
      const photos = (dossier?.visitor_summary as { photos?: unknown[] } | null)?.photos;
      photoCount.set(row.id, Array.isArray(photos) ? photos.length : 0);
    }

    return matches.map((match) => {
      const row = (cases ?? []).find((c) => c.id === match.case_id);
      const quote = (quotes ?? []).find((q) => q.case_id === match.case_id) ?? null;
      return {
        caseId: match.case_id,
        state: match.state,
        invitedAt: match.invited_at,
        reference: row?.reference ?? "",
        caseStatus: row?.status ?? "",
        title: titles.get(match.case_id) ?? row?.reference ?? "",
        summary: summaries.get(match.case_id) ?? "",
        photoCount: photoCount.get(match.case_id) ?? 0,
        quote,
      };
    });
  });

export const getBinderCase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uuid.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binder = await findBinderForUser(sb, context.userId);
    if (!binder) fail(403, "Aucun profil de relieur n'est associé à ce compte.");

    const caseContext = await loadCaseContext(sb, data.caseId);
    if (!caseContext) fail(404, "Dossier introuvable");

    const viewer: Viewer = { role: "binder", binderId: binder!.id };
    const facts = {
      invitedBinderIds: caseContext.invitedBinderIds,
      selectedBinderId: caseContext.selectedBinderId,
      customerUserId: caseContext.customerUserId,
    };
    // Answered on the server, from rows, never from anything the client sent.
    if (!canViewCase(viewer, facts)) fail(403, "Ce dossier ne vous a pas été confié.");

    const disclosure = caseDisclosure(viewer, facts);
    const view = await buildCaseView(sb, caseContext, disclosure);

    const { data: match } = await sb
      .from("marketplace_case_matches")
      .select("state")
      .eq("case_id", data.caseId)
      .eq("binder_id", binder!.id)
      .maybeSingle();

    const { data: myQuote } = await sb
      .from("marketplace_quotes")
      .select("*")
      .eq("case_id", data.caseId)
      .eq("binder_id", binder!.id)
      .maybeSingle();

    return {
      view,
      matchState: match?.state ?? null,
      caseStatus: caseContext.row.status,
      myQuote: myQuote ?? null,
      canQuote: canBinderQuote({
        caseStatus: caseContext.row.status,
        matchState: match?.state ?? null,
      }),
    };
  });

export const declineBinderCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ caseId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binder = await findBinderForUser(sb, context.userId);
    if (!binder) fail(403, "Aucun profil de relieur n'est associé à ce compte.");

    const { error } = await sb
      .from("marketplace_case_matches")
      .update({
        state: "declined",
        responded_at: new Date().toISOString(),
        decline_reason: data.reason ?? null,
      })
      .eq("case_id", data.caseId)
      .eq("binder_id", binder!.id)
      .eq("state", "invited");
    if (error) fail(500, error.message);
    return { ok: true };
  });

export const submitBinderQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        description: z.string().min(1).max(4000),
        technique: z.string().max(300).optional().nullable(),
        materials: z.string().max(300).optional().nullable(),
        options: z.string().max(500).optional().nullable(),
        amountCents: z.number().int(),
        leadTimeWeeks: z.number().int(),
        caveats: z.string().max(1000).optional().nullable(),
        validUntil: z.string().max(20).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binder = await findBinderForUser(sb, context.userId);
    if (!binder) fail(403, "Aucun profil de relieur n'est associé à ce compte.");

    const caseContext = await loadCaseContext(sb, data.caseId);
    if (!caseContext) fail(404, "Dossier introuvable");

    const { data: match } = await sb
      .from("marketplace_case_matches")
      .select("state")
      .eq("case_id", data.caseId)
      .eq("binder_id", binder!.id)
      .maybeSingle();

    const permission = canBinderQuote({
      caseStatus: caseContext.row.status,
      matchState: match?.state ?? null,
    });
    if (!permission.allowed) fail(403, permission.reason ?? "Proposition impossible.");

    const problems = validateQuote(data);
    if (problems.length > 0) fail(422, problems.join(" "));

    // One live proposal per relieur per case (unique index): a revised price
    // replaces the previous one rather than giving the customer four offers.
    const { error } = await sb.from("marketplace_quotes").upsert(
      {
        case_id: data.caseId,
        binder_id: binder!.id,
        description: data.description,
        technique: data.technique ?? null,
        materials: data.materials ?? null,
        options: data.options ?? null,
        amount_cents: data.amountCents,
        lead_time_weeks: data.leadTimeWeeks,
        caveats: data.caveats ?? null,
        valid_until: data.validUntil ?? null,
        state: "submitted",
      },
      { onConflict: "case_id,binder_id" },
    );
    if (error) fail(500, error.message);

    await sb
      .from("marketplace_case_matches")
      .update({ state: "quoted", responded_at: new Date().toISOString() })
      .eq("case_id", data.caseId)
      .eq("binder_id", binder!.id);

    await sb
      .from("marketplace_cases")
      .update({ status: "quotes_received" })
      .eq("id", data.caseId)
      .eq("status", "sent_to_binders");

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Customer — their own books
// ---------------------------------------------------------------------------

/**
 * The rapprochement pass. Runs before a customer's own list so an account
 * created after the fact finds the book it submitted anonymously — and only
 * ever on cases nobody owns, with an address the identity provider says it
 * verified. Everything downstream reads customer_user_id and nothing else.
 */
async function attachVerifiedEmailCases(
  sb: Supa,
  userId: string,
  claims: Record<string, unknown>,
): Promise<void> {
  const verifiedEmail = verifiedEmailFromClaims(claims);
  if (!verifiedEmail) return;
  await claimCasesByVerifiedEmail(sb, userId, verifiedEmail);
}

export const listMyCustomerCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    await attachVerifiedEmailCases(sb, context.userId, context.claims);

    // Ownership is the only filter. A case this account has not claimed is
    // not in this list, whatever e-mail the visitor originally typed.
    const { data: cases } = await sb
      .from("marketplace_cases")
      .select("id, reference, status, dossier_id, created_at")
      .eq("customer_user_id", context.userId)
      .order("created_at", { ascending: false });

    const results = [];
    for (const row of cases ?? []) {
      const { data: dossier } = await sb
        .from("build_dossiers")
        .select("content")
        .eq("id", row.dossier_id)
        .maybeSingle();
      const content = dossier?.content as { missionName?: unknown } | null;
      const { count } = await sb
        .from("marketplace_quotes")
        .select("id", { count: "exact", head: true })
        .eq("case_id", row.id)
        .eq("state", "submitted");
      results.push({
        id: row.id,
        reference: row.reference,
        status: row.status,
        createdAt: row.created_at,
        title: typeof content?.missionName === "string" ? content.missionName : row.reference,
        quoteCount: count ?? 0,
      });
    }
    return results;
  });

export const getMyCustomerCase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uuid.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const caseContext = await loadCaseContext(sb, data.caseId);
    if (!caseContext) fail(404, "Dossier introuvable");

    const viewer: Viewer = { role: "customer", userId: context.userId };
    const facts = {
      invitedBinderIds: caseContext.invitedBinderIds,
      selectedBinderId: caseContext.selectedBinderId,
      customerUserId: caseContext.customerUserId,
    };
    if (!canViewCase(viewer, facts)) fail(403, "Ce dossier n'est pas le vôtre.");

    const view = await buildCaseView(sb, caseContext, caseDisclosure(viewer, facts));

    const { data: quotes } = await sb
      .from("marketplace_quotes")
      .select("*")
      .eq("case_id", data.caseId)
      .in("state", ["submitted", "selected"]);

    const binderIds = (quotes ?? []).map((q) => q.binder_id);
    const { data: binders } = binderIds.length
      ? await sb
          .from("marketplace_binders")
          .select(
            "id, display_name, workshop_name, city, bio, avatar_path, years_experience, rating_avg, rating_count",
          )
          .in("id", binderIds)
      : { data: [] };
    const skills = await skillsByBinder(sb, binderIds);

    // Ordered by the shared rule (chronological, never by price) and then
    // rehydrated, so the customer-facing order can never drift from the one the
    // rule test pins down.
    const byId = new Map((quotes ?? []).map((q) => [q.id, q]));
    const offers = orderQuotesForComparison(
      (quotes ?? []).map((q) => ({
        id: q.id,
        amountCents: q.amount_cents,
        leadTimeWeeks: q.lead_time_weeks,
        submittedAt: q.created_at,
      })),
    ).map((ordered) => {
      const quote = byId.get(ordered.id)!;
      const binder = (binders ?? []).find((row) => row.id === quote.binder_id);
      return {
        ...quote,
        binder: binder ? { ...binder, skills: skills.get(binder.id) ?? [] } : null,
      };
    });

    return { case: caseContext.row, view, offers };
  });

export const selectQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ caseId: z.string().uuid(), quoteId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const caseContext = await loadCaseContext(sb, data.caseId);
    if (!caseContext) fail(404, "Dossier introuvable");

    const viewer: Viewer = { role: "customer", userId: context.userId };
    if (
      !canViewCase(viewer, {
        invitedBinderIds: caseContext.invitedBinderIds,
        selectedBinderId: caseContext.selectedBinderId,
        customerUserId: caseContext.customerUserId,
      })
    ) {
      fail(403, "Ce dossier n'est pas le vôtre.");
    }
    if (caseContext.selectedBinderId) fail(409, "Un relieur a déjà été choisi pour ce dossier.");

    const { data: quote } = await sb
      .from("marketplace_quotes")
      .select("id, binder_id, case_id, state")
      .eq("id", data.quoteId)
      .eq("case_id", data.caseId)
      .maybeSingle();
    if (!quote) fail(404, "Proposition introuvable");
    if (quote!.state !== "submitted") fail(409, "Cette proposition n'est plus disponible.");

    await sb.from("marketplace_quotes").update({ state: "selected" }).eq("id", data.quoteId);
    await sb
      .from("marketplace_quotes")
      .update({ state: "rejected" })
      .eq("case_id", data.caseId)
      .neq("id", data.quoteId)
      .eq("state", "submitted");
    await sb
      .from("marketplace_case_matches")
      .update({ state: "selected" })
      .eq("case_id", data.caseId)
      .eq("binder_id", quote!.binder_id);
    await sb.from("marketplace_cases").update({ status: "binder_selected" }).eq("id", data.caseId);

    return { ok: true, binderId: quote!.binder_id };
  });

/**
 * Attach an anonymously submitted project to the signed-in account, using the
 * secure summary link Métré already sent the visitor.
 *
 * No new token system: the proof is `build_dossier_access_tokens` — 256-bit,
 * hashed, expiring, revocable — resolved in caseRepository.server.ts.
 *
 * Idempotent: claiming a project this account already owns succeeds and
 * changes nothing. A project owned by someone else is refused, and ownership
 * is never transferred by this path — moving a case between accounts is a
 * support action, not a self-service one.
 */
export const claimMarketplaceCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    // Accepts the whole link people paste out of their e-mail, not just the
    // bare token. Bounded so pasting an entire message is rejected cheaply.
    z.object({ link: z.string().min(1).max(2000) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const token = extractAccessToken(data.link);
    if (!token) fail(422, "Ce lien ne semble pas être un lien de suivi de projet.");

    const sb = await admin();
    const found = await resolveCaseByAccessToken(sb, token!);
    // Unknown, revoked, expired, or no case behind it — one answer for all of
    // them, so this can never be used to probe which tokens exist.
    if (!found) fail(404, "Ce lien de suivi n'est plus valable.");

    const decision = decideClaim({
      currentOwnerId: found!.currentOwnerId,
      requesterId: context.userId,
    });
    if (!decision.allowed) fail(409, decision.reason ?? "Ce projet ne peut pas être rattaché.");
    if (decision.alreadyOwned) return { caseId: found!.caseId, alreadyOwned: true };

    // The conditional write is what actually settles a race between two
    // accounts claiming the same project at the same moment.
    const won = await assignCaseOwner(sb, found!.caseId, context.userId, "access_token");
    if (!won) fail(409, "Ce projet est déjà rattaché à un autre compte.");

    return { caseId: found!.caseId, alreadyOwned: false };
  });
