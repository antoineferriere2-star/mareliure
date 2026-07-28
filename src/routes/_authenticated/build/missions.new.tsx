import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  createBuildMission,
  listPublishablePlaybooks,
  listWorkspaces,
} from "@/build/services/admin.data.functions";

export const Route = createFileRoute("/_authenticated/build/missions/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "New Mission — Métré Build AI" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: NewMissionPage,
});

const playbooksKey = ["build-admin", "publishable-playbooks"] as const;
const workspacesKey = ["build-admin", "workspaces"] as const;

function NewMissionPage() {
  const navigate = useNavigate();
  const create = useServerFn(createBuildMission);
  const listPlaybooks = useServerFn(listPublishablePlaybooks);
  const opts = queryOptions({ queryKey: playbooksKey, queryFn: () => listPlaybooks() });
  const { data: playbooks } = useSuspenseQuery(opts);
  const listWs = useServerFn(listWorkspaces);
  const wsOpts = queryOptions({ queryKey: workspacesKey, queryFn: () => listWs() });
  const { data: workspaces } = useSuspenseQuery(wsOpts);

  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [playbookId, setPlaybookId] = useState<string>("");
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const selected = playbooks.find((p) => p.id === playbookId);
      return create({
        data: {
          name: name.trim(),
          objective: objective.trim() || null,
          playbook_id: selected?.id ?? null,
          playbook_version_id: selected?.published_version_id ?? null,
          playbook_name: selected?.name ?? null,
          workspace_id: workspaceId || null,
        },
      });
    },
    onSuccess: (m) => {
      if (m?.id) navigate({ to: "/build/missions/$id", params: { id: m.id } });
      else navigate({ to: "/build/missions" });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Unknown error"),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to="/build/missions" className="text-xs text-muted-foreground hover:underline">
          ← Missions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">New Mission</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a public Mission. It starts as a draft; publish it to generate a{" "}
          <code className="rounded bg-muted px-1">/m/:publicToken</code> link.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (name.trim().length < 2) {
            setError("The name must contain at least 2 characters.");
            return;
          }
          mutation.mutate();
        }}
        className="space-y-4 rounded-lg border border-border bg-card p-5"
      >
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Mission name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="E.g.: Deck qualification — East Coast builders"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground">Objective</label>
          <textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="What is this Mission for? Who will fill it out?"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground">Playbook</label>
          <select
            value={playbookId}
            onChange={(e) => setPlaybookId(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">None (set later)</option>
            {playbooks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {playbooks.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              No published Playbook yet. The Mission cannot be activated until one is selected.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground">
            Client Workspace
          </label>
          <select
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">None (internal/demo Mission)</option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Project Briefs produced by this Mission will appear in that Client Workspace portal.
          </p>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Link
            to="/build/missions"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {mutation.isPending ? "Creating..." : "Create Mission"}
          </button>
        </div>
      </form>
    </div>
  );
}
