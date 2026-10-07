import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
let db: PGlite;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE marketplace_workshop_offer_settings(online_payment_open boolean);
    CREATE TABLE marketplace_binders(id uuid PRIMARY KEY,stripe_account_id text,stripe_connect_charges_enabled boolean,stripe_connect_payouts_enabled boolean);
    CREATE TABLE marketplace_binder_clients(id uuid PRIMARY KEY,binder_id uuid,origin text);
    CREATE TABLE marketplace_binder_works(id uuid PRIMARY KEY,binder_id uuid,source text);
    CREATE TABLE marketplace_binder_quotes(id uuid PRIMARY KEY,binder_id uuid,work_id uuid,client_id uuid);
    CREATE TABLE marketplace_binder_invoices(id uuid PRIMARY KEY,binder_id uuid,quote_id uuid,status text,currency text,deposit_cents integer,total_ttc_cents integer);
    CREATE TABLE marketplace_external_settlements(invoice_id uuid);
    CREATE TABLE marketplace_binder_credit_notes(invoice_id uuid);
    CREATE TABLE marketplace_workshop_connect_consents(binder_id uuid);
    CREATE TABLE marketplace_workshop_online_payments(id uuid DEFAULT gen_random_uuid(),binder_id uuid,invoice_id uuid UNIQUE,stripe_account_id text,token_hash text,token_expires_at timestamptz,amount_cents integer,fee_cents integer,currency text,status text DEFAULT 'ready',checkout_session_id text,payment_intent_id text,checkout_expires_at timestamptz,paid_at timestamptz,refunded_cents integer DEFAULT 0,disputed boolean DEFAULT false,reconciliation_required boolean DEFAULT false,stripe_fee_cents integer,fee_refunded_cents integer,receipt_url text,updated_at timestamptz);
    CREATE TABLE marketplace_workshop_checkout_attempts(checkout_session_id text PRIMARY KEY,payment_id uuid,binder_id uuid,payment_intent_id text,terminal_reason text);`);
  await db.exec(readFileSync('supabase/migrations/20261007190000_workshop_payment_own_client_origin.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261007200000_workshop_payment_attempt_reconciliation.sql','utf8'));
},30000);
afterAll(async()=> {await db?.close();});
beforeEach(async()=> {
  await db.exec(`TRUNCATE marketplace_workshop_checkout_attempts,marketplace_workshop_online_payments,marketplace_external_settlements,marketplace_binder_credit_notes,marketplace_workshop_connect_consents,marketplace_binder_invoices,marketplace_binder_quotes,marketplace_binder_works,marketplace_binder_clients,marketplace_binders,marketplace_workshop_offer_settings;
    INSERT INTO marketplace_workshop_offer_settings VALUES(true);
    INSERT INTO marketplace_binders VALUES('${id(1)}','acct_fixture',true,true);
    INSERT INTO marketplace_binder_clients VALUES('${id(2)}','${id(1)}','mon_client');
    INSERT INTO marketplace_binder_works VALUES('${id(3)}','${id(1)}','mon_client');
    INSERT INTO marketplace_binder_quotes VALUES('${id(4)}','${id(1)}',NULL,'${id(2)}');
    INSERT INTO marketplace_binder_invoices VALUES('${id(5)}','${id(1)}','${id(4)}','issued','EUR',0,10000);
    INSERT INTO marketplace_workshop_connect_consents VALUES('${id(1)}');`);
});
const reserve=()=>db.query<{p: {id:string;amount_cents:number;fee_cents:number}}>(`SELECT marketplace_reserve_workshop_online_payment('${id(1)}','${id(5)}','fixture','2099-01-01') AS p`);
describe('provenance C vérifiée en PostgreSQL',()=> {
  it('archive la tentative terminale et ne reporte ni frais ni reçu lors de la reprise',async()=> {
    const p=(await reserve()).rows[0].p;
    await db.exec(`UPDATE marketplace_workshop_online_payments SET checkout_session_id='cs_old',payment_intent_id='pi_old',status='failed',stripe_fee_cents=35,fee_refunded_cents=300,receipt_url='https://receipt.example.test'`);
    await db.query("SELECT marketplace_release_workshop_payment_checkout($1,'cs_old','pi_old','canceled')",[p.id]);
    expect((await db.query('SELECT status,stripe_fee_cents,fee_refunded_cents,receipt_url FROM marketplace_workshop_online_payments')).rows).toEqual([{status:'ready',stripe_fee_cents:null,fee_refunded_cents:null,receipt_url:null}]);
    expect((await db.query('SELECT payment_intent_id,terminal_reason FROM marketplace_workshop_checkout_attempts')).rows).toEqual([{payment_intent_id:'pi_old',terminal_reason:'canceled'}]);
    await db.exec("UPDATE marketplace_workshop_online_payments SET checkout_session_id='cs_new',stripe_fee_cents=340");
    await db.query("SELECT marketplace_release_workshop_payment_checkout($1,'cs_old','pi_old','canceled')",[p.id]);
    expect((await db.query('SELECT stripe_fee_cents FROM marketplace_workshop_online_payments')).rows).toEqual([{stripe_fee_cents:340}]);
  });
  it('ne libère jamais une tentative payée ou en litige',async()=> {
    const p=(await reserve()).rows[0].p;await db.exec("UPDATE marketplace_workshop_online_payments SET checkout_session_id='cs_old',paid_at=now()");
    await expect(db.query("SELECT marketplace_release_workshop_payment_checkout($1,'cs_old','pi_old','canceled')",[p.id])).rejects.toThrow('checkout_release_refused');
    await db.exec('UPDATE marketplace_workshop_online_payments SET paid_at=NULL,disputed=true');
    await expect(db.query("SELECT marketplace_release_workshop_payment_checkout($1,'cs_old','pi_old','canceled')",[p.id])).rejects.toThrow('checkout_release_refused');
  });
  it('accepte le client propre sans livre et réserve une seule fois les 3 % TTC',async()=> {
    const first=(await reserve()).rows[0].p;
    expect(first).toMatchObject({amount_cents:10000,fee_cents:300});
    expect((await reserve()).rows[0].p.id).toBe(first.id);
    expect((await db.query('SELECT count(*)::integer AS n FROM marketplace_workshop_online_payments')).rows).toEqual([{n:1}]);
  });
  it('accepte un livre propre sans client et les origines importées propres',async()=> {
    await db.exec(`UPDATE marketplace_binder_quotes SET work_id='${id(3)}',client_id=NULL;UPDATE marketplace_binder_works SET source='workshop_platform'`);
    await expect(reserve()).resolves.toBeDefined();
  });
  it.each(['ma_reliure','unknown',null])('refuse un client Oppe ou de provenance inconnue : %s',async(origin)=> {
    await db.query('UPDATE marketplace_binder_clients SET origin=$1',[origin]);
    await expect(reserve()).rejects.toThrow('online_invoice_ineligible');
  });
  it('refuse le client Oppe même si le livre est propre',async()=> {
    await db.exec(`UPDATE marketplace_binder_quotes SET work_id='${id(3)}';UPDATE marketplace_binder_clients SET origin='ma_reliure'`);
    await expect(reserve()).rejects.toThrow('online_invoice_ineligible');
  });
  it('refuse le livre Oppe même si le client est propre',async()=> {
    await db.exec(`UPDATE marketplace_binder_quotes SET work_id='${id(3)}';UPDATE marketplace_binder_works SET source='ma_reliure'`);
    await expect(reserve()).rejects.toThrow('online_invoice_ineligible');
  });
  it.each(['client','work','quote'])('refuse une référence appartenant à un autre atelier : %s',async(kind)=> {
    if(kind==='work') await db.exec(`UPDATE marketplace_binder_quotes SET work_id='${id(3)}';UPDATE marketplace_binder_works SET binder_id='${id(9)}'`);
    if(kind==='client') await db.exec(`UPDATE marketplace_binder_clients SET binder_id='${id(9)}'`);
    if(kind==='quote') await db.exec(`UPDATE marketplace_binder_quotes SET binder_id='${id(9)}'`);
    await expect(reserve()).rejects.toThrow();
  });
  it('refuse une facture sans provenance',async()=> {
    await db.exec('UPDATE marketplace_binder_quotes SET client_id=NULL');
    await expect(reserve()).rejects.toThrow('online_invoice_ineligible');
  });
  it.each(['draft','non_eur','deposit','zero','settlement','credit','consent','charges','payouts','closed'])('conserve le contrôle %s',async(kind)=> {
    const changes:Record<string,string>={draft:"UPDATE marketplace_binder_invoices SET status='draft'",non_eur:"UPDATE marketplace_binder_invoices SET currency='USD'",deposit:'UPDATE marketplace_binder_invoices SET deposit_cents=1',zero:'UPDATE marketplace_binder_invoices SET total_ttc_cents=0',settlement:`INSERT INTO marketplace_external_settlements VALUES('${id(5)}')`,credit:`INSERT INTO marketplace_binder_credit_notes VALUES('${id(5)}')`,consent:'DELETE FROM marketplace_workshop_connect_consents',charges:'UPDATE marketplace_binders SET stripe_connect_charges_enabled=false',payouts:'UPDATE marketplace_binders SET stripe_connect_payouts_enabled=false',closed:'UPDATE marketplace_workshop_offer_settings SET online_payment_open=false'};
    await db.exec(changes[kind]); await expect(reserve()).rejects.toThrow();
  });
  it('interdit l’exécution par le navigateur',async()=> {
    await db.exec('SET ROLE authenticated');await expect(reserve()).rejects.toThrow('permission denied');await db.exec('RESET ROLE');
  });
});
