import { randomUUID } from "crypto";
import { describe, expect, it, vi } from "vitest";
import { playbookSchema, type PlaybookSchema } from "@/build/schema/playbook";
import type { AgentResult } from "@/build/ai/schema";
import type { ImageAnalysisOutput } from "@/build/ai/imageAnalysis";

const runImageAnalysisMock = vi.fn<() => Promise<AgentResult<ImageAnalysisOutput>>>();
vi.mock("@/build/ai/imageAnalysis", () => ({
  runImageAnalysis: (...args: unknown[]) => runImageAnalysisMock(...(args as [])),
}));

import {
  bodySchema,
  findPublishedMission,
  handleAnalyzeInspirationPhoto,
  handleGetMission,
  handleResumeSession,
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

function createFakeSupabase(seed: Record<string, Row[]> = {}, options: { uploadError?: { message: string } } = {}) {
  const store = new Map<string, Row[]>(Object.entries(seed).map(([k, v]) => [k, [...v]]));
  const uploadedPaths: string[] = [];
  return {
    store,
    uploadedPaths,
    // Cast to keep call sites (written against SupabaseClient<Database>) simple in tests.
    client: {
      from(table: string) {
        return new FakeQuery(store, table);
      },
      storage: {
        from(_bucket: string) {
          return {
            async upload(path: string) {
              if (options.uploadError) return { data: null, error: options.uploadError };
              uploadedPaths.push(path);
              return { data: { path }, error: null };
            },
          };
        },
      },
    } as unknown as Parameters<typeof findPublishedMission>[0],
  };
}

function inspirationPhotoSchema(): PlaybookSchema {
  return playbookSchema.parse({
    schemaVersion: 1,
    sections: [
      {
        id: "s1",
        title: "Section",
        steps: [
          {
            id: "step1",
            title: "Step",
            fields: [
              {
                key: "inspiration",
                label: "Photo d'inspiration",
                type: "inspiration_photo",
                maxFileSizeMb: 1,
                acceptMimeTypes: ["image/jpeg", "image/png"],
              },
            ],
          },
        ],
      },
    ],
    briefConfig: { suggestedNextActions: [{ label: "Next", value: "Follow up." }] },
  });
}

function minimalSchema(fieldDesirability: "optional" | "required" = "optional"): PlaybookSchema {
  return playbookSchema.parse({
    schemaVersion: 1,
    sections: [
      {
        id: "s1",
        title: "Section",
        steps: [
          {
            id: "step1",
            title: "Step",
            fields: [{ key: "note", label: "Note", type: "text", desirability: fieldDesirability }],
          },
        ],
      },
    ],
    briefConfig: {
      suggestedNextActions: [{ label: "Next", value: "Follow up." }],
    },
  });
}

function seedPlaybookVersion(schema: PlaybookSchema = minimalSchema()) {
  const row: Row = {
    id: randomUUID(),
    playbook_id: randomUUID(),
    version_number: 1,
    schema,
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  return row;
}

function seedActiveMission(overrides: Partial<Row> = {}, schema?: PlaybookSchema) {
  const versionRow = seedPlaybookVersion(schema);
  const mission: Row = {
    id: randomUUID(),
    name: "Refonte site vitrine",
    status: "active",
    objective: "Qualifier le besoin",
    playbook_id: null,
    playbook_name: null,
    playbook_version_id: versionRow.id,
    public_token: "tok_" + randomUUID().replace(/-/g, ""),
    public_token_revoked_at: null,
    proposal: null,
    workspace_id: null,
    ...overrides,
  };
  return { mission, versionRow };
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
    const { mission, versionRow } = seedActiveMission({ public_token_revoked_at: new Date().toISOString() });
    const { client } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const res = await handleGetMission(client, mission.public_token as string);
    expect(res.status).toBe(404);
  });

  it("refuse une mission qui n'est pas active (draft)", async () => {
    const { mission, versionRow } = seedActiveMission({ status: "draft" });
    const { client } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const res = await handleGetMission(client, mission.public_token as string);
    expect(res.status).toBe(404);
  });

  it("refuse une mission active sans playbook publié", async () => {
    const { mission } = seedActiveMission({ playbook_version_id: null });
    const { client } = createFakeSupabase({ build_missions: [mission] });

    const res = await handleGetMission(client, mission.public_token as string);
    expect(res.status).toBe(404);
  });

  it("retourne la mission et son schéma quand elle est active et non révoquée", async () => {
    const { mission, versionRow } = seedActiveMission();
    const { client } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const res = await handleGetMission(client, mission.public_token as string);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mission.id).toBe(mission.id);
    expect(body.playbook_schema.sections).toHaveLength(1);
  });
});

describe("possession de session (session_id + session_secret)", () => {
  it("refuse save_session avec le mauvais secret", async () => {
    const { mission, versionRow } = seedActiveMission();
    const { client } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session } = await started.json();

    const res = await handleSaveSession(client, session.id, "wrong-secret-wrong-secret-wrong", { note: "hello" });
    expect(res.status).toBe(404);
  });

  it("accepte save_session avec le bon secret", async () => {
    const { mission, versionRow } = seedActiveMission();
    const { client } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session, session_secret } = await started.json();

    const res = await handleSaveSession(client, session.id, session_secret, { note: "hello" });
    expect(res.status).toBe(200);
  });

  it("refuse save_session avec une clé de réponse inconnue du schéma", async () => {
    const { mission, versionRow } = seedActiveMission();
    const { client } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session, session_secret } = await started.json();

    const res = await handleSaveSession(client, session.id, session_secret, { not_a_real_field: "hello" });
    expect(res.status).toBe(400);
  });
});

describe("reprise de session (resume_session)", () => {
  it("restaure les réponses déjà sauvegardées avec le bon secret", async () => {
    const { mission, versionRow } = seedActiveMission();
    const { client } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session, session_secret } = await started.json();
    await handleSaveSession(client, session.id, session_secret, { note: "in progress" });

    const resumed = await handleResumeSession(client, session.id, session_secret);
    expect(resumed.status).toBe(200);
    const body = await resumed.json();
    expect(body.session.answers.note).toBe("in progress");
    expect(body.playbook_schema.sections).toHaveLength(1);
  });

  it("refuse resume_session avec le mauvais secret", async () => {
    const { mission, versionRow } = seedActiveMission();
    const { client } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session } = await started.json();

    const res = await handleResumeSession(client, session.id, "wrong-secret-wrong-secret-wrong");
    expect(res.status).toBe(404);
  });
});

describe("soumission", () => {
  it("refuse la soumission (422) quand un champ requis visible est manquant", async () => {
    const { mission, versionRow } = seedActiveMission({}, minimalSchema("required"));
    const { client } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session, session_secret } = await started.json();

    const res = await handleSubmitSession(client, session.id, session_secret, { note: "" });
    expect(res.status).toBe(422);
  });

  it("une double soumission ne crée pas deux dossiers et renvoie le même dossier", async () => {
    const { mission, versionRow } = seedActiveMission();
    const { client, store } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session, session_secret } = await started.json();

    const first = await handleSubmitSession(client, session.id, session_secret, { note: "answer" });
    expect(first.status).toBe(200);
    const firstBody = await first.json();

    const second = await handleSubmitSession(client, session.id, session_secret, { note: "answer" });
    expect(second.status).toBe(200);
    const secondBody = await second.json();

    expect(secondBody.dossier.id).toBe(firstBody.dossier.id);
    expect((store.get("build_dossiers") ?? []).length).toBe(1);
  });

  it("refuse submit_session avec le mauvais secret", async () => {
    const { mission, versionRow } = seedActiveMission();
    const { client } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session } = await started.json();

    const res = await handleSubmitSession(client, session.id, "wrong-secret-wrong-secret-wrong", { note: "x" });
    expect(res.status).toBe(404);
  });
});

describe("analyze_inspiration_photo", () => {
  const smallImage = Buffer.from("a-small-fake-image").toString("base64");

  it("refuse avec le mauvais secret", async () => {
    const { mission, versionRow } = seedActiveMission({}, inspirationPhotoSchema());
    const { client } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session } = await started.json();

    const res = await handleAnalyzeInspirationPhoto(
      client,
      session.id,
      "wrong-secret-wrong-secret-wrong",
      "inspiration",
      smallImage,
      "image/jpeg",
    );
    expect(res.status).toBe(404);
  });

  it("refuse une clé de champ inconnue ou d'un autre type", async () => {
    const { mission, versionRow } = seedActiveMission({}, minimalSchema());
    const { client } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session, session_secret } = await started.json();

    const res = await handleAnalyzeInspirationPhoto(client, session.id, session_secret, "note", smallImage, "image/jpeg");
    expect(res.status).toBe(400);
  });

  it("refuse un type MIME non autorisé par le champ", async () => {
    const { mission, versionRow } = seedActiveMission({}, inspirationPhotoSchema());
    const { client } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session, session_secret } = await started.json();

    const res = await handleAnalyzeInspirationPhoto(
      client,
      session.id,
      session_secret,
      "inspiration",
      smallImage,
      "application/pdf",
    );
    expect(res.status).toBe(400);
  });

  it("refuse une image dépassant maxFileSizeMb", async () => {
    const { mission, versionRow } = seedActiveMission({}, inspirationPhotoSchema());
    const { client } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session, session_secret } = await started.json();

    const oversized = Buffer.alloc(1024 * 1024 + 1, "a").toString("base64"); // > 1 MB limit
    const res = await handleAnalyzeInspirationPhoto(
      client,
      session.id,
      session_secret,
      "inspiration",
      oversized,
      "image/jpeg",
    );
    expect(res.status).toBe(400);
  });

  it("upload l'image et retourne les hypothèses en cas de succès", async () => {
    runImageAnalysisMock.mockResolvedValue({
      status: "ok",
      data: { materials: ["Composite"], elements: ["Garde-corps"], suggestedQuestions: ["Quelle surface ?"] },
    });
    const { mission, versionRow } = seedActiveMission({}, inspirationPhotoSchema());
    const { client, uploadedPaths } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session, session_secret } = await started.json();

    const res = await handleAnalyzeInspirationPhoto(
      client,
      session.id,
      session_secret,
      "inspiration",
      smallImage,
      "image/jpeg",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.photoPath).toContain(session.id);
    expect(body.hypotheses.materials).toEqual(["Composite"]);
    expect(uploadedPaths).toHaveLength(1);
  });

  it("retourne quand même photoPath si l'analyse IA échoue, pour permettre un nouvel essai sans ré-upload", async () => {
    runImageAnalysisMock.mockResolvedValue({ status: "error", error: "Réponse IA non structurée." });
    const { mission, versionRow } = seedActiveMission({}, inspirationPhotoSchema());
    const { client } = createFakeSupabase({ build_missions: [mission], build_playbook_versions: [versionRow] });

    const started = await handleStartSession(client, mission.public_token as string, "iphash");
    const { session, session_secret } = await started.json();

    const res = await handleAnalyzeInspirationPhoto(
      client,
      session.id,
      session_secret,
      "inspiration",
      smallImage,
      "image/jpeg",
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.photoPath).toBeTruthy();
  });
});
