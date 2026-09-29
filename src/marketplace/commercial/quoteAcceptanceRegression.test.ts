import { quoteRecipePrerequisites } from "./quoteRecipe.fixture";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowedTransitions, type QuoteStatus } from "../quotes/quoteStatus";
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const files = ["20260919090000_marketplace_binder_quotes", "20260920100000_marketplace_binder_invoice_vat_mention", "20260921090000_marketplace_binder_contacts_works", "20260923100000_marketplace_quote_size_blocks_photos", "20260923110000_marketplace_document_branding", "20260923120000_marketplace_invoice_compliance"];
const databases: PGlite[] = [];
let sequence = 100;
beforeAll(async () => {
  for (const patched of [false, true]) {
    const db = new PGlite(); databases.push(db);
    await db.exec(quoteRecipePrerequisites);
    for (const name of [...files, ...(patched ? ["20260928090000_marketplace_payment_circuits", "20260928110000_own_client_external_settlement"] : [])]) {
      await db.exec(readFileSync(new URL(`../../../supabase/migrations/${name}.sql`, import.meta.url), "utf8"));
    }
    await db.exec(`INSERT INTO auth.users VALUES('${id(1)}'); INSERT INTO marketplace_binders VALUES('${id(2)}');
      INSERT INTO marketplace_binder_members VALUES('${id(2)}','${id(1)}','active');
      INSERT INTO marketplace_binder_clients(id,binder_id,name) VALUES('${id(3)}','${id(2)}','QA regression');`);
  }
}, 30000);
afterAll(async () => { for (const db of databases) await db.close(); });
async function quote(db: PGlite, status: string, deposit: number, past: boolean, own: boolean) {
  const q = id(++sequence);
  await db.query(`INSERT INTO marketplace_binder_quotes(id,binder_id,client_id,quote_number,status,issue_date,valid_until,client_name,deposit_cents,vat_regime,subtotal_cents,total_ht_cents,total_vat_cents,total_ttc_cents)
    VALUES($1,$2,$3,$4,$5,'2026-01-01',$6,'QA regression',$7,'FRANCHISE',10000,10000,0,10000)`, [q,id(2),own ? id(3) : null,`QA-${sequence}`,status,past ? '2000-01-01' : '2099-01-01',deposit]);
  return q;
}
describe("historical acceptance versus new external agreement", () => {
  for (const status of ["draft", "sent", "expired"] as const) for (const deposit of [0, 1000]) for (const past of [false, true]) for (const own of [false, true]) {
    it(`${status}, deposit ${deposit}, expired date ${past}, own ${own}`, async () => {
      for (const [index, db] of databases.entries()) {
        const q = await quote(db,status,deposit,past,own);
        const external = own && status === 'sent' && deposit === 0 && !past;
        if (index === 1) {
          const contract = (await db.query<{ c: { eligible: boolean; revision: string } }>("SELECT marketplace_own_contract($1,$2,$3) c",[q,id(2),id(1)])).rows[0].c;
          expect(contract.eligible).toBe(external);
          if (external) {
            await expect(db.query("UPDATE marketplace_binder_quotes SET status='accepted' WHERE id=$1",[q])).rejects.toThrow('own_agreement_required');
            await db.query("SELECT marketplace_accept_own_quote($1,$2,$3,$4,$5)",[q,id(2),id(1),'QA accord documenté',contract.revision]);
          } else {
            await expect(db.query("SELECT marketplace_accept_own_quote($1,$2,$3,$4,$5)",[q,id(2),id(1),'QA accord documenté',contract.revision])).rejects.toThrow('external_contract_unavailable');
            await db.query("UPDATE marketplace_binder_quotes SET status='accepted' WHERE id=$1",[q]);
          }
          const row = (await db.query<{ payment_snapshot: { agreement_version?: string } }>("SELECT payment_snapshot FROM marketplace_binder_quotes WHERE id=$1",[q])).rows[0];
          expect(row.payment_snapshot.agreement_version).toBe(external ? 'own-external-v1' : undefined);
          await expect(db.query("UPDATE marketplace_binder_quotes SET status='refused' WHERE id=$1",[q])).rejects.toThrow('accepted_payment_terms_immutable');
          await db.query("UPDATE marketplace_binder_quotes SET status='invoiced' WHERE id=$1",[q]);
          await expect(db.query("UPDATE marketplace_binder_quotes SET status='accepted' WHERE id=$1",[q])).rejects.toThrow('accepted_payment_terms_immutable');
        } else {
          await db.query("UPDATE marketplace_binder_quotes SET status='accepted' WHERE id=$1",[q]);
          await db.query("UPDATE marketplace_binder_quotes SET status='refused' WHERE id=$1",[q]);
        }
      }
    });
  }
  it.each(["refused", "accepted", "invoiced"] as QuoteStatus[])("offers no manual transition from %s", status => {
    expect(allowedTransitions(status)).toEqual([]);
  });
  it.each(["deposit", "expired"])("preserves historical invoice issuance for %s without enabling settlements", async scenario => {
    const db = databases[1];
    await db.query("INSERT INTO marketplace_binder_billing_profiles(binder_id) VALUES($1) ON CONFLICT DO NOTHING", [id(2)]);
    const q = await quote(db, scenario === "expired" ? "expired" : "sent", scenario === "deposit" ? 1000 : 0, scenario === "expired", true);
    await db.query(`INSERT INTO marketplace_binder_quote_items(quote_id,binder_id,position,label,unit_price_cents,vat_rate_bps,total_ht_cents,line_key)
      VALUES($1,$2,0,'QA travaux',10000,0,10000,'qa-line')`, [q,id(2)]);
    await db.query("UPDATE marketplace_binder_quotes SET status='accepted' WHERE id=$1", [q]);
    const invoice = (await db.query<{ id: string }>("SELECT marketplace_binder_create_invoice_draft($1,$2,$3::jsonb) id", [id(2),q,JSON.stringify({
      issue_date:"2026-09-29",service_date:"2026-09-29",due_date:"2026-10-29",operation_nature:"services",client_type:"individual",
      client_billing_address_line1:"QA fictif",client_billing_postal_code:"00000",client_billing_city:"QA",client_billing_country:"FR",
      issuer:{legalForm:"QA",siren:"000000000",siret:"00000000000000",addressLine1:"QA fictif",postalCode:"00000",city:"QA"},
      vat_mention:"Mention de recette uniquement",
    })])).rows[0].id;
    await db.query("SELECT marketplace_binder_issue_invoice($1,$2,'[]'::jsonb)", [id(2),invoice]);
    expect((await db.query<{ s: { eligible: boolean | null } }>("SELECT marketplace_external_settlement_state($1,$2,$3) s", [invoice,id(2),id(1)])).rows[0].s.eligible).not.toBe(true);
    await expect(db.query("SELECT marketplace_record_external_settlement($1,$2,$3,$4,'receipt',1000,'QA reçu distinct')", [id(++sequence),invoice,id(2),id(1)])).rejects.toThrow();
    await expect(db.query("UPDATE marketplace_binder_quotes SET status='refused' WHERE id=$1",[q])).rejects.toThrow("accepted_payment_terms_immutable");
  });
});
