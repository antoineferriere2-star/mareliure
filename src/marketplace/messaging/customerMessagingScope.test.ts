/**
 * Ce qu'un client lit — et de quoi il est notifié — dans le fil de son dossier,
 * selon sa marque : le comportement réel de `listCaseMessages`,
 * `sendCaseMessage` et `unreadCountsByCase`, avec un faux client Supabase.
 *
 * Ma Reliure : un fil partagé avec l'atelier. Fine Bindery : modèle concierge,
 * le client ne reçoit jamais un message d'atelier (`customerWorkshopDirectMessaging`).
 * Ce que LIT l'atelier n'est pas touché par ce chantier, et un test le fige.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/marketplace/permissions";

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  sb: null as unknown,
  viewer: { role: "anonymous" } as unknown,
  sent: [] as { to: string; templateData: Record<string, unknown>; brand: string }[],
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
  sendTemplateEmail: async (_name: string, to: string, options: { templateData: Record<string, unknown>; brand: string }) => {
    state.sent.push({ to, templateData: options.templateData, brand: options.brand });
  },
}));

const { listCaseMessages, sendCaseMessage, unreadCountsByCase } = await import(
  "@/marketplace/services/messaging.data.functions"
);
const { readableAudiences } = await import("./audience");

const CASE_FB = "11111111-1111-4111-8111-111111111111";
const CASE_MR = "22222222-2222-4222-8222-222222222222";
const CUSTOMER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STRANGER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Un faux client Supabase : filtres `eq`/`in`, insertions enregistrées. */
function fakeSb(tables: Record<string, Row[]>) {
  const writes: { table: string; values: Row; upsert?: boolean }[] = [];
  const from = (table: string) => {
    let rows = (tables[table] ?? []).map((row) => ({ ...row }));
    let inserted: Row | null = null;
    const query: Record<string, unknown> = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        rows = rows.filter((row) => row[column] === value);
        return query;
      },
      in: (column: string, values: unknown[]) => {
        rows = rows.filter((row) => values.includes(row[column]));
        return query;
      },
      order: () => query,
      maybeSingle: async () => ({ data: inserted ?? rows[0] ?? null, error: null }),
      single: async () => ({ data: inserted ?? rows[0] ?? null, error: null }),
      insert: (values: Row) => {
        writes.push({ table, values });
        inserted = { id: "new-message", created_at: "2026-09-19T12:00:00.000Z" };
        return query;
      },
      upsert: async (values: Row) => {
        writes.push({ table, values, upsert: true });
        return { error: null };
      },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve, reject),
    };
    return query;
  };
  return {
    writes,
    sb: {
      from,
      auth: { admin: { getUserById: async () => ({ data: { user: { email: "client@example.test" } } }) } },
    },
  };
}

const message = (id: string, caseId: string, role: string, body: string, minute: number, audience = "shared"): Row => ({
  id,
  case_id: caseId,
  sender_user_id: role === "customer" ? CUSTOMER : `user-${role}`,
  sender_role: role,
  audience,
  body,
  attachment_paths: null,
  created_at: `2026-09-18T10:0${minute}:00.000Z`,
  deleted_at: null,
});

function world() {
  const tables: Record<string, Row[]> = {
    marketplace_cases: [
      { id: CASE_FB, customer_user_id: CUSTOMER, brand: "FINE_BINDERY" },
      { id: CASE_MR, customer_user_id: CUSTOMER, brand: "MA_RELIURE" },
    ],
    marketplace_case_matches: [
      { case_id: CASE_FB, binder_id: "b1", state: "selected" },
      { case_id: CASE_MR, binder_id: "b1", state: "selected" },
    ],
    marketplace_binders: [
      { id: "b1", status: "approved" },
      { id: "b-susp", status: "suspended" },
      { id: "b-rej", status: "rejected" },
    ],
    marketplace_messages: [
      message("f1", CASE_FB, "customer", "customer question", 1, "customer_concierge"),
      message("f2", CASE_FB, "admin", "concierge answer", 2, "customer_concierge"),
      message("f3", CASE_FB, "binder", "workshop note", 3, "workshop_platform"),
      message("f4", CASE_FB, "admin", "concierge to workshop", 4, "workshop_platform"),
      message("m1", CASE_MR, "customer", "question client", 1),
      message("m2", CASE_MR, "admin", "réponse équipe", 2),
      message("m3", CASE_MR, "binder", "note de l'atelier", 3),
    ],
    marketplace_conversation_reads: [],
  };
  return fakeSb(tables);
}

const asCustomer = (userId = CUSTOMER): Viewer => ({ role: "customer", userId });
const context = (userId: string) => ({ supabase: {}, userId, claims: {} });
const bodies = (result: { messages: { body: string | null }[] }) => result.messages.map((m) => m.body);

beforeEach(() => {
  state.sent = [];
  state.viewer = asCustomer();
});

describe("la règle : qui lit quoi (audiences persistées)", () => {
  it("le client : Ma Reliure le fil partagé ; Fine Bindery seulement son canal concierge — jamais celui de l'atelier", () => {
    expect(readableAudiences("customer", true)).toEqual(["shared", "customer_concierge"]);
    expect(readableAudiences("customer", false)).toEqual(["customer_concierge"]);
    expect(readableAudiences("customer", true)).not.toContain("workshop_platform");
    expect(readableAudiences("customer", false)).not.toContain("workshop_platform");
  });
});

describe("listCaseMessages", () => {
  it("Fine Bindery — le client ne reçoit aucun message d'atelier, le concierge et lui-même seulement", async () => {
    const { sb } = world();
    state.sb = sb;
    const result = await listCaseMessages({ context: context(CUSTOMER), data: { caseId: CASE_FB } } as never);
    expect(bodies(result as never)).toEqual(["customer question", "concierge answer"]);
    expect(JSON.stringify(result)).not.toContain("workshop note");
    expect(JSON.stringify(result)).not.toContain("concierge to workshop");
    expect((result as { messages: { senderRole: string }[] }).messages.map((m) => m.senderRole)).not.toContain("binder");
  });

  it("Ma Reliure — le fil partagé avec l'atelier est inchangé", async () => {
    const { sb } = world();
    state.sb = sb;
    const result = await listCaseMessages({ context: context(CUSTOMER), data: { caseId: CASE_MR } } as never);
    expect(bodies(result as never)).toEqual(["question client", "réponse équipe", "note de l'atelier"]);
  });

  it("Fine Bindery — l'atelier retenu ne lit QUE son canal avec la plateforme, jamais l'échange client ↔ concierge (P1-6)", async () => {
    const { sb } = world();
    state.sb = sb;
    state.viewer = { role: "binder", binderId: "b1" };
    const result = await listCaseMessages({ context: context("user-binder"), data: { caseId: CASE_FB } } as never);
    expect(bodies(result as never)).toEqual(["workshop note", "concierge to workshop"]);
    expect(JSON.stringify(result)).not.toContain("customer question");
    expect(JSON.stringify(result)).not.toContain("concierge answer");
  });

  it("Ma Reliure — l'atelier retenu lit toujours le fil partagé, comme avant", async () => {
    const { sb } = world();
    state.sb = sb;
    state.viewer = { role: "binder", binderId: "b1" };
    const result = await listCaseMessages({ context: context("user-binder"), data: { caseId: CASE_MR } } as never);
    expect(bodies(result as never)).toEqual(["question client", "réponse équipe", "note de l'atelier"]);
  });

  it("l'admin (le concierge) lit tous les canaux", async () => {
    const { sb } = world();
    state.sb = sb;
    state.viewer = { role: "admin" };
    const result = await listCaseMessages({ context: context("user-admin"), data: { caseId: CASE_FB } } as never);
    expect(bodies(result as never)).toHaveLength(4);
  });

  it("un autre compte n'a accès à aucun fil", async () => {
    const { sb } = world();
    state.sb = sb;
    state.viewer = asCustomer(STRANGER);
    await expect(
      listCaseMessages({ context: context(STRANGER), data: { caseId: CASE_FB } } as never),
    ).rejects.toThrow();
  });
});

describe("unreadCountsByCase", () => {
  it("un message d'un canal que le client ne peut pas lire n'entre pas dans ses non-lus", async () => {
    const { sb } = world();
    const readable = new Map<string, readonly string[]>([
      [CASE_FB, readableAudiences("customer", false)],
      [CASE_MR, readableAudiences("customer", true)],
    ]);
    const counts = await unreadCountsByCase(sb as never, [CASE_FB, CASE_MR], CUSTOMER, readable);
    // FB : seul le concierge (le client ne compte pas ses propres messages) ; MR : équipe + atelier.
    expect(counts.get(CASE_FB)).toBe(1);
    expect(counts.get(CASE_MR)).toBe(2);
  });

  it("un dossier sans audience lisible (atelier invité, non retenu) n'a AUCUN non-lu — jamais un compte qui trahirait le fil", async () => {
    const { sb } = world();
    const counts = await unreadCountsByCase(sb as never, [CASE_FB, CASE_MR], "user-binder", new Map());
    expect(counts.get(CASE_FB)).toBe(0);
    expect(counts.get(CASE_MR)).toBe(0);
  });

  it("l'atelier retenu ne compte que son canal sur Fine Bindery", async () => {
    const { sb } = world();
    const counts = await unreadCountsByCase(sb as never, [CASE_FB], "user-binder", new Map([[CASE_FB, readableAudiences("binder", false)]]));
    // f3 (sien, ignoré) ; f4 (concierge → atelier) compte.
    expect(counts.get(CASE_FB)).toBe(1);
  });
});

describe("sendCaseMessage : la notification e-mail du client", () => {
  const send = (caseId: string, viewer: Viewer, userId: string) => {
    state.viewer = viewer;
    return sendCaseMessage({ context: context(userId), data: { caseId, body: "Bonjour" } } as never);
  };

  it("Fine Bindery — un message d'atelier ne notifie pas un client qui ne peut pas le lire", async () => {
    const { sb } = world();
    state.sb = sb;
    await send(CASE_FB, { role: "binder", binderId: "b1" }, "user-binder");
    expect(state.sent).toHaveLength(0);
  });

  it("Fine Bindery — un message du concierge notifie le client, et nomme le concierge, pas l'atelier", async () => {
    const { sb } = world();
    state.sb = sb;
    await send(CASE_FB, { role: "admin" }, "user-admin");
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0].brand).toBe("FINE_BINDERY");
    expect(state.sent[0].templateData.intro).toBe("Your Fine Bindery concierge wrote to you about your book.");
    expect(JSON.stringify(state.sent[0].templateData)).not.toMatch(/workshop/i);
  });

  it("Ma Reliure — un message d'atelier notifie toujours le client, dans les mêmes mots qu'avant", async () => {
    const { sb } = world();
    state.sb = sb;
    await send(CASE_MR, { role: "binder", binderId: "b1" }, "user-binder");
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0].brand).toBe("MA_RELIURE");
    expect(state.sent[0].templateData.intro).toBe("Votre atelier ou Ma Reliure vous a écrit au sujet de votre livre.");
  });

  it("un message du client ne notifie jamais le client", async () => {
    const { sb } = world();
    state.sb = sb;
    await send(CASE_FB, asCustomer(), CUSTOMER);
    await send(CASE_MR, asCustomer(), CUSTOMER);
    expect(state.sent).toHaveLength(0);
  });
});

describe("le contrat de la marque", () => {
  it("la règle vient du drapeau de marque customerWorkshopDirectMessaging — désormais lu", () => {
    const server = readFileSync(resolve(process.cwd(), "src/marketplace/services/messaging.data.functions.ts"), "utf8");
    expect(server).toContain("customerCanReadAudience(audience, directWorkshopMessaging)");
    expect(server).toContain("config.messaging.customerWorkshopDirectMessaging");
    const list = readFileSync(resolve(process.cwd(), "src/marketplace/services/marketplace.data.functions.ts"), "utf8");
    expect(list).toContain("marketplaceBrandConfig(brand).messaging.customerWorkshopDirectMessaging");
  });
});
