import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createBuildPlaybook, listBuildPlaybooks } from "@/build/services/admin.data.functions";

const playbooksKey = ["build-admin", "playbooks"] as const;

export const Route = createFileRoute("/_authenticated/build/playbooks")({
  ssr: false,
  head: () => ({ meta: [{ title: "Playbooks — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: PlaybooksPage,
});

function PlaybooksPage() {
  const navigate = useNavigate();
  const list = useServerFn(listBuildPlaybooks);
  const create = useServerFn(createBuildPlaybook);
  const queryClient = useQueryClient();

  const { data: playbooks } = useSuspenseQuery({ queryKey: playbooksKey, queryFn: () => list() });

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState("");
  const [description, setDescription] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          name: name.trim(),
          description: description.trim() || null,
          project_type: projectType.trim() || null,
        },
      }),
    onSuccess: (playbook) => {
      queryClient.invalidateQueries({ queryKey: playbooksKey });
      if (playbook?.id) navigate({ to: "/build/playbooks/$id", params: { id: playbook.id } });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Playbooks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            L'expertise métier — sections, étapes, champs, règles et mapping vers le Dossier Commercial.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >
          + Nouveau Playbook
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length < 2) return;
            createMut.mutate();
          }}
          className="space-y-3 rounded-lg border border-border bg-card p-4"
        >
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Nom *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Ex : Terrasse / Deck — v1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Type de projet</label>
            <input
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="deck"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createMut.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {createMut.isPending ? "Création…" : "Créer le brouillon"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Nom</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Statut</th>
              <th className="px-4 py-2 text-left">Actif</th>
            </tr>
          </thead>
          <tbody>
            {playbooks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Aucun Playbook pour l'instant.
                </td>
              </tr>
            )}
            {playbooks.map((playbook) => (
              <tr key={playbook.id} className="border-t border-border hover:bg-accent/40">
                <td className="px-4 py-2">
                  <Link to="/build/playbooks/$id" params={{ id: playbook.id }} className="font-medium text-foreground hover:underline">
                    {playbook.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{playbook.project_type ?? "—"}</td>
                <td className="px-4 py-2">
                  {playbook.published_version_id ? (
                    <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      Publié
                    </span>
                  ) : (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Brouillon non publié
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{playbook.is_active ? "Oui" : "Non"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
