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
import { assertWorkspaceMember, assertWorkspaceOwner } from "./workspaceAuth.server";
import { fetchSitePublicHtml } from "@/build/onboarding/safeFetch.server";
import { extractSiteText } from "@/build/onboarding/extractText";
import { expandPlaybookDraft } from "@/build/onboarding/expandPlaybookDraft";
import { playbookSchema, type PlaybookSchema } from "@/build/schema/playbook";
import {
  checkAiRun,
  checkBranding,
  checkSiteUrl,
  defaultBranding,
  isAcceptableProduct,
  resolveDeckEligibility,
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
  /** Always false in this lot: this flow cannot publish. */
  draftPublished: boolean;
  branding: Branding | null;
  isOwner: boolean;
}

async function loadRow(sb: Supa, workspaceId: string) {
  const { data, error } = await sb
    .from("build_workspace_onboarding")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Response(error.message, { status: 500 });
  return data;
}

async function workspaceName(sb: Supa, workspaceId: string): Promise<string> {
  const { data } = await sb.from("build_workspaces").select("name").eq("id", workspaceId).maybeSingle();
  return data?.name ?? "My business";
}

function toState(
  row: Awaited<ReturnType<typeof loadRow>>,
  workspaceId: string,
  name: string,
  isOwner: boolean,
): PortalOnboardingState {
  return {
    workspaceId,
    workspaceName: name,
    status: (row?.status as OnboardingStatus | undefined) ?? "started",
    siteUrl: row?.final_url ?? row?.site_url ?? null,
    analysis: (row?.analysis as SiteAnalysis | null) ?? null,
    confirmedBusinessType: row?.confirmed_business_type ?? null,
    confirmedProduct: row?.confirmed_product ?? null,
    draftPlaybookId: row?.playbook_id ?? null,
    draftVersion: row?.draft_version ?? 0,
    draftPublished: false,
    branding: row && row.branding && Object.keys(row.branding).length > 0
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
    const { role } = await assertWorkspaceMember(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();
    const row = await loadRow(sb, data.workspaceId);
    return toState(row, data.workspaceId, await workspaceName(sb, data.workspaceId), role === "owner");
  });

// ------------------------------------------------------------ AI accounting

async function guardAiRun(sb: Supa, workspaceId: string, action: string, requestId: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: runs, error } = await sb
    .from("build_workspace_ai_runs")
    .select("request_id, created_at")
    .eq("workspace_id", workspaceId)
    .eq("action", action)
    .gte("created_at", since);
  if (error) throw new Response(error.message, { status: 500 });

  return checkAiRun(
    (runs ?? []).map((r) => ({ requestId: r.request_id, createdAt: r.created_at })),
    requestId,
    new Date(),
  );
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
  await sb.from("build_workspace_ai_runs").insert({
    workspace_id: fields.workspaceId,
    user_id: fields.userId,
    action: fields.action,
    request_id: fields.requestId,
    status: fields.status,
    latency_ms: fields.latencyMs,
    error: fields.error?.slice(0, 500) ?? null,
  });
}

// ------------------------------------------------------------- Step 1 and 2

export const analyzeMySite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    workspaceInput.extend({ url: z.string().min(1).max(2048), requestId: z.string().min(8).max(64) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceOwner(context.supabase, context.userId, data.workspaceId);

    const checked = checkSiteUrl(data.url);
    if (!checked.ok) throw new Response(checked.error, { status: 400 });

    const sb = await admin();
    const decision = await guardAiRun(sb, data.workspaceId, "analyze_site", data.requestId);
    if (!decision.allow) {
      if (decision.reason === "duplicate") {
        // Double click / retry of the same submit: return what we already have
        // instead of paying for a second analysis.
        const row = await loadRow(sb, data.workspaceId);
        if (row?.analysis) {
          return toState(row, data.workspaceId, await workspaceName(sb, data.workspaceId), true);
        }
        throw new Response("That analysis is already running. Please wait a moment.", { status: 409 });
      }
      throw new Response(
        `You have run several website analyses in the last hour. Try again in ${decision.retryAfterMinutes} minutes.`,
        { status: 429 },
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
      throw new Response(
        "We could not reach that website. Check the address and try again — nothing has been saved.",
        { status: 400 },
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
      throw new Response(
        "The website analysis did not complete. Nothing was saved — you can run it again.",
        { status: 502 },
      );
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

    const { error: upsertError } = await sb.from("build_workspace_onboarding").upsert(
      {
        workspace_id: data.workspaceId,
        created_by: context.userId,
        status: "analyzed",
        site_url: checked.url,
        final_url: fetched.finalUrl,
        analysis: analysis as unknown as Json,
        analyzed_at: analysis.analyzedAt,
        last_analyze_request_id: data.requestId,
        // A re-analysis invalidates a previous confirmation.
        confirmed_business_type: null,
        confirmed_product: null,
      },
      { onConflict: "workspace_id" },
    );
    if (upsertError) throw new Response(upsertError.message, { status: 500 });

    const row = await loadRow(sb, data.workspaceId);
    return toState(row, data.workspaceId, await workspaceName(sb, data.workspaceId), true);
  });

// --------------------------------------------------------------- Step 3 + 4

export const confirmMyDeckProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    workspaceInput.extend({ product: z.string().min(1).max(80) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceOwner(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();

    const row = await loadRow(sb, data.workspaceId);
    const analysis = row?.analysis as SiteAnalysis | null;
    if (!analysis) throw new Response("Analyze your website first.", { status: 400 });

    const eligibility = resolveDeckEligibility(analysis);
    if (!eligibility.eligible) throw new Response(eligibility.reason, { status: 400 });
    if (!isAcceptableProduct(data.product)) {
      throw new Response(
        "The current version of Métré Build supports deck projects only. Pick one of the suggested deck products.",
        { status: 400 },
      );
    }

    const { error } = await sb
      .from("build_workspace_onboarding")
      .update({
        status: "confirmed",
        confirmed_business_type: analysis.businessType,
        confirmed_product: data.product.trim(),
      })
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Response(error.message, { status: 500 });

    const updated = await loadRow(sb, data.workspaceId);
    return toState(updated, data.workspaceId, await workspaceName(sb, data.workspaceId), true);
  });

export const generateMyDeckDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    workspaceInput.extend({ requestId: z.string().min(8).max(64) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceOwner(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();

    const row = await loadRow(sb, data.workspaceId);
    if (!row?.confirmed_product || !row.confirmed_business_type) {
      throw new Response("Confirm your deck product first.", { status: 400 });
    }

    const decision = await guardAiRun(sb, data.workspaceId, "generate_draft", data.requestId);
    if (!decision.allow) {
      if (decision.reason === "duplicate" && row.playbook_id) {
        return toState(row, data.workspaceId, await workspaceName(sb, data.workspaceId), true);
      }
      if (decision.reason === "duplicate") {
        throw new Response("Your intake is already being generated. Please wait a moment.", { status: 409 });
      }
      throw new Response(
        `You have generated several drafts in the last hour. Try again in ${decision.retryAfterMinutes} minutes.`,
        { status: 429 },
      );
    }

    const startedAt = Date.now();
    const { runPlaybookDraftGeneration } = await import("@/build/ai/playbookDraftGeneration");
    const result = await runPlaybookDraftGeneration(row.confirmed_business_type, row.confirmed_product);
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
      throw new Response(
        "We could not generate your project intake. Nothing was saved — you can try again.",
        { status: 502 },
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
    const name = `${row.confirmed_product} intake — draft v${nextVersion}`;
    let playbookId = row.playbook_id;

    if (playbookId) {
      const { error } = await sb
        .from("build_playbooks")
        .update({ name, draft_schema: draftSchema as unknown as Json })
        .eq("id", playbookId)
        .eq("workspace_id", data.workspaceId);
      if (error) throw new Response(error.message, { status: 500 });
    } else {
      const { data: created, error } = await sb
        .from("build_playbooks")
        .insert({
          name,
          description: `Self-service draft generated for ${row.confirmed_business_type} / ${row.confirmed_product}.`,
          project_type: `deck ${row.confirmed_product}`,
          workspace_id: data.workspaceId,
          draft_schema: draftSchema as unknown as Json,
          created_by: context.userId,
          is_active: false,
          // published_version_id stays NULL: never publicly reachable, and
          // no Mission can be pinned to it until someone publishes it.
        })
        .select("id")
        .maybeSingle();
      if (error) throw new Response(error.message, { status: 500 });
      if (!created) throw new Response("Draft creation failed.", { status: 500 });
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
      .eq("workspace_id", data.workspaceId);
    if (updateError) throw new Response(updateError.message, { status: 500 });

    const updated = await loadRow(sb, data.workspaceId);
    return toState(updated, data.workspaceId, await workspaceName(sb, data.workspaceId), true);
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

    const row = await loadRow(sb, data.workspaceId);
    if (!row) throw new Response("Start your setup first.", { status: 400 });

    const name = await workspaceName(sb, data.workspaceId);
    const fallback =
      row.branding && Object.keys(row.branding).length > 0
        ? (row.branding as unknown as Branding)
        : defaultBranding(name, row.confirmed_product ?? "Deck");

    const { workspaceId: _ws, ...fields } = data;
    const checked = checkBranding(fields, fallback);
    if (!checked.ok) throw new Response(checked.error, { status: 400 });

    const { error } = await sb
      .from("build_workspace_onboarding")
      .update({ branding: checked.branding as unknown as Json })
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Response(error.message, { status: 500 });

    const updated = await loadRow(sb, data.workspaceId);
    return toState(updated, data.workspaceId, name, true);
  });

/** Read-only preview of the draft intake. Members can look, nothing is published. */
export const getMyDraftPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => workspaceInput.parse(data))
  .handler(async ({ context, data }): Promise<{ schema: PlaybookSchema; published: false }> => {
    await assertWorkspaceMember(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();

    const row = await loadRow(sb, data.workspaceId);
    if (!row?.playbook_id) throw new Response("No draft yet.", { status: 404 });

    const { data: playbook, error } = await sb
      .from("build_playbooks")
      .select("draft_schema, published_version_id, workspace_id")
      .eq("id", row.playbook_id)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    // Defence in depth: never serve a Playbook that is not this workspace's.
    if (!playbook || playbook.workspace_id !== data.workspaceId) {
      throw new Response("No draft yet.", { status: 404 });
    }

    const parsed = playbookSchema.safeParse(playbook.draft_schema);
    if (!parsed.success) throw new Response("This draft is not readable yet.", { status: 500 });
    return { schema: parsed.data, published: false };
  });
