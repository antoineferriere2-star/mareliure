import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Schéma environnant minimal ; les migrations réelles du lot 2 puis du lot 3 fournissent le reste.
let db: PGlite;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CUSTOMER = id(2);
const BINDER_USER = id(3);
const BINDER = id(10);
const CASE = id(20);
const migration = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");

const SELLER = JSON.stringify({ legal_name: "OPPE SAS", brand: "Ma Reliure", legal_mentions: ["TVA FR55 943 317 610"] });
const BILLING = JSON.stringify({ name: "Client Test", address_line1: "1 rue du Livre", postal_code: "75001", city: "Paris", country: "FR" });

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE user_roles(user_id uuid, role text);
    CREATE TABLE marketplace_binders(id uuid PRIMARY KEY, status text);
    CREATE TABLE marketplace_binder_members(binder_id uuid, user_id uuid, account_status text DEFAULT 'active');
    CREATE TABLE marketplace_cases(id uuid PRIMARY KEY, status text, customer_user_id uuid);
    CREATE TABLE marketplace_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid, binder_id uuid, actor_user_id uuid, event_type text, metadata jsonb);
    CREATE TABLE marketplace_case_matches(case_id uuid, binder_id uuid, state text, responded_at timestamptz, accepted_at timestamptz,
      declined_at timestamptz, selected_at timestamptz, decline_reason_code text, decline_reason_detail text, decline_reason text);
    CREATE TABLE marketplace_quotes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid, binder_id uuid, state text,
      binder_payout_cents integer, accepted_at timestamptz, declined_at timestamptz, selected_at timestamptz,
      decline_reason_code text, decline_reason_detail text, updated_at timestamptz);
    CREATE TABLE marketplace_commercial_proposals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid, version integer,
      brand text DEFAULT 'MA_RELIURE', currency text DEFAULT 'EUR', status text, binder_payout_cents integer, customer_service_price_cents integer,
      shipping_total_cents integer DEFAULT 0, shipping_offer_kind text DEFAULT 'manual', customer_vat_rate_bps integer,
      customer_vat_amount_cents integer, customer_total_ht_cents integer, customer_total_ttc_cents integer,
      tax_country text, billing_country text, customer_type text DEFAULT 'CUSTOMER', business_name text, business_vat_number text,
      accepted_at timestamptz, superseded_at timestamptz, tax_validated_at timestamptz);
    CREATE TABLE marketplace_commercial_proposal_payments(proposal_id uuid PRIMARY KEY, paid_at timestamptz);
    INSERT INTO marketplace_binders VALUES ('${BINDER}','approved');
    INSERT INTO marketplace_binder_members(binder_id, user_id) VALUES ('${BINDER}','${BINDER_USER}');
    INSERT INTO marketplace_cases VALUES ('${CASE}','binder_selected','${CUSTOMER}');
  `);
  await db.exec(migration("20261005120000_oppe_order_lifecycle.sql"));
  await db.exec(migration("20261005150000_oppe_invoicing.sql"));
  // Accord atelier retenu, devis 200 € HT + transport 12,50 € HT, TVA 20 % validée.
  await db.exec(`
    INSERT INTO marketplace_quotes(case_id, binder_id, state, binder_payout_cents, service_description, lead_time_days, agreement_version, selected_at)
      VALUES ('${CASE}','${BINDER}','selected',15000,'Reliure demi-cuir',21,'oppe-workshop-v1',now());
    INSERT INTO marketplace_commercial_proposals(case_id, version, status, binder_payout_cents, customer_service_price_cents,
      shipping_total_cents, shipping_offer_kind, customer_vat_rate_bps, customer_vat_amount_cents, customer_total_ht_cents,
      customer_total_ttc_cents, tax_country, billing_country, tax_validated_at)
      VALUES ('${CASE}',1,'proposed',15000,20000,1250,'book_round_trip_fr',2000,4250,21250,25500,'FR','FR',now());
  `);
}, 30000);
afterAll(async () => { await db?.close(); });

const proposalId = async () => (await db.query<{ id: string }>("SELECT id FROM marketplace_commercial_proposals LIMIT 1")).rows[0].id;
const accept = async (billing: string) =>
  db.query<{ r: string }>(`SELECT marketplace_accept_proposal_as_customer_v2($1, $2, 'cgv-oppe-2026-10-05', $3, NULL, NULL, $4::jsonb) AS r`,
    [await proposalId(), CUSTOMER, "b".repeat(64), billing]);

describe("acceptation avec coordonnées de facturation", () => {
  it("refuse un pays de facturation différent de celui de la fiscalité", async () => {
    await expect(accept(BILLING.replace('"FR"', '"BE"'))).rejects.toThrow("billing_country_mismatch");
  });
  it("enregistre les coordonnées avec l'acceptation", async () => {
    expect((await accept(BILLING)).rows[0].r).toBe("accepted");
    const { rows } = await db.query<{ city: string; country: string }>("SELECT city, country FROM marketplace_proposal_billing_details");
    expect(rows).toEqual([{ city: "Paris", country: "FR" }]);
  });
});

describe("facture Oppe", () => {
  it("exige une commande payée", async () => {
    await expect(db.query(`SELECT marketplace_issue_oppe_invoice($1, $2::jsonb, '{}'::jsonb, '{}'::jsonb, 'Reliure')`, [await proposalId(), SELLER]))
      .rejects.toThrow("invoice_requires_paid_order");
    await db.query("SELECT marketplace_open_oppe_order($1, now())", [await proposalId()]);
  });

  it("s'émet une seule fois, numérotée dans la série de la marque, au total exactement payé", async () => {
    const issue = async () =>
      (await db.query<{ id: string }>(`SELECT marketplace_issue_oppe_invoice($1, $2::jsonb, $3::jsonb, '{"method":"card"}'::jsonb, 'Reliure demi-cuir') AS id`,
        [await proposalId(), SELLER, BILLING])).rows[0].id;
    const first = await issue();
    expect(await issue()).toBe(first);
    const inv = (await db.query<{ number: string; total_ttc_cents: number; total_vat_cents: number }>(
      "SELECT number, total_ttc_cents, total_vat_cents FROM marketplace_oppe_invoices")).rows;
    expect(inv).toHaveLength(1);
    expect(inv[0].number).toMatch(/^MR-\d{4}-00001$/);
    expect(inv[0]).toMatchObject({ total_ttc_cents: 25500, total_vat_cents: 4250 });
    const items = (await db.query<{ category: string; total_ht_cents: number; vat_cents: number }>(
      "SELECT category, total_ht_cents, vat_cents FROM marketplace_oppe_invoice_items ORDER BY position")).rows;
    expect(items).toEqual([
      { category: "service", total_ht_cents: 20000, vat_cents: 4000 },
      { category: "shipping", total_ht_cents: 1250, vat_cents: 250 },
    ]);
  });

  it("ne se modifie ni ne se supprime", async () => {
    await expect(db.exec("UPDATE marketplace_oppe_invoices SET total_ttc_cents = 1")).rejects.toThrow("oppe_document_immutable");
    await expect(db.exec("DELETE FROM marketplace_oppe_invoice_items")).rejects.toThrow("oppe_document_immutable");
  });
});

describe("avoirs", () => {
  it("ventile un remboursement partiel par ligne et par taux", async () => {
    const invoice = (await db.query<{ id: string }>("SELECT id FROM marketplace_oppe_invoices")).rows[0].id;
    await db.query("SELECT marketplace_issue_oppe_credit_note($1, 5100, 'Remboursement partiel du transport et geste')", [invoice]);
    const note = (await db.query<{ number: string; total_ht_cents: number; total_vat_cents: number; total_ttc_cents: number }>(
      "SELECT number, total_ht_cents, total_vat_cents, total_ttc_cents FROM marketplace_oppe_credit_notes")).rows[0];
    expect(note.number).toMatch(/^MR-AV-\d{4}-00001$/);
    expect(note.total_ttc_cents).toBe(5100);
    expect(note.total_ht_cents + note.total_vat_cents).toBe(5100);
    expect(note.total_ht_cents).toBe(4250);
  });

  it("ne dépasse jamais ce qui reste de la facture", async () => {
    const invoice = (await db.query<{ id: string }>("SELECT id FROM marketplace_oppe_invoices")).rows[0].id;
    await expect(db.query("SELECT marketplace_issue_oppe_credit_note($1, 20401, 'Trop rembourser')", [invoice])).rejects.toThrow("credit_exceeds_invoice");
    await db.query("SELECT marketplace_issue_oppe_credit_note($1, 20400, 'Remboursement du solde')", [invoice]);
    const total = (await db.query<{ s: number }>("SELECT sum(total_ttc_cents)::integer AS s FROM marketplace_oppe_credit_notes")).rows[0].s;
    expect(total).toBe(25500);
  });
});
