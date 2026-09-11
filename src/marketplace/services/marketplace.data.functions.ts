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
import type { Json } from "@/integrations/supabase/types";
import { admin, assertAdmin, type Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { MARKETPLACE_CURRENCY, MAX_BINDERS_PER_CASE } from "@/marketplace/config";
import { canSendToBinders, isCaseStatus, type CaseStatus } from "@/marketplace/cases/state";
import { canSendCaseToBinders, planBinderSelection } from "@/marketplace/matching/selection";
import { rankBinders, type BinderMatchProfile } from "@/marketplace/matching/score";
import { caseDisclosure, canViewCase, type Viewer } from "@/marketplace/permissions";
import {
  decideClaim,
  extractAccessToken,
  verifiedEmailFromClaims,
} from "@/marketplace/cases/ownership";
import { triageMessages } from "@/marketplace/cases/triage";
import { disclosedSummary } from "@/marketplace/cases/dossierProjection";
import type { ProjectBrief } from "@/build/schema/brief";
import { suggestManagedPrice, validateManagedPrice } from "@/marketplace/pricing/pricing.engine";
import { PRICING_POLICY } from "@/marketplace/pricing/pricing.rules";
import {
  assignCaseOwner,
  buildCaseView,
  claimCasesByVerifiedEmail,
  loadCaseContext,
  reconcileCaseTriage,
  resolveCaseByAccessToken,
} from "./caseRepository.server";
import { loadAggregates } from "./pricingRepository.server";
import {
  acceptBinderInvitation as acceptBinderInvitationForUser,
  createBinderInvitation,
  findActiveBinderMembership,
} from "./binderMembership.server";
import { isValidReferralSlug } from "@/marketplace/binders/referral";

const BINDER_LIST_COLUMNS =
  "id, user_id, display_name, workshop_name, city, postal_code, bio, years_experience, training, avatar_path, status, capacity_slots, accepted_project_types, min_project_cents, max_project_cents, response_rate, rating_avg, rating_count, is_demo";

const CASE_LIST_COLUMNS =
  "id, dossier_id, reference, status, manual_review_required, heritage_flag, declared_value_band, triage_flags, admin_notes, customer_user_id, pricing_status, customer_price_cents, binder_payout_cents, created_at";

/** States that mean a workshop currently has something on its bench. */
const BUSY_MATCH_STATES = ["offered", "accepted", "selected", "invited", "quoted"];

export const OFFER_DECLINE_REASONS = [
  "payout_insufficient",
  "deadline_impossible",
  "outside_specialty",
  "no_capacity",
  "other",
] as const;

const uuid = z.object({ caseId: z.string().uuid() });

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------

/**
 * The relieur profile the signed-in account currently runs, if any.
 *
 * Resolved through marketplace_binder_members (Phase A, 11 septembre 2026),
 * never through the legacy marketplace_binders.user_id — this is the single
 * point every one of this file's binder-facing server functions already went
 * through, so making membership the source of truth changed nothing else.
 * An account backfilled as OWNER at migration time resolves to exactly the
 * workshop it ran before.
 */
async function findBinderForUser(sb: Supa, userId: string) {
  const membership = await findActiveBinderMembership(sb, userId);
  if (!membership) return null;
  const { data } = await sb
    .from("marketplace_binders")
    .select(BINDER_LIST_COLUMNS)
    .eq("id", membership.binderId)
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
    const counts = new Map<string, { offered: number; accepted: number }>();
    if (ids.length > 0) {
      const { data: matches } = await sb
        .from("marketplace_case_matches")
        .select("case_id, state")
        .in("case_id", ids);
      for (const row of matches ?? []) {
        const entry = counts.get(row.case_id) ?? { offered: 0, accepted: 0 };
        counts.set(row.case_id, {
          offered: entry.offered + 1,
          accepted: entry.accepted + (row.state === "accepted" ? 1 : 0),
        });
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
      invitedCount: counts.get(row.id)?.offered ?? 0,
      acceptedCount: counts.get(row.id)?.accepted ?? 0,
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

    const ranked = rankBinders(
      caseContext.profile,
      profiles,
      caseContext.row.binder_payout_cents,
    ).map((entry) => {
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
      .select(
        "binder_id, state, match_score, binder_payout_cents, currency, offered_at, expires_at, accepted_at, declined_at, selected_at, responded_at, decline_reason_code, decline_reason_detail",
      )
      .eq("case_id", data.caseId);

    const { data: offers } = await sb
      .from("marketplace_quotes")
      .select("*")
      .eq("case_id", data.caseId);
    const managedMatches = (matches ?? []).map((match) => {
      const offer = (offers ?? []).find((candidate) => candidate.binder_id === match.binder_id);
      return offer
        ? {
            ...match,
            state: offer.state,
            binder_payout_cents: offer.binder_payout_cents,
            currency: offer.currency,
            offered_at: offer.offered_at,
            expires_at: offer.expires_at,
            accepted_at: offer.accepted_at,
            declined_at: offer.declined_at,
            selected_at: offer.selected_at,
            decline_reason_code: offer.decline_reason_code,
            decline_reason_detail: offer.decline_reason_detail,
          }
        : match;
    });

    return {
      case: caseContext.row,
      view,
      // Rendered from the stored codes, never from stored prose.
      triageMessages: triageMessages(caseContext.row.triage_flags ?? []),
      requiredSkills: caseContext.profile.requiredSkills,
      candidates: ranked,
      matches: managedMatches,
      offers: offers ?? [],
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
      .update({ manual_review_required: false, status: "pricing" })
      .eq("id", data.caseId)
      .eq("status", "under_review");
    if (error) fail(500, error.message);
    return { ok: true };
  });

export const generateMarketplacePricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uuid.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const caseContext = await loadCaseContext(sb, data.caseId);
    if (!caseContext) fail(404, "Dossier introuvable");

    // Le moteur ne chiffre qu'à partir des grilles réellement saisies par des
    // relieurs. Sans référentiel, il n'invente rien : il rend `manual_review`,
    // et c'est cet état-là qu'on enregistre.
    const suggestion = suggestManagedPrice(caseContext.profile, {
      aggregates: await loadAggregates(sb),
    });
    const abstained = suggestion.status === "manual_review";
    const now = new Date().toISOString();
    const { error } = await sb
      .from("marketplace_cases")
      .update({
        pricing_status: abstained ? "manual_review" : "suggested",
        suggested_customer_price_cents: suggestion.suggestedCustomerPriceCents,
        suggested_binder_payout_cents: suggestion.suggestedBinderPayoutCents,
        // On ne pré-remplit le prix retenu que lorsqu'il y a une suggestion.
        // Écrire un null effacerait une saisie manuelle en cours.
        ...(abstained
          ? {}
          : {
              customer_price_cents: suggestion.suggestedCustomerPriceCents,
              binder_payout_cents: suggestion.suggestedBinderPayoutCents,
            }),
        pricing_low_estimate_cents: suggestion.lowEstimateCents,
        pricing_high_estimate_cents: suggestion.highEstimateCents,
        pricing_confidence: suggestion.confidence,
        pricing_reason_codes: suggestion.workItemKeys,
        pricing_components: suggestion.components as unknown as Json,
        pricing_reference_count: suggestion.referenceCount,
        pricing_rule_version: suggestion.ruleVersion,
        pricing_generated_at: now,
        status: caseContext.row.status === "under_review" ? "under_review" : "pricing",
      })
      .eq("id", data.caseId);
    if (error) fail(500, error.message);
    await sb.from("marketplace_events").insert({
      case_id: data.caseId,
      actor_user_id: context.userId,
      event_type: abstained ? "pricing_manual_review" : "pricing_generated",
      metadata: {
        customer_price_cents: suggestion.suggestedCustomerPriceCents,
        binder_payout_cents: suggestion.suggestedBinderPayoutCents,
        reference_count: suggestion.referenceCount,
        work_items: suggestion.workItemKeys,
        factors: suggestion.factors,
        rule_version: suggestion.ruleVersion,
      },
    });
    return suggestion;
  });

const managedPriceInput = z.object({
  caseId: z.string().uuid(),
  customerPriceCents: z.number().int().positive(),
  binderPayoutCents: z.number().int().positive(),
  priceIncludes: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
});

export const saveMarketplacePricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => managedPriceInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const validation = validateManagedPrice(data.customerPriceCents, data.binderPayoutCents);
    if (!validation.valid) fail(422, validation.errors.join(" "));
    const sb = await admin();
    const { error } = await sb
      .from("marketplace_cases")
      .update({
        customer_price_cents: data.customerPriceCents,
        binder_payout_cents: data.binderPayoutCents,
        price_includes: data.priceIncludes,
      })
      .eq("id", data.caseId)
      .neq("pricing_status", "validated");
    if (error) fail(500, error.message);
    await sb.from("marketplace_events").insert({
      case_id: data.caseId,
      actor_user_id: context.userId,
      event_type: "pricing_edited",
      metadata: {
        customer_price_cents: data.customerPriceCents,
        binder_payout_cents: data.binderPayoutCents,
      },
    });
    return validation;
  });

export const validateMarketplacePricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => managedPriceInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const validation = validateManagedPrice(data.customerPriceCents, data.binderPayoutCents);
    if (!validation.valid) fail(422, validation.errors.join(" "));
    const sb = await admin();
    const { data: result, error } = await sb.rpc("marketplace_validate_pricing", {
      p_case_id: data.caseId,
      p_customer_price_cents: data.customerPriceCents,
      p_binder_payout_cents: data.binderPayoutCents,
      p_price_includes: data.priceIncludes,
      p_minimum_margin_bps: PRICING_POLICY.minimumMarginBps,
      p_minimum_margin_cents: PRICING_POLICY.minimumMarginCents,
      p_actor_user_id: context.userId,
    });
    if (error) fail(409, error.message);
    return { case: result, validation };
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
        pricingValidated: caseContext.row.pricing_status === "validated",
      })
    ) {
      fail(
        409,
        caseContext.row.manual_review_required
          ? "Ce dossier est en attente de revue manuelle."
          : caseContext.row.pricing_status !== "validated"
            ? "Le prix doit être validé avant de solliciter un atelier."
            : "Ce dossier n'est plus au stade de la sélection.",
      );
    }
    if (!caseContext.row.binder_payout_cents)
      fail(409, "La rémunération atelier validée est absente.");

    // A client apporté par un atelier (§54) lui reste affecté et ne passe
    // jamais dans le matching général — canSendCaseToBinders (matching/
    // selection.ts) est la garantie testée, pas seulement une note d'audit.
    const referralCheck = canSendCaseToBinders({
      acquisitionOrigin: caseContext.row.acquisition_origin,
      referredBinderId: caseContext.row.referred_binder_id,
      requestedBinderIds: data.binderIds,
    });
    if (!referralCheck.allowed) fail(422, referralCheck.reason!);

    const { data: candidates } = await sb
      .from("marketplace_binders")
      .select(BINDER_LIST_COLUMNS)
      .in("id", data.binderIds);

    const decision = planBinderSelection({
      selectedIds: data.binderIds,
      candidates: candidates ?? [],
      alreadyInvitedIds: caseContext.invitedBinderIds,
    });
    if (!decision.allowed) fail(422, decision.problems.join(" "));

    const [skills, load] = await Promise.all([
      skillsByBinder(sb, decision.binderIds),
      activeLoadByBinder(sb, decision.binderIds),
    ]);
    const scoreByBinder = new Map(
      rankBinders(
        caseContext.profile,
        (candidates ?? []).map((binder) => ({
          id: binder.id,
          status: binder.status,
          skills: skills.get(binder.id) ?? [],
          acceptedProjectTypes: binder.accepted_project_types ?? [],
          minProjectCents: binder.min_project_cents,
          maxProjectCents: binder.max_project_cents,
          capacitySlots: binder.capacity_slots,
          activeLoad: load.get(binder.id) ?? 0,
          responseRate: binder.response_rate,
          ratingAvg: binder.rating_avg,
        })),
        caseContext.row.binder_payout_cents,
      ).map((entry) => [entry.binder.id, entry.total]),
    );
    const offeredAt = new Date().toISOString();
    const { error } = await sb.from("marketplace_case_matches").insert(
      decision.binderIds.map((binderId) => ({
        case_id: data.caseId,
        binder_id: binderId,
        state: "offered",
        binder_payout_cents: caseContext.row.binder_payout_cents,
        currency: MARKETPLACE_CURRENCY,
        offered_at: offeredAt,
        match_score: scoreByBinder.get(binderId) ?? null,
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

    const { error: offerError } = await sb.from("marketplace_quotes").insert(
      decision.binderIds.map((binderId) => ({
        case_id: data.caseId,
        binder_id: binderId,
        description: "Offre Ma Reliure",
        amount_cents: caseContext.row.customer_price_cents!,
        currency: MARKETPLACE_CURRENCY,
        lead_time_weeks: null,
        state: "offered",
        customer_price_cents: caseContext.row.customer_price_cents,
        binder_payout_cents: caseContext.row.binder_payout_cents,
        offered_at: offeredAt,
      })),
    );
    if (offerError) {
      await sb
        .from("marketplace_case_matches")
        .delete()
        .eq("case_id", data.caseId)
        .eq("offered_at", offeredAt);
      fail(500, offerError.message);
    }

    const { error: statusError } = await sb
      .from("marketplace_cases")
      .update({ status: "awaiting_binder_response" })
      .eq("id", data.caseId);
    if (statusError) fail(500, statusError.message);

    await sb.from("marketplace_events").insert(
      decision.binderIds.map((binderId) => ({
        case_id: data.caseId,
        binder_id: binderId,
        actor_user_id: context.userId,
        event_type: "offer_sent",
        metadata: { binder_payout_cents: caseContext.row.binder_payout_cents },
      })),
    );

    return { offered: decision.binderIds.length };
  });

export const selectBinderOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ caseId: z.string().uuid(), binderId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: result, error } = await sb.rpc("marketplace_select_binder_offer", {
      p_case_id: data.caseId,
      p_binder_id: data.binderId,
      p_actor_user_id: context.userId,
    });
    if (error) fail(409, error.message);
    return result;
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

/**
 * Set or change an atelier's public referral slug (§52, `/a/:slug`).
 *
 * Admin-controlled by design (§52 of the 11 September brief: "Les termes sont
 * définis par Ma Reliure"): the workshop does not pick its own address in the
 * marketplace's URL space.
 */
export const setBinderReferralSlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ binderId: z.string().uuid(), slug: z.string().min(3).max(64) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (!isValidReferralSlug(data.slug)) {
      fail(422, "Le lien ne peut contenir que des minuscules, des chiffres et des tirets.");
    }
    const sb = await admin();
    const { error } = await sb
      .from("marketplace_binders")
      .update({ personal_referral_slug: data.slug })
      .eq("id", data.binderId);
    if (error) {
      fail(
        error.code === "23505" ? 409 : 500,
        error.code === "23505" ? "Ce lien est déjà pris par un autre atelier." : error.message,
      );
    }
    return { ok: true, slug: data.slug };
  });

/**
 * Invite someone to join an atelier (§7).
 *
 * Admin-only: a relieur cannot self-declare "atelier partenaire actif", and
 * cannot invite themselves colleagues without Ma Reliure knowing — the
 * invitation itself is the audited act (`binder_member_invited`).
 */
export const inviteBinderMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ binderId: z.string().uuid(), email: z.string().trim().email() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: binder } = await sb
      .from("marketplace_binders")
      .select("id, display_name, workshop_name")
      .eq("id", data.binderId)
      .maybeSingle();
    if (!binder) fail(404, "Atelier introuvable.");

    const invitation = await createBinderInvitation(sb, {
      binderId: data.binderId,
      email: data.email,
      invitedBy: context.userId,
    });

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    try {
      await sendTemplateEmail("binder-invitation", data.email, {
        templateData: {
          workshopName: binder!.workshop_name ?? binder!.display_name,
          invitationToken: invitation.token,
        },
      });
    } catch (err) {
      // The invitation exists and is valid even if the e-mail failed to
      // leave — the same discipline as sendVisitorSummaryEmail: a
      // notification failure must never undo the write it describes.
      const { logOperationalError } = await import("@/build/services/operationalLog.server");
      logOperationalError("binder-invitation.email-failed", err, { binderId: data.binderId });
    }

    return { ok: true, expiresAt: invitation.expiresAt };
  });

/**
 * Accept a binder invitation and become a member of the atelier it names.
 *
 * The caller must already be signed in — this app has no unauthenticated
 * write path, so the accept screen signs the person up or in first (Supabase
 * Auth, password-based like every other relieur account) and only then calls
 * this.
 */
export const acceptBinderInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ token: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    // The declared address on the signed-in account, not necessarily
    // provider-verified: unlike claimMarketplaceCase's e-mail rapprochement
    // (which grants access on its own and so demands real verification), this
    // is a sanity check on top of a token that already proves the invitation
    // itself — it exists to catch the wrong account, not to authorise one.
    const accountEmail = typeof context.claims.email === "string" ? context.claims.email : null;
    const result = await acceptBinderInvitationForUser(sb, {
      rawToken: data.token,
      userId: context.userId,
      accountEmail,
    });
    if (!result.ok) fail(409, result.reason);
    return { binderId: result.binderId };
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
      .select("case_id, state, offered_at, invited_at, binder_payout_cents, currency")
      .eq("binder_id", binder!.id)
      .order("invited_at", { ascending: false });
    if (error) fail(500, error.message);
    if (!matches || matches.length === 0) return [];

    const caseIds = matches.map((m) => m.case_id);
    const { data: cases } = await sb
      .from("marketplace_cases")
      .select("id, reference, status, dossier_id")
      .in("id", caseIds);

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
      // Par la même règle que la fiche, et non par une lecture directe du
      // Dossier. La liste affichait le résumé brut, budget du client compris,
      // alors que la fiche le retirait : deux surfaces, une seule filtrée.
      if (typeof content?.projectSummary === "string")
        summaries.set(
          row.id,
          disclosedSummary(dossier!.content as unknown as ProjectBrief, "project_only"),
        );
      const photos = (dossier?.visitor_summary as { photos?: unknown[] } | null)?.photos;
      photoCount.set(row.id, Array.isArray(photos) ? photos.length : 0);
    }

    const { data: offers } = await sb
      .from("marketplace_quotes")
      .select(
        "case_id, binder_id, state, customer_price_cents, binder_payout_cents, currency, offered_at, expires_at, accepted_at, declined_at, selected_at, decline_reason_code, decline_reason_detail",
      )
      .in("case_id", caseIds)
      .eq("binder_id", binder!.id);

    return matches.map((match) => {
      const row = (cases ?? []).find((c) => c.id === match.case_id);
      const offer = (offers ?? []).find((candidate) => candidate.case_id === match.case_id);
      return {
        caseId: match.case_id,
        state: offer?.state ?? match.state,
        offeredAt: offer?.offered_at ?? match.offered_at ?? match.invited_at,
        binderPayoutCents: offer?.binder_payout_cents ?? match.binder_payout_cents,
        currency: offer?.currency ?? match.currency,
        reference: row?.reference ?? "",
        caseStatus: row?.status ?? "",
        title: titles.get(match.case_id) ?? row?.reference ?? "",
        summary: summaries.get(match.case_id) ?? "",
        photoCount: photoCount.get(match.case_id) ?? 0,
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

    const { data: offer } = await sb
      .from("marketplace_quotes")
      .select(
        "state, customer_price_cents, binder_payout_cents, currency, offered_at, expires_at, accepted_at, declined_at, selected_at, decline_reason_code, decline_reason_detail",
      )
      .eq("case_id", data.caseId)
      .eq("binder_id", binder!.id)
      .maybeSingle();

    return {
      view,
      offer: offer ?? null,
      caseStatus: caseContext.row.status,
      canRespond: offer?.state === "offered",
    };
  });

export const respondToBinderOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        accept: z.boolean(),
        reasonCode: z.enum(OFFER_DECLINE_REASONS).optional().nullable(),
        reasonDetail: z.string().trim().max(500).optional().nullable(),
        /**
         * « J'aurais accepté à tant. » La donnée la plus honnête du système :
         * révélée par une décision réelle plutôt que déclarée dans un
         * entretien. Elle n'a de sens qu'après un refus pour rémunération.
         */
        minimumRequiredPayoutCents: z.number().int().positive().optional().nullable(),
      })
      .superRefine((value, ctx) => {
        if (!value.accept && !value.reasonCode)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Un motif de refus est requis." });
        if (!value.accept && value.reasonCode === "other" && !value.reasonDetail)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Précisez le motif du refus." });
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binder = await findBinderForUser(sb, context.userId);
    if (!binder) fail(403, "Aucun profil de relieur n'est associé à ce compte.");
    const { data: result, error } = await sb.rpc("marketplace_respond_to_offer", {
      p_case_id: data.caseId,
      p_binder_id: binder!.id,
      p_accept: data.accept,
      p_reason_code: data.reasonCode ?? null,
      p_reason_detail: data.reasonDetail ?? null,
      p_actor_user_id: context.userId,
    });
    if (error) fail(409, error.message);

    // Enregistré à côté de la réponse, jamais dans la procédure : ce montant
    // n'a aucun effet sur l'issue de l'offre. Il alimente l'analyse tarifaire
    // et rien d'autre — le Pricebook ne bouge que par décision humaine.
    const wantsMore =
      !data.accept &&
      data.reasonCode === "payout_insufficient" &&
      typeof data.minimumRequiredPayoutCents === "number";
    if (wantsMore) {
      await sb
        .from("marketplace_case_matches")
        .update({ minimum_required_payout_cents: data.minimumRequiredPayoutCents })
        .eq("case_id", data.caseId)
        .eq("binder_id", binder!.id);
      await sb.from("marketplace_events").insert({
        case_id: data.caseId,
        binder_id: binder!.id,
        actor_user_id: context.userId,
        event_type: "payout_floor_declared",
        metadata: { minimum_required_payout_cents: data.minimumRequiredPayoutCents },
      });
    }
    return result;
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
      .select(
        "id, reference, status, dossier_id, created_at, customer_price_cents, pricing_currency",
      )
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
      results.push({
        id: row.id,
        reference: row.reference,
        status: row.status,
        createdAt: row.created_at,
        title: typeof content?.missionName === "string" ? content.missionName : row.reference,
        customerPriceCents: row.customer_price_cents,
        currency: row.pricing_currency,
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

    const { data: selected } = await sb
      .from("marketplace_case_matches")
      .select("binder_id, selected_at")
      .eq("case_id", data.caseId)
      .eq("state", "selected")
      .maybeSingle();
    const { data: binder } = selected
      ? await sb
          .from("marketplace_binders")
          .select(
            "id, display_name, workshop_name, city, bio, avatar_path, years_experience, rating_avg, rating_count",
          )
          .eq("id", selected.binder_id)
          .maybeSingle()
      : { data: null };
    const skills = binder ? await skillsByBinder(sb, [binder.id]) : new Map<string, string[]>();

    return {
      case: {
        id: caseContext.row.id,
        reference: caseContext.row.reference,
        status: caseContext.row.status,
        customerPriceCents:
          caseContext.row.pricing_status === "validated"
            ? caseContext.row.customer_price_cents
            : null,
        currency: caseContext.row.pricing_currency,
        priceIncludes: caseContext.row.price_includes,
        createdAt: caseContext.row.created_at,
      },
      view,
      selectedBinder: binder
        ? {
            ...binder,
            skills: skills.get(binder.id) ?? [],
            selectedAt: selected?.selected_at ?? null,
          }
        : null,
    };
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
