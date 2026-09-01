import { randomUUID } from "node:crypto";
import type { Json } from "@/integrations/supabase/types";
import { fetchSitePublicHtml } from "@/build/onboarding/safeFetch.server";
import { extractSiteText } from "@/build/onboarding/extractText";
import { expandPlaybookDraft } from "@/build/onboarding/expandPlaybookDraft";
import { getPlaybookPublishIssues } from "@/build/engine/validation";
import { playbookSchema } from "@/build/schema/playbook";
import { runDeckSiteAnalysis } from "@/build/ai/deckSiteAnalysis";
import {
  runPlaybookDraftGeneration,
  type PlaybookDraftGenerationOutput,
} from "@/build/ai/playbookDraftGeneration";
import {
  AI_RUNS_PER_HOUR,
  checkAiRun,
  checkBusinessType,
  checkProduct,
  checkSiteUrl,
  defaultBranding,
  type Branding,
  type SiteAnalysis,
} from "@/build/onboarding/portalOnboarding";
import {
  aiRunsPerHourFor,
  INITIAL_PROSPECT_STATUS,
  INTERNAL_SALES,
  INTERNAL_SALES_WORKSPACE_NAME,
  prospectDisplayName,
} from "@/build/workspaces/internalSales";
import type { Supa } from "./adminAuth.server";
import { fail } from "./serverError";

export const HERMES_FUNNEL_STEPS = ["create", "analyze", "confirm", "generate", "publish"] as const;
export type HermesFunnelStep = (typeof HERMES_FUNNEL_STEPS)[number];

export type HermesProspectInput = {
  companyName?: string | null;
  websiteUrl: string;
  businessType?: string | null;
  /**
   * The trade Hermes is prospecting ("residential pools", "deck builders"...).
   * Hermes knows it from the campaign, so it stands in for the site analysis
   * when the analysis stays vague — never over it.
   */
  vertical?: string | null;
  product?: string | null;
  campaignId?: string | null;
  requestId?: string | null;
};

export type HermesProspectResult = {
  prospectName: string;
  websiteUrl: string;
  onboardingId: string | null;
  status: "published" | "failed" | "existing";
  setupStatus: string | null;
  publicPath: string | null;
  error: string | null;
};

type OnboardingRow = Awaited<ReturnType<typeof loadOnboardingById>>;

const HERMES_DEFAULT_PRODUCT = "Deck project";
const HERMES_DEFAULT_BUSINESS_TYPE = "Deck builder";
export const HERMES_LOCAL_LOVABLE_API_KEY_PLACEHOLDER = "local-dev-placeholder-not-a-real-key";

function shortError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error || "Unknown error")).slice(0, 700);
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function aiRequestId(step: HermesFunnelStep): string {
  return `${randomUUID().replace(/-/g, "").slice(0, 32)}-${step.slice(0, 3)}`;
}

export function hasUsableHermesAiKey(value = process.env.LOVABLE_API_KEY): boolean {
  const key = (value ?? "").trim();
  return Boolean(key && key !== HERMES_LOCAL_LOVABLE_API_KEY_PLACEHOLDER);
}

function fallbackBusinessType(input: HermesProspectInput): string {
  return (
    normalizeText(input.businessType) ??
    normalizeText(input.vertical) ??
    HERMES_DEFAULT_BUSINESS_TYPE
  );
}

function fallbackProduct(input: HermesProspectInput): string {
  const vertical = normalizeText(input.vertical);
  return (
    normalizeText(input.product) ?? (vertical ? `${vertical} project` : HERMES_DEFAULT_PRODUCT)
  );
}

export function buildHermesFallbackSiteAnalysis(
  input: HermesProspectInput,
  finalUrl: string,
): SiteAnalysis {
  const businessType = fallbackBusinessType(input);
  const product = fallbackProduct(input);
  const deckContext = /\bdeck/i.test(`${businessType} ${product} ${input.vertical ?? ""}`);
  const facts = [
    normalizeText(input.companyName)
      ? {
          claim: `Prospect company: ${normalizeText(input.companyName)}`,
          status: "assumed" as const,
        }
      : null,
    { claim: `Prospecting vertical: ${businessType}`, status: "assumed" as const },
    { claim: `Default project intake selected: ${product}`, status: "assumed" as const },
  ].filter(Boolean) as SiteAnalysis["facts"];

  return {
    finalUrl,
    businessType,
    isDeckBusiness: deckContext,
    deckSignals: deckContext ? ["Hermes campaign context names a deck-related prospect."] : [],
    products: [product],
    facts,
    analyzedAt: new Date().toISOString(),
  };
}

function retryStatus(row: NonNullable<OnboardingRow>): string {
  if (row.playbook_id) return "draft_ready";
  if (row.confirmed_business_type && row.confirmed_product) return "confirmed";
  if (row.analysis) return "analyzed";
  return "started";
}

async function internalWorkspace(sb: Supa, workspaceId?: string | null): Promise<string> {
  let query = sb
    .from("build_workspaces")
    .select("id, name, workspace_type")
    .eq("workspace_type", INTERNAL_SALES);
  if (workspaceId) query = query.eq("id", workspaceId);

  const { data, error } = await query.order("created_at", { ascending: true }).limit(5);
  if (error) fail(500, error.message);
  const chosen =
    (data ?? []).find((w) => w.name === INTERNAL_SALES_WORKSPACE_NAME) ?? (data ?? [])[0];
  if (!chosen) fail(404, "No internal Sales / Demos workspace found.");
  return chosen.id;
}

/**
 * A funnel left half-way by a human wizard or an interrupted run holds the
 * workspace slot. Past this age Hermes stops waiting on it: the row is marked
 * failed at its last step so it stays visible and retryable in the admin, and
 * the new prospect can go through instead of getting a permanent 409.
 */
export const STALE_IN_FLIGHT_MINUTES = 30;

/**
 * Where an abandoned funnel actually stopped, read from what it managed to
 * write. A human wizard never sets `prospect_last_step`, so without this the
 * admin would be told to retry from the very beginning and lose the analysis
 * and draft already paid for.
 */
export function staleStep(row: {
  prospect_last_step?: string | null;
  analyzed_at?: string | null;
  confirmed_product?: string | null;
  playbook_id?: string | null;
}): HermesFunnelStep {
  if (row.prospect_last_step) return row.prospect_last_step as HermesFunnelStep;
  if (row.playbook_id) return "publish";
  if (row.confirmed_product) return "generate";
  if (row.analyzed_at) return "confirm";
  return "analyze";
}

export function isStaleInFlight(updatedAt: string | null | undefined, now = new Date()): boolean {
  if (!updatedAt) return true;
  const age = now.getTime() - new Date(updatedAt).getTime();
  return Number.isFinite(age) && age > STALE_IN_FLIGHT_MINUTES * 60 * 1000;
}

async function activeInFlightRow(sb: Supa, workspaceId: string, exceptId?: string | null) {
  let query = sb
    .from("build_workspace_onboarding")
    .select(
      "id, prospect_company_name, site_url, final_url, updated_at, prospect_last_step, analyzed_at, confirmed_product, playbook_id",
    )

    .eq("workspace_id", workspaceId)
    .neq("status", "published")
    .neq("status", "failed")
    .limit(1);
  if (exceptId) query = query.neq("id", exceptId);
  const { data, error } = await query;
  if (error) fail(500, error.message);
  return data?.[0] ?? null;
}

async function workspaceName(sb: Supa, workspaceId: string): Promise<string> {
  const { data, error } = await sb
    .from("build_workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) fail(500, error.message);
  return data?.name ?? "Métré Sales";
}

async function loadOnboardingById(sb: Supa, id: string) {
  const { data, error } = await sb
    .from("build_workspace_onboarding")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) fail(500, error.message);
  return data;
}

async function publicPathForRow(sb: Supa, row: NonNullable<OnboardingRow>): Promise<string | null> {
  if (!row.mission_id) return null;
  const { data, error } = await sb
    .from("build_missions")
    .select("public_token, public_token_revoked_at")
    .eq("id", row.mission_id)
    .maybeSingle();
  if (error) fail(500, error.message);
  return data?.public_token && !data.public_token_revoked_at ? `/m/${data.public_token}` : null;
}

async function toResult(
  sb: Supa,
  input: HermesProspectInput,
  row: OnboardingRow,
  status: HermesProspectResult["status"],
  error: string | null = null,
): Promise<HermesProspectResult> {
  return {
    prospectName: prospectDisplayName(
      input.companyName ?? row?.prospect_company_name,
      input.websiteUrl,
    ),
    websiteUrl: row?.final_url ?? row?.site_url ?? input.websiteUrl,
    onboardingId: row?.id ?? null,
    status,
    setupStatus: row?.status ?? null,
    publicPath: row ? await publicPathForRow(sb, row) : null,
    error,
  };
}

async function markStep(sb: Supa, id: string, step: HermesFunnelStep, status?: string) {
  const patch: {
    prospect_last_step: HermesFunnelStep;
    prospect_last_error: null;
    prospect_last_error_at: null;
    status?: string;
  } = {
    prospect_last_step: step,
    prospect_last_error: null,
    prospect_last_error_at: null,
  };
  if (status) patch.status = status;
  const { error } = await sb.from("build_workspace_onboarding").update(patch).eq("id", id);
  if (error) fail(500, error.message);
}

async function markFailed(sb: Supa, id: string, step: HermesFunnelStep, error: unknown) {
  const { error: updateError } = await sb
    .from("build_workspace_onboarding")
    .update({
      status: "failed",
      prospect_last_step: step,
      prospect_last_error: shortError(error),
      prospect_last_error_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateError) fail(500, updateError.message);
}

async function guardAiRun(
  sb: Supa,
  workspaceId: string,
  userId: string,
  action: string,
  requestId: string,
) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: runs, error } = await sb
    .from("build_workspace_ai_runs")
    .select("request_id, created_at")
    .eq("workspace_id", workspaceId)
    .eq("action", action)
    .gte("created_at", since);
  if (error) fail(500, error.message);

  const decision = checkAiRun(
    (runs ?? []).map((r) => ({ requestId: r.request_id, createdAt: r.created_at })),
    requestId,
    new Date(),
    aiRunsPerHourFor(INTERNAL_SALES, AI_RUNS_PER_HOUR),
  );
  if (!decision.allow) {
    if (decision.reason === "duplicate") return decision;
    fail(
      429,
      `Hermes AI budget is temporarily exhausted. Try again in ${decision.retryAfterMinutes} minutes.`,
    );
  }

  const { error: claimError } = await sb.from("build_workspace_ai_runs").insert({
    workspace_id: workspaceId,
    user_id: userId,
    action,
    request_id: requestId,
    status: "running",
  });
  if (claimError) {
    if (claimError.code === "23505") return { allow: false, reason: "duplicate" } as const;
    fail(500, claimError.message);
  }
  return decision;
}

async function logAiRun(
  sb: Supa,
  fields: {
    workspaceId: string;
    userId: string;
    action: string;
    requestId: string;
    status: "ok" | "error";
    latencyMs: number;
    error?: string;
  },
) {
  await sb
    .from("build_workspace_ai_runs")
    .update({
      status: fields.status,
      latency_ms: fields.latencyMs,
      error: fields.error?.slice(0, 500) ?? null,
    })
    .eq("workspace_id", fields.workspaceId)
    .eq("action", fields.action)
    .eq("request_id", fields.requestId);
}

async function findExisting(
  sb: Supa,
  workspaceId: string,
  checkedUrl: string,
  input: HermesProspectInput,
) {
  if (input.requestId) {
    const { data, error } = await sb
      .from("build_workspace_onboarding")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("prospect_request_id", input.requestId)
      .maybeSingle();
    if (error) fail(500, error.message);
    if (data) return data;
  }

  if (input.campaignId) {
    const { data, error } = await sb
      .from("build_workspace_onboarding")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("prospect_campaign_id", input.campaignId)
      .eq("site_url", checkedUrl)
      .maybeSingle();
    if (error) fail(500, error.message);
    if (data) return data;
  }

  return null;
}

async function createRow(
  sb: Supa,
  workspaceId: string,
  userId: string,
  checkedUrl: string,
  input: HermesProspectInput,
  requestId: string,
) {
  const blocker = await activeInFlightRow(sb, workspaceId);
  if (blocker) {
    if (isStaleInFlight(blocker.updated_at)) {
      await markFailed(
        sb,
        blocker.id,
        staleStep(blocker),
        new Error(
          `Funnel abandoned for more than ${STALE_IN_FLIGHT_MINUTES} minutes — released so the next prospect could run. Retry it from here.`,
        ),
      );
    } else {
      fail(
        409,
        `Another prospect funnel is already in progress (${prospectDisplayName(blocker.prospect_company_name, blocker.final_url ?? blocker.site_url)}). Finish, publish, fail, or retry it first.`,
      );
    }
  }

  const { data, error } = await sb
    .from("build_workspace_onboarding")
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      status: "started",
      site_url: checkedUrl,
      prospect_company_name: normalizeText(input.companyName),
      prospect_status: INITIAL_PROSPECT_STATUS,
      prospect_campaign_id: normalizeText(input.campaignId),
      prospect_request_id: requestId,
      prospect_last_step: "create",
    })
    .select("*")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      fail(409, "Another prospect funnel is already in progress for this workspace.");
    }
    fail(500, error.message);
  }
  if (!data) fail(500, "Could not create prospect funnel.");
  return data;
}

async function saveAnalysis(
  sb: Supa,
  row: NonNullable<OnboardingRow>,
  analysis: SiteAnalysis,
  requestId: string | null,
) {
  const { error } = await sb
    .from("build_workspace_onboarding")
    .update({
      status: "analyzed",
      final_url: analysis.finalUrl,
      analysis: analysis as unknown as Json,
      analyzed_at: analysis.analyzedAt,
      last_analyze_request_id: requestId,
      prospect_last_step: "analyze",
      prospect_last_error: null,
      prospect_last_error_at: null,
    })
    .eq("id", row.id);
  if (error) fail(500, error.message);
  const updated = await loadOnboardingById(sb, row.id);
  if (!updated) fail(404, "Prospect funnel disappeared during analysis.");
  return updated;
}

async function analyzeStep(
  sb: Supa,
  row: NonNullable<OnboardingRow>,
  userId: string,
  input: HermesProspectInput,
) {
  if (row.analysis && row.analyzed_at) return row;
  await markStep(sb, row.id, "analyze", "started");

  const fetched = await fetchSitePublicHtml(row.site_url ?? input.websiteUrl);
  if (!hasUsableHermesAiKey()) {
    return saveAnalysis(sb, row, buildHermesFallbackSiteAnalysis(input, fetched.finalUrl), null);
  }

  const startedAt = Date.now();
  const requestId = aiRequestId("analyze");
  try {
    const decision = await guardAiRun(sb, row.workspace_id, userId, "analyze_site", requestId);
    if (!decision.allow && decision.reason === "duplicate") {
      throw new Error("That website analysis is already running.");
    }
    const result = await runDeckSiteAnalysis(extractSiteText(fetched.html));
    const latencyMs = Date.now() - startedAt;
    if (result.status === "error" || !result.data) {
      await logAiRun(sb, {
        workspaceId: row.workspace_id,
        userId,
        action: "analyze_site",
        requestId,
        status: "error",
        latencyMs,
        error: result.error ?? "unknown",
      });
      if (canUseDeterministicHermesFallback(result.error)) {
        return saveAnalysis(
          sb,
          row,
          buildHermesFallbackSiteAnalysis(input, fetched.finalUrl),
          null,
        );
      }
      throw new Error(result.error ?? "Website analysis did not complete.");
    }
    await logAiRun(sb, {
      workspaceId: row.workspace_id,
      userId,
      action: "analyze_site",
      requestId,
      status: "ok",
      latencyMs,
    });

    const analysis: SiteAnalysis = {
      finalUrl: fetched.finalUrl,
      businessType: result.data.businessType,
      isDeckBusiness: result.data.isDeckBusiness,
      deckSignals: result.data.deckSignals,
      products: result.data.products,
      facts: result.data.facts,
      analyzedAt: new Date().toISOString(),
    };

    return saveAnalysis(sb, row, analysis, requestId);
  } catch (err) {
    await logAiRun(sb, {
      workspaceId: row.workspace_id,
      userId,
      action: "analyze_site",
      requestId,
      status: "error",
      latencyMs: Date.now() - startedAt,
      error: shortError(err),
    });
    if (canUseDeterministicHermesFallback(err)) {
      return saveAnalysis(sb, row, buildHermesFallbackSiteAnalysis(input, fetched.finalUrl), null);
    }
    throw err;
  }
}

async function confirmStep(sb: Supa, row: NonNullable<OnboardingRow>, input: HermesProspectInput) {
  if (row.confirmed_business_type && row.confirmed_product) return row;
  await markStep(sb, row.id, "confirm", "analyzed");

  const analysis = (row.analysis ?? null) as SiteAnalysis | null;
  const vertical = normalizeText(input.vertical);
  const business = checkBusinessType(
    normalizeText(input.businessType) ??
      analysis?.businessType ??
      vertical ??
      fallbackBusinessType(input),
  );
  if (!business.ok) throw new Error(business.error);
  const product = checkProduct(
    normalizeText(input.product) ?? analysis?.products?.[0] ?? fallbackProduct(input),
  );
  if (!product.ok) throw new Error(product.error);

  const { error } = await sb
    .from("build_workspace_onboarding")
    .update({
      status: "confirmed",
      confirmed_business_type: business.value,
      confirmed_product: product.value,
      prospect_last_step: "confirm",
      prospect_last_error: null,
      prospect_last_error_at: null,
    })
    .eq("id", row.id);
  if (error) fail(500, error.message);
  const updated = await loadOnboardingById(sb, row.id);
  if (!updated) fail(404, "Prospect funnel disappeared during confirmation.");
  return updated;
}

/**
 * Draft generation runs through an AI Gateway, so a share of its failures are
 * weather, not verdicts: rate limits, timeouts, gateway hiccups, a model
 * momentarily unavailable. Those must not burn a prospect — Hermes retries them
 * before classifying the funnel as failed.
 */
export const TRANSIENT_AI_ERROR_PATTERNS = [
  /rate limit/i,
  /rate_limit/i,
  /too many requests/i,
  /\b429\b/,
  /timed? ?out/i,
  /timeout/i,
  /etimedout/i,
  /econnreset/i,
  /gateway/i,
  /bad gateway/i,
  /\b50[0234]\b/,
  /temporarily/i,
  /unavailable/i,
  /overloaded/i,
  /capacity/i,
  /try again/i,
  /already running/i,
] as const;

export function isTransientAiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return TRANSIENT_AI_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export const HERMES_DETERMINISTIC_FALLBACK_PATTERNS = [
  /LOVABLE_API_KEY/i,
  /local-dev-placeholder-not-a-real-key/i,
  /invalid api key/i,
  /unauthorized/i,
  /\b401\b/,
  /credits?/i,
  /\b402\b/,
  /Réponse IA non structurée/i,
  /parsing échoué/i,
] as const;

export function canUseDeterministicHermesFallback(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/already running/i.test(message)) return false;
  return (
    HERMES_DETERMINISTIC_FALLBACK_PATTERNS.some((pattern) => pattern.test(message)) ||
    isTransientAiError(error)
  );
}

export const DRAFT_GENERATION_ATTEMPTS = 3;

/**
 * Waiting between attempts, not hammering: a rate-limited or overloaded gateway
 * needs time, so each retry backs off before asking again. One entry per gap
 * between attempts, hence ATTEMPTS - 1 delays.
 */
export const DRAFT_RETRY_BACKOFF_MS = [1500, 5000] as const;

export function draftRetryDelayMs(attempt: number): number {
  return DRAFT_RETRY_BACKOFF_MS[attempt - 1] ?? DRAFT_RETRY_BACKOFF_MS.at(-1) ?? 0;
}

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

export function buildHermesFallbackPlaybookDraft(
  businessType: string,
  product: string,
): PlaybookDraftGenerationOutput {
  return {
    steps: [
      {
        title: "Project basics",
        why: `The ${businessType} team needs to understand the project before the first call.`,
        fields: [
          {
            label: `What type of ${product} is this?`,
            type: "single_choice",
            required: true,
            options: ["New project", "Replacement or upgrade", "Repair or service", "Not sure yet"],
          },
          {
            label: "What should the finished project help you accomplish?",
            type: "text",
            required: true,
          },
        ],
      },
      {
        title: "Site and scope",
        why: "Photos, access, and existing conditions help the team spot fit and complexity early.",
        fields: [
          {
            label: "Where will the work happen?",
            type: "address",
            required: true,
          },
          {
            label: "What site conditions should the team know about?",
            type: "multi_choice",
            required: false,
            options: [
              "Easy access",
              "Limited access",
              "Existing structure or surface",
              "Permits may be needed",
              "Not sure yet",
            ],
          },
          {
            label: "Add photos of the current space",
            type: "photo",
            required: false,
          },
        ],
      },
      {
        title: "Budget and timing",
        why: "Budget range and schedule expectations help the sales team prioritize the right response.",
        fields: [
          {
            label: "Estimated budget range",
            type: "budget",
            required: false,
            options: [
              "Under $5,000",
              "$5,000-$15,000",
              "$15,000-$35,000",
              "$35,000+",
              "Not sure yet",
            ],
          },
          {
            label: "Ideal project timing",
            type: "timeline",
            required: false,
            options: [
              "As soon as possible",
              "Within 1-3 months",
              "Within 3-6 months",
              "Planning ahead",
              "Not sure yet",
            ],
          },
        ],
      },
      {
        title: "Decision details",
        why: "The team gets the context that makes the first conversation useful.",
        fields: [
          {
            label: "What would make this project feel successful?",
            type: "text",
            required: false,
          },
        ],
      },
    ],
  };
}

async function generateStep(sb: Supa, row: NonNullable<OnboardingRow>, userId: string) {
  if (row.playbook_id) return row;
  await markStep(sb, row.id, "generate", "confirmed");
  if (!row.confirmed_business_type || !row.confirmed_product) {
    throw new Error("Confirm the product before generating the draft.");
  }

  if (!hasUsableHermesAiKey()) {
    return saveDraftPlaybook(
      sb,
      row,
      userId,
      buildHermesFallbackPlaybookDraft(row.confirmed_business_type, row.confirmed_product),
      null,
      "Lovable AI Gateway was not configured; Hermes used the deterministic starter draft.",
    );
  }

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= DRAFT_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      return await generateDraftAttempt(sb, row, userId);
    } catch (err) {
      lastError = err;
      if (!canUseDeterministicHermesFallback(err)) throw err;
      if (!isTransientAiError(err) || attempt === DRAFT_GENERATION_ATTEMPTS) break;
      await wait(draftRetryDelayMs(attempt));
    }
  }
  if (canUseDeterministicHermesFallback(lastError)) {
    return saveDraftPlaybook(
      sb,
      row,
      userId,
      buildHermesFallbackPlaybookDraft(row.confirmed_business_type, row.confirmed_product),
      null,
      `AI draft generation failed after retries; Hermes used the deterministic starter draft. Last error: ${shortError(lastError)}`,
    );
  }
  throw lastError instanceof Error ? lastError : new Error("Draft generation did not complete.");
}

async function saveDraftPlaybook(
  sb: Supa,
  row: NonNullable<OnboardingRow>,
  userId: string,
  draft: PlaybookDraftGenerationOutput,
  requestId: string | null,
  description: string,
) {
  if (!row.confirmed_business_type || !row.confirmed_product) {
    throw new Error("Confirm the product before generating the draft.");
  }
  const draftSchema = expandPlaybookDraft(
    draft,
    row.confirmed_business_type,
    row.confirmed_product,
  );
  const name = `${row.confirmed_product} intake`;
  const { data: playbook, error } = await sb
    .from("build_playbooks")
    .insert({
      name,
      description,
      project_type: row.confirmed_product,
      workspace_id: row.workspace_id,
      draft_schema: draftSchema as unknown as Json,
      created_by: userId,
      is_active: false,
    })
    .select("id")
    .maybeSingle();
  if (error) fail(500, error.message);
  if (!playbook) fail(500, "Draft creation failed.");

  const branding = defaultBranding(
    prospectDisplayName(row.prospect_company_name, row.final_url ?? row.site_url),
    row.confirmed_product,
  );
  const { error: updateError } = await sb
    .from("build_workspace_onboarding")
    .update({
      status: "draft_ready",
      playbook_id: playbook.id,
      draft_version: (row.draft_version ?? 0) + 1,
      branding: branding as unknown as Json,
      last_generate_request_id: requestId,
      prospect_last_step: "generate",
      prospect_last_error: null,
      prospect_last_error_at: null,
    })
    .eq("id", row.id);
  if (updateError) fail(500, updateError.message);
  const updated = await loadOnboardingById(sb, row.id);
  if (!updated) fail(404, "Prospect funnel disappeared during generation.");
  return updated;
}

async function generateDraftAttempt(sb: Supa, row: NonNullable<OnboardingRow>, userId: string) {
  if (!row.confirmed_business_type || !row.confirmed_product) {
    throw new Error("Confirm the product before generating the draft.");
  }
  const startedAt = Date.now();
  const requestId = aiRequestId("generate");
  try {
    const decision = await guardAiRun(sb, row.workspace_id, userId, "generate_draft", requestId);
    if (!decision.allow && decision.reason === "duplicate") {
      throw new Error("That draft generation is already running.");
    }
    const result = await runPlaybookDraftGeneration(
      row.confirmed_business_type,
      row.confirmed_product,
    );

    const latencyMs = Date.now() - startedAt;
    if (result.status === "error" || !result.data) {
      await logAiRun(sb, {
        workspaceId: row.workspace_id,
        userId,
        action: "generate_draft",
        requestId,
        status: "error",
        latencyMs,
        error: result.error ?? "unknown",
      });
      throw new Error(result.error ?? "Draft generation did not complete.");
    }
    await logAiRun(sb, {
      workspaceId: row.workspace_id,
      userId,
      action: "generate_draft",
      requestId,
      status: "ok",
      latencyMs,
    });

    return saveDraftPlaybook(
      sb,
      row,
      userId,
      result.data,
      requestId,
      `Hermes prospect draft generated for ${row.confirmed_business_type} / ${row.confirmed_product}.`,
    );
  } catch (err) {
    await logAiRun(sb, {
      workspaceId: row.workspace_id,
      userId,
      action: "generate_draft",
      requestId,
      status: "error",
      latencyMs: Date.now() - startedAt,
      error: shortError(err),
    });
    throw err;
  }
}

async function publishStep(sb: Supa, row: NonNullable<OnboardingRow>, userId: string) {
  if (row.status === "published" && row.mission_id) return row;
  await markStep(sb, row.id, "publish", "draft_ready");
  // Reaching publish without a playbook means draft generation gave up; say so
  // instead of an instruction ("generate the draft first") that reads like the
  // funnel is merely waiting on a human.
  if (!row.playbook_id) {
    throw new Error(
      "Draft generation did not produce a project intake draft — retry the generate step.",
    );
  }

  const { data: playbook, error } = await sb
    .from("build_playbooks")
    .select("draft_schema, name, workspace_id")
    .eq("id", row.playbook_id)
    .maybeSingle();
  if (error) fail(500, error.message);
  if (!playbook || playbook.workspace_id !== row.workspace_id)
    throw new Error("No draft to publish.");

  const parsedSchema = playbookSchema.safeParse(playbook.draft_schema);
  if (!parsedSchema.success)
    throw new Error("This draft is not valid and cannot be published yet.");
  const issues = getPlaybookPublishIssues(parsedSchema.data);
  if (issues.length > 0)
    throw new Error(`This draft is not ready to publish yet: ${issues.join(" ")}`);

  const branding =
    row.branding && Object.keys(row.branding).length > 0
      ? (row.branding as unknown as Branding)
      : defaultBranding(await workspaceName(sb, row.workspace_id), row.confirmed_product ?? "Deck");

  const missionName = `${branding.displayName} — ${row.confirmed_product ?? "Deck"} Intake`;
  const { error: publishError } = await sb.rpc("publish_workspace_onboarding", {
    p_workspace_id: row.workspace_id,
    p_playbook_id: row.playbook_id,
    p_validated_draft_schema: parsedSchema.data as unknown as Json,
    p_published_by: userId,
    p_mission_name: missionName,
  });
  if (publishError) throw new Error(publishError.message);

  const updated = await loadOnboardingById(sb, row.id);
  if (!updated) fail(404, "Prospect funnel disappeared during publish.");
  const { error: prospectError } = await sb
    .from("build_workspace_onboarding")
    .update({
      prospect_status: "ready",
      prospect_last_step: "publish",
      prospect_last_error: null,
      prospect_last_error_at: null,
    })
    .eq("id", row.id)
    .eq("prospect_status", INITIAL_PROSPECT_STATUS);
  if (prospectError) fail(500, prospectError.message);
  return (await loadOnboardingById(sb, row.id)) ?? updated;
}

async function processRow(
  sb: Supa,
  row: NonNullable<OnboardingRow>,
  userId: string,
  input: HermesProspectInput,
) {
  let current = row;
  let step: HermesFunnelStep = "analyze";
  try {
    current = await analyzeStep(sb, current, userId, input);
    step = "confirm";
    current = await confirmStep(sb, current, input);
    step = "generate";
    current = await generateStep(sb, current, userId);
    step = "publish";
    current = await publishStep(sb, current, userId);
    return toResult(sb, input, current, "published");
  } catch (err) {
    // No playbook attached means the draft never came out of the generator, so
    // the blocking step is generate — even when the throw happened in publish.
    // The admin and Hermes then relaunch the step that actually failed.
    const failedStep: HermesFunnelStep =
      step === "publish" && !current.playbook_id ? "generate" : step;
    await markFailed(sb, current.id, failedStep, err);
    const failed = await loadOnboardingById(sb, current.id);
    return toResult(sb, input, failed, "failed", shortError(err));
  }
}

export async function runHermesProspectFunnel(
  sb: Supa,
  fields: {
    userId: string;
    workspaceId?: string | null;
    input: HermesProspectInput;
    retryFailed?: boolean;
  },
): Promise<HermesProspectResult> {
  const checked = checkSiteUrl(fields.input.websiteUrl);
  if (!checked.ok) {
    return {
      prospectName: prospectDisplayName(fields.input.companyName, fields.input.websiteUrl),
      websiteUrl: fields.input.websiteUrl,
      onboardingId: null,
      status: "failed",
      setupStatus: null,
      publicPath: null,
      error: checked.error,
    };
  }

  const workspaceId = await internalWorkspace(sb, fields.workspaceId);
  const requestId = normalizeText(fields.input.requestId) ?? randomUUID();
  const existing = await findExisting(sb, workspaceId, checked.url, fields.input);
  if (existing) {
    if (existing.status === "failed" && fields.retryFailed) {
      const blocker = await activeInFlightRow(sb, workspaceId, existing.id);
      if (blocker) {
        return toResult(
          sb,
          fields.input,
          existing,
          "failed",
          `Another prospect funnel is already in progress (${prospectDisplayName(blocker.prospect_company_name, blocker.final_url ?? blocker.site_url)}).`,
        );
      }
      const { error } = await sb
        .from("build_workspace_onboarding")
        .update({
          status: retryStatus(existing),
          prospect_last_step: "retry",
          prospect_last_error: null,
          prospect_last_error_at: null,
        })
        .eq("id", existing.id);
      if (error) {
        if (error.code === "23505") {
          return toResult(
            sb,
            fields.input,
            existing,
            "failed",
            "Another prospect funnel started while this retry was opening.",
          );
        }
        fail(500, error.message);
      }
      const retry = await loadOnboardingById(sb, existing.id);
      if (!retry) fail(404, "Prospect funnel not found.");
      return processRow(sb, retry, fields.userId, fields.input);
    }
    return toResult(sb, fields.input, existing, "existing", existing.prospect_last_error ?? null);
  }

  const row = await createRow(sb, workspaceId, fields.userId, checked.url, fields.input, requestId);
  return processRow(sb, row, fields.userId, fields.input);
}

export async function retryHermesProspectFunnelById(
  sb: Supa,
  fields: { userId: string; id: string },
): Promise<HermesProspectResult> {
  const row = await loadOnboardingById(sb, fields.id);
  if (!row) fail(404, "Prospect funnel not found.");
  await internalWorkspace(sb, row.workspace_id);
  const input: HermesProspectInput = {
    companyName: row.prospect_company_name,
    websiteUrl: row.site_url ?? row.final_url ?? "",
    businessType: row.confirmed_business_type,
    product: row.confirmed_product,
    campaignId: row.prospect_campaign_id,
    requestId: row.prospect_request_id ?? randomUUID(),
  };
  return runHermesProspectFunnel(sb, {
    userId: fields.userId,
    workspaceId: row.workspace_id,
    input,
    retryFailed: true,
  });
}

export async function runHermesProspectFunnelBatch(
  sb: Supa,
  fields: {
    userId: string;
    workspaceId?: string | null;
    prospects: HermesProspectInput[];
    retryFailed?: boolean;
  },
): Promise<{ results: HermesProspectResult[] }> {
  const results: HermesProspectResult[] = [];
  for (const input of fields.prospects) {
    try {
      results.push(
        await runHermesProspectFunnel(sb, {
          userId: fields.userId,
          workspaceId: fields.workspaceId,
          input,
          retryFailed: fields.retryFailed,
        }),
      );
    } catch (err) {
      // One prospect must never take the batch down with it: Hermes gets a
      // named failure per prospect and keeps the others.
      results.push({
        prospectName: prospectDisplayName(input.companyName, input.websiteUrl),
        websiteUrl: input.websiteUrl,
        onboardingId: null,
        status: "failed",
        setupStatus: null,
        publicPath: null,
        error: shortError(err),
      });
    }
  }
  return { results };
}
