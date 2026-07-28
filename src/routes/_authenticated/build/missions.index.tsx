import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBuildMissions, setMissionStatus } from "@/build/services/admin.data.functions";

const missionsKey = ["build-admin", "missions"] as const;

export const Route = createFileRoute("/_authenticated/build/missions/")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Missions — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: MissionsPage,
});

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "border-slate-300 bg-slate-100 text-slate-700",
    active: "border-emerald-300 bg-emerald-50 text-emerald-800",
    paused: "border-amber-300 bg-amber-50 text-amber-800",
    archived: "border-slate-300 bg-slate-50 text-slate-500",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${map[status] ?? map.draft}`}
    >
      {status}
    </span>
  );
}

function MissionsPage() {
  const fetchMissions = useServerFn(listBuildMissions);
  const opts = queryOptions({ queryKey: missionsKey, queryFn: () => fetchMissions() });
  const { data: missions } = useSuspenseQuery(opts);
  const queryClient = useQueryClient();
  const patchStatus = useServerFn(setMissionStatus);

  const mutation = useMutation({
    mutationFn: (vars: { id: string; status: "draft" | "active" | "paused" | "archived" }) =>
      patchStatus({ data: vars }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: missionsKey }),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Missions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Missions publiques et leurs tokens `/m/:publicToken`.
          </p>
        </div>
        <Link
          to="/build/missions/new"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          New Mission
        </Link>
      </header>

      {missions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No Missions yet.</p>
          <Link
            to="/build/missions/new"
            className="mt-3 inline-block text-sm font-medium text-primary underline"
          >
            Create the first Mission
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Nom</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-left">Playbook</th>
                <th className="px-4 py-2 text-left">Created</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {missions.map((m) => (
                <tr key={m.id} className="border-b border-border/60 last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      to="/build/missions/$id"
                      params={{ id: m.id }}
                      className="font-medium text-foreground hover:underline"
                    >
                      {m.name}
                    </Link>
                    {m.objective ? (
                      <div className="text-xs text-muted-foreground">{m.objective}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.playbook_name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.status === "active" ? (
                      <button
                        onClick={() => mutation.mutate({ id: m.id, status: "paused" })}
                        disabled={mutation.isPending}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        onClick={() => mutation.mutate({ id: m.id, status: "active" })}
                        disabled={mutation.isPending}
                        className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-100"
                      >
                        Publish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
