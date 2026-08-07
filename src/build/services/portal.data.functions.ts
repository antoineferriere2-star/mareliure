// Server functions for the Espace Client portal (/portal/*): a workspace
// member's own view of the Dossiers Commerciaux produced by their Missions.
// Never admin-only — gated by workspace membership via assertWorkspaceMember,
// not assertAdmin. Same service-role-client-after-authorization pattern as
// admin.data.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { admin } from "./adminAuth.server";
import { fail } from "./serverError";
import { assertWorkspaceMember, assertWorkspaceOwner } from "./workspaceAuth.server";
import { getWorkspaceUsageInternal } from "./workspaceUsage.server";
import { assertCanPublish, getWorkspaceEntitlements } from "./workspaceEntitlements.server";
import { wouldExceedActiveMissions } from "@/build/billing/quota";
import { extractPhotoReferences } from "@/build/engine/visitorSummary";
import type { Answers } from "@/build/schema/answers";
import type { DisplayPhotoReference } from "@/build/schema/visitorSummary";
import { INSPIRATION_PHOTOS_BUCKET } from "@/build/storage/inspirationPhotosBucket";

/** Long enough to read a Dossier without reloading, short enough that a copied URL dies quickly. */
const SIGNED_PHOTO_URL_TTL_SECONDS = 3600;

const COMMERCIAL_STATUSES = ["nouveau", "contacte", "devise", "gagne", "perdu"] as const;
export type CommercialStatus = (typeof COMMERCIAL_STATUSES)[number];

export const listMyWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const { data: memberships, error } = await sb
      .from("build_workspace_members")
      .select("workspace_id, role")
      .eq("user_id", context.userId);
    if (error) fail(500, error.message);
    if (!memberships || memberships.length === 0) return [];

    const { data: workspaces, error: wErr } = await sb
      .from("build_workspaces")
      .select("id, name")
      .in(
        "id",
        memberships.map((m) => m.workspace_id),
      )
      .eq("is_active", true);
    if (wErr) fail(500, wErr.message);

    const roleByWorkspace = new Map(memberships.map((m) => [m.workspace_id, m.role]));
    return (workspaces ?? []).map((w) => ({ ...w, role: roleByWorkspace.get(w.id) ?? "member" }));
  });

export const listWorkspaceDossiers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertWorkspaceMember(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();
    const { data: dossiers, error } = await sb
      .from("build_dossiers")
      .select("id, summary, commercial_status, mission_id, created_at, last_activity_at")
      .eq("workspace_id", data.workspaceId)
      .order("last_activity_at", { ascending: false })
      .limit(200);
    if (error) fail(500, error.message);
    return dossiers ?? [];
  });

/**
 * Missions belonging to the workspace, with the number of Dossiers each one
 * has produced. Reading is open to any member; pausing/reactivating below is
 * owner-only. Editing the Playbook itself still requires the technical
 * editor and stays admin-only — this is only the on/off switch.
 */
export const listWorkspaceMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertWorkspaceMember(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();
    const { data: missions, error } = await sb
      .from("build_missions")
      .select(
        "id, name, status, playbook_name, playbook_version_id, public_token, public_token_revoked_at, published_at, created_at",
      )
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) fail(500, error.message);

    // The published version number, so the portal can show a real "v3"
    // instead of the redraft counter that used to be baked into
    // playbook_name. Fetched separately rather than as an embedded select to
    // stay consistent with the dossier count below.
    const versionIds = [
      ...new Set((missions ?? []).map((m) => m.playbook_version_id).filter((id) => id !== null)),
    ];
    const versionNumbers = new Map<string, number>();
    if (versionIds.length > 0) {
      const { data: versions, error: vErr } = await sb
        .from("build_playbook_versions")
        .select("id, version_number")
        .in("id", versionIds);
      if (vErr) fail(500, vErr.message);
      for (const v of versions ?? []) versionNumbers.set(v.id, v.version_number);
    }

    const { data: dossiers, error: dErr } = await sb
      .from("build_dossiers")
      .select("mission_id")
      .eq("workspace_id", data.workspaceId)
      .limit(2000);
    if (dErr) fail(500, dErr.message);

    const counts = new Map<string, number>();
    for (const d of dossiers ?? []) {
      if (d.mission_id) counts.set(d.mission_id, (counts.get(d.mission_id) ?? 0) + 1);
    }
    return (missions ?? []).map((m) => ({
      ...m,
      dossierCount: counts.get(m.id) ?? 0,
      playbookVersionNumber: m.playbook_version_id
        ? (versionNumbers.get(m.playbook_version_id) ?? null)
        : null,
    }));
  });

/**
 * Toggles a Mission between active and paused. Never touches build_dossiers
 * — historical Project Briefs stay exactly as they are, this only changes
 * whether the public intake link still accepts new submissions
 * (build-runtime.ts's session-creation path checks Mission status).
 * Owner-only, and the Mission id is always re-verified against
 * workspaceId before any write, so a workspace can never toggle a Mission
 * that belongs to someone else even if it guessed the id.
 */
export const setMissionPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ workspaceId: z.string().uuid(), missionId: z.string().uuid(), paused: z.boolean() })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceOwner(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();

    const { data: mission, error: findError } = await sb
      .from("build_missions")
      .select("id, status, workspace_id")
      .eq("id", data.missionId)
      .maybeSingle();
    if (findError) fail(500, findError.message);
    if (!mission || mission.workspace_id !== data.workspaceId) {
      fail(404, "Mission not found.");
    }
    if (mission.status !== "active" && mission.status !== "paused") {
      fail(400, "Only a published Mission can be paused or reactivated.");
    }

    // Pausing is always allowed — it frees a slot and costs us nothing.
    // Reactivating puts an Intake back online, so it goes through the same
    // billing gate and the same plan limit as a first publish. Neither check
    // existed here before, which let a paused Mission be revived past both.
    if (!data.paused && mission.status === "paused") {
      await assertCanPublish(data.workspaceId);
      const usage = await getWorkspaceUsageInternal(data.workspaceId);
      if (wouldExceedActiveMissions(usage.activeMissions, usage.maxActiveMissions)) {
        fail(
          409,
          `Your plan allows ${usage.maxActiveMissions} active Project Intake(s). Pause another one first, or upgrade your plan.`,
        );
      }
    }

    const { data: updated, error } = await sb
      .from("build_missions")
      .update({ status: data.paused ? "paused" : "active" })
      .eq("id", data.missionId)
      .select("id, status")
      .maybeSingle();
    if (error) fail(500, error.message);
    return updated;
  });

/** Non-blocking usage display for the portal's own workspace — never gates submission. */
export const getMyWorkspaceUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertWorkspaceMember(context.supabase, context.userId, data.workspaceId);
    // Entitlements ride along with usage because the two are always shown
    // together ("2 / 3 active Intakes" is meaningless next to a frozen
    // account) and the missions page already fetches this once.
    const [usage, entitlements] = await Promise.all([
      getWorkspaceUsageInternal(data.workspaceId),
      getWorkspaceEntitlements(data.workspaceId),
    ]);
    return { ...usage, entitlements };
  });

/** Billing summary for /portal/billing — never returns the raw Stripe customer id, just whether one exists. */
export const getMyWorkspaceBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertWorkspaceMember(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();
    const { data: workspace, error } = await sb
      .from("build_workspaces")
      .select("plan, subscription_status, stripe_customer_id, stripe_subscription_id")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (error) fail(500, error.message);
    if (!workspace) fail(404, "Not found");
    return {
      plan: workspace.plan,
      subscriptionStatus: workspace.subscription_status,
      hasStripeCustomer: workspace.stripe_customer_id !== null,
      hasStripeBilling:
        workspace.stripe_customer_id !== null || workspace.stripe_subscription_id !== null,
      entitlements: await getWorkspaceEntitlements(data.workspaceId),
    };
  });

export const getWorkspaceDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { data: dossier, error } = await sb
      .from("build_dossiers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) fail(500, error.message);
    if (!dossier || !dossier.workspace_id) fail(404, "Not found");
    await assertWorkspaceMember(context.supabase, context.userId, dossier.workspace_id);

    let mission: { name: string; playbook_name: string | null } | null = null;
    if (dossier.mission_id) {
      const { data: m } = await sb
        .from("build_missions")
        .select("name, playbook_name")
        .eq("id", dossier.mission_id)
        .maybeSingle();
      mission = m;
    }
    return { dossier, mission };
  });

/**
 * Signed URLs for the photos a visitor attached to this Dossier.
 *
 * The Storage bucket is private and the admin console has been able to show
 * these since the feature shipped; the workspace that actually receives the
 * project never could. A Project Brief promising "photos in one place" was
 * showing the sales team nothing.
 *
 * The caller passes a Dossier id, never a Storage path. Paths are read
 * server-side from that Dossier's own session after membership is checked, so
 * a member of one workspace cannot mint a URL for another's photo by guessing
 * or replaying a path — which is exactly what the admin-only variant
 * (getInspirationPhotoUrl) allows, and why it must stay admin-only.
 */
export const getWorkspaceDossierPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { data: dossier, error } = await sb
      .from("build_dossiers")
      .select("id, workspace_id, session_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) fail(500, error.message);
    if (!dossier || !dossier.workspace_id) fail(404, "Not found");
    await assertWorkspaceMember(context.supabase, context.userId, dossier.workspace_id);
    if (!dossier.session_id) return { photos: [] as DisplayPhotoReference[] };

    const { data: session } = await sb
      .from("build_runtime_sessions")
      .select("answers")
      .eq("id", dossier.session_id)
      .maybeSingle();
    const refs = extractPhotoReferences((session?.answers ?? {}) as Answers);
    if (refs.length === 0) return { photos: [] as DisplayPhotoReference[] };

    const photos: DisplayPhotoReference[] = [];
    for (const ref of refs) {
      const { data: signed } = await sb.storage
        // No bucket on the reference means the inspiration bucket — the only
        // one that existed when those snapshots were written.
        .from(ref.bucket ?? INSPIRATION_PHOTOS_BUCKET)
        .createSignedUrl(ref.path, SIGNED_PHOTO_URL_TTL_SECONDS);
      // One unreadable object must not take the whole Dossier down with it.
      if (signed?.signedUrl) photos.push({ url: signed.signedUrl, caption: ref.caption });
    }
    return { photos };
  });

export const updateDossierFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        commercial_status: z.enum(COMMERCIAL_STATUSES).optional(),
        commercial_notes: z.string().max(5000).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { data: existing, error: fetchError } = await sb
      .from("build_dossiers")
      .select("workspace_id")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchError) fail(500, fetchError.message);
    if (!existing || !existing.workspace_id) fail(404, "Not found");
    await assertWorkspaceMember(context.supabase, context.userId, existing.workspace_id);

    const { data: updated, error } = await sb
      .from("build_dossiers")
      .update({
        ...(data.commercial_status !== undefined
          ? { commercial_status: data.commercial_status }
          : {}),
        ...(data.commercial_notes !== undefined ? { commercial_notes: data.commercial_notes } : {}),
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) fail(500, error.message);
    if (!updated) fail(404, "Not found");
    return updated;
  });

// ---------------------------------------------------------------- Team
//
// A workspace was single-user in practice: build_workspace_members has always
// distinguished 'owner' from 'member', but only an admin could add anyone, so
// a customer who subscribed had no way to give their sales rep access. These
// four functions close that, entirely inside the owner's own workspace.

/** Anyone in the workspace may see who else is in it. */
export const listMyWorkspaceMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertWorkspaceMember(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();
    const { data: members, error } = await sb
      .from("build_workspace_members")
      .select("id, user_id, email, role, created_at")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: true });
    if (error) fail(500, error.message);
    return (members ?? []).map((m) => ({ ...m, isSelf: m.user_id === context.userId }));
  });

/**
 * Invites a colleague by email. build_workspace_members.user_id is a real FK
 * to auth.users, so there is no "pending invite" state to model: the account
 * is created up front with no password, exactly like admin provisioning does,
 * and the person signs in with the same passwordless OTP as everyone else.
 * Creating the account is therefore not a security decision — it grants
 * nothing until that person proves ownership of the mailbox.
 */
export const inviteMyWorkspaceMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ workspaceId: z.string().uuid(), email: z.string().email().max(320) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceOwner(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();
    const email = data.email.trim().toLowerCase();

    const { data: existingUsers, error: listError } = await sb.auth.admin.listUsers({
      perPage: 1000,
    });
    if (listError) fail(500, listError.message);
    let userId = existingUsers.users.find((u) => u.email?.toLowerCase() === email)?.id;

    if (!userId) {
      const { data: created, error: createError } = await sb.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (createError || !created.user) {
        fail(500, createError?.message ?? "Could not create that account.");
      }
      userId = created.user.id;
    }

    const { data: inserted, error } = await sb
      .from("build_workspace_members")
      .insert({ workspace_id: data.workspaceId, user_id: userId, email, role: "member" })
      .select("id, user_id, email, role, created_at")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") fail(409, "That person is already in this workspace.");
      fail(500, error.message);
    }
    return inserted;
  });

/**
 * Removes a member. Two guards: the last owner cannot be removed (the
 * workspace would become unmanageable), and an owner cannot remove
 * themselves by accident — that is a separate, deliberate action.
 */
export const removeMyWorkspaceMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ workspaceId: z.string().uuid(), memberId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceOwner(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();

    const { data: member, error: findError } = await sb
      .from("build_workspace_members")
      .select("id, user_id, role, workspace_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (findError) fail(500, findError.message);
    if (!member || member.workspace_id !== data.workspaceId) fail(404, "Member not found.");

    if (member.user_id === context.userId) {
      fail(400, "You cannot remove yourself from your own workspace.");
    }

    if (member.role === "owner") {
      const { count, error: countError } = await sb
        .from("build_workspace_members")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", data.workspaceId)
        .eq("role", "owner");
      if (countError) fail(500, countError.message);
      if ((count ?? 0) <= 1) fail(400, "A workspace must keep at least one owner.");
    }

    // Dossiers assigned to this person become unassigned rather than pointing
    // at someone who can no longer open them.
    const { error: unassignError } = await sb
      .from("build_dossiers")
      .update({ assigned_to_user_id: null })
      .eq("workspace_id", data.workspaceId)
      .eq("assigned_to_user_id", member.user_id);
    if (unassignError) fail(500, unassignError.message);

    const { error } = await sb.from("build_workspace_members").delete().eq("id", data.memberId);
    if (error) fail(500, error.message);
    return { removed: true };
  });

/**
 * Assigns a Dossier to a workspace member, or clears the assignment with a
 * null userId. Any member may assign — deciding who follows up is ordinary
 * sales work, not an ownership privilege.
 */
export const assignMyDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), userId: z.string().uuid().nullable() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const { data: dossier, error: fetchError } = await sb
      .from("build_dossiers")
      .select("workspace_id")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchError) fail(500, fetchError.message);
    if (!dossier?.workspace_id) fail(404, "Not found");
    await assertWorkspaceMember(context.supabase, context.userId, dossier.workspace_id);

    // The assignee must belong to the same workspace: without this, any
    // member could park a Dossier on an arbitrary user id.
    if (data.userId !== null) {
      const { data: member, error: memberError } = await sb
        .from("build_workspace_members")
        .select("id")
        .eq("workspace_id", dossier.workspace_id)
        .eq("user_id", data.userId)
        .maybeSingle();
      if (memberError) fail(500, memberError.message);
      if (!member) fail(400, "That person is not in this workspace.");
    }

    const { data: updated, error } = await sb
      .from("build_dossiers")
      .update({ assigned_to_user_id: data.userId })
      .eq("id", data.id)
      .select("id, assigned_to_user_id")
      .maybeSingle();
    if (error) fail(500, error.message);
    if (!updated) fail(404, "Not found");
    return updated;
  });
