import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { quoteRecipePrerequisites } from "./quoteRecipe.fixture";
let db:PGlite;
const id=(n:number)=>`52000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const migration=(name:string)=>readFileSync(new URL(`../../../supabase/migrations/${name}.sql`,import.meta.url),"utf8");
const seller={workshopName:"Atelier fictif",legalName:"Atelier fictif",legalForm:"EI",siret:"12345678900012",country:"FR"};
const input=(n:number)=>({issue_date:"2026-10-06",valid_until:"2099-01-01",client_name:"Client fictif",client_id:id(n),work_id:id(n+10),
  currency:"EUR",issuer:seller,vat_regime:"FRANCHISE",subtotal_cents:10000,total_ht_cents:10000,total_vat_cents:0,total_ttc_cents:10000,
  discount_type:"NONE",discount_value:0,discount_cents:0,vat_breakdown:[],deposit_type:"NONE",deposit_value:0,deposit_cents:0});
const contract=async(q:string,binder=id(2),actor=id(1))=>(await db.query<{c:{eligible:boolean;agreementRequired:boolean;revision:string}}>("SELECT marketplace_own_contract($1,$2,$3) c",[q,binder,actor])).rows[0].c;
const create=async(n:number)=>(await db.query<{id:string}>("SELECT marketplace_binder_create_quote($1,$2::jsonb,'[]') id",[id(2),JSON.stringify(input(n))])).rows[0].id;
beforeAll(async()=>{
  db=new PGlite();await db.exec(quoteRecipePrerequisites);
  await db.exec("ALTER TABLE marketplace_cases ADD COLUMN brand text DEFAULT 'MA_RELIURE'; ALTER TABLE marketplace_binders ADD COLUMN status text DEFAULT 'approved'; CREATE TABLE marketplace_quotes(id uuid,case_id uuid,binder_id uuid); CREATE TABLE marketplace_case_matches(case_id uuid,binder_id uuid,state text);");
  for(const name of ["20260919090000_marketplace_binder_quotes","20260920100000_marketplace_binder_invoice_vat_mention","20260921090000_marketplace_binder_contacts_works","20260923100000_marketplace_quote_size_blocks_photos","20260923110000_marketplace_document_branding","20260923120000_marketplace_invoice_compliance","20260928090000_marketplace_payment_circuits","20260928110000_own_client_external_settlement","20260928130000_work_logistics_manual","20261001150000_own_client_seller_identity_contract_epoch","20261005090000_commercial_origin_separation","20261007160000_workshop_quote_contract_epoch"])await db.exec(migration(name));
  await db.exec(`INSERT INTO auth.users VALUES('${id(1)}'),('${id(9)}');INSERT INTO marketplace_binders(id) VALUES('${id(2)}'),('${id(8)}');INSERT INTO marketplace_binder_members VALUES('${id(2)}','${id(1)}','active'),('${id(8)}','${id(9)}','active');
    INSERT INTO marketplace_cases(id,brand,acquisition_origin,referred_binder_id) VALUES('${id(20)}','MA_RELIURE','BINDER_REFERRED','${id(2)}'),('${id(21)}','FINE_BINDERY','FINEBINDERY_PROFILE','${id(2)}'),('${id(22)}','MA_RELIURE','MA_RELIURE_ACQUIRED',NULL);
    INSERT INTO marketplace_binder_clients(id,binder_id,name,origin,origin_case_id) VALUES('${id(30)}','${id(2)}','Client MR','workshop_platform','${id(20)}'),('${id(31)}','${id(2)}','Client FB','workshop_platform','${id(21)}'),('${id(32)}','${id(2)}','Client Oppe','ma_reliure','${id(22)}'),('${id(33)}','${id(2)}','Client propre','mon_client',NULL);
    INSERT INTO marketplace_binder_works(id,binder_id,contact_id,title,reference,source,case_id) VALUES('${id(40)}','${id(2)}','${id(30)}','Livre fictif','QA-1','workshop_platform','${id(20)}'),('${id(41)}','${id(2)}','${id(31)}','Livre fictif','QA-2','workshop_platform','${id(21)}'),('${id(42)}','${id(2)}','${id(32)}','Livre Oppe','QA-3','ma_reliure','${id(22)}'),('${id(43)}','${id(2)}','${id(33)}','Livre propre','QA-4','mon_client',NULL);`);
},30000);
afterAll(async()=>{await db?.close();});
it("reproduit l'absence d'accord pour la vitrine puis préserve les devis existants à la migration",async()=>{
  const q=await create(30);expect((await contract(q)).agreementRequired).toBe(false);
  const before=await db.query("SELECT md5(jsonb_agg(to_jsonb(q) ORDER BY id)::text) hash FROM marketplace_binder_quotes q");
  await db.exec(migration("20261007170000_workshop_referral_agreement"));
  expect((await db.query("SELECT md5(jsonb_agg(to_jsonb(q) ORDER BY id)::text) hash FROM marketplace_binder_quotes q")).rows).toEqual(before.rows);
  expect((await contract(q)).agreementRequired).toBe(true);
});
it.each([30,31])("enregistre l'accord du client propre, marque préservée, cas %s",async(n)=>{
  const q=await create(n);await db.query("UPDATE marketplace_binder_quotes SET status='sent' WHERE id=$1",[q]);
  const c=await contract(q);expect(c.eligible).toBe(true);
  await expect(db.query("UPDATE marketplace_binder_quotes SET status='accepted' WHERE id=$1",[q])).rejects.toThrow("own_agreement_required");
  await db.query("SELECT marketplace_accept_own_quote($1,$2,$3,$4,$5)",[q,id(2),id(1),"Accord fictif de recette uniquement",c.revision]);
  const snapshot=(await db.query<{s:{circuit:string;agreement_version:string;platform_fee_cents:number;provenance:{recorded_case_id:string}}}>("SELECT payment_snapshot s FROM marketplace_binder_quotes WHERE id=$1",[q])).rows[0].s;
  expect(snapshot).toMatchObject({circuit:"own_client",agreement_version:"own-external-v1",platform_fee_cents:0});
  expect(snapshot.provenance.recorded_case_id).toBe(id(n-10));
  await expect(db.query("UPDATE marketplace_binder_quotes SET total_ttc_cents=1 WHERE id=$1",[q])).rejects.toThrow("accepted_payment_terms_immutable");
});
it("conserve le parcours du client saisi par l'atelier et refuse le circuit Oppe",async()=>{
  const q=await create(33);expect((await contract(q)).agreementRequired).toBe(true);
  await expect(create(32)).rejects.toThrow("workshop_document_forbidden_on_oppe_order");
});
it("refuse l'autre atelier et une fiche client provenant d'un autre dossier",async()=>{
  const q=await create(30);await expect(contract(q,id(8),id(9))).rejects.toThrow("quote_not_found");
  const mismatch={...input(30),client_id:id(31)};
  const wrong=(await db.query<{id:string}>("SELECT marketplace_binder_create_quote($1,$2::jsonb,'[]') id",[id(2),JSON.stringify(mismatch)])).rows[0].id;
  expect((await contract(wrong)).agreementRequired).toBe(false);
  await db.query("UPDATE marketplace_binder_quotes SET status='sent' WHERE id=$1",[wrong]);
  await expect(db.query("UPDATE marketplace_binder_quotes SET status='accepted' WHERE id=$1",[wrong])).rejects.toThrow("circuit_origin_mismatch");
});
