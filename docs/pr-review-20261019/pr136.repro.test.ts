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

// Characterisation for an independent report. Passing assertions also document unsafe observed outcomes.
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
describe("audit19 — correction and residual boundaries", () => {
  it("refuses an already cancelled adopted label, a foreign reference and an unverifiable label", async () => {
    const id = await ambiguous();
    expect(
      await adoptLeg(provider({ ...label("2000"), reference: id }), store(), id, "701"),
    ).toMatchObject({ state: "review_required", code: "label_unusable" });
    expect(
      await adoptLeg(provider({ ...label(), reference: "another-job" }), store(), id, "701"),
    ).toMatchObject({ code: "reference_mismatch" });
    expect(
      await adoptLeg(provider(label(), { findByReference: async () => null }), store(), id, "701"),
    ).toMatchObject({ code: "reference_unverifiable" });
    expect(saved.size).toBe(0);
  });
  it("catches cancellation arriving during adoption", async () => {
    const id = await ambiguous();
    let start!: () => void, release!: () => void;
    let code = "1000";
    const started = new Promise<void>((r) => (start = r)),
      gate = new Promise<void>((r) => (release = r));
    const first = {
      ...label(),
      reference: id,
      pdf: async () => {
        start();
        await gate;
        return pdf;
      },
    };
    let reads = 0;
    const p = provider(first, {
      findByLabelId: async () => (++reads === 1 ? first : { ...label(code), reference: id }),
    });
    const adoption = adoptLeg(p, store(), id, "701");
    await started;
    code = "2000";
    expect(await (await webhook(provider(label(code)))).json()).toEqual({ ignored: true });
    release();
    expect(await adoption).toMatchObject({ code: "label_unusable" });
    expect(await status(id)).toBe("cancelled");
  });
  it("documents a cancelled label still confirmed by the existing-label purchase resumption", async () => {
    const id = await ambiguous();
    let rereads = 0;
    const p = provider(
      { ...label("2000"), reference: id },
      {
        findByLabelId: async () => {
          rereads++;
          return label("2000");
        },
      },
    );
    expect(await purchaseLeg(p, store(), id, request)).toMatchObject({ state: "confirmed" });
    expect(await status(id)).toBe("confirmed");
    expect(rereads).toBe(0);
  });
  it("documents cancellation targeting a different v3 parcel despite the attached id", async () => {
    const calls: { url: string; method: string }[] = [];
    const p = createSendcloudProvider({
      publicKey: "synthetic",
      secretKey: "synthetic",
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), method: init?.method ?? "GET" });
        return new Response(
          JSON.stringify(
            calls.length === 1
              ? {
                  data: [
                    {
                      id: "different-shipment",
                      external_reference_id: "synthetic-job",
                      parcels: [{ id: 999 }],
                    },
                  ],
                }
              : {},
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });
    expect(await p.cancel("synthetic-job", "701")).toEqual({
      kind: "cancelled",
      reference: "different-shipment",
    });
    expect(calls[1]).toEqual({
      url: "https://panel.sendcloud.sc/api/v3/shipments/different-shipment/cancel",
      method: "POST",
    });
    expect(calls.some((c) => c.url.includes("/parcels/701/"))).toBe(false);
  });
  it("documents an error when the webhook cancels before the post-confirmation reread returns", async () => {
    const id = await ambiguous();
    const current = { ...label(), reference: id };
    let reads = 0;
    const p = provider(current, {
      findByLabelId: async () => {
        if (++reads === 1) return current;
        expect((await webhook(provider(label("2000")))).status).toBe(200);
        return { ...label("2000"), reference: id };
      },
    });
    await expect(adoptLeg(p, store(), id, "701")).rejects.toThrow(
      /label_transition_invalid:cancelled:cancelled/,
    );
    expect(await status(id)).toBe("cancelled");
  });
});
