import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import {
  bodySchema,
  findPublishedMission,
  handleGetMission,
  handleSaveSession,
  handleStartSession,
  handleSubmitSession,
} from "./build-runtime";

type Row = Record<string, unknown>;

/**
 * Minimal in-memory fake of the subset of the supabase-js query builder this
 * route uses (select/eq/is/insert/update + maybeSingle/single). Good enough
 * to exercise the actual handler logic without a real Postgres instance.
 */
class FakeQuery implements PromiseLike<{ data: unknown; error: unknown }> {
  private filters: ((r: Row) => boolean)[] = [];
  private mode: "select" | "insert" | "update" = "select";
  private patch: Row | null = null;
  private insertRows: Row[] = [];

  constructor(
    private store: Map<string, Row[]>,
    private tableName: string,
  ) {}

  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  is(col: string, _val: null) {
    this.filters.push((r) => r[col] === null || r[col] === undefined);
    return this;
  }
  insert(rows: Row | Row[]) {
    this.mode = "insert";
    this.insertRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
    this.patch = patch;
    return this;
  }

  private matchedRows(): Row[] {
    const rows = this.store.get(this.tableName) ?? [];
    return rows.filter((r) => this.filters.every((f) => f(r)));
  }

  private execute(): { data: Row[] | null; error: { code?: string; message: string } | null } {
    if (this.mode === "insert") {
      const rows = this.store.get(this.tableName) ?? [];
      const created: Row[] = [];
      for (const r of this.insertRows) {
        if (this.tableName === "build_dossiers" && r.session_id != null) {
          const dup = rows.some((existing) => existing.session_id === r.session_id);
          if (dup) {
            return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
          }
        }
        const row: Row = {
          id: randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...r,
        };
        rows.push(row);
        created.push(row);
      }
      this.store.set(this.tableName, rows);
      return { data: created, error: null };
    }
    if (this.mode === "update") {
      const matched = this.matchedRows();
      matched.forEach((r) => Object.assign(r, this.patch));
      return { data: matched, error: null };
    }
    return { data: this.matchedRows(), error: null };
  }

  maybeSingle() {
    const { data, error } = this.execute();
    return Promise.resolve({ data: data && data.length > 0 ? data[0] : null, error });
  }
  single() {
    const { data, error } = this.execute();
    if (!data || data.length === 0) {
      return Promise.resolve({ data: null, error: error ?? { message: "no rows" } });
    }
    return Promise.resolve({ data: data[0], error });
  }
  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

function createFakeSupabase(seed: Record<string, Row[]> = {}) {
  const store = new Map<string, Row[]>(Object.entries(seed).map(([k, v]) => [k, [...v]]));
  return {
    store,
    // Cast to keep call sites (written against SupabaseClient<Database>) simple in tests.
    client: {
      from(table: string) {
        return new FakeQuery(store, table);
      },
    } as unknown as Parameters<typeof findPublishedMission>[0],
  };
}

function seedActiveMission(overrides: Partial<Row> = {}) {
  return {
    id: randomUUID(),
    name: "Refonte site vitrine",
    status: "active",
    objective: "Qualifier le besoin",
    playbook_id: null,
    playbook_name: null,
    public_token: "tok_" + randomUUID().replace(/-/g, ""),
    public_token_revoked_at: null,
    proposal: { qualificationQuestions: ["Quel est votre budget ?"] },
    workspace_id: null,
    ...overrides,
  };
}

describe("bodySchema", () => {
  it("refuse un mission_id sur get_mission (seul public_token est accepté)", () => {
    const result = bodySchema.safeParse({ action: "get_mission", mission_id: randomUUID() });
    expect(result.success).toBe(false);
  });

  it("refuse un mission_id sur start_session (seul public_token est accepté)", () => {
    const result = bodySchema.safeParse({ action: "start_session", mission_id: randomUUID() });
    expect(result.success).toBe(false);
  });

  it("accepte start_session avec un public_token valide", () => {
    const result = bodySchema.safeParse({ action: "start_session", public_token: "a".repeat(20) });
    expect(result.success).toBe(true);
  });
});

describe("findPublishedMission / handleGetMission", () => {
  it("refuse une mission dont le lien public a été révoqué", async () => {
    const mission = seedActiveMission({ public_token_revoked_at: new Date().toISOString() });
    const { client } = createFakeSupabase({ build_missions: [mission] });

    const res = await handleGetMission(client, mission.public_token as string);
    expect(res.status).toBe(404);
  });

  it("refuse une mission qui n'est pas active (draft)", async () => {
    const mission = seedActiveMission({ status: "draft" });
    const { client } = createFakeSupabase({ build_missions: [mission] });

    const res = await handleGetMission(client, mission.public_token as string);
    expect(res.status).toBe(404);
  });

  it("retourne la mission quand elle est active et non révoquée", async () => {
    const mission = seedActiveMission();
    const { client } = createFakeSupabase({ build_missions: [mission] });

    const res = await handleGetMission(client, mission.public_token as string);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mission.id).toBe(mission.id);
  });
});

describe("possession de session (session_id + session_secret)", () => {
  it("refuse save_session avec le mauvais secret", async () => {
    const mission = seedActiveMission();
    const { client } = createFakeSupabase({ build_missions: [mission] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session } = await started.json();

    const res = await handleSaveSession(client, session.id, "wrong-secret-wrong-secret-wrong", { q0: "hello" });
    expect(res.status).toBe(404);
  });

  it("accepte save_session avec le bon secret", async () => {
    const mission = seedActiveMission();
    const { client } = createFakeSupabase({ build_missions: [mission] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session, session_secret } = await started.json();

    const res = await handleSaveSession(client, session.id, session_secret, { q0: "hello" });
    expect(res.status).toBe(200);
  });
});

describe("soumission idempotente", () => {
  it("une double soumission ne crée pas deux dossiers et renvoie le même dossier", async () => {
    const mission = seedActiveMission();
    const { client, store } = createFakeSupabase({ build_missions: [mission] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session, session_secret } = await started.json();

    const first = await handleSubmitSession(client, session.id, session_secret, { q0: "answer" });
    expect(first.status).toBe(200);
    const firstBody = await first.json();

    const second = await handleSubmitSession(client, session.id, session_secret, { q0: "answer" });
    expect(second.status).toBe(200);
    const secondBody = await second.json();

    expect(secondBody.dossier.id).toBe(firstBody.dossier.id);
    expect((store.get("build_dossiers") ?? []).length).toBe(1);
  });

  it("refuse submit_session avec le mauvais secret", async () => {
    const mission = seedActiveMission();
    const { client } = createFakeSupabase({ build_missions: [mission] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session } = await started.json();

    const res = await handleSubmitSession(client, session.id, "wrong-secret-wrong-secret-wrong", { q0: "x" });
    expect(res.status).toBe(404);
  });
});
