import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = id(1);
const USER_A = id(3);
const USER_B = id(4);
const BINDER_A = id(10);
const BINDER_B = id(11);
const CASE = id(20);
const migration = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");

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
      brand text DEFAULT 'MA_RELIURE', status text, binder_payout_cents integer, customer_service_price_cents integer,
      accepted_at timestamptz, superseded_at timestamptz, tax_validated_at timestamptz);
    INSERT INTO user_roles VALUES ('${ADMIN}','admin');
    INSERT INTO marketplace_binders VALUES ('${BINDER_A}','approved'),('${BINDER_B}','approved');
    INSERT INTO marketplace_binder_members(binder_id, user_id) VALUES ('${BINDER_A}','${USER_A}'),('${BINDER_B}','${USER_B}');
    INSERT INTO marketplace_cases VALUES ('${CASE}','paid','${id(2)}');
  `);
  await db.exec(migration("20261005120000_oppe_order_lifecycle.sql"));
  await db.exec(migration("20261005180000_oppe_supplier_invoices.sql"));
  await db.exec(`
    INSERT INTO marketplace_quotes(case_id, binder_id, state, binder_payout_cents, service_description, lead_time_days, agreement_version, selected_at)
      VALUES ('${CASE}','${BINDER_A}','selected',15000,'Reliure',21,'oppe-workshop-v1',now());
    INSERT INTO marketplace_commercial_proposals(id, case_id, version, status, accepted_at, binder_payout_cents, customer_service_price_cents)
      VALUES ('${id(30)}','${CASE}',1,'accepted',now(),15000,20000);
    INSERT INTO marketplace_oppe_orders(proposal_id, case_id, brand, paid_at) VALUES ('${id(30)}','${CASE}','MA_RELIURE', now());
    INSERT INTO marketplace_oppe_order_assignments(case_id, binder_id, payout_cents, lead_time_days) VALUES ('${CASE}','${BINDER_A}',15000,21);
  `);
}, 30000);
afterAll(async () => { await db?.close(); });

const today = new Date().toISOString().slice(0, 10);
const submit = (binder: string, user: string, number = "F-2026-001", over: Partial<{ source: string; regime: string; rate: number | null; mention: string | null; date: string }> = {}) =>
  db.query<{ id: string }>(
    `SELECT marketplace_submit_supplier_invoice($1, $2, $3, $4, $5::date, $6, $7, $8, 'supplier-invoices-private/x.pdf', $9) AS id`,
    [CASE, binder, over.source ?? "external", number, over.date ?? today, over.regime ?? "VAT_LIABLE", over.rate === undefined ? 2000 : over.rate, over.mention ?? null, user],
  );

describe("facture de l'atelier à Oppe", () => {
  it("n'est possible qu'une fois la commande terminée", async () => {
    await expect(submit(BINDER_A, USER_A)).rejects.toThrow("supplier_invoice_requires_completed_order");
    await db.exec(`UPDATE marketplace_oppe_orders SET status = 'completed', completed_at = now() WHERE case_id = '${CASE}'`);
  });

  it("est réservée à l'atelier affecté (accès inter-ateliers refusé)", async () => {
    await expect(submit(BINDER_B, USER_B)).rejects.toThrow("forbidden");
    await expect(submit(BINDER_A, USER_B)).rejects.toThrow("forbidden");
  });

  it("reprend la rémunération acceptée, TVA d'achat distincte, échéance à 30 jours", async () => {
    await submit(BINDER_A, USER_A);
    const { rows } = await db.query<{ amount_ht_cents: number; vat_cents: number; amount_ttc_cents: number; due_in: number; status: string }>(
      "SELECT amount_ht_cents, vat_cents, amount_ttc_cents, (due_date - issue_date) AS due_in, status FROM marketplace_oppe_supplier_invoices",
    );
    expect(rows).toEqual([{ amount_ht_cents: 15000, vat_cents: 3000, amount_ttc_cents: 18000, due_in: 30, status: "submitted" }]);
  });

  it("refuse un doublon de numéro et une seconde facture pour la même affectation", async () => {
    await expect(submit(BINDER_A, USER_A, " f-2026-001 ")).rejects.toThrow();
    await expect(submit(BINDER_A, USER_A, "F-2026-002")).rejects.toThrow();
  });

  it("ne se réécrit pas", async () => {
    await expect(db.exec("UPDATE marketplace_oppe_supplier_invoices SET amount_ht_cents = 16000")).rejects.toThrow("supplier_invoice_terms_immutable");
  });
});

describe("règlement manuel", () => {
  const invoiceId = async () => (await db.query<{ id: string }>("SELECT id FROM marketplace_oppe_supplier_invoices")).rows[0].id;

  it("exige une facture acceptée par l'administration", async () => {
    await expect(db.query(`SELECT marketplace_record_supplier_payment($1, $2::date, 18000, 'VIR-001', $3)`, [await invoiceId(), today, ADMIN])).rejects.toThrow("supplier_invoice_not_accepted");
    await expect(db.query(`SELECT marketplace_review_supplier_invoice($1, 'rejected', 'x', $2)`, [await invoiceId(), ADMIN])).rejects.toThrow("supplier_rejection_reason_required");
    await expect(db.query(`SELECT marketplace_review_supplier_invoice($1, 'accepted', NULL, $2)`, [await invoiceId(), USER_A])).rejects.toThrow("admin_required");
    await db.query(`SELECT marketplace_review_supplier_invoice($1, 'accepted', NULL, $2)`, [await invoiceId(), ADMIN]);
  });

  it("rapproche des règlements partiels puis solde, référence unique, jamais au-delà du TTC", async () => {
    const pay = async (amount: number, ref: string) =>
      (await db.query<{ r: string }>(`SELECT marketplace_record_supplier_payment($1, $2::date, $3, $4, $5) AS r`, [await invoiceId(), today, amount, ref, ADMIN])).rows[0].r;
    expect(await pay(10000, "VIR-001")).toBe("partial");
    await expect(pay(1, "vir-001")).rejects.toThrow();
    await expect(pay(8001, "VIR-002")).rejects.toThrow("supplier_payment_exceeds_invoice");
    expect(await pay(8000, "VIR-002")).toBe("paid");
    const { rows } = await db.query<{ status: string }>("SELECT status FROM marketplace_oppe_supplier_invoices");
    expect(rows[0].status).toBe("paid");
    await expect(db.exec("DELETE FROM marketplace_oppe_supplier_payments")).rejects.toThrow("supplier_payment_immutable");
  });

  it("n'ouvre aucune fonction à l'API publique", async () => {
    const { rows } = await db.query<{ ok: boolean }>(
      `SELECT NOT has_function_privilege('authenticated','marketplace_record_supplier_payment(uuid,date,integer,text,uuid)','EXECUTE')
          AND NOT has_function_privilege('anon','marketplace_submit_supplier_invoice(uuid,uuid,text,text,date,text,integer,text,text,uuid)','EXECUTE') AS ok`,
    );
    expect(rows[0].ok).toBe(true);
  });
});

describe("franchise en base", () => {
  it("exige la mention et ne porte aucune TVA", async () => {
    await db.exec(`UPDATE marketplace_oppe_supplier_invoices SET status = 'rejected', review_reason = 'remplacée' WHERE true`).catch(() => undefined);
    // Une facture soldée ne se rejette pas : on vérifie la règle de franchise sur une nouvelle affectation.
    await db.exec(`INSERT INTO marketplace_oppe_order_assignments(case_id, binder_id, payout_cents) VALUES ('${CASE}','${BINDER_B}',15000)`).catch(() => undefined);
    await expect(db.exec(`INSERT INTO marketplace_oppe_supplier_invoices(case_id, assignment_id, binder_id, source, invoice_number, issue_date, due_date, amount_ht_cents, vat_regime, vat_cents, amount_ttc_cents, document_path)
      SELECT '${CASE}', id, '${BINDER_B}', 'external', 'FR-1', current_date, current_date + 30, 15000, 'FRANCHISE', 0, 15000, 'x' FROM marketplace_oppe_order_assignments WHERE binder_id = '${BINDER_A}'`)).rejects.toThrow();
  });
});
