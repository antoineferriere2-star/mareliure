// Server functions for the onboarding wizard (/build/onboarding): analyze a
// client's public website, then create+publish the resulting Mission in one
// step. Same admin-only gating as admin.data.functions.ts. AI/Gateway
// imports are dynamic inside handlers so their server-only credentials never
// reach the client bundle — this file itself is not suffixed .server.ts and
// its module graph is analyzed for the client stub.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { admin, assertAdmin } from "./adminAuth.server";
import { fetchSitePublicHtml } from "@/build/onboarding/safeFetch.server";
import { extractSiteText } from "@/build/onboarding/extractText";
import { missionProposalSchema } from "@/build/schema/missionProposal";
import { playbookSchema } from "@/build/schema/playbook";
import { expandPlaybookDraft } from "@/build/onboarding/expandPlaybookDraft";

export const analyzeOnboardingSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ url: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    let fetched: { finalUrl: string; html: string };
    try {
      fetched = await fetchSitePublicHtml(data.url);
    } catch (err) {
      throw new Response(err instanceof Error ? err.message : "Impossible de récupérer ce site.", { status: 400 });
    }

    const extracted = extractSiteText(fetched.html);
    const { runOnboardingExtraction } = await import("@/build/ai/onboardingExtraction");
    const result = await runOnboardingExtraction(extracted);

    if (result.status === "error" || !result.data) {
      throw new Response(result.error ?? "Extraction IA impossible.", { status: 502 });
    }

    return {
      finalUrl: fetched.finalUrl,
      businessTypeCandidates: result.data.businessTypeCandidates,
      products: result.data.products,
    };
  });

/** Published schema for the wizard's preview step — the exact version the Mission would be pinned to, not the mutable draft. */
export const getPublishedPlaybookSchema = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ playbookId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();

    const { data: playbook, error: playbookError } = await sb
      .from("build_playbooks")
      .select("published_version_id")
      .eq("id", data.playbookId)
      .maybeSingle();
    if (playbookError) throw new Response(playbookError.message, { status: 500 });
    if (!playbook?.published_version_id) {
      throw new Response("Ce Playbook n'a pas de version publiée.", { status: 400 });
    }

    const { data: version, error: versionError } = await sb
      .from("build_playbook_versions")
      .select("schema")
      .eq("id", playbook.published_version_id)
      .maybeSingle();
    if (versionError) throw new Response(versionError.message, { status: 500 });
    if (!version) throw new Response("Version publiée introuvable.", { status: 404 });

    const parsed = playbookSchema.safeParse(version.schema);
    if (!parsed.success) throw new Response("Schéma de Playbook invalide.", { status: 500 });
    return parsed.data;
  });

/**
 * When no published Playbook matches the detected business type/product,
 * generate a draft one instead of leaving the admin stuck. Always saved
 * unpublished (published_version_id stays null) — the admin must review,
 * adjust and publish it via the ordinary Playbook editor before it can ever
 * be matched to a real Mission (CLAUDE.md: the AI proposes, it never
 * decides for the commercial).
 */
export const generatePlaybookFromAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ businessType: z.string().min(1), product: z.string().min(1) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const { runPlaybookDraftGeneration } = await import("@/build/ai/playbookDraftGeneration");
    const result = await runPlaybookDraftGeneration(data.businessType, data.product);
    if (result.status === "error" || !result.data) {
      throw new Response(result.error ?? "Génération IA impossible.", { status: 502 });
    }

    const draftSchema = expandPlaybookDraft(result.data, data.businessType, data.product);

    const sb = await admin();
    const { data: playbook, error } = await sb
      .from("build_playbooks")
      .insert({
        name: `${data.product} — v1`,
        description: `Brouillon généré par IA pour ${data.businessType} / ${data.product}.`,
        project_type: `${data.businessType} ${data.product}`,
        draft_schema: draftSchema as unknown as Json,
        created_by: context.userId,
      })
      .select()
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!playbook) throw new Response("Playbook creation failed.", { status: 500 });
    return playbook;
  });

export const createAndPublishMissionFromOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        playbookId: z.string().uuid(),
        name: z.string().min(2).max(200),
        objective: z.string().max(1000).optional().nullable(),
        proposal: missionProposalSchema.optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();

    const { data: playbook, error: playbookError } = await sb
      .from("build_playbooks")
      .select("id, name, published_version_id, is_active")
      .eq("id", data.playbookId)
      .maybeSingle();
    if (playbookError) throw new Response(playbookError.message, { status: 500 });
    if (!playbook || !playbook.is_active || !playbook.published_version_id) {
      throw new Response("Ce Playbook n'a pas de version publiée active.", { status: 400 });
    }

    const { data: mission, error } = await sb
      .from("build_missions")
      .insert({
        name: data.name,
        objective: data.objective ?? null,
        playbook_id: playbook.id,
        playbook_version_id: playbook.published_version_id,
        playbook_name: playbook.name,
        proposal: (data.proposal ?? null) as unknown as Json,
        status: "active",
        public_token: crypto.randomUUID().replace(/-/g, ""),
        published_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    return mission;
  });
