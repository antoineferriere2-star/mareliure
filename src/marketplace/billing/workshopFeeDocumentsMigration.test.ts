import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { oppeSellerSnapshot } from "@/marketplace/invoices/oppeInvoice";
let db: PGlite;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE marketplace_workshop_offer_settings(id boolean PRIMARY KEY,subscription_open boolean,online_payment_open boolean);
    INSERT INTO marketplace_workshop_offer_settings VALUES(true,false,false);
    CREATE TABLE marketplace_binders(id uuid PRIMARY KEY);
    CREATE TABLE marketplace_binder_billing_profiles(binder_id uuid PRIMARY KEY,country text,postal_code text,
      address_line1 text,city text,legal_name text,workshop_name text,vat_regime text,vat_number text,siren text,address_line2 text,email text);
    CREATE TABLE marketplace_workshop_connect_consents(binder_id uuid PRIMARY KEY REFERENCES marketplace_binders,
      accepted_by uuid,accepted_at timestamptz DEFAULT now(),terms_version text,fee_bps integer);
    CREATE TABLE marketplace_workshop_online_payments(id uuid PRIMARY KEY,binder_id uuid REFERENCES marketplace_binders,
      paid_at timestamptz,fee_cents integer,fee_refunded_cents integer,payment_intent_id text);
    INSERT INTO marketplace_binders VALUES('${id(1)}'),('${id(2)}');
    INSERT INTO marketplace_workshop_connect_consents VALUES('${id(1)}','${id(10)}',now(),'old_terms',300);
    INSERT INTO marketplace_workshop_online_payments VALUES('${id(4)}','${id(1)}',now(),300,0,'pi_legacy');`);
  await db.exec(readFileSync("supabase/migrations/20261007180000_workshop_fee_vat_documents.sql", "utf8"));
  await db.exec(`INSERT INTO marketplace_binder_billing_profiles VALUES('${id(2)}','FR','75001','Adresse de recette','Paris',
    'Atelier fictif',NULL,'FRANCHISE',NULL,NULL,NULL,NULL);
    INSERT INTO marketplace_workshop_connect_consents(binder_id,accepted_by,terms_version,fee_bps,fee_tax_basis)
    VALUES('${id(2)}','${id(10)}','oppe-workshop-2026-10-07-v2',300,'vat_inclusive_fr_20');
    INSERT INTO marketplace_workshop_online_payments(id,binder_id,paid_at,fee_cents,fee_refunded_cents,payment_intent_id,fee_brand)
    VALUES('${id(3)}','${id(2)}',now(),3,0,'pi_test','FINE_BINDERY');`);
}, 30000);
afterAll(async () => { await db?.close(); });
const issue = (refunded: number, payment = id(3), fee = 3) => db.query(
  "SELECT marketplace_issue_workshop_fee_documents($1,'fee_test',$2,$3,'FINE_BINDERY',$4,$5)",
  [payment,fee,refunded,JSON.stringify(oppeSellerSnapshot("FINE_BINDERY", "BUSINESS")),
    JSON.stringify({ business_name: "Atelier fictif", name: "Atelier fictif", address_line1: "Adresse de recette", country: "FR" })]);
describe("factures de frais Oppe C — PostgreSQL", () => {
  it("préserve les anciennes conventions et paiements, sans leur attribuer un régime", async () => {
    expect((await db.query("SELECT fee_tax_basis FROM marketplace_workshop_online_payments WHERE id=$1",[id(4)])).rows)
      .toEqual([{ fee_tax_basis: null }]);
    await expect(issue(0,id(4),300)).rejects.toThrow("fee_collection_not_verified");
  });
  it("émet une seule facture, puis des avoirs cumulatifs au centime après remboursement réel des frais", async () => {
    await issue(0); await issue(0);
    expect((await db.query("SELECT kind,total_ht_cents,total_vat_cents,total_ttc_cents FROM marketplace_workshop_fee_documents")).rows)
      .toEqual([{ kind: "invoice", total_ht_cents: 3, total_vat_cents: 0, total_ttc_cents: 3 }]);
    await issue(1); await issue(1); await issue(2); await issue(3); await issue(2);
    expect((await db.query("SELECT count(*)::integer AS n,sum(total_ht_cents)::integer AS ht,sum(total_vat_cents)::integer AS vat,sum(total_ttc_cents)::integer AS ttc FROM marketplace_workshop_fee_documents WHERE kind='credit_note'")).rows)
      .toEqual([{ n: 3, ht: 3, vat: 0, ttc: 3 }]);
    expect((await db.query("SELECT fee_refunded_cents FROM marketplace_workshop_online_payments WHERE id=$1",[id(3)])).rows)
      .toEqual([{ fee_refunded_cents: 3 }]);
    await expect(issue(4)).rejects.toThrow("fee_collection_not_verified");
    await expect(db.exec("UPDATE marketplace_workshop_fee_documents SET number='changed'")).rejects.toThrow("immutable");
    await expect(db.exec("DELETE FROM marketplace_workshop_fee_documents")).rejects.toThrow("immutable");
  });
  it("garde la preuve des conditions antérieures et refuse une transition HT silencieuse", async () => {
    await db.exec(`UPDATE marketplace_workshop_connect_consents SET fee_tax_basis='explicit_ht_legacy' WHERE binder_id='${id(1)}'`);
    expect((await db.query("SELECT count(*)::integer AS n FROM marketplace_workshop_connect_consent_history")).rows).toEqual([{ n: 1 }]);
    await expect(db.exec(`UPDATE marketplace_workshop_connect_consents SET fee_tax_basis='vat_inclusive_fr_20' WHERE binder_id='${id(1)}'`))
      .rejects.toThrow("explicit_ht_convention");
  });
  it("ventile une retenue de 3 € en 2,50 € HT et 0,50 € TVA et fige son régime après encaissement", async () => {
    await db.exec(`INSERT INTO marketplace_workshop_online_payments(id,binder_id,paid_at,fee_cents,fee_refunded_cents,payment_intent_id,fee_brand)
      VALUES('${id(5)}','${id(2)}',now(),300,0,'pi_test_300','FINE_BINDERY');`);
    await issue(0,id(5),300); await issue(100,id(5),300); await issue(300,id(5),300);
    expect((await db.query("SELECT kind,sum(total_ht_cents)::integer AS ht,sum(total_vat_cents)::integer AS vat,sum(total_ttc_cents)::integer AS ttc FROM marketplace_workshop_fee_documents WHERE payment_id=$1 GROUP BY kind ORDER BY kind",[id(5)])).rows)
      .toEqual([{ kind: "credit_note", ht: 250, vat: 50, ttc: 300 },{ kind: "invoice", ht: 250, vat: 50, ttc: 300 }]);
    await expect(db.exec(`UPDATE marketplace_workshop_online_payments SET fee_tax_basis=NULL WHERE id='${id(5)}'`)).rejects.toThrow("immutable");
  });
  it("refuse les accès financiers directs des navigateurs", async () => {
    await expect(db.exec("SET ROLE authenticated; SELECT * FROM marketplace_workshop_fee_documents")).rejects.toThrow();
    await db.exec("RESET ROLE");
    await expect(db.exec("SET ROLE anon; SELECT marketplace_issue_workshop_fee_documents(NULL,NULL,0,0,NULL,NULL,NULL)")).rejects.toThrow();
    await db.exec("RESET ROLE");
  });
});
