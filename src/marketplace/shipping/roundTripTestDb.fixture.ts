import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

// Base PostgreSQL isolée : schéma minimal + vraie migration de l'aller-retour, un dossier payé
// (revente historique, Stripe confirmé), atelier accepté, tarif revu, réception physique faite.
export const rtId = (n: number) => `41000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const RT_OUT = "a".repeat(64);
export const RT_RET = "b".repeat(64);

export async function roundTripDb(): Promise<PGlite> {
  const db = new PGlite();
  const id = rtId;
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
    INSERT INTO marketplace_binders VALUES('${id(2)}');
    INSERT INTO marketplace_commercial_proposals VALUES(
      '${id(4)}','${id(1)}','accepted',now(),'EUR','legacy_resale','NONE',0,0,0,0,2000,'FR',13500);
    INSERT INTO marketplace_case_matches VALUES('${id(1)}','${id(2)}','selected',now());
    INSERT INTO marketplace_binder_members VALUES('${id(2)}','${id(9)}','active');
    INSERT INTO marketplace_binder_works VALUES('${id(5)}','${id(1)}','${id(2)}');
  `);
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20261001160000_book_round_trip_shipping.sql", import.meta.url), "utf8"));
  await db.exec(`UPDATE marketplace_commercial_proposals SET shipping_offer_kind='book_round_trip_fr',shipping_total_cents=1250,shipping_other_cents=1250;
    INSERT INTO marketplace_commercial_proposal_payments VALUES('${id(4)}',now(),'cs_qa','pi_qa',13500,'eur');
    INSERT INTO marketplace_round_trip_rate_approvals(case_id,proposal_id,binder_id,
      outbound_address_sha256,return_address_sha256,outbound_weight_grams,return_weight_grams,
      outbound_dimensions_mm,return_dimensions_mm,outbound_method,return_method,
      provider_quote_reference,coverage_evidence_reference,outbound_cost_ttc_cents,
      return_cost_ttc_cents,all_other_costs_ttc_cents,estimated_economic_cost_cents,
      economic_cost_evidence_reference,valid_until,reviewed_by)
    VALUES('${id(1)}','${id(4)}','${id(2)}','${RT_OUT}','${RT_RET}',500,500,
      ARRAY[350,250,80],ARRAY[350,250,80],'QA outbound','QA return','QA quote only',
      'QA coverage only',400,400,0,700,'QA net cost only',now()+interval '1 day','${id(9)}');
    INSERT INTO marketplace_work_logistics_events VALUES('${id(5)}','received');`);
  await db.query("SELECT marketplace_mark_round_trip_return_ready($1,$2,$3)", [id(1), id(2), id(9)]);
  return db;
}

export async function reserveLeg(db: PGlite, direction: "outbound" | "return"): Promise<string> {
  const r = await db.query<{ r: { id: string } }>("SELECT marketplace_reserve_round_trip_label($1,$2,$3,$4) r", [rtId(1), direction, RT_OUT, RT_RET]);
  return r.rows[0].r.id;
}
