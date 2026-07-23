import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/build/knowledge")({
  ssr: false,
  head: () => ({ meta: [{ title: "Knowledge — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: KnowledgePage,
});

type KnowledgeStatus = "proposed" | "approved" | "archived";
interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  status: KnowledgeStatus;
  createdAt: string;
}

const STORAGE_KEY = "metre_build_knowledge_items_v1";

function loadItems(): KnowledgeItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveItems(items: KnowledgeItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    setItems(loadItems());
  }, []);

  function persist(next: KnowledgeItem[]) {
    setItems(next);
    saveItems(next);
  }

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const item: KnowledgeItem = {
      id: crypto.randomUUID(),
      title: title.trim(),
      content: content.trim(),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      status: "proposed",
      createdAt: new Date().toISOString(),
    };
    persist([item, ...items]);
    setTitle(""); setContent(""); setTags(""); setShowForm(false);
  }

  function setStatus(id: string, status: KnowledgeStatus) {
    persist(items.map((it) => (it.id === id ? { ...it, status } : it)));
  }

  function remove(id: string) {
    if (!confirm("Supprimer cette note ?")) return;
    persist(items.filter((it) => it.id !== id));
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Knowledge</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Base de connaissance interne (matériaux, contraintes locales, tarifs). Stockage dev local — sera migré en DB.
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
        <form onSubmit={addItem} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Titre</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Ex : Trex Enhance vs Transcend — arbitrage prix/finition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Contenu</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Note libre, contrainte locale, référence matériaux…"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Tags (séparés par des virgules)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="composite, deck, code-local"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
              Enregistrer
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
                        <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    {new Date(it.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <select
                    value={it.status}
                    onChange={(e) => setStatus(it.id, e.target.value as KnowledgeStatus)}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="proposed">proposed</option>
                    <option value="approved">approved</option>
                    <option value="archived">archived</option>
                  </select>
                  <button
                    onClick={() => remove(it.id)}
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
