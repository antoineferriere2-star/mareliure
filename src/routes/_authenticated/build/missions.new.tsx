import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createBuildMission } from "@/build/services/admin.data.functions";

export const Route = createFileRoute("/_authenticated/build/missions/new")({
  ssr: false,
  head: () => ({ meta: [{ title: "Nouvelle mission — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: NewMissionPage,
});

function NewMissionPage() {
  const navigate = useNavigate();
  const create = useServerFn(createBuildMission);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [playbookName, setPlaybookName] = useState("Terrasse / Deck — v1");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () =>
      create({
        data: {
          name: name.trim(),
          objective: objective.trim() || null,
          playbook_name: playbookName.trim() || null,
        },
      }),
    onSuccess: (m) => {
      if (m?.id) navigate({ to: "/build/missions/$id", params: { id: m.id } });
      else navigate({ to: "/build/missions" });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Erreur inconnue"),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to="/build/missions" className="text-xs text-muted-foreground hover:underline">← Missions</Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Nouvelle mission</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crée une mission publique. Elle sera en brouillon — publie-la pour générer un lien <code className="rounded bg-muted px-1">/m/:publicToken</code>.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (name.trim().length < 2) {
            setError("Le nom doit contenir au moins 2 caractères.");
            return;
          }
          mutation.mutate();
        }}
        className="space-y-4 rounded-lg border border-border bg-card p-5"
      >
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Nom de la mission *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Ex : Deck qualification — East Coast builders"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground">Objectif</label>
          <textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="À quoi sert cette mission ? Qui va la remplir ?"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground">Playbook</label>
          <input
            value={playbookName}
            onChange={(e) => setPlaybookName(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Nom du playbook (Terrasse / Deck — v1)"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Link to="/build/missions" className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent">
            Annuler
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {mutation.isPending ? "Création…" : "Créer la mission"}
          </button>
        </div>
      </form>
    </div>
  );
}
