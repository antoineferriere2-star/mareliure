import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
// Minimal surrounding schema; the actual migration below supplies all new constraints,
// grants and triggers. No Supabase/Stripe network call is made by this test.
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE user_roles(user_id uuid, role text);
    CREATE TABLE marketplace_cases(id uuid PRIMARY KEY, acquisition_origin text, referred_binder_id uuid);
    CREATE TABLE marketplace_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid,actor_user_id uuid,event_type text,metadata jsonb);
    CREATE TABLE marketplace_commercial_proposals(id uuid PRIMARY KEY,case_id uuid,status text,accepted_at timestamptz,currency text,total_cents integer);
    CREATE TABLE marketplace_binder_works(id uuid PRIMARY KEY,binder_id uuid,case_id uuid,source text);
    CREATE TABLE marketplace_binder_clients(id uuid PRIMARY KEY,binder_id uuid,origin_case_id uuid,origin text);
    CREATE TABLE marketplace_binder_quotes(id uuid PRIMARY KEY,binder_id uuid,client_id uuid,work_id uuid,status text,currency text,total_ttc_cents integer);
    CREATE TABLE marketplace_binder_invoices(id uuid PRIMARY KEY,binder_id uuid,quote_id uuid,status text,currency text,total_ttc_cents integer);
    INSERT INTO auth.users VALUES('${id(1)}'); INSERT INTO user_roles VALUES('${id(1)}','admin');
    INSERT INTO marketplace_cases VALUES('${id(2)}','MA_RELIURE_ACQUIRED',NULL);
    INSERT INTO marketplace_commercial_proposals VALUES('${id(3)}','${id(2)}','accepted',now(),'EUR',12000);
  `);
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20260928090000_marketplace_payment_circuits.sql", import.meta.url), "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });

describe("payment circuits on isolated PostgreSQL", () => {
  it("preserves the accepted historical amount and does not invent a commission", async () => {
    const { rows } = await db.query("SELECT payment_circuit,total_cents FROM marketplace_commercial_proposals");
    expect(rows).toEqual([{ payment_circuit: "legacy_resale", total_cents: 12000 }]);
    await expect(db.exec(`UPDATE marketplace_case_payment_circuits SET circuit='network_sale' WHERE case_id='${id(2)}'`)).rejects.toThrow("payment_circuit_locked");
  });
  it("requires an admin and evidence from the same dossier", async () => {
    await db.exec(`INSERT INTO marketplace_cases VALUES('${id(4)}','FINEBINDERY_PROFILE',NULL);
      INSERT INTO marketplace_events(id,case_id) VALUES('${id(5)}','${id(4)}'),('${id(6)}','${id(2)}');`);
    const call = (actor: string, event: string) => db.exec(`SELECT marketplace_set_case_payment_circuit('${id(4)}','network_sale','${event}','${actor}','Verified project provenance')`);
    await expect(call(id(9),id(5))).rejects.toThrow("admin_required");
    await expect(call(id(1),id(6))).rejects.toThrow("evidence_case_mismatch");
    await call(id(1),id(5));
    expect((await db.query(`SELECT circuit FROM marketplace_case_payment_circuits WHERE case_id='${id(4)}'`)).rows).toEqual([{ circuit: "network_sale" }]);
    await expect(db.exec(`INSERT INTO marketplace_commercial_proposals(id,case_id,status) VALUES('${id(7)}','${id(4)}','proposed')`)).rejects.toThrow("target_payment_contract_required");
  });
  it("snapshots own-client terms, freezes agreement and links the invoice", async () => {
    await db.exec(`INSERT INTO marketplace_binder_clients VALUES('${id(10)}','${id(11)}',NULL,'mon_client');
      INSERT INTO marketplace_binder_quotes VALUES('${id(12)}','${id(11)}','${id(10)}',NULL,'draft','EUR',12345,NULL);
      UPDATE marketplace_binder_quotes SET status='accepted' WHERE id='${id(12)}';`);
    const snapshot = (await db.query<{ payment_snapshot: Record<string, unknown> }>(`SELECT payment_snapshot FROM marketplace_binder_quotes WHERE id='${id(12)}'`)).rows[0].payment_snapshot;
    expect(snapshot).toMatchObject({ circuit: "own_client", currency: "EUR", total_ttc_cents: 12345, collection: "external", platform_fee_cents: null });
    await expect(db.exec(`UPDATE marketplace_binder_quotes SET total_ttc_cents=999 WHERE id='${id(12)}'`)).rejects.toThrow("accepted_payment_terms_immutable");
    await expect(db.exec(`UPDATE marketplace_binder_quotes SET status='draft' WHERE id='${id(12)}'`)).rejects.toThrow("accepted_payment_terms_immutable");
    await db.exec(`INSERT INTO marketplace_binder_invoices(id,binder_id,quote_id,status,currency,total_ttc_cents) VALUES('${id(13)}','${id(11)}','${id(12)}','draft','EUR',12345);`);
    expect((await db.query<{ payment_snapshot: unknown }>(`SELECT payment_snapshot FROM marketplace_binder_invoices WHERE id='${id(13)}'`)).rows[0].payment_snapshot).toEqual(snapshot);
    await expect(db.exec(`UPDATE marketplace_binder_invoices SET status='issued',total_ttc_cents=999 WHERE id='${id(13)}'`)).rejects.toThrow("invoice_requires_new_agreed_quote");
    await expect(db.exec(`UPDATE marketplace_binder_invoices SET payment_snapshot=NULL WHERE id='${id(13)}'`)).rejects.toThrow("invoice_payment_terms_immutable");
    await db.exec(`UPDATE marketplace_binder_invoices SET status='issued' WHERE id='${id(13)}'; UPDATE marketplace_binder_quotes SET status='invoiced' WHERE id='${id(12)}';`);
    expect((await db.query<{ payment_snapshot: unknown }>(`SELECT payment_snapshot FROM marketplace_binder_quotes WHERE id='${id(12)}'`)).rows[0].payment_snapshot).toEqual(snapshot);
  });
  it("does not accept a quote for a different atelier's work", async () => {
    await db.exec(`INSERT INTO marketplace_binder_works VALUES('${id(14)}','${id(15)}',NULL,'mon_client');`);
    await expect(db.exec(`INSERT INTO marketplace_binder_quotes(id,binder_id,client_id,work_id,status,currency,total_ttc_cents) VALUES('${id(16)}','${id(11)}','${id(10)}','${id(14)}','accepted','EUR',1000)`)).rejects.toThrow("work_binder_mismatch");
  });
  it("preserves free-form contact quotes without inventing acquisition provenance", async () => {
    await db.exec(`INSERT INTO marketplace_binder_quotes(id,binder_id,status,currency,total_ttc_cents)
      VALUES('${id(30)}','${id(11)}','accepted','EUR',8000);`);
    expect((await db.query<{ circuit: string }>(`SELECT payment_snapshot->>'circuit' AS circuit FROM marketplace_binder_quotes WHERE id='${id(30)}'`)).rows).toEqual([{ circuit: "review_required" }]);
  });
  it("deduplicates simultaneous payment journals by PaymentIntent", async () => {
    await db.exec(`INSERT INTO marketplace_events(case_id,event_type,metadata) VALUES('${id(2)}','CUSTOMER_PAYMENT_SUCCEEDED','{"payment_intent_id":"pi_qa"}');`);
    await expect(db.exec(`INSERT INTO marketplace_events(case_id,event_type,metadata) VALUES('${id(2)}','CUSTOMER_PAYMENT_SUCCEEDED','{"payment_intent_id":"pi_qa"}')`)).rejects.toThrow("marketplace_payment_success_once");
  });
  it("locks dossier classification for an invoiced quote without a work record", async () => {
    await db.exec(`INSERT INTO marketplace_cases VALUES('${id(20)}','MA_RELIURE_ACQUIRED',NULL);
      INSERT INTO marketplace_binder_clients VALUES('${id(21)}','${id(11)}','${id(20)}','ma_reliure');
      INSERT INTO marketplace_binder_quotes(id,binder_id,client_id,status,currency,total_ttc_cents)
      VALUES('${id(22)}','${id(11)}','${id(21)}','accepted','EUR',5000);
      UPDATE marketplace_binder_quotes SET status='invoiced' WHERE id='${id(22)}';`);
    await expect(db.exec(`UPDATE marketplace_case_payment_circuits SET circuit='own_client' WHERE case_id='${id(20)}'`)).rejects.toThrow("payment_circuit_locked");
    await expect(db.exec(`DELETE FROM marketplace_case_payment_circuits WHERE case_id='${id(20)}'`)).rejects.toThrow("payment_circuit_history_required");
  });
  it("denies anonymous reads and classification", async () => {
    await db.exec("SET ROLE anon");
    try {
      await expect(db.exec("SELECT * FROM marketplace_case_payment_circuits")).rejects.toThrow("permission denied");
      await expect(db.exec(`SELECT marketplace_set_case_payment_circuit('${id(4)}','own_client','${id(5)}','${id(1)}','Forged browser classification')`)).rejects.toThrow("permission denied");
    } finally { await db.exec("RESET ROLE"); }
  });
});
