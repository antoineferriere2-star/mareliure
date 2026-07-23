import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { deckDemoSteps } from "@/build/services/deckProjectBrief";
import {
  listCustomPlaybooks,
  createCustomPlaybook,
  deleteCustomPlaybook,
} from "@/build/services/admin.data.functions";
import { callWithFallback, localListPlaybooks, localCreatePlaybook, localDeletePlaybook } from "@/build/services/buildAdminClient";
import type { BuildPlaybook } from "@/build/types";

const playbooksKey = ["build-admin", "playbooks"] as const;

export const Route = createFileRoute("/_authenticated/build/playbooks")({
  ssr: false,
  head: () => ({ meta: [{ title: "Playbooks — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: PlaybooksPage,
});

function PlaybooksPage() {
  const list = useServerFn(listCustomPlaybooks);
  const create = useServerFn(createCustomPlaybook);
  const remove = useServerFn(deleteCustomPlaybook);
  const queryClient = useQueryClient();

  const opts = queryOptions({
    queryKey: playbooksKey,
    queryFn: async () =>
      callWithFallback<BuildPlaybook[]>(
        async () => (await list()) as unknown as BuildPlaybook[],
        () => localListPlaybooks(),
      ),
  });
  const { data: result } = useSuspenseQuery(opts);
  const source = result.source;
  const items = result.data;

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState("deck");
  const [description, setDescription] = useState("");

  const createMut = useMutation({
    mutationFn: async () => {
      if (source === "supabase") {
        return await create({ data: { name: name.trim(), description: description.trim() || null, project_type: projectType.trim() || null } });
      }
      return localCreatePlaybook({ name: name.trim(), description: description.trim() || null, project_type: projectType.trim() || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playbooksKey });
      setName(""); setDescription(""); setShowForm(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      if (source === "supabase") return remove({ data: { id } });
      localDeletePlaybook(id);
      return { ok: true as const };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: playbooksKey }),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Playbooks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Modèles de questions par type de projet. Le playbook intégré ci-dessous est utilisé par la démo `/demo/deck-project`.
          </p>
          <p className="mt-2 text-xs">
            <span className="text-muted-foreground">Data source: </span>
            <span
              className={`rounded-full border px-2 py-0.5 font-medium ${
                source === "local-fallback"
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-emerald-300 bg-emerald-50 text-emerald-800"
              }`}
            >
              {source === "local-fallback" ? "Local dev fallback" : "Supabase Build admin"}
            </span>
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {showForm ? "Annuler" : "+ Nouveau playbook"}
        </button>
      </header>

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
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Type de projet</label>
            <input value={projectType} onChange={(e) => setProjectType(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="deck, kitchen, bathroom…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={createMut.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {createMut.isPending ? "Création…" : "Enregistrer"}
            </button>
          </div>
        </form>
      )}

      <article className="rounded-lg border border-border bg-card p-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Terrasse / Deck — v1</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Playbook intégré · {deckDemoSteps.length} étapes · utilisé par la démo `/demo/deck-project`.
            </p>
          </div>
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase text-emerald-800">
            Built-in
          </span>
        </header>
        <ol className="mt-4 space-y-3">
          {deckDemoSteps.map((step, i) => (
            <li key={step.id} className="rounded-md border border-border/60 bg-background p-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-medium text-foreground">{step.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Pourquoi : {step.why}</div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </article>

      <div>
        <h2 className="text-sm font-semibold text-foreground">Playbooks custom</h2>
        {items.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Aucun playbook custom pour le moment.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((p) => (
              <li key={p.id} className="flex items-start justify-between rounded-lg border border-border bg-card p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{p.name}</div>
                  {p.description && <div className="mt-0.5 text-xs text-muted-foreground">{p.description}</div>}
                  <div className="mt-1 text-[10px] uppercase text-muted-foreground">
                    {p.project_type ?? "—"} · {p.version}
                  </div>
                </div>
                <button
                  onClick={() => confirm("Supprimer ce playbook ?") && deleteMut.mutate(p.id)}
                  className="text-[10px] text-muted-foreground hover:text-destructive"
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
