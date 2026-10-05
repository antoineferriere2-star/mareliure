import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CASE = id(20);
const BINDER = id(10);
const migration = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
const SELLER = JSON.stringify({ legal_name: "OPPE SAS", brand: "Ma Reliure", legal_mentions: [] });

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
      shipping_total_cents integer DEFAULT 0, shipping_other_cents integer DEFAULT 0, shipping_outbound_cents integer DEFAULT 0,
      shipping_return_cents integer DEFAULT 0, shipping_offer_kind text DEFAULT 'manual', payment_circuit text DEFAULT 'legacy_resale',
      deposit_type text DEFAULT 'NONE', customer_vat_rate_bps integer, customer_vat_amount_cents integer, customer_total_ht_cents integer,
      customer_total_ttc_cents integer, tax_country text, billing_country text, customer_type text DEFAULT 'CUSTOMER', business_name text,
      business_vat_number text, tax_validation_source text, accepted_at timestamptz, superseded_at timestamptz, tax_validated_at timestamptz);
    CREATE TABLE marketplace_commercial_proposal_payments(proposal_id uuid PRIMARY KEY, paid_at timestamptz);
    INSERT INTO marketplace_binders VALUES ('${BINDER}','approved');
    INSERT INTO marketplace_cases VALUES ('${CASE}','binder_selected','${id(2)}');
    -- Contrainte historique du transport, telle que la production la porte avant cette migration.
    ALTER TABLE marketplace_commercial_proposals ADD CONSTRAINT marketplace_round_trip_offer_check CHECK (
      shipping_offer_kind = 'manual' OR (shipping_offer_kind = 'book_round_trip_fr' AND shipping_total_cents = 1250 AND currency = 'EUR'
        AND (customer_vat_rate_bps IS NULL OR (customer_vat_rate_bps = 2000 AND tax_country = 'FR'))
        AND (accepted_at IS NULL OR (customer_vat_rate_bps = 2000 AND customer_total_ttc_cents IS NOT NULL))));
  `);
  await db.exec(migration("20261005120000_oppe_order_lifecycle.sql"));
  await db.exec(migration("20261005150000_oppe_invoicing.sql"));
  await db.exec(migration("20261005210000_oppe_tax_qualification.sql"));
  await db.exec(`
    INSERT INTO marketplace_quotes(case_id, binder_id, state, binder_payout_cents, service_description, lead_time_days, agreement_version, selected_at)
      VALUES ('${CASE}','${BINDER}','selected',15000,'Reliure',21,'oppe-workshop-v1',now());
  `);
}, 30000);
afterAll(async () => { await db?.close(); });

const proposal = (over: Record<string, string | number | null> = {}) => {
  const base = { customer_service_price_cents: 20000, shipping_total_cents: 1250, shipping_offer_kind: "'book_round_trip_fr'", ...over };
  return db.query<{ id: string }>(`INSERT INTO marketplace_commercial_proposals(case_id, version, status, binder_payout_cents, customer_service_price_cents,
    shipping_total_cents, shipping_other_cents, shipping_offer_kind, customer_total_ht_cents)
    VALUES ('${CASE}', (SELECT coalesce(max(version),0)+1 FROM marketplace_commercial_proposals), 'draft', 15000, ${base.customer_service_price_cents},
      ${base.shipping_total_cents}, ${base.shipping_total_cents}, ${base.shipping_offer_kind}, ${base.customer_service_price_cents} + ${base.shipping_total_cents}) RETURNING id`);
};

describe("validation fiscale d'un devis Oppe", () => {
  it("refuse la règle automatique « France = 20 % » et toute validation sans qualification ni justification", async () => {
    const { rows } = await proposal();
    const validate = (set: string) => db.exec(`UPDATE marketplace_commercial_proposals SET ${set}, tax_validated_at = now() WHERE id = '${rows[0].id}'`);
    const amounts = "customer_vat_amount_cents = 1250, customer_total_ttc_cents = 22500";
    await expect(validate(`tax_validation_source = 'FR_STANDARD_VAT_20', customer_vat_rate_bps = 2000, shipping_vat_rate_bps = 2000, service_tax_category = 'book_binding', tax_justification = 'justification suffisante', ${amounts}`)).rejects.toThrow("oppe_tax_requires_manual_validation");
    await expect(validate(`tax_validation_source = 'manual_admin_review', customer_vat_rate_bps = 550, shipping_vat_rate_bps = 2000, ${amounts}`)).rejects.toThrow("oppe_tax_category_required");
    await expect(validate(`tax_validation_source = 'manual_admin_review', customer_vat_rate_bps = 550, shipping_vat_rate_bps = 2000, service_tax_category = 'book_binding', ${amounts}`)).rejects.toThrow("oppe_tax_justification_required");
    await expect(validate(`tax_validation_source = 'manual_admin_review', customer_vat_rate_bps = 550, service_tax_category = 'book_binding', tax_justification = 'justification suffisante', ${amounts}`)).rejects.toThrow("oppe_tax_shipping_rate_required");
  });

  it("exige des montants cohérents avec les taux de chaque ligne", async () => {
    const id = (await db.query<{ id: string }>("SELECT id FROM marketplace_commercial_proposals LIMIT 1")).rows[0].id;
    await expect(db.exec(`UPDATE marketplace_commercial_proposals SET tax_validation_source = 'manual_admin_review', customer_vat_rate_bps = 550,
      shipping_vat_rate_bps = 2000, service_tax_category = 'book_binding', tax_justification = 'justification suffisante', tax_country = 'FR',
      customer_vat_amount_cents = 4250, customer_total_ttc_cents = 25500, tax_validated_at = now() WHERE id = '${id}'`)).rejects.toThrow("oppe_tax_amounts_inconsistent");
  });

  it("accepte 5,5 % sur la prestation et 20 % sur le transport, puis facture ligne par ligne", async () => {
    const id = (await db.query<{ id: string }>("SELECT id FROM marketplace_commercial_proposals LIMIT 1")).rows[0].id;
    // 20 000 × 5,5 % = 1 100 ; 1 250 × 20 % = 250 ; TVA 1 350 ; TTC 22 600.
    await db.exec(`UPDATE marketplace_commercial_proposals SET tax_validation_source = 'manual_admin_review', customer_vat_rate_bps = 550,
      shipping_vat_rate_bps = 2000, service_tax_category = 'book_binding', tax_justification = 'Reliure d''un livre au sens fiscal : validation comptable', tax_country = 'FR',
      customer_vat_amount_cents = 1350, customer_total_ttc_cents = 22600, tax_validated_at = now() WHERE id = '${id}'`);
    await db.exec(`UPDATE marketplace_commercial_proposals SET status = 'proposed' WHERE id = '${id}'`);
    await db.exec(`INSERT INTO marketplace_proposal_acceptances(proposal_id, case_id, customer_user_id, terms_version, snapshot_sha256)
      VALUES ('${id}','${CASE}','00000000-0000-4000-8000-000000000002','cgv','${"c".repeat(64)}')`);
    await db.exec(`UPDATE marketplace_commercial_proposals SET status = 'accepted', accepted_at = now() WHERE id = '${id}'`);
    await db.query("SELECT marketplace_open_oppe_order($1, now())", [id]);
    await db.query(`SELECT marketplace_issue_oppe_invoice($1, $2::jsonb, '{}'::jsonb, '{}'::jsonb, 'Reliure')`, [id, SELLER]);
    const items = (await db.query<{ category: string; vat_rate_bps: number; vat_cents: number; total_ttc_cents: number }>(
      "SELECT category, vat_rate_bps, vat_cents, total_ttc_cents FROM marketplace_oppe_invoice_items ORDER BY position")).rows;
    expect(items).toEqual([
      { category: "service", vat_rate_bps: 550, vat_cents: 1100, total_ttc_cents: 21100 },
      { category: "shipping", vat_rate_bps: 2000, vat_cents: 250, total_ttc_cents: 1500 },
    ]);
    const inv = (await db.query<{ total_vat_cents: number; total_ttc_cents: number; vat_breakdown: { rate_bps: number; vat_cents: number }[] }>(
      "SELECT total_vat_cents, total_ttc_cents, vat_breakdown FROM marketplace_oppe_invoices")).rows[0];
    expect(inv.total_vat_cents).toBe(1350);
    expect(inv.total_ttc_cents).toBe(22600);
    expect(inv.vat_breakdown.map((g) => [g.rate_bps, g.vat_cents])).toEqual([[550, 1100], [2000, 250]]);
  });

  it("ventile un avoir partiel au taux de chaque ligne", async () => {
    const invoice = (await db.query<{ id: string }>("SELECT id FROM marketplace_oppe_invoices")).rows[0].id;
    // Remboursement du seul transport : 15 € TTC = 12,50 € HT + 2,50 € de TVA à 20 %.
    await db.query("SELECT marketplace_issue_oppe_credit_note($1, 1500, 'Remboursement du transport')", [invoice]);
    const note = (await db.query<{ total_ht_cents: number; total_vat_cents: number; vat_breakdown: { rate_bps: number }[] }>(
      "SELECT total_ht_cents, total_vat_cents, vat_breakdown FROM marketplace_oppe_credit_notes")).rows[0];
    expect(note.total_ht_cents + note.total_vat_cents).toBe(1500);
    expect(note.total_vat_cents).toBeGreaterThan(0);
  });
});
