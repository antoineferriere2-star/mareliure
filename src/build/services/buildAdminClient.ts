/**
 * buildAdminClient — remote-first admin client for `/build/*`.
 *
 * Calls TanStack server functions (which run inside the Worker with the
 * service-role Supabase client, gated by admin role check). On network
 * failure, falls back to a localStorage-backed mock so the admin UI keeps
 * working in dev when the backend is unreachable.
 *
 * The server functions are the equivalent of the `build-admin` edge
 * function referenced in the Codex plan: same admin gating, same
 * service-role access, same "never expose build_* tables to the browser"
 * contract — implemented as `createServerFn` because this stack does not
 * allow new Supabase edge functions.
 */
import type { BuildDataSource, BuildKnowledgeNote, KnowledgeStatus } from "@/build/types";

const LS_KNOWLEDGE = "metre_build_knowledge_items_v1";

function safeParseArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? (p as T[]) : [];
  } catch {
    return [];
  }
}

function readLS<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  return safeParseArray<T>(window.localStorage.getItem(key));
}

function writeLS<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export interface WithSource<T> {
  data: T;
  source: BuildDataSource;
}

/**
 * Wrap a server-fn call so a network/permission failure falls back to
 * localStorage. Returns both the payload and the data source used.
 */
export async function callWithFallback<T>(
  remote: () => Promise<T>,
  fallback: () => T,
): Promise<WithSource<T>> {
  try {
    const data = await remote();
    return { data, source: "supabase" };
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[buildAdminClient] falling back to local storage:", err);
    }
    return { data: fallback(), source: "local-fallback" };
  }
}

// ---------- Knowledge (local fallback) ----------

export function localListKnowledge(): BuildKnowledgeNote[] {
  return readLS<BuildKnowledgeNote>(LS_KNOWLEDGE);
}

export function localCreateKnowledge(input: { title: string; content?: string | null; tags?: string[] }): BuildKnowledgeNote {
  const note: BuildKnowledgeNote = {
    id: crypto.randomUUID(),
    title: input.title,
    content: input.content ?? null,
    tags: input.tags ?? [],
    status: "proposed",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const next = [note, ...localListKnowledge()];
  writeLS(LS_KNOWLEDGE, next);
  return note;
}

export function localUpdateKnowledgeStatus(id: string, status: KnowledgeStatus): void {
  const next = localListKnowledge().map((n) =>
    n.id === id ? { ...n, status, updated_at: new Date().toISOString() } : n,
  );
  writeLS(LS_KNOWLEDGE, next);
}

export function localDeleteKnowledge(id: string): void {
  writeLS(LS_KNOWLEDGE, localListKnowledge().filter((n) => n.id !== id));
}
