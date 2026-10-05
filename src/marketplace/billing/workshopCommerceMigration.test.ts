import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sql = (name: string) => readFileSync(`supabase/migrations/${name}.sql`, "utf8");
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE TABLE marketplace_binders(id uuid PRIMARY KEY,public_profile_status text DEFAULT 'draft',public_profile_published_at timestamptz,stripe_account_id text,stripe_connect_charges_enabled boolean,stripe_connect_payouts_enabled boolean);
 CREATE TABLE marketplace_binder_members(binder_id uuid,user_id uuid,role text,account_status text);
 CREATE TABLE marketplace_binder_portfolio(binder_id uuid,is_published boolean);
 CREATE TABLE marketplace_binder_works(id uuid PRIMARY KEY,binder_id uuid,source text);
 CREATE TABLE marketplace_binder_quotes(id uuid PRIMARY KEY,binder_id uuid,work_id uuid);
 CREATE TABLE marketplace_binder_invoices(id uuid PRIMARY KEY,binder_id uuid,quote_id uuid,status text,deposit_cents integer DEFAULT 0,
 issuer jsonb DEFAULT '{}',currency text DEFAULT 'EUR',client_type text,client_name text,client_legal_name text,
 client_billing_address_line1 text,client_billing_postal_code text,client_billing_city text,client_billing_country text,client_siren text,client_vat_number text,
 total_ht_cents integer,total_vat_cents integer,total_ttc_cents integer,vat_breakdown jsonb,legal_mentions jsonb DEFAULT '[]');
 CREATE TABLE marketplace_binder_invoice_items(id uuid PRIMARY KEY,binder_id uuid,invoice_id uuid,position integer,label text,description text,unit text,quantity numeric,unit_price_cents integer,vat_rate_bps integer,total_ht_cents integer);
 CREATE TABLE marketplace_binder_document_counters(binder_id uuid,kind text,year integer,last_value integer,PRIMARY KEY(binder_id,kind,year));
 CREATE TABLE marketplace_binder_billing_profiles(binder_id uuid,credit_note_prefix text);
 CREATE TABLE marketplace_external_settlements(id uuid PRIMARY KEY,invoice_id uuid);
 INSERT INTO auth.users VALUES('${id(1)}'),('${id(2)}');
 INSERT INTO marketplace_binders(id) VALUES('${id(10)}');
 INSERT INTO marketplace_binder_members VALUES('${id(10)}','${id(1)}','OWNER','active');`);
  const credit = sql("20260923120000_marketplace_invoice_compliance");
  await db.exec(
    credit.slice(
      credit.indexOf("CREATE TABLE IF NOT EXISTS public.marketplace_binder_credit_notes"),
      credit.indexOf("REVOKE ALL ON FUNCTION public.marketplace_binder_create_invoice_draft"),
    ),
  );
  await db.exec(sql("20261006100000_workshop_subscriptions"));
  await db.exec(sql("20261006110000_workshop_partial_credit_notes"));
  await db.exec(sql("20261006120000_workshop_connect_payments"));
  await db.exec(`INSERT INTO marketplace_binder_billing_profiles VALUES('${id(10)}','AV');
 INSERT INTO marketplace_binder_works VALUES('${id(20)}','${id(10)}','mon_client');
 INSERT INTO marketplace_binder_quotes VALUES('${id(30)}','${id(10)}','${id(20)}');
 INSERT INTO marketplace_binder_invoices(id,binder_id,quote_id,status,total_ht_cents,total_vat_cents,total_ttc_cents,vat_breakdown)
 VALUES('${id(40)}','${id(10)}','${id(30)}','issued',900,115,1015,'[{"vatRateBps":550,"baseHtCents":450,"vatCents":25},{"vatRateBps":2000,"baseHtCents":450,"vatCents":90}]'),
 ('${id(41)}','${id(10)}','${id(30)}','issued',10000,2000,12000,'[{"vatRateBps":2000,"baseHtCents":10000,"vatCents":2000}]');
 -- Remise de 10 % : 500 HT avant remise par ligne, 450 après.
 INSERT INTO marketplace_binder_invoice_items VALUES('${id(50)}','${id(10)}','${id(40)}',0,'Reliure',NULL,NULL,1,500,550,500),
 ('${id(51)}','${id(10)}','${id(40)}',1,'Restauration',NULL,NULL,1,500,2000,500);`);
}, 30000);
afterAll(async () => {
  await db?.close();
});

describe("abonnement atelier en PostgreSQL", () => {
  it("conserve les ateliers existants gratuits, y compris après une tentative abandonnée", async () => {
    expect(
      (
        await db.query(
          `SELECT legacy_free FROM marketplace_binder_subscriptions WHERE binder_id='${id(10)}'`,
        )
      ).rows,
    ).toEqual([{ legacy_free: true }]);
    await expect(
      db.exec(`SELECT marketplace_reserve_workshop_checkout('${id(10)}','${id(1)}','v1')`),
    ).rejects.toThrow("workshop_subscription_closed");
    await db.exec("UPDATE marketplace_workshop_offer_settings SET subscription_open=true");
    await db.exec(`SELECT marketplace_reserve_workshop_checkout('${id(10)}','${id(1)}','v1')`);
    expect(
      (await db.query(`SELECT marketplace_workshop_can_create('${id(10)}') AS allowed`)).rows,
    ).toEqual([{ allowed: true }]);
  });
  it("refuse un autre compte et refuse la création après résiliation, conserve la lecture", async () => {
    await expect(
      db.exec(`SELECT marketplace_reserve_workshop_checkout('${id(10)}','${id(2)}','v1')`),
    ).rejects.toThrow("forbidden");
    await db.exec(`UPDATE marketplace_binder_subscriptions SET stripe_customer_id='cus_qa' WHERE binder_id='${id(10)}';
  SELECT marketplace_sync_workshop_subscription('${id(10)}','{"id":"sub_qa","customer":"cus_qa","status":"active","period_end":"2099-01-01","cancel_at_period_end":true}',10);
  SELECT marketplace_sync_workshop_subscription('${id(10)}','{"id":"sub_qa","customer":"cus_qa","status":"canceled","period_end":"2000-01-01","cancel_at_period_end":false}',20);`);
    await expect(
      db.exec(`INSERT INTO marketplace_binder_quotes VALUES('${id(31)}','${id(10)}','${id(20)}')`),
    ).rejects.toThrow("workshop_subscription_required");
    expect(
      (await db.query(`SELECT count(*)::integer AS n FROM marketplace_binder_invoices`)).rows,
    ).toEqual([{ n: 2 }]);
    await db.exec(
      `SELECT marketplace_sync_workshop_subscription('${id(10)}','{"id":"sub_qa","customer":"cus_qa","status":"active","period_end":"2099-01-01","cancel_at_period_end":false}',5)`,
    );
    expect(
      (
        await db.query(
          `SELECT status FROM marketplace_binder_subscriptions WHERE binder_id='${id(10)}'`,
        )
      ).rows,
    ).toEqual([{ status: "canceled" }]);
    await db.exec("UPDATE marketplace_workshop_offer_settings SET subscription_open=false");
  });
  it("refuse les écritures directes du navigateur", async () => {
    await expect(
      db.exec(
        `SET ROLE authenticated;UPDATE marketplace_binder_subscriptions SET legacy_free=true;`,
      ),
    ).rejects.toThrow();
    await db.exec("RESET ROLE");
  });
});
describe("avoirs partiels", () => {
  const issue = (request: number, lines: unknown) =>
    db.query(
      `SELECT marketplace_binder_create_partial_credit_note($1,$2,'2026-10-05','Correction client',$3,$4) AS id`,
      [id(10), id(40), id(request), JSON.stringify(lines)],
    );
  it("reprend sans doublon et garde la ventilation d'origine après remise", async () => {
    const first = await issue(60, [
      { position: 0, htCents: 100 },
      { position: 1, htCents: 200 },
    ]);
    expect(
      (
        await issue(60, [
          { position: 0, htCents: 100 },
          { position: 1, htCents: 200 },
        ])
      ).rows,
    ).toEqual(first.rows);
    const note = (
      await db.query("SELECT total_ht_cents,total_vat_cents FROM marketplace_binder_credit_notes")
    ).rows[0];
    expect(note).toEqual({ total_ht_cents: 300, total_vat_cents: 46 });
    await expect(issue(61, [{ position: 0, htCents: 351 }])).rejects.toThrow("credit_exceeds_line");
    await expect(
      issue(62, [
        { position: 0, htCents: 1 },
        { position: 0, htCents: 1 },
      ]),
    ).rejects.toThrow("credit_duplicate_line");
  });
  it("complète uniquement le reliquat, somme HT/TVA exacte et facture immuable", async () => {
    await db.exec(
      `SELECT marketplace_binder_create_full_credit_note('${id(10)}','${id(40)}','2026-10-05','Annulation du reliquat')`,
    );
    expect(
      (
        await db.query(
          "SELECT sum(total_ht_cents)::integer AS ht,sum(total_vat_cents)::integer AS vat FROM marketplace_binder_credit_notes",
        )
      ).rows,
    ).toEqual([{ ht: 900, vat: 115 }]);
    await expect(issue(63, [{ position: 1, htCents: 1 }])).rejects.toThrow("credit_exceeds_line");
    await expect(
      db.exec("UPDATE marketplace_binder_credit_notes SET reason='Autre' "),
    ).rejects.toThrow("immutable");
    expect(
      (
        await db.query(
          `SELECT total_ht_cents FROM marketplace_binder_invoices WHERE id='${id(40)}'`,
        )
      ).rows,
    ).toEqual([{ total_ht_cents: 900 }]);
  });
});
describe("paiement Connect distinct", () => {
  it("réserve le paiement propre et refuse le mélange des circuits", async () => {
    await db.exec(`UPDATE marketplace_binders SET stripe_account_id='acct_qa',stripe_connect_charges_enabled=true,stripe_connect_payouts_enabled=true WHERE id='${id(10)}';
    UPDATE marketplace_workshop_offer_settings SET online_payment_open=true;
    INSERT INTO marketplace_workshop_connect_consents(binder_id,accepted_by,terms_version) VALUES('${id(10)}','${id(1)}','v1');`);
    const result = await db.query<{ p: { fee_cents: number; id: string } }>(
      `SELECT marketplace_reserve_workshop_online_payment('${id(10)}','${id(41)}','hash','2099-01-01') AS p`,
    );
    expect(result.rows[0].p.fee_cents).toBe(360);
    await expect(
      db.exec(`INSERT INTO marketplace_external_settlements VALUES('${id(70)}','${id(41)}')`),
    ).rejects.toThrow("online_payment_circuit_reserved");
    await db.exec(`UPDATE marketplace_binder_works SET source='ma_reliure' WHERE id='${id(20)}'`);
    await expect(
      db.exec(
        `SELECT marketplace_reserve_workshop_online_payment('${id(10)}','${id(41)}','other','2099-01-01')`,
      ),
    ).rejects.toThrow("online_invoice_ineligible");
  });
});
