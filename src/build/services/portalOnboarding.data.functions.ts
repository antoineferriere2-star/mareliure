// Server functions for the client-facing self-service setup (/portal/setup).
//
// Security contract, identical on every function below:
//  - the caller's identity comes from the validated bearer token
//    (context.userId), never from the request body;
//  - the workspaceId supplied by the browser is only ever used AFTER
//    assertWorkspaceMember / assertWorkspaceOwner has proven the caller
//    belongs to it. Reads are open to members, every write (and every AI
//    call, which costs money) is owner-only;
//  - the service-role client is loaded only after that authorization.
//
// Product contract (CLAUDE.md): the AI proposes, the client confirms.
// Nothing here publishes anything — the generated Playbook is always saved
// as a workspace-scoped draft with published_version_id NULL, and no Mission
// is ever created by this flow.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { admin, type Supa } from "./adminAuth.server";
import { fail } from "./serverError";
import { assertWorkspaceMember, assertWorkspaceOwner } from "./workspaceAuth.server";
import { assertCanPublish } from "./workspaceEntitlements.server";
import { fetchSitePublicHtml } from "@/build/onboarding/safeFetch.server";
import { extractSiteText } from "@/build/onboarding/extractText";
import { expandPlaybookDraft } from "@/build/onboarding/expandPlaybookDraft";
import { playbookSchema, type PlaybookSchema } from "@/build/schema/playbook";
import { getPlaybookPublishIssues } from "@/build/engine/validation";
import {
  checkAiRun,
  checkBranding,
  checkBusinessType,
  checkProduct,
  checkSiteUrl,
  defaultBranding,
  isPublished,
  type Branding,
  type OnboardingStatus,
  type SiteAnalysis,
} from "@/build/onboarding/portalOnboarding";

const workspaceInput = z.object({ workspaceId: z.string().uuid() });

export interface PortalOnboardingState {
  workspaceId: string;
  workspaceName: string;
  status: OnboardingStatus;
  siteUrl: string | null;
  analysis: SiteAnalysis | null;
  confirmedBusinessType: string | null;
  confirmedProduct: string | null;
  draftPlaybookId: string | null;
  draftVersion: number;
  draftPublished: boolean;
  missionId: string | null;
  publicUrl: string | null;
  branding: Branding | null;
  isOwner: boolean;
  /** Intakes this workspace has already published. Lets the wizard offer
   * "set up another one" instead of looking like a dead end after the first. */
  publishedIntakeCount: number;
}

/**
 * The setup currently being configured. A workspace may hold several rows —
 * one unpublished plus every published one — so "the workspace's setup" is no
 * longer meaningful and every *write* must go through this, never through a
 * bare `.eq("workspace_id", …)` that would also hit published rows.
 *
 * At most one such row can exist: build_workspace_onboarding_one_in_flight_uidx
 * enforces it, which is what keeps `.maybeSingle()` correct here.
 */
async function loadInFlightRow(sb: Supa, workspaceId: string) {
  const { data, error } = await sb
    .from("build_workspace_onboarding")
    .select("*")
    .eq("workspace_id", workspaceId)
    .neq("status", "published")
    .maybeSingle();
  if (error) fail(500, error.message);
  return data;
}

/**
 * What the wizard should render: the setup in flight, or — once it has been
 * published and no new one is started — the most recent published setup, so
 * the confirmation screen and its public link survive a page reload.
 * Read-only; never use it to decide what to write.
 */
async function loadDisplayRow(sb: Supa, workspaceId: string) {
  const inFlight = await loadInFlightRow(sb, workspaceId);
  if (inFlight) return inFlight;

  const { data, error } = await sb
    .from("build_workspace_onboarding")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail(500, error.message);
  return data;
}

/** How many Intakes this workspace has already taken all the way to publish. */
async function publishedSetupCount(sb: Supa, workspaceId: string): Promise<number> {
  const { count, error } = await sb
    .from("build_workspace_onboarding")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "published");
  if (error) fail(500, error.message);
  return count ?? 0;
}

async function workspaceName(sb: Supa, workspaceId: string): Promise<string> {
  const { data } = await sb
    .from("build_workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();
  return data?.name ?? "My business";
}

async function publicUrlForMission(sb: Supa, missionId: string | null): Promise<string | null> {
  if (!missionId) return null;
  const { data } = await sb
    .from("build_missions")
    .select("public_token")
    .eq("id", missionId)
    .maybeSingle();
  return data?.public_token ? `/m/${data.public_token}` : null;
}

async function toState(
  sb: Supa,
  row: Awaited<ReturnType<typeof loadInFlightRow>>,
  workspaceId: string,
  name: string,
  isOwner: boolean,
): Promise<PortalOnboardingState> {
  const status = (row?.status as OnboardingStatus | undefined) ?? "started";
  return {
    publishedIntakeCount: await publishedSetupCount(sb, workspaceId),
    workspaceId,
    workspaceName: name,
    status,
    siteUrl: row?.final_url ?? row?.site_url ?? null,
    analysis: (row?.analysis as SiteAnalysis | null) ?? null,
    confirmedBusinessType: row?.confirmed_business_type ?? null,
    confirmedProduct: row?.confirmed_product ?? null,
    draftPlaybookId: row?.playbook_id ?? null,
    draftVersion: row?.draft_version ?? 0,
    draftPublished: isPublished(status),
    missionId: row?.mission_id ?? null,
    publicUrl: await publicUrlForMission(sb, row?.mission_id ?? null),
    branding:
      row && row.branding && Object.keys(row.branding).length > 0
        ? (row.branding as unknown as Branding)
        : null,
    isOwner,
  };
}

/** Members may read the setup state; only owners can change it. */
export const getMySetup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => workspaceInput.parse(data))
  .handler(async ({ context, data }) => {
    const { role } = await assertWorkspaceMember(
      context.supabase,
      context.userId,
      data.workspaceId,
    );
    const sb = await admin();
    const row = await loadDisplayRow(sb, data.workspaceId);
    return toState(
      sb,
      row,
      data.workspaceId,
      await workspaceName(sb, data.workspaceId),
      role === "owner",
    );
  });

// ------------------------------------------------------------ AI accounting

/**
 * Reserves one AI run. The reservation is the row insert itself, protected by
 * the unique index on (workspace_id, action, request_id): two concurrent
 * double-click submits race on the database, not on a read-then-write window,
 * so the loser is reported as a duplicate and never pays for a second run.
 */
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
  );
  if (!decision.allow) return decision;

  const { error: claimError } = await sb.from("build_workspace_ai_runs").insert({
    workspace_id: workspaceId,
    user_id: userId,
    action,
    request_id: requestId,
    status: "running",
  });
  // 23505 = unique violation: a concurrent call already claimed this requestId.
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
  // Observability only — a logging failure must never lose the client's result.
  // Closes the reservation row opened by guardAiRun.
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

// ------------------------------------------------------------- Step 1 and 2

export const analyzeMySite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    workspaceInput
      .extend({ url: z.string().min(1).max(2048), requestId: z.string().min(8).max(64) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceOwner(context.supabase, context.userId, data.workspaceId);

    const checked = checkSiteUrl(data.url);
    if (!checked.ok) fail(400, checked.error);

    const sb = await admin();
    const decision = await guardAiRun(
      sb,
      data.workspaceId,
      context.userId,
      "analyze_site",
      data.requestId,
    );
    if (!decision.allow) {
      if (decision.reason === "duplicate") {
        // Double click / retry of the same submit: return what we already have
        // instead of paying for a second analysis.
        const row = await loadInFlightRow(sb, data.workspaceId);
        if (row?.analysis) {
          return toState(
            sb,
            row,
            data.workspaceId,
            await workspaceName(sb, data.workspaceId),
            true,
          );
        }
        fail(409, "That analysis is already running. Please wait a moment.");
      }
      fail(
        429,
        `You have run several website analyses in the last hour. Try again in ${decision.retryAfterMinutes} minutes.`,
      );
    }

    const startedAt = Date.now();
    let fetched: { finalUrl: string; html: string };
    try {
      // SSRF protection (DNS resolution, private ranges, redirect chain,
      // size and timeout caps) lives in fetchSitePublicHtml.
      fetched = await fetchSitePublicHtml(checked.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "We could not reach that website.";
      await logAiRun(sb, {
        workspaceId: data.workspaceId,
        userId: context.userId,
        action: "analyze_site",
        requestId: data.requestId,
        status: "error",
        latencyMs: Date.now() - startedAt,
        error: `fetch: ${message}`,
      });
      fail(
        400,
        "We could not reach that website. Check the address and try again — nothing has been saved.",
      );
    }

    const { runDeckSiteAnalysis } = await import("@/build/ai/deckSiteAnalysis");
    const result = await runDeckSiteAnalysis(extractSiteText(fetched.html));
    const latencyMs = Date.now() - startedAt;

    if (result.status === "error" || !result.data) {
      await logAiRun(sb, {
        workspaceId: data.workspaceId,
        userId: context.userId,
        action: "analyze_site",
        requestId: data.requestId,
        status: "error",
        latencyMs,
        error: result.error ?? "unknown",
      });
      // Never a mocked fallback: an AI failure is reported as a failure.
      fail(502, "The website analysis did not complete. Nothing was saved — you can run it again.");
    }

    await logAiRun(sb, {
      workspaceId: data.workspaceId,
      userId: context.userId,
      action: "analyze_site",
      requestId: data.requestId,
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

    // This used to be `.upsert(..., { onConflict: "workspace_id" })`, which
    // relied on the UNIQUE constraint that 20260803100000 removed to allow
    // several Intakes per workspace. Left as an upsert it would insert a new
    // row on every analysis. Resolved explicitly instead: update the setup in
    // flight, or start a new one when the previous was published.
    const fields = {
      status: "analyzed",
      site_url: checked.url,
      final_url: fetched.finalUrl,
      analysis: analysis as unknown as Json,
      analyzed_at: analysis.analyzedAt,
      last_analyze_request_id: data.requestId,
      // A re-analysis invalidates a previous confirmation.
      confirmed_business_type: null,
      confirmed_product: null,
    };
    const existing = await loadInFlightRow(sb, data.workspaceId);

    // The insert can still lose a race with a concurrent first analysis; the
    // partial unique index is what makes that a clean 23505 rather than two
    // competing setups.
    const { error: upsertError } = existing
      ? await sb.from("build_workspace_onboarding").update(fields).eq("id", existing.id)
      : await sb
          .from("build_workspace_onboarding")
          .insert({ ...fields, workspace_id: data.workspaceId, created_by: context.userId });
    if (upsertError) {
      if (upsertError.code === "23505") {
        fail(409, "Another setup was just started for this workspace. Reload and continue there.");
      }
      fail(500, upsertError.message);
    }

    const row = await loadInFlightRow(sb, data.workspaceId);
    return toState(sb, row, data.workspaceId, await workspaceName(sb, data.workspaceId), true);
  });

// --------------------------------------------------------------- Step 3 + 4

export const confirmMyDeckProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    workspaceInput
      .extend({
        businessType: z.string().min(1).max(80).optional(),
        product: z.string().min(1).max(80),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceOwner(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();

    const row = await loadInFlightRow(sb, data.workspaceId);
    if (!row) fail(400, "Analyze your website first.");
    const analysis = row.analysis as SiteAnalysis | null;
    if (!analysis) fail(400, "Analyze your website first.");

    const checkedBusinessType = checkBusinessType(data.businessType ?? analysis.businessType);
    if (!checkedBusinessType.ok) fail(400, checkedBusinessType.error);
    const checkedProduct = checkProduct(data.product);
    if (!checkedProduct.ok) fail(400, checkedProduct.error);

    const { error } = await sb
      .from("build_workspace_onboarding")
      .update({
        status: "confirmed",
        confirmed_business_type: checkedBusinessType.value,
        confirmed_product: checkedProduct.value,
      })
      // By row id, not workspace_id: a workspace can now hold published rows
      // too, and those must never be rewritten by an in-flight step.
      .eq("id", row.id);
    if (error) fail(500, error.message);

    const updated = await loadInFlightRow(sb, data.workspaceId);
    return toState(sb, updated, data.workspaceId, await workspaceName(sb, data.workspaceId), true);
  });

export const generateMyDeckDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    workspaceInput.extend({ requestId: z.string().min(8).max(64) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceOwner(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();

    const row = await loadInFlightRow(sb, data.workspaceId);
    if (!row?.confirmed_product || !row.confirmed_business_type) {
      fail(400, "Confirm your product first.");
    }

    const decision = await guardAiRun(
      sb,
      data.workspaceId,
      context.userId,
      "generate_draft",
      data.requestId,
    );
    if (!decision.allow) {
      if (decision.reason === "duplicate" && row.playbook_id) {
        return toState(sb, row, data.workspaceId, await workspaceName(sb, data.workspaceId), true);
      }
      if (decision.reason === "duplicate") {
        fail(409, "Your intake is already being generated. Please wait a moment.");
      }
      fail(
        429,
        `You have generated several drafts in the last hour. Try again in ${decision.retryAfterMinutes} minutes.`,
      );
    }

    const startedAt = Date.now();
    const { runPlaybookDraftGeneration } = await import("@/build/ai/playbookDraftGeneration");
    const result = await runPlaybookDraftGeneration(
      row.confirmed_business_type,
      row.confirmed_product,
    );
    const latencyMs = Date.now() - startedAt;

    if (result.status === "error" || !result.data) {
      await logAiRun(sb, {
        workspaceId: data.workspaceId,
        userId: context.userId,
        action: "generate_draft",
        requestId: data.requestId,
        status: "error",
        latencyMs,
        error: result.error ?? "unknown",
      });
      fail(
        502,
        "We could not generate your project intake. Nothing was saved — you can try again.",
      );
    }

    await logAiRun(sb, {
      workspaceId: data.workspaceId,
      userId: context.userId,
      action: "generate_draft",
      requestId: data.requestId,
      status: "ok",
      latencyMs,
    });

    // Structural validity is guaranteed in code, not by the model.
    const draftSchema = expandPlaybookDraft(
      result.data,
      row.confirmed_business_type,
      row.confirmed_product,
    );

    const nextVersion = (row.draft_version ?? 0) + 1;
    // Identity only. This string is copied verbatim into
    // build_missions.playbook_name at publish time and shown to the customer,
    // so baking the lifecycle ("draft") and the redraft counter into it made a
    // live Mission read "Deck intake — draft v1" forever. The real state comes
    // from the Mission's own status, and the real version from
    // build_playbook_versions.version_number — `nextVersion` below is the
    // redraft counter, which is a different number and internal only.
    const name = `${row.confirmed_product} intake`;
    let playbookId = row.playbook_id;

    if (playbookId) {
      const { error } = await sb
        .from("build_playbooks")
        .update({ name, draft_schema: draftSchema as unknown as Json })
        .eq("id", playbookId)
        .eq("workspace_id", data.workspaceId);
      if (error) fail(500, error.message);
    } else {
      const { data: created, error } = await sb
        .from("build_playbooks")
        .insert({
          name,
          description: `Self-service draft generated for ${row.confirmed_business_type} / ${row.confirmed_product}.`,
          project_type: row.confirmed_product,
          workspace_id: data.workspaceId,
          draft_schema: draftSchema as unknown as Json,
          created_by: context.userId,
          is_active: false,
          // published_version_id stays NULL: never publicly reachable, and
          // no Mission can be pinned to it until someone publishes it.
        })
        .select("id")
        .maybeSingle();
      if (error) fail(500, error.message);
      if (!created) fail(500, "Draft creation failed.");
      playbookId = created.id;
    }

    const branding =
      row.branding && Object.keys(row.branding).length > 0
        ? (row.branding as unknown as Branding)
        : defaultBranding(await workspaceName(sb, data.workspaceId), row.confirmed_product);

    const { error: updateError } = await sb
      .from("build_workspace_onboarding")
      .update({
        status: "draft_ready",
        playbook_id: playbookId,
        draft_version: nextVersion,
        branding: branding as unknown as Json,
        last_generate_request_id: data.requestId,
      })
      .eq("id", row.id);
    if (updateError) fail(500, updateError.message);

    const updated = await loadInFlightRow(sb, data.workspaceId);
    return toState(sb, updated, data.workspaceId, await workspaceName(sb, data.workspaceId), true);
  });

// ------------------------------------------------------------------- Step 5

export const updateMyBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    workspaceInput
      .extend({
        displayName: z.string().max(200).optional(),
        accentColor: z.string().max(20).optional(),
        introTitle: z.string().max(400).optional(),
        introText: z.string().max(1000).optional(),
        ctaLabel: z.string().max(120).optional(),
        logoPath: z.string().max(400).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceOwner(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();

    const row = await loadInFlightRow(sb, data.workspaceId);
    if (!row) fail(400, "Start your setup first.");

    const name = await workspaceName(sb, data.workspaceId);
    const fallback =
      row.branding && Object.keys(row.branding).length > 0
        ? (row.branding as unknown as Branding)
        : defaultBranding(name, row.confirmed_product ?? "Deck");

    const { workspaceId: _ws, ...fields } = data;
    const checked = checkBranding(fields, fallback);
    if (!checked.ok) fail(400, checked.error);

    const { error } = await sb
      .from("build_workspace_onboarding")
      .update({ branding: checked.branding as unknown as Json })
      .eq("id", row.id);
    if (error) fail(500, error.message);

    const updated = await loadInFlightRow(sb, data.workspaceId);
    return toState(sb, updated, data.workspaceId, name, true);
  });

/** Read-only preview of the draft intake. Members can look, nothing is published. */
export const getMyDraftPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => workspaceInput.parse(data))
  .handler(async ({ context, data }): Promise<{ schema: PlaybookSchema; published: false }> => {
    await assertWorkspaceMember(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();

    const row = await loadDisplayRow(sb, data.workspaceId);
    if (!row?.playbook_id) fail(404, "No draft yet.");

    const { data: playbook, error } = await sb
      .from("build_playbooks")
      .select("draft_schema, published_version_id, workspace_id")
      .eq("id", row.playbook_id)
      .maybeSingle();
    if (error) fail(500, error.message);
    // Defence in depth: never serve a Playbook that is not this workspace's.
    if (!playbook || playbook.workspace_id !== data.workspaceId) {
      fail(404, "No draft yet.");
    }

    const parsed = playbookSchema.safeParse(playbook.draft_schema);
    if (!parsed.success) fail(500, "This draft is not readable yet.");
    return { schema: parsed.data, published: false };
  });

// ------------------------------------------------------------------- LOT 3
//
// Explicit, owner-only, self-service publish: turns the private draft into
// a live Mission. Validation remains here for readable schema errors, but
// every write runs inside publish_workspace_onboarding(): onboarding lock,
// workspace quota check, version insert, Mission insert with unique
// source_onboarding_id, and onboarding->Mission link.

function publishRpcStatus(message: string): number {
  if (message.includes("changed while publishing")) return 409;
  if (message.includes("active Mission limit")) return 400;
  if (
    message.includes("Start your setup") ||
    message.includes("Generate your project intake draft") ||
    message.includes("No draft to publish") ||
    message.includes("Mission name is required")
  ) {
    return 400;
  }
  if (message.includes("Published onboarding points")) return 409;
  return 500;
}

export const publishMyDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    workspaceInput.extend({ requestId: z.string().min(8).max(64) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceOwner(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();

    const row = await loadInFlightRow(sb, data.workspaceId);

    // No setup in flight means this publish already succeeded and the caller
    // is retrying (double click, lost response). Return the Mission it
    // produced rather than erroring — the same idempotency the old
    // "row.status === published" branch gave, which loadInFlightRow can no
    // longer see now that it filters published rows out.
    if (!row) {
      const published = await loadDisplayRow(sb, data.workspaceId);
      if (published?.mission_id) {
        return toState(
          sb,
          published,
          data.workspaceId,
          await workspaceName(sb, data.workspaceId),
          true,
        );
      }
      fail(400, "Start your setup first.");
    }

    // Billing gate. Deliberately after the already-published short-circuit: a
    // frozen workspace must still be able to re-read the Intake it published
    // while entitled, it just cannot put a new one live.
    await assertCanPublish(data.workspaceId);

    if (!row.playbook_id) {
      fail(400, "Generate your project intake draft first.");
    }

    const { data: playbook, error: playbookError } = await sb
      .from("build_playbooks")
      .select("draft_schema, name, workspace_id")
      .eq("id", row.playbook_id)
      .maybeSingle();
    if (playbookError) fail(500, playbookError.message);
    if (!playbook || playbook.workspace_id !== data.workspaceId) {
      fail(404, "No draft to publish.");
    }

    const parsedSchema = playbookSchema.safeParse(playbook.draft_schema);
    if (!parsedSchema.success) {
      fail(400, "This draft is not valid and cannot be published yet.");
    }
    const issues = getPlaybookPublishIssues(parsedSchema.data);
    if (issues.length > 0) {
      fail(400, `This draft is not ready to publish yet: ${issues.join(" ")}`);
    }

    const branding =
      row.branding && Object.keys(row.branding).length > 0
        ? (row.branding as unknown as Branding)
        : defaultBranding(
            await workspaceName(sb, data.workspaceId),
            row.confirmed_product ?? "Deck",
          );

    const missionName = `${branding.displayName} — ${row.confirmed_product ?? "Deck"} Intake`;
    const { error: publishError } = await sb.rpc("publish_workspace_onboarding", {
      p_workspace_id: data.workspaceId,
      p_playbook_id: row.playbook_id,
      p_validated_draft_schema: parsedSchema.data as unknown as Json,
      p_published_by: context.userId,
      p_mission_name: missionName,
    });
    if (publishError) fail(publishRpcStatus(publishError.message), publishError.message);

    const updated = await loadDisplayRow(sb, data.workspaceId);
    return toState(sb, updated, data.workspaceId, await workspaceName(sb, data.workspaceId), true);
  });
