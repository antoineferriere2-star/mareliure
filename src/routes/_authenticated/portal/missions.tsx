import { createFileRoute } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listMyWorkspaces,
  listWorkspaceMissions,
  getMyWorkspaceUsage,
  setMissionPaused,
} from "@/build/services/portal.data.functions";
import { PortalError, PortalPending } from "@/build/pages/portal/PortalStates";
import { EntitlementBanner } from "@/build/pages/portal/EntitlementBanner";
import { IntegrationSnippetsPanel } from "@/build/pages/integration/IntegrationSnippetsPanel";

export const Route = createFileRoute("/_authenticated/portal/missions")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Missions — Client Portal" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  pendingComponent: PortalPending,
  errorComponent: PortalError,
  component: PortalMissionsPage,
});

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

function PortalMissionsPage() {
  const queryClient = useQueryClient();
  const fetchWorkspaces = useServerFn(listMyWorkspaces);
  const { data: workspaces } = useSuspenseQuery(
    queryOptions({ queryKey: ["portal", "workspaces"] as const, queryFn: () => fetchWorkspaces() }),
  );
  const [workspaceId, setWorkspaceId] = useState<string>(workspaces[0]?.id ?? "");
  const isOwner = workspaces.find((w) => w.id === workspaceId)?.role === "owner";

  const missionsKey = ["portal", "missions", workspaceId] as const;
  const fetchMissions = useServerFn(listWorkspaceMissions);
  const {
    data: missions,
    isPending,
    error,
  } = useQuery({
    queryKey: missionsKey,
    queryFn: () => fetchMissions({ data: { workspaceId } }),
    enabled: workspaceId.length > 0,
  });

  const togglePause = useServerFn(setMissionPaused);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const toggleMutation = useMutation({
    mutationFn: (vars: { missionId: string; paused: boolean }) =>
      togglePause({ data: { workspaceId, missionId: vars.missionId, paused: vars.paused } }),
    onSuccess: () => {
      setToggleError(null);
      queryClient.invalidateQueries({ queryKey: missionsKey });
    },
    onError: (err: unknown) => {
      setToggleError(err instanceof Error ? err.message : "Unable to update this Mission.");
    },
  });

  const fetchUsage = useServerFn(getMyWorkspaceUsage);
  const { data: usage } = useQuery({
    queryKey: ["portal", "workspace-usage", workspaceId] as const,
    queryFn: () => fetchUsage({ data: { workspaceId } }),
    enabled: workspaceId.length > 0,
  });
  const publicMissions =
    missions?.filter(
      (mission): mission is typeof mission & { public_token: string } =>
        mission.status === "active" &&
        mission.public_token !== null &&
        mission.public_token_revoked_at === null,
    ) ?? [];

  if (workspaces.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No workspace is linked to this account yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Missions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The journeys published for your workspace and the Dossiers they produce.
          </p>
        </div>
        {workspaces.length > 1 && (
          <select
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
      </header>

      {usage && <EntitlementBanner entitlements={usage.entitlements} />}

      {usage && (
        <div className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
          {usage.activeMissions} / {usage.maxActiveMissions} active Mission(s) on your plan ·{" "}
          {usage.monthlyBriefs} / {usage.monthlyBriefQuota} Project Briefs this month.
        </div>
      )}

      {toggleError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {toggleError}
        </p>
      )}

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "Unable to load your Missions."}
        </p>
      ) : isPending ? (
        <PortalPending />
      ) : missions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No Mission is linked to this workspace yet.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Mission</th>
                  <th className="px-4 py-2 text-left">Playbook</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-right">Dossiers</th>
                  <th className="px-4 py-2 text-left">Public link</th>
                  {isOwner && <th className="px-4 py-2 text-left">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {missions.map((m) => (
                  <tr key={m.id} className="border-b border-border/60 last:border-b-0">
                    <td className="px-4 py-3 font-medium text-foreground">{m.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {m.playbook_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {STATUS_LABELS[m.status] ?? m.status}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{m.dossierCount}</td>
                    <td className="px-4 py-3 text-xs">
                      {m.status === "active" && m.public_token && !m.public_token_revoked_at ? (
                        <a
                          href={`/m/${m.public_token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Not published</span>
                      )}
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3 text-xs">
                        {m.status === "active" || m.status === "paused" ? (
                          <button
                            type="button"
                            onClick={() =>
                              toggleMutation.mutate({
                                missionId: m.id,
                                paused: m.status === "active",
                              })
                            }
                            disabled={toggleMutation.isPending}
                            className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                          >
                            {m.status === "active" ? "Pause" : "Reactivate"}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {publicMissions.length > 0 ? (
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">Website integration</h2>
              <div className="mt-4 space-y-6">
                {publicMissions.map((mission) => (
                  <div
                    key={mission.id}
                    className="border-t border-border pt-4 first:border-t-0 first:pt-0"
                  >
                    <p className="mb-3 text-sm font-medium text-foreground">{mission.name}</p>
                    <IntegrationSnippetsPanel
                      publicUrl={`/m/${mission.public_token}`}
                      ctaLabel="Start your project"
                      missionName={mission.name}
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
