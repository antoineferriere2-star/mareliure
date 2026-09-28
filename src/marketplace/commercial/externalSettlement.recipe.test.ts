import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: PGlite;
let invoice: string;
const migration = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}.sql`, import.meta.url), "utf8");
beforeAll(async () => {
  db = new PGlite();
  // Isolated recipe database. Stub only dependencies outside quote/invoice billing.
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE user_roles(user_id uuid,role text);
    CREATE TABLE marketplace_binders(id uuid PRIMARY KEY);
    CREATE TABLE marketplace_binder_members(binder_id uuid,user_id uuid,account_status text);
    CREATE TABLE marketplace_cases(id uuid PRIMARY KEY,acquisition_origin text,referred_binder_id uuid);
    CREATE TABLE marketplace_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid,actor_user_id uuid,event_type text,metadata jsonb);
    CREATE TABLE marketplace_commercial_proposals(id uuid PRIMARY KEY,case_id uuid,status text,accepted_at timestamptz);
    CREATE FUNCTION build_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid,bucket_id text);
  `);
  for (const file of ["20260919090000_marketplace_binder_quotes", "20260920100000_marketplace_binder_invoice_vat_mention",
    "20260921090000_marketplace_binder_contacts_works", "20260923100000_marketplace_quote_size_blocks_photos",
    "20260923110000_marketplace_document_branding", "20260923120000_marketplace_invoice_compliance",
    "20260928090000_marketplace_payment_circuits", "20260928110000_own_client_external_settlement"]) await db.exec(migration(file));
  await db.exec(`INSERT INTO auth.users VALUES('${id(1)}'); INSERT INTO marketplace_binders VALUES('${id(2)}');
    INSERT INTO marketplace_binder_members VALUES('${id(2)}','${id(1)}','active');
    INSERT INTO marketplace_binder_clients(id,binder_id,name) VALUES('${id(3)}','${id(2)}','QA client fictif');
    INSERT INTO marketplace_binder_billing_profiles(binder_id) VALUES('${id(2)}');
    INSERT INTO marketplace_binder_quotes(id,binder_id,client_id,quote_number,status,issue_date,valid_until,client_name,
      currency,issuer,vat_regime,vat_mention,subtotal_cents,total_ht_cents,total_vat_cents,total_ttc_cents)
    VALUES('${id(4)}','${id(2)}','${id(3)}','QA-D-1','sent','2026-09-28','2026-10-28','QA client fictif',
      'EUR','{"legalForm":"QA","siren":"000000000","siret":"00000000000000","addressLine1":"QA fictif","postalCode":"00000","city":"QA"}',
      'FRANCHISE','Mention de recette uniquement',10000,10000,0,10000);
    INSERT INTO marketplace_binder_quote_items(quote_id,binder_id,position,label,unit_price_cents,vat_rate_bps,total_ht_cents,line_key)
    VALUES('${id(4)}','${id(2)}',0,'QA travaux',10000,0,10000,'qa-line');`);
}, 30000);
afterAll(async () => { await db?.close(); });
const event = (n: number, kind: string, amount: number, proof = `Justificatif QA ${n}`) => db.query(
  "SELECT marketplace_record_external_settlement($1,$2,$3,$4,$5,$6,$7)", [id(n), invoice, id(2), id(1), kind, amount, proof]);
const state = async () => (await db.query<{ s: { netCents: number; disputed: boolean; events: unknown[] } }>(
  "SELECT marketplace_external_settlement_state($1,$2,$3) s", [invoice,id(2),id(1)])).rows[0].s;

describe("own-client external settlement on a recipe database", () => {
  it.each(["MA_RELIURE_ACQUIRED", "FINEBINDERY_PROFILE"])("preserves the resale lifecycle for %s after both migrations", async (origin) => {
    const caseId = id(origin === "MA_RELIURE_ACQUIRED" ? 80 : 81);
    const proposalId = id(origin === "MA_RELIURE_ACQUIRED" ? 82 : 83);
    await db.query("INSERT INTO marketplace_cases VALUES($1,$2,NULL)", [caseId, origin]);
    await db.query("INSERT INTO marketplace_commercial_proposals(id,case_id,status) VALUES($1,$2,'draft')", [proposalId,caseId]);
    await db.query("UPDATE marketplace_commercial_proposals SET status='proposed' WHERE id=$1", [proposalId]);
    await db.query("UPDATE marketplace_commercial_proposals SET status='accepted',accepted_at=now() WHERE id=$1", [proposalId]);
    expect((await db.query("SELECT payment_circuit FROM marketplace_commercial_proposals WHERE id=$1", [proposalId])).rows)
      .toEqual([{ payment_circuit: "legacy_resale" }]);
  });
  it("requires a documented agreement and executes the real quote → agreement → draft → issued invoice RPCs", async () => {
    await expect(db.exec(`UPDATE marketplace_binder_quotes SET status='accepted' WHERE id='${id(4)}'`)).rejects.toThrow("own_agreement_required");
    const revision = async () => (await db.query<{ r:string }>("SELECT marketplace_own_contract($1,$2,$3)->>'revision' r",[id(4),id(2),id(1)])).rows[0].r;
    const stale = await revision();
    await db.exec(`UPDATE marketplace_binder_quotes SET notes='QA version relue' WHERE id='${id(4)}'`);
    await expect(db.query("SELECT marketplace_accept_own_quote($1,$2,$3,$4,$5)",[id(4),id(2),id(1),"QA accord écrit du client",stale])).rejects.toThrow("quote_changed_review_required");
    await db.query("SELECT marketplace_accept_own_quote($1,$2,$3,$4,$5)", [id(4),id(2),id(1),"QA accord écrit du client",await revision()]);
    invoice = (await db.query<{ id: string }>("SELECT marketplace_binder_create_invoice_draft($1,$2,$3::jsonb) id", [id(2),id(4),JSON.stringify({
      issue_date:"2026-09-28",service_date:"2026-09-28",due_date:"2026-10-28",operation_nature:"services",client_type:"individual",
      client_billing_address_line1:"QA fictif",client_billing_postal_code:"00000",client_billing_city:"QA",client_billing_country:"FR",
      issuer:{legalForm:"QA",siren:"000000000",siret:"00000000000000",addressLine1:"QA fictif",postalCode:"00000",city:"QA"},
      vat_mention:"Mention de recette uniquement",
    })])).rows[0].id;
    await db.query("UPDATE marketplace_binder_invoices SET issuer=jsonb_set(issuer,'{siret}','\"99999999999999\"') WHERE id=$1",[invoice]);
    await expect(db.query("SELECT marketplace_binder_issue_invoice($1,$2,'[]'::jsonb)", [id(2),invoice])).rejects.toThrow("invoice_seller_changed_new_agreement_required");
    await db.query("UPDATE marketplace_binder_invoices SET issuer=jsonb_set(issuer,'{siret}','\"00000000000000\"') WHERE id=$1",[invoice]);
    await db.query("SELECT marketplace_binder_issue_invoice($1,$2,'[]'::jsonb)", [id(2),invoice]);
    expect((await db.query<{ status: string; payment_snapshot: { platform_fee_cents: number } }>("SELECT status,payment_snapshot FROM marketplace_binder_invoices WHERE id=$1",[invoice])).rows[0]).toMatchObject({ status:"issued",payment_snapshot:{ platform_fee_cents:0 } });
  });
  it("records partial/full receipts once, rejects changed retries, duplicates and overpayment", async () => {
    await event(10,"receipt",4000); await event(10,"receipt",4000);
    expect((await state()).netCents).toBe(4000);
    expect((await db.query<{payment_status:string}>("SELECT payment_status FROM marketplace_binder_invoices WHERE id=$1",[invoice])).rows[0].payment_status).toBe("partial");
    await expect(db.query("UPDATE marketplace_binder_invoices SET amount_paid_cents=10000,payment_status='paid',paid_at=now() WHERE id=$1",[invoice])).rejects.toThrow("payment_evidence_required");
    await expect(event(10,"receipt",3000)).rejects.toThrow("idempotency_conflict");
    await expect(event(11,"receipt",4000,"Justificatif QA 10")).rejects.toThrow("proof_once");
    await expect(event(12,"receipt",7000)).rejects.toThrow("receipt_not_due");
    await event(13,"receipt",6000);
    expect((await state()).netCents).toBe(10000);
    expect((await db.query<{ payment_status:string }>("SELECT payment_status FROM marketplace_binder_invoices WHERE id=$1",[invoice])).rows[0].payment_status).toBe("paid");
  });
  it("records partial/full refunds without commission or a second money movement", async () => {
    await event(14,"refund",3000); expect((await state()).netCents).toBe(7000);
    await expect(event(15,"refund",8000)).rejects.toThrow("refund_exceeds_receipts");
    await event(16,"refund",7000); expect((await state()).netCents).toBe(0);
  });
  it("blocks receipts during a dispute and keeps closure in the history", async () => {
    await event(17,"dispute_open",0); expect((await state()).disputed).toBe(true);
    await expect(event(18,"receipt",1000)).rejects.toThrow("receipt_not_due");
    await event(19,"dispute_close",0); expect((await state()).disputed).toBe(false);
    await expect(event(20,"dispute_close",0)).rejects.toThrow("dispute_transition_invalid");
  });
  it("an issued credit note blocks further receipts and is distinct from refund", async () => {
    await event(21,"receipt",1000);
    await db.query("SELECT marketplace_binder_create_full_credit_note($1,$2,$3,$4)", [id(2),invoice,"2026-09-28","QA annulation"]);
    expect((await state()).netCents).toBe(1000);
    await expect(event(22,"receipt",1000)).rejects.toThrow("receipt_not_due");
    await event(23,"refund",1000); expect((await state()).netCents).toBe(0);
  });
  it("denies another account, anonymous RPCs and history rewriting", async () => {
    await expect(db.query("SELECT marketplace_external_settlement_state($1,$2,$3)",[invoice,id(2),id(99)])).rejects.toThrow("active_membership_required");
    await expect(db.exec("UPDATE marketplace_external_settlements SET amount_cents=1")).rejects.toThrow("settlement_history_immutable");
    await db.exec("SET ROLE anon");
    try { await expect(db.query("SELECT marketplace_external_settlement_state($1,$2,$3)",[invoice,id(2),id(1)])).rejects.toThrow("permission denied"); }
    finally { await db.exec("RESET ROLE"); }
  });
  it("can execute as service_role with application-level membership checks", async () => {
    await db.exec("GRANT SELECT ON marketplace_binder_members TO service_role; SET ROLE service_role");
    try { await event(24,"dispute_open",0); expect((await state()).disputed).toBe(true); }
    finally { await db.exec("RESET ROLE"); }
  });
});
