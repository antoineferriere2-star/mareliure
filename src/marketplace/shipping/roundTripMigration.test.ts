import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const address = "a".repeat(64);
const otherAddress = "b".repeat(64);
let db: PGlite;
const reserve = (direction: string, outbound = address, inbound = otherAddress) =>
  db.query("SELECT marketplace_reserve_round_trip_label($1,$2,$3,$4) AS result", [id(1), direction, outbound, inbound]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(bucket_id text,name text);
    CREATE TABLE marketplace_cases(id uuid PRIMARY KEY);
    CREATE TABLE marketplace_binders(id uuid PRIMARY KEY);
    CREATE TABLE marketplace_commercial_proposals(
      id uuid PRIMARY KEY,case_id uuid,status text,accepted_at timestamptz,
      currency text,payment_circuit text,deposit_type text,
      shipping_total_cents integer,shipping_other_cents integer,
      shipping_outbound_cents integer,shipping_return_cents integer,
      customer_vat_rate_bps integer,tax_country text,customer_total_ttc_cents integer);
    CREATE TABLE marketplace_commercial_proposal_payments(
      proposal_id uuid PRIMARY KEY,paid_at timestamptz,stripe_checkout_session_id text,
      stripe_payment_intent_id text,amount_paid_cents integer,paid_currency text);
    CREATE TABLE marketplace_case_matches(case_id uuid,binder_id uuid,state text,accepted_at timestamptz);
    CREATE TABLE marketplace_binder_members(binder_id uuid,user_id uuid,account_status text);
    CREATE TABLE marketplace_binder_works(id uuid PRIMARY KEY,case_id uuid,binder_id uuid);
    CREATE TABLE marketplace_work_logistics_events(work_id uuid,kind text);
    INSERT INTO auth.users VALUES('${id(9)}');
    INSERT INTO marketplace_cases VALUES('${id(1)}');
    INSERT INTO marketplace_binders VALUES('${id(2)}'),('${id(3)}');
    INSERT INTO marketplace_commercial_proposals VALUES(
      '${id(4)}','${id(1)}','accepted',now(),'EUR','legacy_resale','NONE',0,0,0,0,2000,'FR',12000);
    INSERT INTO marketplace_case_matches VALUES('${id(1)}','${id(2)}','selected',now());
    INSERT INTO marketplace_binder_members VALUES('${id(2)}','${id(9)}','active');
    INSERT INTO marketplace_binder_works VALUES('${id(5)}','${id(1)}','${id(2)}');
  `);
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20261001160000_book_round_trip_shipping.sql", import.meta.url), "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });

it("keeps old proposals manual and refuses an externally declared settlement", async () => {
  expect((await db.query<{ shipping_offer_kind: string }>("SELECT shipping_offer_kind FROM marketplace_commercial_proposals")).rows)
    .toEqual([{ shipping_offer_kind: "manual" }]);
  await expect(reserve("outbound")).rejects.toThrow("round_trip_offer_required");
  await db.exec(`UPDATE marketplace_commercial_proposals SET shipping_offer_kind='book_round_trip_fr',
    shipping_total_cents=1250,shipping_other_cents=1250,customer_total_ttc_cents=13500 WHERE id='${id(4)}';`);
  await expect(reserve("outbound")).rejects.toThrow("platform_payment_required");
  await db.exec(`INSERT INTO marketplace_commercial_proposal_payments VALUES
    ('${id(4)}',now(),'cs_qa','pi_qa',13500,NULL);`);
  await expect(reserve("outbound")).rejects.toThrow("platform_payment_required");
});

it("requires an accepted workshop, current review and the same addresses", async () => {
  await db.exec(`UPDATE marketplace_commercial_proposal_payments SET paid_currency='eur' WHERE proposal_id='${id(4)}';
    INSERT INTO marketplace_round_trip_rate_approvals(case_id,proposal_id,binder_id,
      outbound_address_sha256,return_address_sha256,outbound_weight_grams,return_weight_grams,
      outbound_dimensions_mm,return_dimensions_mm,outbound_method,return_method,
      provider_quote_reference,coverage_evidence_reference,outbound_cost_ttc_cents,
      return_cost_ttc_cents,all_other_costs_ttc_cents,estimated_economic_cost_cents,
      economic_cost_evidence_reference,valid_until,reviewed_by)
    VALUES('${id(1)}','${id(4)}','${id(2)}','${address}','${otherAddress}',500,500,
      ARRAY[350,250,80],ARRAY[350,250,80],'QA outbound','QA return','QA quote only',
      'QA coverage only',400,400,0,700,'QA net cost only',now()+interval '1 day','${id(9)}');`);
  await expect(reserve("outbound", otherAddress, otherAddress)).rejects.toThrow("address_changed_review_required");
  await db.exec(`UPDATE marketplace_case_matches SET accepted_at=NULL WHERE case_id='${id(1)}';`);
  await expect(reserve("outbound")).rejects.toThrow("accepted_workshop_required");
  await db.exec(`UPDATE marketplace_case_matches SET accepted_at=now() WHERE case_id='${id(1)}';`);
});

it("claims each leg once and requires physical receipt plus workshop readiness for return", async () => {
  const first = await reserve("outbound");
  expect((first.rows[0] as { result: { outcome: string } }).result.outcome).toBe("claim");
  const retry = await reserve("outbound");
  expect((retry.rows[0] as { result: { outcome: string } }).result.outcome).toBe("review_required");
  expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM marketplace_round_trip_label_jobs")).rows[0].n).toBe(1);
  await expect(db.exec(`INSERT INTO marketplace_round_trip_label_jobs
    (case_id,proposal_id,rate_approval_id,binder_id,direction,stripe_payment_intent_id)
    SELECT case_id,proposal_id,rate_approval_id,binder_id,direction,stripe_payment_intent_id
    FROM marketplace_round_trip_label_jobs WHERE direction='outbound'`)).rejects.toThrow("duplicate key");
  await expect(reserve("return")).rejects.toThrow("return_not_ready");
  await expect(db.query("SELECT marketplace_mark_round_trip_return_ready($1,$2,$3)", [id(1), id(2), id(9)]))
    .rejects.toThrow("physical_receipt_required");
  await db.exec(`INSERT INTO marketplace_work_logistics_events VALUES('${id(5)}','carrier_delivered');`);
  await expect(db.query("SELECT marketplace_mark_round_trip_return_ready($1,$2,$3)", [id(1), id(2), id(9)]))
    .rejects.toThrow("physical_receipt_required");
  await db.exec(`INSERT INTO marketplace_work_logistics_events VALUES('${id(5)}','received');`);
  await db.query("SELECT marketplace_mark_round_trip_return_ready($1,$2,$3)", [id(1), id(2), id(9)]);
  expect(((await reserve("return")).rows[0] as { result: { outcome: string } }).result.outcome).toBe("claim");
});

it("denies direct browser roles and keeps labels private", async () => {
  expect((await db.query<{ public: boolean }>("SELECT public FROM storage.buckets WHERE id='round-trip-labels-private'")).rows)
    .toEqual([{ public: false }]);
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`SET ROLE ${role}`);
    try {
      await expect(reserve("outbound")).rejects.toThrow("permission denied");
      await expect(db.exec("SELECT * FROM marketplace_round_trip_label_jobs")).rejects.toThrow("permission denied");
    } finally { await db.exec("RESET ROLE"); }
  }
});

it("keeps approved costs and provider history immutable for the service role", async () => {
  await expect(db.exec("UPDATE marketplace_round_trip_rate_approvals SET estimated_economic_cost_cents=1251"))
    .rejects.toThrow("check constraint");
  await db.exec("SET ROLE service_role");
  try {
    await expect(db.exec("UPDATE marketplace_round_trip_rate_approvals SET outbound_cost_ttc_cents=1"))
      .rejects.toThrow("permission denied");
    await db.exec(`INSERT INTO marketplace_round_trip_label_events(job_id,kind)
      SELECT id,'request_started' FROM marketplace_round_trip_label_jobs LIMIT 1`);
    await expect(db.exec("DELETE FROM marketplace_round_trip_label_events"))
      .rejects.toThrow("permission denied");
  } finally { await db.exec("RESET ROLE"); }
});

const transition = (direction: string, kind: string, details: object = {}, eventId: string | null = null) =>
  db.query<{ result: { outcome: string; status: string; cost_review_required: boolean } }>(
    `SELECT marketplace_round_trip_label_transition((SELECT id FROM marketplace_round_trip_label_jobs WHERE direction=$1),$2,$3,$4::jsonb) AS result`,
    [direction, kind, eventId, JSON.stringify(details)]).then((r) => r.rows[0].result);
const label = { provider: "sendcloud", provider_label_id: "qa-parcel-1", carrier: "qa_carrier", tracking: "QA000001", charged_cost_ttc_cents: 400 };

it("treats an attempt without recorded outcome as ambiguous, never as a fresh purchase", async () => {
  // The previous test recorded a request_started without outcome on the outbound leg.
  expect((await transition("outbound", "request_started")).status).toBe("ambiguous");
  await expect(transition("outbound", "purchase_failed", { code: "qa" })).rejects.toThrow("label_transition_invalid:ambiguous:purchase_failed");
  expect((await transition("outbound", "label_confirmed", label)).status).toBe("confirmed");
  const job = (await db.query<{ status: string; private_label_path: string; id: string }>(
    "SELECT id,status,private_label_path FROM marketplace_round_trip_label_jobs WHERE direction='outbound'")).rows[0];
  expect(job.private_label_path).toBe(`${job.id}/label.pdf`);
  await expect(transition("outbound", "label_confirmed", label)).rejects.toThrow("label_transition_invalid:confirmed:label_confirmed");
});

it("records a charge above the reviewed rate and requires complete label details", async () => {
  expect((await transition("return", "request_started")).status).toBe("claimed");
  await expect(transition("return", "label_confirmed", { provider: "sendcloud" })).rejects.toThrow("label_details_required");
  const confirmed = await transition("return", "label_confirmed", { ...label, provider_label_id: "qa-parcel-2", charged_cost_ttc_cents: 450 });
  expect(confirmed).toMatchObject({ status: "confirmed", cost_review_required: true });
  await expect(transition("return", "operator_note", { address: "1 rue privée" })).rejects.toThrow("private_details_refused");
});

it("deduplicates provider events and never assumes a cancellation or refund", async () => {
  expect((await transition("outbound", "tracking_update", { code: "announced" }, "qa-parcel-1:1")).outcome).toBe("applied");
  expect((await transition("outbound", "tracking_update", { code: "announced" }, "qa-parcel-1:1")).outcome).toBe("duplicate");
  await expect(transition("outbound", "cancelled", {})).rejects.toThrow("cancellation_reference_required");
  expect((await transition("outbound", "cancellation_requested", { provider_status: "queued" })).status).toBe("confirmed");
  expect((await transition("outbound", "cancelled", { reference: "qa-cancel-1" })).status).toBe("cancelled");
  const row = (await db.query<{ refunded_cost_ttc_cents: number | null }>(
    "SELECT refunded_cost_ttc_cents FROM marketplace_round_trip_label_jobs WHERE direction='outbound'")).rows[0];
  expect(row.refunded_cost_ttc_cents).toBeNull();
  await db.exec("SET ROLE authenticated");
  try { await expect(transition("return", "operator_note")).rejects.toThrow("permission denied"); }
  finally { await db.exec("RESET ROLE"); }
});
