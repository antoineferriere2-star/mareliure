/**
 * Seeded, self-tearing-down fixtures for the visitor-summary visual-preview
 * E2E suite (e2e/visitor-summary-visual-preview.spec.ts).
 *
 * This project has only ONE Supabase project — the real production one
 * (confirmed with the project owner; see e2e/README.md). There is no
 * separate staging database. Every row created here is therefore created
 * with a unique, clearly-tagged "E2E TEST —" name and MUST be deleted by
 * `teardownDeckPreviewFixtures` at the end of the run — never left behind.
 * Deletion is scoped strictly to the exact IDs this module created; it
 * never deletes by name pattern or any broad query, so a partial/failed
 * provision can never cascade into deleting unrelated data.
 *
 * Reuses the already-published Deck Playbook version (DECK_PLAYBOOK_ID)
 * rather than creating a new Playbook — this Playbook is already public,
 * non-sensitive, and shared with the existing demo Mission.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import type { Database, Json } from "../../src/integrations/supabase/types";
import { DECK_PLAYBOOK_ID } from "../../src/build/constants";

export function hasSupabaseAdminCredentials(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function adminClient() {
  if (!hasSupabaseAdminCredentials()) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are required to seed E2E fixtures.");
  }
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export interface DeckPreviewFixtures {
  workspaceId: string;
  /** Newly created Mission with the visual-preview capability explicitly enabled. */
  missionEnabledId: string;
  missionEnabledToken: string;
  /**
   * Newly created Mission WITHOUT the capability — stands in for "an
   * existing Mission that predates this feature" without ever touching a
   * real customer's actual Mission.
   */
  missionDisabledId: string;
  missionDisabledToken: string;
}

export async function provisionDeckPreviewFixtures(): Promise<DeckPreviewFixtures> {
  const supabase = adminClient();

  const { data: playbook, error: playbookErr } = await supabase
    .from("build_playbooks")
    .select("published_version_id")
    .eq("id", DECK_PLAYBOOK_ID)
    .maybeSingle();
  if (playbookErr) throw playbookErr;
  if (!playbook?.published_version_id) {
    throw new Error(
      "Deck Playbook has no published version in this Supabase project — run `npm run seed:deck` once before this suite.",
    );
  }
  const versionId = playbook.published_version_id;
  const suffix = randomUUID().slice(0, 8);

  const { data: workspace, error: wsErr } = await supabase
    .from("build_workspaces")
    .insert({ name: `E2E TEST — Deck Visual Preview (${suffix})` })
    .select("id")
    .single();
  if (wsErr) throw wsErr;

  const missionEnabledToken = `e2e-test-preview-on-${suffix}`;
  const { data: missionEnabled, error: meErr } = await supabase
    .from("build_missions")
    .insert({
      name: `E2E TEST — Deck (preview enabled) ${suffix}`,
      workspace_id: workspace.id,
      playbook_id: DECK_PLAYBOOK_ID,
      playbook_version_id: versionId,
      status: "active",
      public_token: missionEnabledToken,
      published_at: new Date().toISOString(),
      proposal: {
        visualPreview: { enabled: true, type: "simple-deck-3d", version: 1 },
      } as unknown as Json,
    })
    .select("id")
    .single();
  if (meErr) throw meErr;

  const missionDisabledToken = `e2e-test-preview-off-${suffix}`;
  const { data: missionDisabled, error: mdErr } = await supabase
    .from("build_missions")
    .insert({
      name: `E2E TEST — Deck (preview disabled, legacy-shaped) ${suffix}`,
      workspace_id: workspace.id,
      playbook_id: DECK_PLAYBOOK_ID,
      playbook_version_id: versionId,
      status: "active",
      public_token: missionDisabledToken,
      published_at: new Date().toISOString(),
      // No `proposal` at all — simulates a Mission that predates this feature.
    })
    .select("id")
    .single();
  if (mdErr) throw mdErr;

  return {
    workspaceId: workspace.id,
    missionEnabledId: missionEnabled.id,
    missionEnabledToken,
    missionDisabledId: missionDisabled.id,
    missionDisabledToken,
  };
}

/** Inserts a dossier with a deliberately corrupted visualPreview snapshot, for the render-error-isolation test. Returns a fresh secure-summary access token pointing at it. */
export async function seedCorruptedPreviewDossier(
  fixtures: DeckPreviewFixtures,
): Promise<{ dossierId: string; accessToken: string }> {
  const supabase = adminClient();
  const { hashAccessToken, generateAccessToken, accessTokenExpiryFromNow } =
    await import("../../src/build/services/dossierAccessToken.server");

  const corruptedSummary = {
    version: 1,
    locale: "en-US",
    measurementSystem: "imperial",
    businessName: "E2E Test",
    summary: "Corrupted preview regression fixture.",
    confirmedItems: [],
    calculatedItems: [],
    itemsToConfirm: [],
    budgetAndTimingItems: [],
    photos: [],
    confirmationText: null,
    submittedAt: new Date().toISOString(),
    // Deliberately malformed: status says "complete" but params is missing
    // the dimensions object DeckVisualPreview's render path reads from —
    // this must throw during render and be caught by the error boundary,
    // never take down the rest of the page.
    visualPreview: { version: 1, resolution: { status: "complete", params: {} } },
  } as unknown as Json;

  const { data: dossier, error: dErr } = await supabase
    .from("build_dossiers")
    .insert({
      workspace_id: fixtures.workspaceId,
      mission_id: fixtures.missionEnabledId,
      status: "ready",
      summary: "E2E corrupted-preview fixture",
      content: {} as unknown as Json,
      visitor_summary: corruptedSummary,
    })
    .select("id")
    .single();
  if (dErr) throw dErr;

  const rawToken = generateAccessToken();
  const { error: tokenErr } = await supabase.from("build_dossier_access_tokens").insert({
    dossier_id: dossier.id,
    token_hash: hashAccessToken(rawToken),
    expires_at: accessTokenExpiryFromNow(),
  });
  if (tokenErr) throw tokenErr;

  return { dossierId: dossier.id, accessToken: rawToken };
}

export async function teardownDeckPreviewFixtures(fixtures: DeckPreviewFixtures): Promise<void> {
  const supabase = adminClient();
  for (const missionId of [fixtures.missionEnabledId, fixtures.missionDisabledId]) {
    const { data: dossiers } = await supabase
      .from("build_dossiers")
      .select("id")
      .eq("mission_id", missionId);
    const dossierIds = (dossiers ?? []).map((d) => d.id);
    if (dossierIds.length > 0) {
      await supabase.from("build_dossier_access_tokens").delete().in("dossier_id", dossierIds);
      await supabase.from("build_dossiers").delete().in("id", dossierIds);
    }

    const { data: sessions } = await supabase
      .from("build_runtime_sessions")
      .select("id")
      .eq("mission_id", missionId);
    const sessionIds = (sessions ?? []).map((s) => s.id);
    if (sessionIds.length > 0) {
      await supabase.from("build_runtime_sessions").delete().in("id", sessionIds);
    }

    await supabase.from("build_missions").delete().eq("id", missionId);
  }
  await supabase.from("build_workspaces").delete().eq("id", fixtures.workspaceId);
}
