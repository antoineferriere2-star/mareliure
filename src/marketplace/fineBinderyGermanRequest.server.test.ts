import { describe, expect, it } from "vitest";
import { reconcileCaseTriage } from "./services/caseRepository.server";

type Row = Record<string, unknown>;

function germanRequestClient(source: string | null = "finebindery_profile", found = true, status = "under_review") {
  const updates: Row[] = [];
  const matches: Row[] = [];
  const events: Row[] = [];
  const answers = {
    _request_source: source,
    _referral_slug: "atelier-martin",
    _submission_locale: "de",
    _preferred_language: "de",
  };

  class Query implements PromiseLike<{ data: unknown; error: null }> {
    private exclusions: Array<[string, unknown]> = [];
    private operation: "select" | "update" | "upsert" | "insert" = "select";
    constructor(private table: string) {}
    select() { this.operation = "select"; return this; }
    update(value: Row) { this.operation = "update"; updates.push(value); return this; }
    upsert(value: Row) { this.operation = "upsert"; matches.push(value); return this; }
    insert(value: Row) { this.operation = "insert"; events.push(value); return this; }
    eq() { return this; }
    is() { return this; }
    neq(column: string, value: unknown) { this.exclusions.push([column, value]); return this; }
    limit() { return this; }
    async maybeSingle() {
      if (this.table === "build_dossiers") return { data: { session_id: "session-de" }, error: null };
      if (this.table === "build_runtime_sessions") return { data: { answers }, error: null };
      if (this.table === "marketplace_binders") return { data: found ? { id: "binder-martin", display_name: "Martin", workshop_name: "Atelier Martin" } : null, error: null };
      return { data: null, error: null };
    }
    then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      const data = this.table === "marketplace_cases" && this.operation === "select"
        ? [{ id: "case-de", dossier_id: "dossier-de", status }].filter((row) => this.exclusions.every(([column, value]) => (row as Row)[column] !== value))
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
  it("ne réattribue pas un dossier annulé encore sans tri", async () => {
    const { client, updates, matches, events } = germanRequestClient("finebindery_profile", true, "cancelled");
    await expect(reconcileCaseTriage(client as never)).resolves.toBe(0);
    expect(updates).toEqual([]);
    expect(matches).toEqual([]);
    expect(events).toEqual([]);
  });
  it("rattache aussi une demande du lien personnel Ma Reliure au seul atelier référent", async () => {
    const { client, updates, matches } = germanRequestClient(null);
    await reconcileCaseTriage(client as never);
    expect(updates).toContainEqual(expect.objectContaining({ acquisition_origin: "BINDER_REFERRED", referred_binder_id: "binder-martin" }));
    expect(matches).toEqual([expect.objectContaining({ case_id: "case-de", binder_id: "binder-martin", state: "invited" })]);
  });
  it("un atelier devenu indisponible ne transforme jamais son client propre en vente Oppe", async () => {
    const { client, updates, matches, events } = germanRequestClient(null, false);
    await reconcileCaseTriage(client as never);
    expect(updates).toContainEqual(expect.objectContaining({ acquisition_origin: "BINDER_REFERRED", referred_binder_id: null, manual_review_required: true, triage_flags: expect.arrayContaining(["unresolved_workshop_referral"]) }));
    expect(matches).toEqual([]);
    expect(events).toEqual([]);
  });
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
