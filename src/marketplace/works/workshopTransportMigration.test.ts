import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";
const id = (n: number) => `51000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: PGlite;
const address = { name: "Client fictif", line1: "1 rue de la Recette", postalCode: "75001", city: "Paris", countryCode: "FR" };
const details = { mode: "parcel", carrier: "Transporteur fictif", tracking: "TEST-NOT-A-SHIPMENT", invoiceId: id(6), payer: "workshop", transportCostCents: 700, coverageEvidence: "SIMULATION fournisseur, aucune assurance réelle", fromAddress: address, toAddress: { ...address, name: "Atelier fictif" }, parcel: { weightGrams: 450, lengthMm: 250, widthMm: 180, heightMm: 60 } };
const append = (event: number, data: unknown, actor = id(1), binder = id(3), work = id(5)) => db.query("SELECT marketplace_work_logistics($1,$2,$3,'append',$4::jsonb)", [work,binder,actor,JSON.stringify({ id: id(event), version: 0, kind: "outbound", details: data })]);
const attach = (label: number, actor = id(1), binder = id(3), work = id(5), event = id(20)) => db.query("SELECT marketplace_attach_work_transport_label($1,$2,$3,$4,$5)", [work,binder,actor,event,id(label)]);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(bucket_id text,name text);
    CREATE TABLE marketplace_binder_members(binder_id uuid,user_id uuid,account_status text);
    CREATE TABLE marketplace_binders(id uuid PRIMARY KEY,status text);
    CREATE TABLE marketplace_cases(id uuid PRIMARY KEY,acquisition_origin text,referred_binder_id uuid);
    CREATE TABLE marketplace_case_matches(case_id uuid,binder_id uuid,state text,invited_at timestamptz,UNIQUE(case_id,binder_id));
    CREATE TABLE marketplace_binder_works(id uuid PRIMARY KEY,binder_id uuid,source text);
    CREATE TABLE marketplace_binder_quotes(id uuid PRIMARY KEY,binder_id uuid,work_id uuid);
    CREATE TABLE marketplace_binder_invoices(id uuid PRIMARY KEY,binder_id uuid,quote_id uuid,status text);
    INSERT INTO auth.users VALUES('${id(1)}'),('${id(2)}');
    INSERT INTO marketplace_binder_members VALUES('${id(3)}','${id(1)}','active'),('${id(4)}','${id(2)}','active');
    INSERT INTO marketplace_binder_works VALUES('${id(5)}','${id(3)}','mon_client'),('${id(8)}','${id(3)}','ma_reliure');
    INSERT INTO marketplace_binder_quotes VALUES('${id(7)}','${id(3)}','${id(5)}');
    INSERT INTO marketplace_binder_invoices VALUES('${id(6)}','${id(3)}','${id(7)}','issued');`);
  for (const file of ["20260928130000_work_logistics_manual.sql", "20261006130000_workshop_order_transport.sql", "20261007140000_workshop_transport_labels.sql"]) await db.exec(readFileSync(new URL(`../../../supabase/migrations/${file}`, import.meta.url), "utf8"));
}, 20000);
afterAll(async () => { await db?.close(); });
it("refuse un colis client propre sans adresses ni mesures, sans créer d’événement", async () => {
  const { fromAddress: _from, toAddress: _to, parcel: _parcel, ...withoutPlan } = details;
  await expect(append(10, withoutPlan)).rejects.toThrow("transport_address_required");
  await expect(append(11, { ...details, parcel: { ...details.parcel, weightGrams: 0 } })).rejects.toThrow("transport_parcel_required");
  expect((await db.query("SELECT * FROM marketplace_work_logistics_events")).rows).toHaveLength(0);
});
it("refuse un autre atelier et une facture qui ne correspond pas à l’ouvrage", async () => {
  await expect(append(12, details, id(2), id(4))).rejects.toThrow("work_not_found");
  await expect(append(13, { ...details, invoiceId: id(99) })).rejects.toThrow();
});
it("enregistre une seule déclaration avec son payeur, ses mesures et ses adresses privées", async () => {
  await append(20, details); await append(20, details);
  const rows = (await db.query<{ details: typeof details }>("SELECT details FROM marketplace_work_logistics_events")).rows;
  expect(rows).toHaveLength(1); expect(rows[0].details).toEqual(details);
});
it("refuse un PDF absent, un autre acteur et un dossier du circuit A", async () => {
  await expect(attach(30)).rejects.toThrow("label_object_missing");
  await expect(attach(30, id(2), id(4))).rejects.toThrow("own_work_not_found");
  await expect(attach(30, id(1), id(3), id(8))).rejects.toThrow("own_work_not_found");
});
it("rattache le PDF privé une seule fois et conserve ses preuves immuables", async () => {
  await db.query("INSERT INTO storage.objects VALUES('work-transport-labels-private',$1)", [`${id(3)}/${id(5)}/${id(20)}/${id(30)}.pdf`]);
  await attach(30); await attach(30);
  expect((await db.query("SELECT * FROM marketplace_work_logistics_labels")).rows).toHaveLength(1);
  await expect(db.query("UPDATE marketplace_work_logistics_labels SET path='other.pdf'")).rejects.toThrow("logistics_history_immutable");
  await expect(db.query("DELETE FROM marketplace_work_logistics_labels")).rejects.toThrow("logistics_history_immutable");
});
it("ne confond pas livraison transporteur et réception physique, et exige le constat avant retour", async () => {
  await expect(db.query("SELECT marketplace_work_logistics($1,$2,$3,'append',$4::jsonb)", [id(5),id(3),id(1),JSON.stringify({ id:id(41), version:1, kind:"return", details })])).rejects.toThrow("invalid_transition");
  await db.query("SELECT marketplace_work_logistics($1,$2,$3,'append',$4::jsonb)", [id(5),id(3),id(1),JSON.stringify({ id:id(42), version:1, kind:"carrier_delivered", details:{proof:"FICTITIOUS carrier declaration"} })]);
  await expect(db.query("SELECT marketplace_work_logistics($1,$2,$3,'append',$4::jsonb)", [id(5),id(3),id(1),JSON.stringify({ id:id(43), version:2, kind:"return", details })])).rejects.toThrow("invalid_transition");
});
it("répare les invitations manquantes sans altérer une décision, l’origine ou l’atelier", async () => {
  await db.exec(`INSERT INTO marketplace_binders VALUES('${id(3)}','approved'),('${id(4)}','suspended');
    INSERT INTO marketplace_cases VALUES('${id(60)}','BINDER_REFERRED','${id(3)}'),('${id(61)}','FINEBINDERY_PROFILE','${id(3)}'),('${id(62)}','MA_RELIURE','${id(3)}'),('${id(63)}','BINDER_REFERRED','${id(4)}');
    INSERT INTO marketplace_case_matches VALUES('${id(61)}','${id(3)}','declined',now());`);
  await db.query("SELECT marketplace_repair_workshop_referral_matches()");
  await db.query("SELECT marketplace_repair_workshop_referral_matches()");
  expect((await db.query("SELECT case_id,state FROM marketplace_case_matches ORDER BY case_id")).rows).toEqual([{case_id:id(60),state:"invited"},{case_id:id(61),state:"declined"}]);
  expect((await db.query("SELECT acquisition_origin FROM marketplace_cases WHERE id=$1",[id(60)])).rows).toEqual([{acquisition_origin:"BINDER_REFERRED"}]);
});
