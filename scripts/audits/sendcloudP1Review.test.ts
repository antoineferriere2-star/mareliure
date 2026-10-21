import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  adoptLeg,
  cancelLeg,
  declareLegAbsent,
  type LabelJobStore,
  type TransitionKind,
} from "../../src/marketplace/shipping/labelOrchestrator";
import { handleSendcloudWebhook } from "../../src/marketplace/shipping/sendcloudWebhook";
import { createSendcloudProvider } from "../../src/marketplace/shipping/sendcloudProvider.server";
import {
  RT,
  RT_OUT,
  RT_RET,
  reserveLeg,
  roundTripDb,
  putLabelObject,
} from "../../src/marketplace/shipping/roundTripTestDb.fixture";
import type { LabelProvider, ProviderLabel } from "../../src/marketplace/shipping/labelProvider";

// Regression assertions updated on 20 October 2026 after #136, #141, #142 and #149.
// Provider, PDF bytes and signatures are synthetic. PGlite is one PostgreSQL engine, not two backends.
let db: PGlite;
let saved: Map<string, Uint8Array>;
const pdf = new TextEncoder().encode("%PDF-synthetic-audit");
const secret = "synthetic-audit-signature-key";
beforeEach(async () => {
  db = await roundTripDb();
  saved = new Map();
});
afterEach(async () => {
  await db.close();
});
function store(): LabelJobStore {
  return {
    async job(id) {
      return (
        (
          await db.query<{ id: string; status: "ambiguous" }>(
            "SELECT id,status FROM marketplace_round_trip_label_jobs WHERE id=$1",
            [id],
          )
        ).rows[0] ?? null
      );
    },
    async transition(id, kind: TransitionKind, details, event = null) {
      const result = await db.query<{ r: { outcome: "applied" | "duplicate"; status: string } }>(
        "SELECT marketplace_round_trip_label_transition($1,$2,$3,$4::jsonb) r",
        [id, kind, event, JSON.stringify(details)],
      );
      return result.rows[0].r;
    },
    async savePrivateLabel(id, bytes) {
      const previous = saved.get(id);
      if (previous && Buffer.compare(Buffer.from(previous), Buffer.from(bytes)))
        throw Error("label_object_conflict");
      if (!previous) await putLabelObject(db, id);
      saved.set(id, bytes);
    },
    async discardPrivateLabel(id) {
      await db.query(
        "DELETE FROM storage.objects WHERE bucket_id='round-trip-labels-private' AND name=$1",
        [`${id}/label.pdf`],
      );
      saved.delete(id);
    },
  };
}
const status = async (id: string) => (await store().job(id))!.status as string;
async function ambiguous() {
  const id = await reserveLeg(db, "outbound");
  await store().transition(id, "response_ambiguous", {});
  return id;
}
function label(code = "1000", labelId = "701", reference?: string): ProviderLabel {
  return {
    provider: "sendcloud",
    labelId,
    reference,
    carrier: "QA",
    tracking: "SYNTHETIC-TRACKING",
    chargedTtcCents: null,
    status: { code, message: "Synthetic status" },
    pdf: async () => pdf,
  };
}
function provider(current: ProviderLabel, overrides: Partial<LabelProvider> = {}): LabelProvider {
  return {
    name: "sendcloud",
    create: async () => {
      throw Error("purchase_forbidden_in_audit");
    },
    findByReference: async (reference) => (current.reference === reference ? current : null),
    findByLabelId: async () => current,
    cancel: async () => ({ kind: "queued", reference: "synthetic-cancellation" }),
    ...overrides,
  };
}
async function webhook(p: LabelProvider, id = "701", timestamp = "1") {
  const body = JSON.stringify({ action: "parcel_status_changed", parcel: { id }, timestamp });
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = Buffer.from(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  ).toString("hex");
  return handleSendcloudWebhook(
    new Request("https://synthetic.invalid/webhook", {
      method: "POST",
      body,
      headers: { "sendcloud-signature": signature },
    }),
    {
      secret,
      provider: p,
      store: store(),
      jobByProviderLabel: async (labelId) =>
        (
          await db.query<{ id: string }>(
            "SELECT id FROM marketplace_round_trip_label_jobs WHERE provider='sendcloud' AND provider_label_id=$1",
            [labelId],
          )
        ).rows[0] ?? null,
    },
  );
}
async function addRate(valid = true) {
  await db.query(
    `INSERT INTO marketplace_round_trip_rate_approvals(case_id,proposal_id,binder_id,
    outbound_address_sha256,return_address_sha256,outbound_weight_grams,return_weight_grams,outbound_dimensions_mm,return_dimensions_mm,
    outbound_method,return_method,provider_quote_reference,coverage_evidence_reference,outbound_cost_ttc_cents,return_cost_ttc_cents,
    all_other_costs_ttc_cents,estimated_economic_cost_cents,economic_cost_evidence_reference,valid_until,reviewed_by,reviewed_at)
    SELECT case_id,proposal_id,binder_id,outbound_address_sha256,return_address_sha256,outbound_weight_grams,return_weight_grams,
    outbound_dimensions_mm,return_dimensions_mm,'synthetic-new','synthetic-new',provider_quote_reference,coverage_evidence_reference,
    outbound_cost_ttc_cents,return_cost_ttc_cents,all_other_costs_ttc_cents,estimated_economic_cost_cents,economic_cost_evidence_reference,
    now()+$1::interval,reviewed_by,now()+interval '1 second' FROM marketplace_round_trip_rate_approvals ORDER BY reviewed_at LIMIT 1`,
    [valid ? "1 day" : "-1 day"],
  );
}

describe("SQL tarifs versionnés — vraies migrations", () => {
  it("reuses the same reservation under concurrent queued calls", async () => {
    const [a, b] = await Promise.all([reserveLeg(db, "outbound"), reserveLeg(db, "outbound")]);
    expect(a).toBe(b);
    expect((await db.query("SELECT id FROM marketplace_round_trip_label_jobs")).rows).toHaveLength(
      1,
    );
  });
  it("uses the latest review and refuses it when expired, even if an older review is valid", async () => {
    await addRate(false);
    await expect(reserveLeg(db, "outbound")).rejects.toThrow(/current_rate_approval_required/);
  });
  it("resumes after expiry without selecting a new rate", async () => {
    const id = await reserveLeg(db, "outbound");
    await db.exec(
      "UPDATE marketplace_round_trip_rate_approvals SET valid_until=now()-interval '1 day'",
    );
    expect(await reserveLeg(db, "outbound")).toBe(id);
  });
  it("rejects changed return weight, but accepts the same dimensions in another orientation", async () => {
    await db.exec("UPDATE marketplace_case_logistics_plans SET return_weight_grams=451");
    await expect(reserveLeg(db, "return")).rejects.toThrow(/parcel_changed_rate_review_required/);
    await db.exec(
      "UPDATE marketplace_case_logistics_plans SET return_weight_grams=450,return_length_mm=60,return_width_mm=340,return_height_mm=240",
    );
    expect(await reserveLeg(db, "return")).toBeTruthy();
  });
  it("rejects a changed address hash", async () => {
    await expect(
      db.query("SELECT marketplace_reserve_round_trip_label($1,'outbound',$2,$3)", [
        RT.case,
        "c".repeat(64),
        RT_RET,
      ]),
    ).rejects.toThrow(/address_changed_review_required/);
  });
});

describe("adoption, absence et webhook — ordre des opérations", () => {
  it("records only one absence when two callers read ambiguous before either transition", async () => {
    const id = await ambiguous();
    let reads = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const underlying = store();
    const concurrent: LabelJobStore = {
      ...underlying,
      job: async (job) => {
        const result = await underlying.job(job);
        if (++reads === 2) release();
        await gate;
        return result;
      },
    };
    const results = await Promise.allSettled([
      declareLegAbsent(concurrent, id, "sendcloud", RT.admin, "Synthetic absence A"),
      declareLegAbsent(concurrent, id, "sendcloud", RT.admin, "Synthetic absence B"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(0);
    for (const result of results)
      if (result.status === "fulfilled")
        expect(result.value).toEqual({ state: "failed", code: "absent_confirmed" });
    expect(await status(id)).toBe("failed");
    expect(
      (
        await db.query(
          "SELECT id FROM marketplace_round_trip_label_events WHERE kind='purchase_failed'",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("a serial second absence requires review and writes no second failure", async () => {
    const id = await ambiguous();
    await declareLegAbsent(store(), id, "sendcloud", RT.admin, "Synthetic absence checked");
    expect(
      await declareLegAbsent(store(), id, "sendcloud", RT.admin, "Synthetic second click"),
    ).toMatchObject({ state: "review_required", code: "job_failed" });
  });
  it("absence refuses short evidence and missing actor", async () => {
    const id = await ambiguous();
    await expect(declareLegAbsent(store(), id, "sendcloud", RT.admin, "short")).rejects.toThrow(
      /label_transition_invalid/,
    );
    await expect(
      declareLegAbsent(store(), id, "sendcloud", "", "Synthetic absence checked"),
    ).rejects.toThrow(/label_transition_invalid/);
    expect(await status(id)).toBe("ambiguous");
  });
  it("adoption then cancelled webhook ends cancelled, duplicate webhook adds no tracking row", async () => {
    const id = await ambiguous();
    await adoptLeg(provider(label("1000", "701", id)), store(), id, "701");
    expect((await webhook(provider(label("2000", "701", id)))).status).toBe(200);
    expect(await status(id)).toBe("cancelled");
    expect((await webhook(provider(label("2000", "701", id)))).status).toBe(200);
    expect(
      (
        await db.query(
          "SELECT id FROM marketplace_round_trip_label_events WHERE kind='tracking_update'",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("refuses an already cancelled label and catches a cancellation before adoption commits", async () => {
    const id = await ambiguous();
    expect(await adoptLeg(provider(label("2000", "701", id)), store(), id, "701")).toEqual({
      state: "review_required",
      code: "label_unusable",
    });
    expect(saved.has(id)).toBe(false);
    let downloaded!: () => void;
    let resume!: () => void;
    const reading = new Promise<void>((resolve) => {
      downloaded = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const first = {
      ...label("1000", "701", id),
      pdf: async () => {
        downloaded();
        await gate;
        return pdf;
      },
    };
    let reads = 0;
    const p = provider(first, {
      findByLabelId: async () => (++reads === 1 ? first : label("2000", "701", id)),
    });
    const adoption = adoptLeg(p, store(), id, "701");
    await reading;
    const notification = await webhook(provider(label("2000", "701", id)));
    expect(await notification.json()).toEqual({ ignored: true });
    resume();
    expect(await adoption).toEqual({ state: "review_required", code: "label_unusable" });
    expect(await status(id)).toBe("cancelled");
    expect(reads).toBe(2);
  });
  it("refuses a readable parcel whose reference belongs to another reservation", async () => {
    const id = await ambiguous();
    expect(
      await adoptLeg(provider(label("1000", "999", "another-reservation")), store(), id, "999"),
    ).toEqual({ state: "review_required", code: "reference_mismatch" });
    expect(await status(id)).toBe("ambiguous");
    expect(saved.has(id)).toBe(false);
    const row = (
      await db.query<{ provider_label_id: string | null }>(
        "SELECT provider_label_id FROM marketplace_round_trip_label_jobs WHERE id=$1",
        [id],
      )
    ).rows[0];
    expect(row.provider_label_id).toBeNull();
  });
  it("absence winning over adoption prevents confirmation and removes the uploaded private PDF", async () => {
    const id = await ambiguous();
    let started!: () => void;
    let resume!: () => void;
    const seen = new Promise<void>((r) => {
      started = r;
    });
    const gate = new Promise<void>((r) => {
      resume = r;
    });
    const adoption = adoptLeg(
      provider({
        ...label("1000", "701", id),
        pdf: async () => {
          started();
          await gate;
          return pdf;
        },
      }),
      store(),
      id,
      "701",
    );
    await seen;
    await declareLegAbsent(store(), id, "sendcloud", RT.admin, "Synthetic absence checked");
    resume();
    expect(await adoption).toEqual({ state: "review_required", code: "job_failed" });
    expect(await status(id)).toBe("failed");
    expect(saved.has(id)).toBe(false);
    expect(
      (
        await db.query(
          "SELECT name FROM storage.objects WHERE bucket_id='round-trip-labels-private'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("queued cancellation remains confirmed until a reread cancelled status; no refund is fabricated", async () => {
    const id = await ambiguous();
    await adoptLeg(provider(label("1000", "701", id)), store(), id, "701");
    expect(await cancelLeg(provider(label("1000", "701", id)), store(), id)).toEqual({
      state: "queued",
    });
    expect(await status(id)).toBe("confirmed");
    expect((await webhook(provider(label("2000", "701", id)), "701", "later")).status).toBe(200);
    expect(await status(id)).toBe("cancelled");
    const row = (
      await db.query<{ refunded_cost_ttc_cents: number | null }>(
        "SELECT refunded_cost_ttc_cents FROM marketplace_round_trip_label_jobs WHERE id=$1",
        [id],
      )
    ).rows[0];
    expect(row.refunded_cost_ttc_cents).toBeNull();
  });
  it("unknown reference lookup falls back to the attached readable label id", async () => {
    const id = await ambiguous();
    await adoptLeg(provider(label("1000", "701", id)), store(), id, "701");
    let reads = 0;
    const p = provider(label("2000"), {
      findByReference: async () => "unknown",
      findByLabelId: async () => {
        reads++;
        return label("2000", "701", id);
      },
    });
    expect((await webhook(p)).status).toBe(200);
    expect(reads).toBe(1);
    expect(await status(id)).toBe("cancelled");
  });
  it("cancels an attached v2 parcel absent from v3 search, keeping a queued result", async () => {
    const calls: { url: string; method: string }[] = [];
    const p = createSendcloudProvider({
      publicKey: "synthetic",
      secretKey: "synthetic",
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), method: init?.method ?? "GET" });
        return new Response(JSON.stringify(init?.method === "POST" ? {} : { data: [] }), {
          status: init?.method === "POST" ? 202 : 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    expect(await p.cancel("synthetic-job", "701")).toEqual({ kind: "queued", reference: "701" });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("external_reference_id=synthetic-job");
    expect(calls[1]).toMatchObject({ method: "POST" });
    expect(calls[1].url).toContain("/parcels/701/cancel");
  });
});
