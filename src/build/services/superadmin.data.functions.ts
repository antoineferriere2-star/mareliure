import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { admin, assertAdmin } from "./adminAuth.server";
import { fail } from "./serverError";

/**
 * Super admin observability: inscriptions (comptes créés), activité
 * (sessions / Dossiers Commerciaux / demandes publiques) et fréquentation
 * des surfaces publiques. Lecture seule.
 */

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function buildSeries(days: number, buckets: Record<string, Record<string, number>>) {
  const out: { day: string; [k: string]: string | number }[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row: { day: string; [k: string]: string | number } = { day: key };
    for (const metric of Object.keys(buckets)) {
      row[metric] = buckets[metric][key] ?? 0;
    }
    out.push(row);
  }
  return out;
}

function countBy<T>(rows: T[], get: (r: T) => string | null | undefined) {
  const map: Record<string, number> = {};
  for (const r of rows) {
    const k = get(r);
    if (!k) continue;
    map[k] = (map[k] ?? 0) + 1;
  }
  return map;
}

export const getSuperAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ days: z.number().int().min(7).max(90).optional() }).parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();

    const days = data.days ?? 30;
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));
    const sinceIso = since.toISOString();

    // --- Inscriptions (comptes Auth) ---
    const accounts: {
      id: string;
      email: string | null;
      created_at: string;
      last_sign_in_at: string | null;
      confirmed: boolean;
    }[] = [];
    for (let page = 1; page <= 5; page++) {
      const { data: list, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
      if (error) fail(500, error.message);
      for (const u of list.users) {
        accounts.push({
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          confirmed: Boolean(u.email_confirmed_at ?? u.confirmed_at),
        });
      }
      if (list.users.length < 200) break;
    }
    accounts.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const [
      sessionsRes,
      dossiersRes,
      requestsRes,
      missionsRes,
      membersRes,
      workspacesRes,
      rolesRes,
      viewsRes,
    ] = await Promise.all([
      sb
        .from("build_runtime_sessions")
        .select("id, mission_id, status, created_at, submitted_at, visitor_hash")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(5000),
      sb
        .from("build_dossiers")
        .select("id, mission_id, workspace_id, created_at")
        .gte("created_at", sinceIso)
        .limit(5000),
      sb
        .from("build_public_requests")
        .select("id, request_type, source_path, status, created_at")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(5000),
      sb.from("build_missions").select("id, name, status, workspace_id"),
      sb.from("build_workspace_members").select("user_id, email, workspace_id, role"),
      sb.from("build_workspaces").select("id, name, plan, subscription_status, created_at"),
      sb.from("user_roles").select("user_id, role"),
      sb
        .from("build_page_views")
        .select("path, referrer_host, device, locale, visitor_hash, session_hash, created_at")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(20000),
    ]);


    const err =
      sessionsRes.error ||
      dossiersRes.error ||
      requestsRes.error ||
      missionsRes.error ||
      membersRes.error ||
      workspacesRes.error ||
      rolesRes.error ||
      viewsRes.error;
    if (err) fail(500, err.message);

    const sessions = sessionsRes.data ?? [];
    const dossiers = dossiersRes.data ?? [];
    const requests = requestsRes.data ?? [];
    const missions = missionsRes.data ?? [];
    const members = membersRes.data ?? [];
    const workspaces = workspacesRes.data ?? [];
    const roles = rolesRes.data ?? [];
    const views = viewsRes.data ?? [];

    const missionName = new Map(missions.map((m) => [m.id, m.name]));
    const workspaceName = new Map(workspaces.map((w) => [w.id, w.name]));

    // --- Real visit tracking (public surface page views) ---
    const uniqueViewers = new Set(views.map((v) => v.visitor_hash).filter(Boolean)).size;
    const viewSessions = new Set(views.map((v) => v.session_hash).filter(Boolean)).size;
    const viewsByDay = countBy(views, (v) => dayKey(v.created_at));
    const uniquePerDay: Record<string, number> = {};
    const seenPerDay = new Map<string, Set<string>>();
    for (const v of views) {
      const key = dayKey(v.created_at);
      if (!v.visitor_hash) continue;
      const set = seenPerDay.get(key) ?? new Set<string>();
      set.add(v.visitor_hash);
      seenPerDay.set(key, set);
    }
    for (const [key, set] of seenPerDay) uniquePerDay[key] = set.size;

    const topPages = Object.entries(countBy(views, (v) => v.path))
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
    const topReferrers = Object.entries(countBy(views, (v) => v.referrer_host ?? "direct"))
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    const devices = countBy(views, (v) => v.device ?? "unknown");
    const locales = countBy(views, (v) => v.locale ?? "unknown");

    const series = buildSeries(days, {
      pageViews: viewsByDay,
      visitors: uniquePerDay,
      signups: countBy(
        accounts.filter((a) => a.created_at >= sinceIso),
        (a) => dayKey(a.created_at),
      ),
      sessions: countBy(sessions, (s) => dayKey(s.created_at)),
      dossiers: countBy(dossiers, (d) => dayKey(d.created_at)),
      requests: countBy(requests, (r) => dayKey(r.created_at)),
    });


    const submitted = sessions.filter((s) => s.status === "submitted").length;
    const uniqueVisitors = new Set(sessions.map((s) => s.visitor_hash).filter(Boolean)).size;

    const sessionsByMission = countBy(sessions, (s) => s.mission_id);
    const dossiersByMission = countBy(dossiers, (d) => d.mission_id);
    const topMissions = Object.entries(sessionsByMission)
      .map(([id, count]) => ({
        id,
        name: missionName.get(id) ?? "Mission supprimée",
        sessions: count,
        dossiers: dossiersByMission[id] ?? 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);

    const dossiersByWorkspace = countBy(dossiers, (d) => d.workspace_id);
    const memberEmails = new Map(members.map((m) => [m.user_id, m.email]));
    const roleByUser = new Map(roles.map((r) => [r.user_id, r.role as string]));

    return {
      generatedAt: new Date().toISOString(),
      days,
      totals: {
        accounts: accounts.length,
        newAccounts: accounts.filter((a) => a.created_at >= sinceIso).length,
        unconfirmedAccounts: accounts.filter((a) => !a.confirmed).length,
        workspaces: workspaces.length,
        workspaceMembers: members.length,
        admins: roles.filter((r) => r.role === "admin").length,
        pageViews: views.length,
        uniqueViewers,
        viewSessions,
        viewsPerVisitor: uniqueViewers ? Math.round((views.length / uniqueViewers) * 10) / 10 : 0,
        sessions: sessions.length,
        submittedSessions: submitted,

        uniqueVisitors,
        dossiers: dossiers.length,
        requests: requests.length,
        conversionRate: sessions.length ? Math.round((submitted / sessions.length) * 100) : 0,
      },
      series,
      recentAccounts: accounts.slice(0, 15).map((a) => ({
        ...a,
        role: roleByUser.get(a.id) ?? (memberEmails.has(a.id) ? "client" : null),
      })),
      topMissions,
      requestsByType: countBy(requests, (r) => r.request_type as string),
      requestsBySource: Object.entries(countBy(requests, (r) => r.source_path))
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      workspaceActivity: workspaces
        .map((w) => ({
          id: w.id,
          name: w.name,
          plan: w.plan,
          subscriptionStatus: w.subscription_status,
          members: members.filter((m) => m.workspace_id === w.id).length,
          dossiers: dossiersByWorkspace[w.id] ?? 0,
        }))
        .sort((a, b) => b.dossiers - a.dossiers),
      recentRequests: requests.slice(0, 10).map((r) => ({
        id: r.id,
        type: r.request_type as string,
        source: r.source_path,
        status: r.status,
        created_at: r.created_at,
      })),
      workspaceNames: Object.fromEntries(workspaceName),
    };
  });
