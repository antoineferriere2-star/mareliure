/**
 * Phase 0 / P1-6 — l'isolation et les permissions des conversations, de bout en bout :
 * le comportement réel de `listCaseMessages`, `sendCaseMessage` et `markConversationRead`
 * (client, atelier retenu, atelier seulement invité, admin/concierge, atelier retiré ou suspendu).
 * Seuls la base de données et l'envoi d'e-mail sont remplacés.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/marketplace/permissions";

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  sb: null as unknown,
  viewer: { role: "anonymous" } as unknown,
  sent: [] as { to: string }[],
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder: Record<string, unknown> = {};
    let validate: ((data: unknown) => unknown) | null = null;
    builder.middleware = () => builder;
    builder.inputValidator = (fn: (data: unknown) => unknown) => {
      validate = fn;
      return builder;
    };
    builder.handler = (fn: (args: unknown) => unknown) => (args: { data: unknown }) =>
      fn({ ...args, data: validate ? validate(args.data) : args.data });
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/build/services/adminAuth.server", () => ({ admin: async () => state.sb }));
vi.mock("@/build/services/operationalLog.server", () => ({ logOperationalError: vi.fn() }));
vi.mock("@/marketplace/services/marketplace.data.functions", () => ({ resolveViewer: async () => state.viewer }));
vi.mock("@/lib/email-templates/send-email", () => ({
  sendTemplateEmail: async (_name: string, to: string) => void state.sent.push({ to }),
}));

const { listCaseMessages, sendCaseMessage, markConversationRead } = await import("@/marketplace/services/messaging.data.functions");

const CASE_FB = "11111111-1111-4111-8111-111111111111";
const CASE_MR = "22222222-2222-4222-8222-222222222222";
const CUSTOMER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function fakeSb(tables: Record<string, Row[]>) {
  const writes: { table: string; values: Row }[] = [];
  const from = (table: string) => {
    let rows = (tables[table] ?? []).map((row) => ({ ...row }));
    let inserted: Row | null = null;
    const query: Record<string, unknown> = {
      select: () => query,
      eq: (column: string, value: unknown) => ((rows = rows.filter((r) => r[column] === value)), query),
      in: (column: string, values: unknown[]) => ((rows = rows.filter((r) => values.includes(r[column]))), query),
      order: () => query,
      maybeSingle: async () => ({ data: inserted ?? rows[0] ?? null, error: null }),
      single: async () => ({ data: inserted ?? rows[0] ?? null, error: null }),
      insert: (values: Row) => {
        writes.push({ table, values });
        inserted = { id: "new-message", created_at: "2026-09-19T12:00:00.000Z" };
        return query;
      },
      upsert: async (values: Row) => (writes.push({ table, values }), { error: null }),
      then: (resolve: (v: unknown) => unknown, reject: (r: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve, reject),
    };
    return query;
  };
  return { writes, sb: { from, auth: { admin: { getUserById: async () => ({ data: { user: { email: "client@example.test" } } }) } } } };
}

const msg = (id: string, caseId: string, role: string, audience: string, body: string): Row => ({
  id, case_id: caseId, sender_user_id: `user-${role}`, sender_role: role, audience, body,
  attachment_paths: null, created_at: `2026-09-18T10:0${id.length}:00.000Z`, deleted_at: null,
});

/** Un dossier Fine Bindery : `matchState` est l'état du match de l'atelier « b1 ». */
function world(over: { matchState?: string; binderStatus?: string; matches?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    marketplace_cases: [
      { id: CASE_FB, customer_user_id: CUSTOMER, brand: "FINE_BINDERY" },
      { id: CASE_MR, customer_user_id: CUSTOMER, brand: "MA_RELIURE" },
    ],
    marketplace_case_matches: over.matches ?? [
      { case_id: CASE_FB, binder_id: "b1", state: over.matchState ?? "selected" },
      { case_id: CASE_MR, binder_id: "b1", state: over.matchState ?? "selected" },
    ],
    marketplace_binders: [{ id: "b1", status: over.binderStatus ?? "approved" }],
    marketplace_messages: [
      msg("a", CASE_FB, "customer", "customer_concierge", "client -> concierge"),
      msg("bb", CASE_FB, "admin", "customer_concierge", "concierge -> client"),
      msg("ccc", CASE_FB, "admin", "workshop_platform", "concierge -> atelier"),
      msg("dddd", CASE_FB, "binder", "workshop_platform", "atelier -> concierge"),
      msg("e", CASE_MR, "customer", "shared", "MR client"),
      msg("ff", CASE_MR, "binder", "shared", "MR atelier"),
    ],
    marketplace_conversation_reads: [],
  };
  return fakeSb(tables);
}

const ctx = (userId: string) => ({ supabase: {}, userId, claims: {} });
const list = (caseId: string, userId: string) => listCaseMessages({ context: ctx(userId), data: { caseId } } as never) as Promise<{ messages: { body: string }[] }>;
const send = (caseId: string, userId: string, extra: Row = {}) => sendCaseMessage({ context: ctx(userId), data: { caseId, body: "Bonjour", ...extra } } as never);
const bodies = async (caseId: string, userId: string) => (await list(caseId, userId)).messages.map((m) => m.body);
const rejected = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { status?: number }).status ?? "other";
  }
};
const as = (viewer: Viewer) => void (state.viewer = viewer);
const customer: Viewer = { role: "customer", userId: CUSTOMER };
const workshop: Viewer = { role: "binder", binderId: "b1" };
const platform: Viewer = { role: "admin" };

beforeEach(() => {
  state.sent = [];
  state.viewer = customer;
});

describe("le client", () => {
  it("lit son canal concierge et jamais celui de l'atelier", async () => {
    state.sb = world().sb;
    as(customer);
    expect(await bodies(CASE_FB, CUSTOMER)).toEqual(["client -> concierge", "concierge -> client"]);
  });

  it("écrit dans son canal — même s'il demande le canal atelier", async () => {
    const w = world();
    state.sb = w.sb;
    as(customer);
    await send(CASE_FB, CUSTOMER, { audience: "workshop_platform" });
    expect(w.writes.find((x) => x.table === "marketplace_messages")?.values).toMatchObject({ sender_role: "customer", audience: "customer_concierge" });
  });
});

describe("l'atelier RETENU", () => {
  it("lit seulement son canal avec la plateforme", async () => {
    state.sb = world().sb;
    as(workshop);
    expect(await bodies(CASE_FB, "user-binder")).toEqual(["concierge -> atelier", "atelier -> concierge"]);
  });

  it("écrit dans son canal — même s'il demande le canal du client", async () => {
    const w = world();
    state.sb = w.sb;
    as(workshop);
    await send(CASE_FB, "user-binder", { audience: "customer_concierge" });
    expect(w.writes.find((x) => x.table === "marketplace_messages")?.values).toMatchObject({ sender_role: "binder", audience: "workshop_platform" });
  });

  it("Ma Reliure : le fil partagé, comme avant", async () => {
    state.sb = world().sb;
    as(workshop);
    expect(await bodies(CASE_MR, "user-binder")).toEqual(["MR client", "MR atelier"]);
  });

  it("son message n'envoie aucun e-mail au client (il ne peut pas le lire)", async () => {
    state.sb = world().sb;
    as(workshop);
    await send(CASE_FB, "user-binder");
    expect(state.sent).toHaveLength(0);
  });
});

describe.each(["offered", "accepted", "declined", "cancelled", "expired"])("un atelier dont le match est « %s » (invité, disponible ou écarté)", (matchState) => {
  it("ne lit aucune conversation — ni Fine Bindery ni Ma Reliure", async () => {
    state.sb = world({ matchState }).sb;
    as(workshop);
    expect(await rejected(list(CASE_FB, "user-binder"))).toBe(403);
    expect(await rejected(list(CASE_MR, "user-binder"))).toBe(403);
  });

  it("n'écrit dans aucune conversation, et n'y marque rien comme lu", async () => {
    const w = world({ matchState });
    state.sb = w.sb;
    as(workshop);
    expect(await rejected(send(CASE_FB, "user-binder"))).toBe(403);
    expect(await rejected(markConversationRead({ context: ctx("user-binder"), data: { caseId: CASE_FB } } as never))).toBe(403);
    expect(w.writes).toHaveLength(0);
  });
});

describe.each(["suspended", "rejected"])("un atelier retenu puis « %s »", (binderStatus) => {
  it("perd l'accès à la conversation : lecture et écriture refusées", async () => {
    const w = world({ binderStatus });
    state.sb = w.sb;
    as(workshop);
    expect(await rejected(list(CASE_FB, "user-binder"))).toBe(403);
    expect(await rejected(send(CASE_FB, "user-binder"))).toBe(403);
    expect(w.writes).toHaveLength(0);
  });
});

describe("un atelier retenu mais inconnu de la base", () => {
  it("est refusé (fail closed)", async () => {
    const w = world();
    (w.sb as { from: unknown }).from = (table: string) => (table === "marketplace_binders" ? fakeSb({ marketplace_binders: [] }).sb.from(table) : (world().sb as { from: (t: string) => unknown }).from(table));
    state.sb = w.sb;
    as(workshop);
    expect(await rejected(list(CASE_FB, "user-binder"))).toBe(403);
  });
});

describe("l'admin (le concierge)", () => {
  it("lit tous les canaux", async () => {
    state.sb = world().sb;
    as(platform);
    expect(await bodies(CASE_FB, "user-admin")).toHaveLength(4);
  });

  it("écrit par défaut dans le canal du client, et le client en est notifié", async () => {
    const w = world();
    state.sb = w.sb;
    as(platform);
    await send(CASE_FB, "user-admin");
    expect(w.writes.find((x) => x.table === "marketplace_messages")?.values).toMatchObject({ sender_role: "admin", audience: "customer_concierge" });
    expect(state.sent).toHaveLength(1);
  });

  it("peut écrire dans le canal atelier : le client n'en est PAS notifié", async () => {
    const w = world();
    state.sb = w.sb;
    as(platform);
    await send(CASE_FB, "user-admin", { audience: "workshop_platform" });
    expect(w.writes.find((x) => x.table === "marketplace_messages")?.values).toMatchObject({ audience: "workshop_platform" });
    expect(state.sent).toHaveLength(0);
  });

  it("ne peut pas écrire dans un fil partagé qui n'existe pas en modèle concierge (422)", async () => {
    const w = world();
    state.sb = w.sb;
    as(platform);
    expect(await rejected(send(CASE_FB, "user-admin", { audience: "shared" }))).toBe(422);
    expect(w.writes.find((x) => x.table === "marketplace_messages")).toBeUndefined();
  });

  it("une audience inconnue est refusée avant toute écriture", async () => {
    const w = world();
    state.sb = w.sb;
    as(platform);
    // La validation d'entrée lève avant même la promesse : on enveloppe l'appel.
    expect(await rejected((async () => send(CASE_FB, "user-admin", { audience: "everyone" }))())).not.toBeNull();
    expect(w.writes).toHaveLength(0);
  });
});

describe("la lecture est filtrée DANS la requête, pas après coup", () => {
  it("la requête de lecture porte le filtre d'audience (contrat de source)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../services/messaging.data.functions.ts", import.meta.url), "utf8");
    const list = src.slice(src.indexOf("export const listCaseMessages"), src.indexOf("export const sendCaseMessage"));
    expect(list).toMatch(/\.in\("audience", \[\.\.\.audiences\]\)/);
    expect(list.indexOf('.in("audience"')).toBeLessThan(list.indexOf(".order("));
  });
});
