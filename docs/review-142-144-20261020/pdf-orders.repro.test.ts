import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  adoptLeg,
  purchaseLeg,
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

// Independent regression assertions, updated after #149.
// Provider, PDF bytes and signatures are synthetic. PGlite is one PostgreSQL engine, not two backends.
let db: PGlite;
let saved: Map<string, Uint8Array>;
let discarded: string[];
const pdf = new TextEncoder().encode("%PDF-synthetic-audit");
const secret = "synthetic-audit-signature-key";
beforeEach(async () => {
  db = await roundTripDb();
  saved = new Map();
  discarded = [];
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
      discarded.push(id);
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
function label(code = "1000", labelId = "701"): ProviderLabel {
  return {
    provider: "sendcloud",
    labelId,
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
    findByReference: async () => current,
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

const request = async () => ({
  reference: "synthetic",
  direction: "outbound" as const,
  shippingOptionCode: "qa:option",
  from: {
    name: "Synthetic sender",
    addressLine1: "1 rue QA",
    postalCode: "75001",
    city: "Paris",
    countryCode: "FR",
  },
  to: {
    name: "Synthetic receiver",
    addressLine1: "2 rue QA",
    postalCode: "69001",
    city: "Lyon",
    countryCode: "FR",
  },
  parcel: { weightGrams: 480, dimensionsMm: [340, 240, 60] as [number, number, number] },
});

async function noConfirmedMissingPdf() {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int n FROM marketplace_round_trip_label_jobs j LEFT JOIN storage.objects o ON o.bucket_id='round-trip-labels-private' AND o.name=j.private_label_path WHERE j.status='confirmed' AND o.name IS NULL`,
  );
  expect(r.rows[0].n).toBe(0);
}
const ownLabel = (id: string, code = "1000") => ({ ...label(code), reference: id });
const absence = (s: LabelJobStore, id: string) =>
  declareLegAbsent(s, id, "sendcloud", RT.admin, "Synthetic provider absence checked");
describe("independent #142 — terminal states and PDF interleavings", () => {
  it("absence then adoption never stores or confirms a PDF", async () => {
    const id = await ambiguous();
    await absence(store(), id);
    expect(await adoptLeg(provider(ownLabel(id)), store(), id, "701")).toMatchObject({
      code: "job_failed",
    });
    expect(saved.has(id)).toBe(false);
    expect(discarded).toEqual([]);
    await noConfirmedMissingPdf();
  });
  it("adoption then absence preserves the confirmed PDF", async () => {
    const id = await ambiguous();
    await adoptLeg(provider(ownLabel(id)), store(), id, "701");
    expect(await absence(store(), id)).toMatchObject({ code: "job_confirmed" });
    expect(saved.has(id)).toBe(true);
    expect(discarded).toEqual([]);
    await noConfirmedMissingPdf();
  });
  it("two simultaneous absences return success once each with one SQL event", async () => {
    const id = await ambiguous(),
      base = store();
    let reads = 0,
      release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const s = {
      ...base,
      job: async (job: string) => {
        const row = await base.job(job);
        if (++reads === 2) release();
        await gate;
        return row;
      },
    };
    expect(await Promise.all([absence(s, id), absence(s, id)])).toEqual([
      { state: "failed", code: "absent_confirmed" },
      { state: "failed", code: "absent_confirmed" },
    ]);
    expect(
      (
        await db.query(
          "SELECT id FROM marketplace_round_trip_label_events WHERE kind='purchase_failed'",
        )
      ).rows,
    ).toHaveLength(1);
    await noConfirmedMissingPdf();
  });
  it("absence during PDF download discards the subsequently uploaded object", async () => {
    const id = await ambiguous();
    let ready!: () => void, release!: () => void;
    const seen = new Promise<void>((r) => (ready = r)),
      gate = new Promise<void>((r) => (release = r));
    const p = provider({
      ...ownLabel(id),
      pdf: async () => {
        ready();
        await gate;
        return pdf;
      },
    });
    const adopting = adoptLeg(p, store(), id, "701");
    await seen;
    await absence(store(), id);
    release();
    expect(await adopting).toMatchObject({ code: "job_failed" });
    expect(discarded).toEqual([id]);
    expect(saved.has(id)).toBe(false);
    await noConfirmedMissingPdf();
  });
  it("absence after upload but before confirmation discards only the failed job PDF", async () => {
    const id = await ambiguous(),
      base = store();
    const s = {
      ...base,
      savePrivateLabel: async (job: string, bytes: Uint8Array) => {
        await base.savePrivateLabel(job, bytes);
        await absence(base, job);
      },
    };
    expect(await adoptLeg(provider(ownLabel(id)), s, id, "701")).toMatchObject({
      code: "job_failed",
    });
    expect(discarded).toEqual([id]);
    expect(saved.has(id)).toBe(false);
    await noConfirmedMissingPdf();
  });
  it("adoption winning between absence read and transition preserves its confirmed object", async () => {
    const id = await ambiguous(),
      base = store();
    let first = true;
    const s: LabelJobStore = {
      ...base,
      transition: async (job, kind, details, event) => {
        if (kind === "purchase_failed" && first) {
          first = false;
          await adoptLeg(provider(ownLabel(id)), base, id, "701");
        }
        return base.transition(job, kind, details, event);
      },
    };
    expect(await absence(s, id)).toMatchObject({ code: "job_confirmed" });
    expect(saved.has(id)).toBe(true);
    expect(discarded).toEqual([]);
    await noConfirmedMissingPdf();
  });
  it("a failed job cannot be confirmed while its cleanup is delayed", async () => {
    const id = await ambiguous(),
      base = store();
    let ready!: () => void, release!: () => void;
    const seen = new Promise<void>((r) => (ready = r)),
      gate = new Promise<void>((r) => (release = r));
    const s: LabelJobStore = {
      ...base,
      savePrivateLabel: async (job, bytes) => {
        await base.savePrivateLabel(job, bytes);
        await absence(base, job);
      },
      discardPrivateLabel: async (job) => {
        ready();
        await gate;
        await base.discardPrivateLabel!(job);
      },
    };
    const adopting = adoptLeg(provider(ownLabel(id)), s, id, "701");
    await seen;
    expect(await adoptLeg(provider(ownLabel(id)), base, id, "701")).toMatchObject({
      code: "job_failed",
    });
    await expect(
      base.transition(id, "label_confirmed", {
        provider: "sendcloud",
        provider_label_id: "701",
        carrier: "QA",
        tracking: "QA",
      }),
    ).rejects.toThrow(/label_transition_invalid/);
    release();
    expect(await adopting).toMatchObject({ code: "job_failed" });
    expect(saved.has(id)).toBe(false);
    await noConfirmedMissingPdf();
  });
  it("webhook during adoption ends cancelled without discarding the confirmed PDF", async () => {
    const id = await ambiguous();
    let ready!: () => void,
      release!: () => void,
      reads = 0;
    const seen = new Promise<void>((r) => (ready = r)),
      gate = new Promise<void>((r) => (release = r));
    const first = {
      ...ownLabel(id),
      pdf: async () => {
        ready();
        await gate;
        return pdf;
      },
    };
    const p = provider(first, {
      findByLabelId: async () => (++reads === 1 ? first : ownLabel(id, "2000")),
    });
    const adopting = adoptLeg(p, store(), id, "701");
    await seen;
    expect((await webhook(provider(ownLabel(id, "2000")))).status).toBe(200);
    release();
    expect(await adopting).toMatchObject({ code: "label_unusable" });
    expect(await status(id)).toBe("cancelled");
    expect(saved.has(id)).toBe(true);
    expect(discarded).toEqual([]);
    await noConfirmedMissingPdf();
  });
  it("webhook after adoption and later absence retain the label archive", async () => {
    const id = await ambiguous();
    await adoptLeg(provider(ownLabel(id)), store(), id, "701");
    expect((await webhook(provider(ownLabel(id, "2000")))).status).toBe(200);
    expect(await absence(store(), id)).toMatchObject({ code: "job_cancelled" });
    expect(saved.has(id)).toBe(true);
    expect(discarded).toEqual([]);
    await noConfirmedMissingPdf();
  });
  it("a lost confirmation acknowledgement never deletes a committed confirmed PDF", async () => {
    const id = await ambiguous(),
      base = store();
    const s: LabelJobStore = {
      ...base,
      transition: async (job, kind, details, event) => {
        const r = await base.transition(job, kind, details, event);
        if (kind === "label_confirmed") throw Error("synthetic_lost_ack");
        return r;
      },
    };
    await expect(adoptLeg(provider(ownLabel(id)), s, id, "701")).rejects.toThrow(
      "synthetic_lost_ack",
    );
    expect(await status(id)).toBe("confirmed");
    expect(saved.has(id)).toBe(true);
    expect(discarded).toEqual([]);
    await noConfirmedMissingPdf();
  });
  it("confirmation network failure before commit retains the PDF for retry", async () => {
    const id = await ambiguous(),
      base = store();
    const s: LabelJobStore = {
      ...base,
      transition: async (job, kind, details, event) => {
        if (kind === "label_confirmed") throw Error("synthetic_network");
        return base.transition(job, kind, details, event);
      },
    };
    await expect(adoptLeg(provider(ownLabel(id)), s, id, "701")).rejects.toThrow(
      "synthetic_network",
    );
    expect(await status(id)).toBe("ambiguous");
    expect(saved.has(id)).toBe(true);
    expect(discarded).toEqual([]);
    await noConfirmedMissingPdf();
  });
  it("reports removal failure as label_orphaned and journals the private orphan PDF", async () => {
    const id = await ambiguous(),
      base = store();
    let attempted = false;
    const s: LabelJobStore = {
      ...base,
      savePrivateLabel: async (job, bytes) => {
        await base.savePrivateLabel(job, bytes);
        await absence(base, job);
      },
      discardPrivateLabel: async () => {
        attempted = true;
        throw Error("label_discard_failed");
      },
    };
    expect(await adoptLeg(provider(ownLabel(id)), s, id, "701")).toMatchObject({
      state: "review_required",
      code: "label_orphaned",
    });
    const notes = await db.query<{ details: { note: string; object: string; code: string } }>(
      "SELECT details FROM marketplace_round_trip_label_events WHERE job_id=$1 AND kind='operator_note'",
      [id],
    );
    expect(notes.rows.map((row) => row.details)).toContainEqual(
      expect.objectContaining({
        note: "label_discard_failed",
        object: `${id}/label.pdf`,
        code: "label_discard_failed",
      }),
    );
    expect(attempted).toBe(true);
    expect(saved.has(id)).toBe(true);
    expect(await status(id)).toBe("failed");
    await noConfirmedMissingPdf();
  });
});
