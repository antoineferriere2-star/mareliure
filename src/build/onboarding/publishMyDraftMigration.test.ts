import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260727123000_onboarding_publish_atomic.sql"),
  "utf8",
);
const server = readFileSync(
  join(process.cwd(), "src/build/services/portalOnboarding.data.functions.ts"),
  "utf8",
);

function indexOfSql(fragment: string): number {
  const index = migration.indexOf(fragment);
  expect(index, `Missing SQL fragment: ${fragment}`).toBeGreaterThanOrEqual(0);
  return index;
}

describe("publishMyDraft atomic publish contract", () => {
  it("publishes normal drafts inside one RPC transaction", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.publish_workspace_onboarding");
    expect(migration).toContain("INSERT INTO public.build_playbook_versions");
    expect(migration).toContain("INSERT INTO public.build_missions");
    expect(migration).toContain("UPDATE public.build_workspace_onboarding");
    expect(migration).toContain("SELECT v_mission_id, v_version_id, FALSE");
  });

  it("serializes double clicks and truly concurrent publish attempts", () => {
    expect(migration).toContain("WHERE workspace_id = p_workspace_id");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("build_missions_source_onboarding_uidx");
    expect(migration).toContain("WHERE source_onboarding_id IS NOT NULL");
  });

  it("returns an existing Mission on sequential retries without inserting a new version", () => {
    const existingByStatus = indexOfSql("v_onboarding.status = 'published'");
    const existingBySource = indexOfSql("WHERE source_onboarding_id = v_onboarding.id");
    const insertVersion = indexOfSql("INSERT INTO public.build_playbook_versions");

    expect(existingByStatus).toBeLessThan(insertVersion);
    expect(existingBySource).toBeLessThan(insertVersion);
    expect(migration).toContain(
      "SELECT v_existing_mission.id, v_existing_mission.playbook_version_id, TRUE",
    );
  });

  it("checks active Mission quota before changing Playbook, Mission, or onboarding state", () => {
    const lockWorkspace = indexOfSql("FROM public.build_workspaces");
    const countActive = indexOfSql(
      "WHERE workspace_id = p_workspace_id\n      AND status = 'active'",
    );
    const quotaBlock = indexOfSql("v_active_count >= v_workspace.max_active_missions");
    const insertVersion = indexOfSql("INSERT INTO public.build_playbook_versions");

    expect(lockWorkspace).toBeLessThan(countActive);
    expect(countActive).toBeLessThan(quotaBlock);
    expect(quotaBlock).toBeLessThan(insertVersion);
  });

  it("refuses owner bypasses, member publishes, and other-workspace drafts in the server layer", () => {
    const publishBlock = server.slice(server.indexOf("export const publishMyDraft"));
    const ownerCheck = publishBlock.indexOf(
      "assertWorkspaceOwner(context.supabase, context.userId, data.workspaceId)",
    );
    const adminClient = publishBlock.indexOf("const sb = await admin()");
    const workspaceCheck = publishBlock.indexOf("playbook.workspace_id !== data.workspaceId");
    const rpcCall = publishBlock.indexOf('sb.rpc("publish_workspace_onboarding"');

    expect(ownerCheck).toBeGreaterThanOrEqual(0);
    expect(ownerCheck).toBeLessThan(adminClient);
    expect(workspaceCheck).toBeGreaterThan(ownerCheck);
    expect(workspaceCheck).toBeLessThan(rpcCall);
  });

  it("prevents draft changes between validation and the transaction write", () => {
    expect(server).toContain("getPlaybookPublishIssues(parsedSchema.data)");
    expect(server).toContain("p_validated_draft_schema: parsedSchema.data as unknown as Json");
    expect(migration).toContain("v_playbook.draft_schema <> p_validated_draft_schema");
  });

  it("does not introduce a durable publishing state or silently delete existing duplicates", () => {
    expect(migration).not.toContain("status = 'publishing'");
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).toContain("RAISE EXCEPTION 'Cannot add onboarding publish provenance:");
  });

  it("limits RPC execution privileges to the service role", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.publish_workspace_onboarding(UUID, UUID, JSONB, UUID, TEXT)",
    );
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.publish_workspace_onboarding");
    expect(migration).toContain("TO service_role");
  });
});
