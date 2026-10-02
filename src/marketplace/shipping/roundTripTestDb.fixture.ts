import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

// Base PostgreSQL isolée : schéma minimal + les VRAIES migrations de l'aller-retour
// (20261001160000 puis 20261002090000). Dossier Ma Reliure, plan logistique accepté par
// l'atelier retenu, offre 15 € TTC acceptée, paiement Stripe de revente confirmé.
export const rtId = (n: number) => `41000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const RT_OUT = "a".repeat(64);
export const RT_RET = "b".repeat(64);
/** Rôles : 7 = admin, 8 = client propriétaire, 9 = membre de l'atelier retenu, 10 = membre d'un autre atelier. */
export const RT = { case: rtId(1), binder: rtId(2), otherBinder: rtId(3), proposal: rtId(4), work: rtId(5),
  admin: rtId(7), customer: rtId(8), member: rtId(9), outsider: rtId(10) };

const migration = (name: string) =>
  readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");

/** Schéma et migrations, sans aucune proposition ni plan. */
export async function roundTripSchema(): Promise<PGlite> {
  const db = new PGlite();
  const id = rtId;
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(bucket_id text,name text);
    CREATE TABLE user_roles(user_id uuid,role text);
    CREATE TABLE marketplace_cases(id uuid PRIMARY KEY,brand text NOT NULL DEFAULT 'MA_RELIURE');
    CREATE TABLE marketplace_binders(id uuid PRIMARY KEY);
    CREATE TABLE marketplace_commercial_proposals(
      id uuid PRIMARY KEY,case_id uuid,status text,accepted_at timestamptz,superseded_at timestamptz,
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
    INSERT INTO auth.users VALUES('${id(7)}'),('${id(8)}'),('${id(9)}'),('${id(10)}');
    INSERT INTO user_roles VALUES('${id(7)}','admin');
    INSERT INTO marketplace_cases VALUES('${id(1)}','MA_RELIURE');
    INSERT INTO marketplace_binders VALUES('${id(2)}'),('${id(3)}');
    INSERT INTO marketplace_case_matches VALUES('${id(1)}','${id(2)}','selected',now());
    INSERT INTO marketplace_binder_members VALUES('${id(2)}','${id(9)}','active'),('${id(3)}','${id(10)}','active');
    INSERT INTO marketplace_binder_works VALUES('${id(5)}','${id(1)}','${id(2)}');
  `);
  await db.exec(migration("20261001160000_book_round_trip_shipping.sql"));
  await db.exec(migration("20261002090000_book_round_trip_journey.sql"));
  return db;
}

/** Plan « expédition organisée » éligible, soumis par le client. */
export async function insertEligiblePlan(db: PGlite, overrides: Record<string, unknown> = {}): Promise<void> {
  const plan: Record<string, unknown> = {
    case_id: RT.case, mode: "organized_round_trip", contact_name: "QA Client", phone: "+33 6 00 00 00 00",
    address_line1: "1 rue de la Recette", postal_code: "75011", city: "Paris", country_code: "FR",
    parcel_weight_grams: 480, parcel_length_mm: 340, parcel_width_mm: 240, parcel_height_mm: 60,
    book_description: "QA roman broché courant", book_kind: "ordinary", declared_value_cents: 3000,
    conditions_accepted_at: new Date().toISOString(), submitted_by: RT.customer, ...overrides,
  };
  const keys = Object.keys(plan);
  await db.query(`INSERT INTO marketplace_case_logistics_plans(${keys.join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    keys.map((k) => plan[k]));
}

export async function acceptPlanByWorkshop(db: PGlite, binder = RT.binder, actor = RT.member): Promise<void> {
  await db.query(`UPDATE marketplace_case_logistics_plans SET workshop_binder_id=$1, workshop_decision='accepted',
    workshop_plan_version=version, workshop_decided_by=$2, workshop_decided_at=now(), workshop_reception_name='QA Atelier',
    workshop_address_line1='3 rue des Relieurs', workshop_postal_code='69002', workshop_city='Lyon',
    workshop_country_code='FR' WHERE case_id=$3`, [binder, actor, RT.case]);
}

export async function insertProposal(db: PGlite, kind: "manual" | "book_round_trip_fr", status = "proposed"): Promise<void> {
  const shipping = kind === "manual" ? 0 : 1250;
  await db.query(`INSERT INTO marketplace_commercial_proposals(id,case_id,status,accepted_at,currency,payment_circuit,deposit_type,
    shipping_total_cents,shipping_other_cents,shipping_outbound_cents,shipping_return_cents,customer_vat_rate_bps,tax_country,
    customer_total_ttc_cents,shipping_offer_kind) VALUES ($1,$2,$3,$4,'EUR','legacy_resale','NONE',$5,$5,0,0,2000,'FR',13500,$6)`,
    [RT.proposal, RT.case, status, status === "accepted" ? new Date().toISOString() : null, shipping, kind]);
}

export async function payProposal(db: PGlite): Promise<void> {
  await db.query("INSERT INTO marketplace_commercial_proposal_payments VALUES($1,now(),'cs_qa','pi_qa',13500,'eur')", [RT.proposal]);
}

/** Dossier complet : plan accepté, offre acceptée et payée, réception physique, retour prêt et confirmé. */
export async function roundTripDb(): Promise<PGlite> {
  const db = await roundTripSchema();
  await insertEligiblePlan(db);
  await acceptPlanByWorkshop(db);
  await insertProposal(db, "book_round_trip_fr", "accepted");
  await payProposal(db);
  await db.exec(`UPDATE marketplace_round_trip_automation SET enabled=true WHERE id;
    INSERT INTO marketplace_round_trip_rate_approvals(case_id,proposal_id,binder_id,
      outbound_address_sha256,return_address_sha256,outbound_weight_grams,return_weight_grams,
      outbound_dimensions_mm,return_dimensions_mm,outbound_method,return_method,
      provider_quote_reference,coverage_evidence_reference,outbound_cost_ttc_cents,
      return_cost_ttc_cents,all_other_costs_ttc_cents,estimated_economic_cost_cents,
      economic_cost_evidence_reference,valid_until,reviewed_by)
    VALUES('${RT.case}','${RT.proposal}','${RT.binder}','${RT_OUT}','${RT_RET}',500,500,
      ARRAY[350,250,80],ARRAY[350,250,80],'QA outbound','QA return','QA quote only',
      'QA coverage only',400,400,0,700,'QA net cost only',now()+interval '1 day','${RT.admin}');
    INSERT INTO marketplace_work_logistics_events VALUES('${RT.work}','received');`);
  await db.query("SELECT marketplace_round_trip_return_ready($1,$2,$3,450,340,240,60)", [RT.case, RT.binder, RT.member]);
  await db.query("UPDATE marketplace_case_logistics_plans SET return_address_confirmed_at=now(), return_address_confirmed_version=version WHERE case_id=$1", [RT.case]);
  return db;
}

export async function reserveLeg(db: PGlite, direction: "outbound" | "return"): Promise<string> {
  const r = await db.query<{ r: { id: string } }>("SELECT marketplace_reserve_round_trip_label($1,$2,$3,$4) r", [RT.case, direction, RT_OUT, RT_RET]);
  return r.rows[0].r.id;
}

/** Ce que fait le serveur avant `label_confirmed` : déposer le PDF privé. */
export async function putLabelObject(db: PGlite, jobId: string): Promise<void> {
  await db.query("INSERT INTO storage.objects VALUES('round-trip-labels-private',$1)", [`${jobId}/label.pdf`]);
}
