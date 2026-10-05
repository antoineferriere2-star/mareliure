import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Schéma environnant minimal ; la migration réelle fournit gardes, tables et fonctions.
// Scénario complet également rejoué sur une copie restaurée de la production (journal de publication).
let db: PGlite;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = id(1);
const CUSTOMER = id(2);
const BINDER_USER_A = id(3);
const BINDER_USER_B = id(4);
const BINDER_A = id(10);
const BINDER_B = id(11);
const CASE = id(20);

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
    INSERT INTO marketplace_binder_members(binder_id, user_id) VALUES ('${BINDER_A}','${BINDER_USER_A}'),('${BINDER_B}','${BINDER_USER_B}');
    INSERT INTO marketplace_cases VALUES ('${CASE}','awaiting_binder_response','${CUSTOMER}');
  `);
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20261005120000_oppe_order_lifecycle.sql", import.meta.url), "utf8"));
  await db.exec(`
    INSERT INTO marketplace_quotes(case_id, binder_id, state, binder_payout_cents, service_description) VALUES
      ('${CASE}','${BINDER_A}','offered',15000,'Reliure demi-cuir'),('${CASE}','${BINDER_B}','offered',16000,'Reliure demi-cuir');
    INSERT INTO marketplace_case_matches(case_id, binder_id, state) VALUES ('${CASE}','${BINDER_A}','offered'),('${CASE}','${BINDER_B}','offered');
  `);
}, 30000);
afterAll(async () => { await db?.close(); });

const proposal = (price: number, payout: number, derogation: string | null = null, version = 1) =>
  db.query<{ id: string }>(
    `INSERT INTO marketplace_commercial_proposals(case_id, version, status, binder_payout_cents, customer_service_price_cents, price_derogation_reason, tax_validated_at)
     VALUES ($1, $2, 'draft', $3, $4, $5, now()) RETURNING id`,
    [CASE, version, payout, price, derogation],
  );

describe("accord atelier", () => {
  it("exige un délai pour accepter, puis fige prestation, rémunération et délai", async () => {
    await expect(db.exec(`SELECT marketplace_respond_to_offer('${CASE}','${BINDER_A}',true,NULL,NULL,'${BINDER_USER_A}')`)).rejects.toThrow("workshop_lead_time_required");
    await db.exec(`SELECT marketplace_accept_workshop_offer('${CASE}','${BINDER_A}',21,'${BINDER_USER_A}')`);
    await db.exec(`SELECT marketplace_accept_workshop_offer('${CASE}','${BINDER_B}',28,'${BINDER_USER_B}')`);
    await expect(db.exec(`UPDATE marketplace_quotes SET binder_payout_cents = 12000 WHERE binder_id = '${BINDER_A}'`)).rejects.toThrow("workshop_agreement_immutable");
  });
});

describe("devis Oppe", () => {
  it("n'existe pas sans atelier retenu ayant accepté", async () => {
    await expect(proposal(20000, 15000)).rejects.toThrow("workshop_agreement_required");
    await db.exec(`UPDATE marketplace_quotes SET state = 'selected', selected_at = now() WHERE binder_id = '${BINDER_A}'`);
    await db.exec(`UPDATE marketplace_quotes SET state = 'cancelled' WHERE binder_id = '${BINDER_B}'`);
  });

  it("reprend la rémunération acceptée et respecte 25 % de marge sur le prix de vente", async () => {
    await expect(proposal(20000, 14000)).rejects.toThrow("workshop_payout_mismatch");
    await expect(proposal(19900, 15000)).rejects.toThrow("margin_below_target_without_derogation");
    await expect(proposal(19000, 15000, "court")).rejects.toThrow("margin_below_target_without_derogation");
    await db.exec("BEGIN");
    await proposal(19000, 15000, "Geste commercial validé : client fidèle");
    await db.exec("ROLLBACK");
    const { rows } = await proposal(20000, 15000);
    const bound = await db.query<{ contract_version: string; workshop_lead_time_days: number; workshop_service_description: string }>(
      `SELECT contract_version, workshop_lead_time_days, workshop_service_description FROM marketplace_commercial_proposals WHERE id = $1`, [rows[0].id],
    );
    expect(bound.rows[0]).toEqual({ contract_version: "oppe-a-v1", workshop_lead_time_days: 21, workshop_service_description: "Reliure demi-cuir" });
    await expect(db.query(`UPDATE marketplace_commercial_proposals SET customer_service_price_cents = 30000 WHERE id = $1`, [rows[0].id])).rejects.toThrow("proposal_agreement_immutable");
    await db.query(`UPDATE marketplace_commercial_proposals SET status = 'proposed', sent_at = now() WHERE id = $1`, [rows[0].id]);
  });

  it("n'est accepté que par son client, preuve enregistrée, une seule fois", async () => {
    const pid = (await db.query<{ id: string }>(`SELECT id FROM marketplace_commercial_proposals WHERE status = 'proposed'`)).rows[0].id;
    await expect(db.query(`UPDATE marketplace_commercial_proposals SET status = 'accepted', accepted_at = now() WHERE id = $1`, [pid])).rejects.toThrow("customer_acceptance_required");
    const accept = (user: string) =>
      db.query<{ r: string }>(`SELECT marketplace_accept_proposal_as_customer($1, $2, 'cgv-oppe-2026-10-05', $3, '192.0.2.1', 'test') AS r`, [pid, user, "a".repeat(64)]);
    await expect(accept(BINDER_USER_A)).rejects.toThrow("forbidden");
    expect((await accept(CUSTOMER)).rows[0].r).toBe("accepted");
    expect((await accept(CUSTOMER)).rows[0].r).toBe("already_accepted");
    await expect(db.query(`UPDATE marketplace_proposal_acceptances SET terms_version = 'x' WHERE proposal_id = $1`, [pid])).rejects.toThrow("proposal_acceptance_immutable");
  });
});

describe("commande payée", () => {
  it("s'ouvre une seule fois et suit son cycle", async () => {
    const pid = (await db.query<{ id: string }>(`SELECT id FROM marketplace_commercial_proposals WHERE accepted_at IS NOT NULL`)).rows[0].id;
    const open = await db.query<{ a: boolean; b: boolean }>(`SELECT marketplace_open_oppe_order($1, now()) AS a, marketplace_open_oppe_order($1, now()) AS b`, [pid]);
    expect(open.rows[0]).toEqual({ a: true, b: false });
    await expect(db.exec(`SELECT marketplace_advance_oppe_order('${CASE}','in_production','${BINDER_USER_B}','binder',NULL)`)).rejects.toThrow("forbidden");
    await db.exec(`SELECT marketplace_advance_oppe_order('${CASE}','in_production','${BINDER_USER_A}','binder',NULL)`);
    await expect(db.exec(`SELECT marketplace_advance_oppe_order('${CASE}','cancelled','${BINDER_USER_A}','binder','raison suffisante ici')`)).rejects.toThrow("admin_required");
  });

  it("se réattribue avec historique, sans toucher au prix client", async () => {
    await expect(db.exec(`SELECT marketplace_reassign_oppe_order('${CASE}','${BINDER_B}','court','${ADMIN}')`)).rejects.toThrow("reassignment_reason_required");
    await expect(db.exec(`SELECT marketplace_reassign_oppe_order('${CASE}','${BINDER_B}','Atelier initial indisponible','${ADMIN}')`)).rejects.toThrow("workshop_agreement_required");
    await db.exec(`UPDATE marketplace_quotes SET state = 'accepted' WHERE binder_id = '${BINDER_B}'`);
    await db.exec(`SELECT marketplace_reassign_oppe_order('${CASE}','${BINDER_B}','Atelier initial indisponible','${ADMIN}')`);
    const { rows } = await db.query<{ binder_id: string; payout_cents: number; ended: boolean }>(
      `SELECT binder_id, payout_cents, ended_at IS NOT NULL AS ended FROM marketplace_oppe_order_assignments ORDER BY started_at, ended_at NULLS LAST`,
    );
    expect(rows).toEqual([
      { binder_id: BINDER_A, payout_cents: 15000, ended: true },
      { binder_id: BINDER_B, payout_cents: 16000, ended: false },
    ]);
    const price = await db.query<{ p: number }>(`SELECT customer_service_price_cents AS p FROM marketplace_commercial_proposals WHERE accepted_at IS NOT NULL`);
    expect(price.rows[0].p).toBe(20000);
    await db.exec(`SELECT marketplace_advance_oppe_order('${CASE}','completed','${BINDER_USER_B}','binder',NULL)`);
    await expect(db.exec(`SELECT marketplace_advance_oppe_order('${CASE}','cancelled','${ADMIN}','admin','Annulation après réalisation')`)).rejects.toThrow("order_transition_forbidden");
  });

  it("n'ouvre aucune fonction à l'API publique", async () => {
    const { rows } = await db.query<{ ok: boolean }>(
      `SELECT NOT has_function_privilege('authenticated','marketplace_accept_proposal_as_customer(uuid,uuid,text,text,text,text)','EXECUTE')
          AND NOT has_function_privilege('anon','marketplace_open_oppe_order(uuid,timestamptz)','EXECUTE')
          AND has_function_privilege('service_role','marketplace_reassign_oppe_order(uuid,uuid,text,uuid)','EXECUTE') AS ok`,
    );
    expect(rows[0].ok).toBe(true);
  });
});
