import { randomUUID } from "crypto";
import { describe, expect, it, vi } from "vitest";
import { generateAccessToken, hashAccessToken } from "@/build/services/dossierAccessToken.server";
import { handleGetSummary } from "@/routes/api/public/project-summary";

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

import { extractPhotoReferences, foreignPhotoReference } from "@/build/engine/visitorSummary";
import { signCasePhotos } from "@/marketplace/services/caseRepository.server";
import { BOOKBINDING_MISSION_ID } from "@/build/constants";
vi.mock("@/brand", async (original) => ({
  ...(await original<typeof import("@/brand")>()),
  isMaReliure: true,
}));

const sessionA = "51000000-0000-4000-8000-000000000001";
const sessionB = "51000000-0000-4000-8000-000000000002";
const file = "51000000-0000-4000-8000-000000000099";
const own = `sessions/${sessionA}/${file}`;
const foreign = `sessions/${sessionB}/${file}`;
describe("audit19 — photo boundaries", () => {
  it("rejects another session and signs a valid path in its own session", async () => {
    expect(extractPhotoReferences({ photos: [{ storagePath: foreign }] }, sessionA)).toEqual([]);
    expect(foreignPhotoReference({ photoPath: foreign }, sessionA)).toBe(true);
    const { client } = createFakeSupabase();
    expect(await signCasePhotos(client, { photos: [{ storagePath: foreign }] }, sessionA)).toEqual(
      [],
    );
    expect(await signCasePhotos(client, { photos: [{ storagePath: own }] }, sessionA)).toHaveLength(
      1,
    );
    expect(await signCasePhotos(client, { photos: [{ storagePath: own }] }, null)).toEqual([]);
  });
  it("documents a legacy foreign reference still signed by the public summary handler", async () => {
    const rawToken = generateAccessToken();
    const dossierId = randomUUID();
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
      build_dossiers: [
        {
          id: dossierId,
          session_id: sessionA,
          mission_id: BOOKBINDING_MISSION_ID,
          visitor_summary: {
            version: 1,
            locale: "fr-FR",
            businessName: "Synthetic QA",
            itemsToConfirm: [],
            photos: [{ path: foreign }],
          },
        },
      ],
      build_runtime_sessions: [{ id: sessionA, answers: {} }],
    });
    const result = await handleGetSummary(client, rawToken);
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.summary.photos[0].url).toBe(`https://signed.example/${foreign}`);
  });
});
