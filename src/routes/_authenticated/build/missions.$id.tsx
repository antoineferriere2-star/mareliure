import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getBuildMission,
  setMissionStatus,
  setMissionWorkspace,
  deleteBuildMission,
  listWorkspaces,
  revokeMissionPublicToken,
} from "@/build/services/admin.data.functions";
import { IntegrationSnippetsPanel } from "@/build/pages/integration/IntegrationSnippetsPanel";

export const Route = createFileRoute("/_authenticated/build/missions/$id")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Mission — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: MissionDetailPage,
});

function MissionDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchMission = useServerFn(getBuildMission);
  const key = ["build-admin", "mission", id] as const;
  const opts = queryOptions({ queryKey: key, queryFn: () => fetchMission({ data: { id } }) });
  const { data: mission } = useSuspenseQuery(opts);
  const queryClient = useQueryClient();
  const patchStatus = useServerFn(setMissionStatus);
  const patchWorkspace = useServerFn(setMissionWorkspace);
  const removeMission = useServerFn(deleteBuildMission);
  const revokeToken = useServerFn(revokeMissionPublicToken);

  const listWs = useServerFn(listWorkspaces);
  const wsOpts = queryOptions({
    queryKey: ["build-admin", "workspaces"] as const,
    queryFn: () => listWs(),
  });
  const { data: workspaces } = useSuspenseQuery(wsOpts);

  const statusMutation = useMutation({
    mutationFn: (status: "draft" | "active" | "paused" | "archived") =>
      patchStatus({ data: { id, status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["build-admin", "missions"] });
    },
  });

  const workspaceMutation = useMutation({
    mutationFn: (workspaceId: string) =>
      patchWorkspace({ data: { id, workspace_id: workspaceId || null } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => removeMission({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["build-admin", "missions"] });
      navigate({ to: "/build/missions" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => revokeToken({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["build-admin", "missions"] });
    },
  });

  const publicPath =
    mission.public_token && mission.status === "active" && !mission.public_token_revoked_at
      ? `/m/${mission.public_token}`
      : null;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/build/missions" className="text-xs text-muted-foreground hover:underline">
          ← Missions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{mission.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mission.objective ?? "Sans objectif défini."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Status</h2>
          <div className="mt-2 text-sm">{mission.status}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {mission.status === "active" ? (
              <button
                onClick={() => statusMutation.mutate("paused")}
                disabled={statusMutation.isPending}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent"
              >
                Unpublish
              </button>
            ) : (
              <button
                onClick={() => statusMutation.mutate("active")}
                disabled={statusMutation.isPending}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-100"
              >
                Publish
              </button>
            )}
            {mission.public_token && !mission.public_token_revoked_at ? (
              <button
                onClick={() => {
                  if (confirm("Revoke this public link? Existing embeds will stop loading.")) {
                    revokeMutation.mutate();
                  }
                }}
                disabled={revokeMutation.isPending}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-100"
              >
                Revoke public link
              </button>
            ) : null}
            {mission.status !== "archived" && (
              <button
                onClick={() => statusMutation.mutate("archived")}
                disabled={statusMutation.isPending}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent"
              >
                Archive
              </button>
            )}
            <button
              onClick={() => {
                if (confirm("Delete this Mission permanently? This action cannot be undone.")) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
            >
              Delete
            </button>
          </div>
          {statusMutation.isError && (
            <p className="mt-2 text-xs text-destructive">
              {statusMutation.error instanceof Error
                ? statusMutation.error.message
                : "Status update failed."}
            </p>
          )}
          {revokeMutation.isError ? (
            <p className="mt-2 text-xs text-destructive">
              {revokeMutation.error instanceof Error
                ? revokeMutation.error.message
                : "Public link revocation failed."}
            </p>
          ) : null}
          {deleteMutation.isError ? (
            <p className="mt-2 text-xs text-destructive">
              {deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : "Mission deletion failed."}
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Playbook</h2>
          <div className="mt-2 text-sm text-foreground">{mission.playbook_name ?? "—"}</div>
          {mission.playbook_id && (
            <div className="mt-1 text-xs text-muted-foreground">ID: {mission.playbook_id}</div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Espace Client</h2>
          <select
            value={mission.workspace_id ?? ""}
            onChange={(e) => workspaceMutation.mutate(e.target.value)}
            disabled={workspaceMutation.isPending}
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Aucun (mission interne / démo)</option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Les Dossiers produits par cette mission apparaissent dans le portail de cet Espace
            Client.
          </p>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Website integration</h2>
        {publicPath ? (
          <div className="mt-2 space-y-3">
            <IntegrationSnippetsPanel
              publicUrl={publicPath}
              ctaLabel="Start your project"
              iframeTitle={`${mission.name} project intake`}
            />
            <a
              href={publicPath}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent"
            >
              Open runtime
            </a>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            The public link is generated when this Mission is active and its token has not been
            revoked.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Détails techniques</h2>
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Créée</dt>
            <dd>{new Date(mission.created_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Mise à jour</dt>
            <dd>{new Date(mission.updated_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Publiée</dt>
            <dd>{mission.published_at ? new Date(mission.published_at).toLocaleString() : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">ID</dt>
            <dd className="font-mono">{mission.id}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
