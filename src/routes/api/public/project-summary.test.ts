import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { generateAccessToken, hashAccessToken } from "@/build/services/dossierAccessToken.server";
import { handleGetSummary } from "./project-summary";

type Row = Record<string, unknown>;

/** Minimal in-memory fake — same pattern as build-runtime.test.ts's FakeQuery, narrowed to what handleGetSummary needs (select/eq/update/maybeSingle + a signed-URL storage stub). */
class FakeQuery implements PromiseLike<{ data: unknown; error: unknown }> {
  private filters: ((r: Row) => boolean)[] = [];
  private mode: "select" | "update" = "select";
  private patch: Row | null = null;

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
  update(patch: Row) {
    this.mode = "update";
    this.patch = patch;
    return this;
  }

  private matchedRows(): Row[] {
    const rows = this.store.get(this.tableName) ?? [];
    return rows.filter((r) => this.filters.every((f) => f(r)));
  }

  private execute() {
    if (this.mode === "update") {
      const matched = this.matchedRows();
      matched.forEach((r) => Object.assign(r, this.patch));
      return { data: matched, error: null };
    }
    return { data: this.matchedRows(), error: null };
  }

  maybeSingle() {
    const { data, error } = this.execute();
    return Promise.resolve({ data: data.length > 0 ? data[0] : null, error });
  }
  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

function createFakeSupabase(seed: Record<string, Row[]> = {}) {
  const store = new Map<string, Row[]>(Object.entries(seed).map(([k, v]) => [k, [...v]]));
  return {
    store,
    client: {
      from(table: string) {
        return new FakeQuery(store, table);
      },
      storage: {
        from(_bucket: string) {
          return {
            async createSignedUrl(path: string) {
              return { data: { signedUrl: `https://signed.example/${path}` }, error: null };
            },
          };
        },
      },
    } as unknown as Parameters<typeof handleGetSummary>[0],
  };
}

const workspaceASummary = {
  version: 1,
  locale: "en-US",
  measurementSystem: "imperial",
  businessName: "Workspace A Decks",
  summary: "Workspace A's project.",
  confirmedItems: [],
  calculatedItems: [],
  itemsToConfirm: [],
  budgetAndTimingItems: [],
  photos: [{ path: "workspace-a/photo.jpg" }],
  confirmationText: null,
  submittedAt: "2026-07-29T00:00:00.000Z",
};

const workspaceBSummary = { ...workspaceASummary, businessName: "Workspace B Decks" };

async function jsonOf(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

describe("handleGetSummary", () => {
  it("returns the summary for a valid, unexpired, unrevoked token", async () => {
    const dossierAId = randomUUID();
    const rawToken = generateAccessToken();
    const { client } = createFakeSupabase({
      build_dossier_access_tokens: [
        {
          id: randomUUID(),
          dossier_id: dossierAId,
          token_hash: hashAccessToken(rawToken),
          expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          revoked_at: null,
        },
      ],
      build_dossiers: [{ id: dossierAId, visitor_summary: workspaceASummary }],
    });
    const res = await handleGetSummary(client, rawToken);
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    const summary = body.summary as Record<string, unknown>;
    expect(summary.businessName).toBe("Workspace A Decks");
    // Photo path resolved to a signed URL, never left as a bare storage path.
    expect((summary.photos as { url: string }[])[0].url).toBe(
      "https://signed.example/workspace-a/photo.jpg",
    );
    // Never a dossier id anywhere in the response.
    expect(JSON.stringify(body)).not.toContain(dossierAId);
  });

  it("never leaks storage paths, bucket names, or any internal id in the public response", async () => {
    const dossierId = randomUUID();
    const workspaceId = randomUUID();
    const missionId = randomUUID();
    const sessionId = randomUUID();
    const rawToken = generateAccessToken();
    const storagePath = "workspace-a/secret-photo-path.jpg";
    const { client } = createFakeSupabase({
      build_dossier_access_tokens: [
        {
          id: randomUUID(),
          dossier_id: dossierId,
          token_hash: hashAccessToken(rawToken),
          expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          revoked_at: null,
        },
      ],
      build_dossiers: [
        {
          id: dossierId,
          // Extra internal ids embedded in the snapshot to prove the
          // response is built strictly from an allow-listed shape, not by
          // forwarding whatever happens to live in visitor_summary.
          workspace_id: workspaceId,
          mission_id: missionId,
          session_id: sessionId,
          visitor_summary: {
            ...workspaceASummary,
            photos: [{ path: storagePath, caption: "Backyard" }],
          },
        },
      ],
    });
    const res = await handleGetSummary(client, rawToken);
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    const raw = JSON.stringify(body);

    // Internal ids must never appear anywhere in the response, regardless
    // of what the underlying dossier row happens to carry.
    expect(raw).not.toContain(dossierId);
    expect(raw).not.toContain(workspaceId);
    expect(raw).not.toContain(missionId);
    expect(raw).not.toContain(sessionId);

    // The photo must expose exactly { url, caption } — no raw storage path
    // or bucket name as a standalone field. (The signed url legitimately
    // embeds the path/bucket as part of pointing at the right object —
    // that's expected and not a leak — but there must be no separate,
    // reusable, unsigned reference to it.)
    const photo = (body.summary as Record<string, unknown>).photos as Record<string, unknown>[];
    expect(Object.keys(photo[0]).sort()).toEqual(["caption", "url"]);
    expect(photo[0].url).toBe("https://signed.example/" + storagePath);
  });

  it("rejects an unknown token with the generic not-available response", async () => {
    const { client } = createFakeSupabase();
    const res = await handleGetSummary(client, generateAccessToken());
    expect(res.status).toBe(404);
    expect(await jsonOf(res)).toEqual({ error: "This summary link is not available." });
  });

  it("rejects a revoked token with the exact same generic response as an unknown token", async () => {
    const dossierId = randomUUID();
    const rawToken = generateAccessToken();
    const { client } = createFakeSupabase({
      build_dossier_access_tokens: [
        {
          id: randomUUID(),
          dossier_id: dossierId,
          token_hash: hashAccessToken(rawToken),
          expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          revoked_at: new Date().toISOString(),
        },
      ],
      build_dossiers: [{ id: dossierId, visitor_summary: workspaceASummary }],
    });
    const res = await handleGetSummary(client, rawToken);
    expect(res.status).toBe(404);
    expect(await jsonOf(res)).toEqual({ error: "This summary link is not available." });
  });

  it("rejects an expired token with the exact same generic response", async () => {
    const dossierId = randomUUID();
    const rawToken = generateAccessToken();
    const { client } = createFakeSupabase({
      build_dossier_access_tokens: [
        {
          id: randomUUID(),
          dossier_id: dossierId,
          token_hash: hashAccessToken(rawToken),
          expires_at: new Date(Date.now() - 1000).toISOString(), // 1s in the past
          revoked_at: null,
        },
      ],
      build_dossiers: [{ id: dossierId, visitor_summary: workspaceASummary }],
    });
    const res = await handleGetSummary(client, rawToken);
    expect(res.status).toBe(404);
    expect(await jsonOf(res)).toEqual({ error: "This summary link is not available." });
  });

  it("never returns another workspace's dossier for a guessed/malformed token (no direct-object-access)", async () => {
    const dossierAId = randomUUID();
    const dossierBId = randomUUID();
    const rawTokenA = generateAccessToken();
    const { client } = createFakeSupabase({
      build_dossier_access_tokens: [
        {
          id: randomUUID(),
          dossier_id: dossierAId,
          token_hash: hashAccessToken(rawTokenA),
          expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          revoked_at: null,
        },
      ],
      build_dossiers: [
        { id: dossierAId, visitor_summary: workspaceASummary },
        { id: dossierBId, visitor_summary: workspaceBSummary },
      ],
    });

    // Token A correctly returns only workspace A's data.
    const resA = await handleGetSummary(client, rawTokenA);
    const bodyA = await jsonOf(resA);
    expect((bodyA.summary as Record<string, unknown>).businessName).toBe("Workspace A Decks");

    // Attempting to use dossier B's raw UUID (or any other guessed value) as
    // if it were a token never matches any token_hash — cross-workspace
    // access via a guessed identifier is structurally impossible here.
    const resGuessed = await handleGetSummary(client, dossierBId.replace(/-/g, "").padEnd(64, "0"));
    expect(resGuessed.status).toBe(404);
    expect(await jsonOf(resGuessed)).toEqual({ error: "This summary link is not available." });
  });

  it("returns the generic response when the dossier's visitor_summary is missing", async () => {
    const dossierId = randomUUID();
    const rawToken = generateAccessToken();
    const { client } = createFakeSupabase({
      build_dossier_access_tokens: [
        {
          id: randomUUID(),
          dossier_id: dossierId,
          token_hash: hashAccessToken(rawToken),
          expires_at: null,
          revoked_at: null,
        },
      ],
      build_dossiers: [{ id: dossierId, visitor_summary: null }],
    });
    const res = await handleGetSummary(client, rawToken);
    expect(res.status).toBe(404);
    expect(await jsonOf(res)).toEqual({ error: "This summary link is not available." });
  });

  it("allows a null expires_at (no expiry) to still succeed", async () => {
    const dossierId = randomUUID();
    const rawToken = generateAccessToken();
    const { client } = createFakeSupabase({
      build_dossier_access_tokens: [
        {
          id: randomUUID(),
          dossier_id: dossierId,
          token_hash: hashAccessToken(rawToken),
          expires_at: null,
          revoked_at: null,
        },
      ],
      build_dossiers: [{ id: dossierId, visitor_summary: workspaceASummary }],
    });
    const res = await handleGetSummary(client, rawToken);
    expect(res.status).toBe(200);
  });
});
