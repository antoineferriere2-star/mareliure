import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listKnowledgeNotes,
  createKnowledgeNote,
  updateKnowledgeNoteStatus,
  deleteKnowledgeNote,
} from "@/build/services/admin.data.functions";
import {
  callWithFallback,
  localListKnowledge,
  localCreateKnowledge,
  localUpdateKnowledgeStatus,
  localDeleteKnowledge,
} from "@/build/services/buildAdminClient";
import type { BuildKnowledgeNote, KnowledgeStatus } from "@/build/types";

const knowledgeKey = ["build-admin", "knowledge"] as const;

export const Route = createFileRoute("/_authenticated/build/knowledge")({
  ssr: false,
  head: () => ({ meta: [{ title: "Knowledge — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: KnowledgePage,
});

function normalizeNote(raw: unknown): BuildKnowledgeNote {
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    content: (r.content as string | null) ?? null,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    status: (r.status as KnowledgeStatus) ?? "proposed",
    created_at: String(r.created_at ?? new Date().toISOString()),
    updated_at: String(r.updated_at ?? new Date().toISOString()),
  };
}

function KnowledgePage() {
  const list = useServerFn(listKnowledgeNotes);
  const create = useServerFn(createKnowledgeNote);
  const patch = useServerFn(updateKnowledgeNoteStatus);
  const remove = useServerFn(deleteKnowledgeNote);
  const queryClient = useQueryClient();

  const opts = queryOptions({
    queryKey: knowledgeKey,
    queryFn: async () =>
      callWithFallback<BuildKnowledgeNote[]>(
        async () => ((await list()) as unknown[]).map(normalizeNote),
        () => localListKnowledge(),
      ),
  });
  const { data: result } = useSuspenseQuery(opts);
  const source = result.source;
  const items = result.data;

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  const createMut = useMutation({
    mutationFn: async () => {
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (source === "supabase") return create({ data: { title: title.trim(), content: content.trim() || null, tags: tagList } });
      return localCreateKnowledge({ title: title.trim(), content: content.trim() || null, tags: tagList });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeKey });
      setTitle(""); setContent(""); setTags(""); setShowForm(false);
    },
  });

  const statusMut = useMutation({
    mutationFn: async (vars: { id: string; status: KnowledgeStatus }) => {
      if (source === "supabase") return patch({ data: vars });
      localUpdateKnowledgeStatus(vars.id, vars.status);
      return null;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: knowledgeKey }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      if (source === "supabase") return remove({ data: { id } });
      localDeleteKnowledge(id);
      return { ok: true as const };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: knowledgeKey }),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Knowledge</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Base de connaissance interne (matériaux, contraintes locales, tarifs).
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
          {showForm ? "Annuler" : "+ Add knowledge"}
        </button>
      </header>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; createMut.mutate(); }}
          className="space-y-3 rounded-lg border border-border bg-card p-4"
        >
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Titre *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Ex : Trex Enhance vs Transcend — arbitrage prix/finition" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Contenu</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Tags (virgules)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="composite, deck, code-local" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={createMut.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {createMut.isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Aucune note interne pour le moment.</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm font-medium text-primary underline">
            Ajouter la première note
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{it.title}</h3>
                  {it.content && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{it.content}</p>}
                  {it.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {it.tags.map((t) => (
                        <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 text-[10px] text-muted-foreground">{new Date(it.created_at).toLocaleString()}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <select
                    value={it.status}
                    onChange={(e) => statusMut.mutate({ id: it.id, status: e.target.value as KnowledgeStatus })}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="proposed">proposed</option>
                    <option value="approved">approved</option>
                    <option value="archived">archived</option>
                  </select>
                  <button
                    onClick={() => confirm("Supprimer cette note ?") && deleteMut.mutate(it.id)}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
