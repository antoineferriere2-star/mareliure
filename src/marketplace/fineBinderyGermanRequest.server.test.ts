import { describe, expect, it } from "vitest";
import { reconcileCaseTriage } from "./services/caseRepository.server";

type Row = Record<string, unknown>;

function germanRequestClient() {
  const updates: Row[] = [];
  const matches: Row[] = [];
  const events: Row[] = [];
  const answers = {
    _request_source: "finebindery_profile",
    _referral_slug: "atelier-martin",
    _submission_locale: "de",
    _preferred_language: "de",
  };

  class Query implements PromiseLike<{ data: unknown; error: null }> {
    private operation: "select" | "update" | "upsert" | "insert" = "select";
    constructor(private table: string) {}
    select() { this.operation = "select"; return this; }
    update(value: Row) { this.operation = "update"; updates.push(value); return this; }
    upsert(value: Row) { this.operation = "upsert"; matches.push(value); return this; }
    insert(value: Row) { this.operation = "insert"; events.push(value); return this; }
    eq() { return this; }
    is() { return this; }
    limit() { return this; }
    async maybeSingle() {
      if (this.table === "build_dossiers") return { data: { session_id: "session-de" }, error: null };
      if (this.table === "build_runtime_sessions") return { data: { answers }, error: null };
      if (this.table === "marketplace_binders") return { data: { id: "binder-martin", display_name: "Martin", workshop_name: "Atelier Martin" }, error: null };
      return { data: null, error: null };
    }
    then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      const data = this.table === "marketplace_cases" && this.operation === "select"
        ? [{ id: "case-de", dossier_id: "dossier-de" }]
        : null;
      return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
    }
  }

  const client = {
    rpc: async () => ({ data: null, error: null }),
    from: (table: string) => new Query(table),
  };
  return { client, updates, matches, events };
}

describe("FineBindery German project routing", () => {
  it("stores German preferences and sends Atelier Martin an attributed invitation", async () => {
    const { client, updates, matches, events } = germanRequestClient();
    await expect(reconcileCaseTriage(client as never)).resolves.toBe(1);
    expect(updates).toContainEqual(expect.objectContaining({
      submission_locale: "de",
      preferred_language: "de",
      acquisition_origin: "FINEBINDERY_PROFILE",
      referred_binder_id: "binder-martin",
    }));
    expect(matches).toContainEqual(expect.objectContaining({
      case_id: "case-de",
      binder_id: "binder-martin",
      state: "invited",
    }));
    expect(events).toContainEqual(expect.objectContaining({
      event_type: "finebindery_profile_request_attributed",
    }));
  });
});
