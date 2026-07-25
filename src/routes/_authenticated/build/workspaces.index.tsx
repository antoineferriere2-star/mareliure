import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listWorkspaces,
  createWorkspace,
  addWorkspaceMember,
  removeWorkspaceMember,
} from "@/build/services/admin.data.functions";

export const Route = createFileRoute("/_authenticated/build/workspaces/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Espaces Client — Métré Build AI" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: WorkspacesPage,
});

const workspacesKey = ["build-admin", "workspaces"] as const;

function WorkspacesPage() {
  const fetchWorkspaces = useServerFn(listWorkspaces);
  const opts = queryOptions({ queryKey: workspacesKey, queryFn: () => fetchWorkspaces() });
  const { data: workspaces } = useSuspenseQuery(opts);
  const queryClient = useQueryClient();

  const create = useServerFn(createWorkspace);
  const [newName, setNewName] = useState("");
  const createMutation = useMutation({
    mutationFn: () => create({ data: { name: newName.trim() } }),
    onSuccess: () => {
      setNewName("");
      queryClient.invalidateQueries({ queryKey: workspacesKey });
    },
  });

  const addMember = useServerFn(addWorkspaceMember);
  const [memberEmail, setMemberEmail] = useState<Record<string, string>>({});
  const [memberError, setMemberError] = useState<Record<string, string>>({});
  const addMemberMutation = useMutation({
    mutationFn: ({ workspaceId, email }: { workspaceId: string; email: string }) =>
      addMember({ data: { workspaceId, email } }),
    onSuccess: (_, { workspaceId }) => {
      setMemberEmail((prev) => ({ ...prev, [workspaceId]: "" }));
      setMemberError((prev) => ({ ...prev, [workspaceId]: "" }));
      queryClient.invalidateQueries({ queryKey: workspacesKey });
    },
    onError: (err: unknown, { workspaceId }) => {
      setMemberError((prev) => ({
        ...prev,
        [workspaceId]: err instanceof Error ? err.message : "Erreur inconnue.",
      }));
    },
  });

  const removeMember = useServerFn(removeWorkspaceMember);
  const removeMemberMutation = useMutation({
    mutationFn: (id: string) => removeMember({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspacesKey }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Espaces Client</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chaque Espace Client donne accès au portail{" "}
          <code className="rounded bg-muted px-1">/portal</code> pour suivre les Dossiers
          Commerciaux des Missions qui lui sont assignées.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim().length >= 2) createMutation.mutate();
        }}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-4"
      >
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-muted-foreground">
            Nom de l'entreprise cliente
          </label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex : Reliure Ferrière"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending || newName.trim().length < 2}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {createMutation.isPending ? "Création…" : "Créer l'Espace Client"}
        </button>
      </form>

      {workspaces.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Aucun Espace Client pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {workspaces.map((w) => (
            <section key={w.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">{w.name}</h2>
                <span className="text-[10px] uppercase text-muted-foreground">
                  {new Date(w.created_at).toLocaleDateString()}
                </span>
              </div>

              <ul className="mt-3 space-y-1">
                {w.members.length === 0 && (
                  <li className="text-xs text-muted-foreground">
                    Aucun membre — le portail n'est accessible à personne.
                  </li>
                )}
                {w.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{m.email}</span>
                    <button
                      onClick={() => removeMemberMutation.mutate(m.id)}
                      className="text-destructive hover:underline"
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const email = memberEmail[w.id]?.trim();
                  if (email) addMemberMutation.mutate({ workspaceId: w.id, email });
                }}
                className="mt-3 flex flex-wrap items-center gap-2"
              >
                <input
                  type="email"
                  value={memberEmail[w.id] ?? ""}
                  onChange={(e) => setMemberEmail((prev) => ({ ...prev, [w.id]: e.target.value }))}
                  placeholder="email@client.com"
                  className="flex-1 min-w-[200px] rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  disabled={addMemberMutation.isPending}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                >
                  Ajouter un membre
                </button>
              </form>
              {memberError[w.id] && (
                <p className="mt-1 text-xs text-destructive">{memberError[w.id]}</p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
