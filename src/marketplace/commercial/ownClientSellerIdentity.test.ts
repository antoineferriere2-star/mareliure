import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { quoteRecipePrerequisites } from "./quoteRecipe.fixture";

// Audit #53 (1er octobre 2026), C1/C2, sur les VRAIES migrations : une base « publiée » (#53 seul)
// reproduit les défauts, une base corrigée (#53 + 20261001150000 appliquée sur des données
// existantes) prouve la correction. Aucun appel réseau.
const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const chain = ["20260919090000_marketplace_binder_quotes", "20260920100000_marketplace_binder_invoice_vat_mention",
  "20260921090000_marketplace_binder_contacts_works", "20260923100000_marketplace_quote_size_blocks_photos",
  "20260923110000_marketplace_document_branding", "20260923120000_marketplace_invoice_compliance",
  "20260928090000_marketplace_payment_circuits", "20260928110000_own_client_external_settlement",
  "20260928130000_work_logistics_manual"];
const migration = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}.sql`, import.meta.url), "utf8");
const FIX = "20261001150000_own_client_seller_identity_contract_epoch";

type Issuer = Record<string, string | null>;
const seller = (extra: Issuer = {}): Issuer => ({ workshopName: "Atelier QA", legalName: "Atelier QA", legalForm: "EI",
  addressLine1: "1 rue QA", postalCode: "75001", city: "Paris", country: "FR", siret: "12345678900012", ...extra });

class Bench {
  db = new PGlite();
  async setup() {
    await this.db.exec(quoteRecipePrerequisites);
    for (const name of chain) await this.db.exec(migration(name));
    // La transaction de publication #53 a eu lieu il y a une heure.
    await this.db.exec(`UPDATE storage.buckets SET created_at=now()-interval '1 hour' WHERE id='work-logistics-private';
      INSERT INTO auth.users VALUES('${id(1)}'),('${id(901)}');
      INSERT INTO marketplace_binders VALUES('${id(2)}'),('${id(902)}');
      INSERT INTO marketplace_binder_members VALUES('${id(2)}','${id(1)}','active'),('${id(902)}','${id(901)}','active');
      INSERT INTO marketplace_binder_clients(id,binder_id,name) VALUES('${id(3)}','${id(2)}','QA client fictif');
      INSERT INTO marketplace_binder_billing_profiles(binder_id,workshop_name,legal_name,country,siret,legal_form,address_line1,postal_code,city,vat_regime,vat_mention)
        VALUES('${id(2)}','Atelier QA','Atelier QA','FR','123 456 789 00012','EI','1 rue QA','75001','Paris','FRANCHISE','TVA non applicable, art. 293 B du CGI');`);
  }
  async quote(n: number, opts: { issuer?: Issuer; status?: string; deposit?: number; created?: string; epoch?: string } = {}) {
    await this.db.query(`INSERT INTO marketplace_binder_quotes(id,binder_id,client_id,quote_number,status,issue_date,valid_until,client_name,
      currency,issuer,vat_regime,vat_mention,subtotal_cents,total_ht_cents,total_vat_cents,total_ttc_cents,deposit_cents,created_at${opts.epoch ? ",contract_epoch" : ""})
      VALUES($1,$2,$3,$4,$5,'2026-09-28','2099-01-01','QA','EUR',$6,'FRANCHISE','QA',10000,10000,0,10000,$7,${opts.created ?? "now()"}${opts.epoch ? `,'${opts.epoch}'` : ""})`,
      [id(n), id(2), id(3), `QA-${n}`, opts.status ?? "sent", JSON.stringify(opts.issuer ?? seller()), opts.deposit ?? 0]);
    await this.db.query(`INSERT INTO marketplace_binder_quote_items(quote_id,binder_id,position,line_key,label,quantity,unit_price_cents,vat_rate_bps,total_ht_cents)
      VALUES($1,$2,1,'l1','Reliure QA',1,10000,0,10000)`, [id(n), id(2)]);
  }
  async contract(n: number) {
    return (await this.db.query<{ c: { eligible: boolean; revision: string; blocker: string | null; agreementRequired: boolean } }>(
      "SELECT marketplace_own_contract($1,$2,$3) c", [id(n), id(2), id(1)])).rows[0].c;
  }
  async accept(n: number) {
    return this.db.query("SELECT marketplace_accept_own_quote($1,$2,$3,$4,$5)", [id(n), id(2), id(1), "Accord e-mail QA 2026", (await this.contract(n)).revision]);
  }
  async issue(n: number, invoiceSeller: Issuer) {
    const draft = await this.db.query<{ v: string }>("SELECT marketplace_binder_create_invoice_draft($1,$2,$3) v", [id(2), id(n),
      JSON.stringify({ issue_date: "2026-10-01", due_date: "2026-10-31", operation_nature: "services", issuer: {} })]);
    const invoice = draft.rows[0].v;
    await this.db.query("SELECT marketplace_binder_update_invoice_draft($1,$2,$3)", [id(2), invoice, JSON.stringify({
      issue_date: "2026-10-01", service_date: "2026-10-01", due_date: "2026-10-31", operation_nature: "services", client_type: "individual",
      client_name: "QA", client_billing_address_line1: "1 rue QA", client_billing_postal_code: "75001", client_billing_city: "Paris",
      client_billing_country: "FR", issuer: invoiceSeller, vat_mention: "TVA non applicable, art. 293 B du CGI" })]);
    await this.db.query("SELECT marketplace_binder_issue_invoice($1,$2,'[]'::jsonb)", [id(2), invoice]);
    return invoice;
  }
  async attest(n: number, actor = id(1), text = "Même atelier, identifiant ajouté au profil") {
    return this.db.query("SELECT marketplace_complete_own_agreement_identity($1,$2,$3,$4)", [id(n), id(2), actor, text]);
  }
  async identityState(n: number) {
    return (await this.db.query<{ s: { state: string } }>("SELECT marketplace_own_agreement_identity($1,$2,$3) s", [id(n), id(2), id(1)])).rows[0].s.state;
  }
}

const invoiceSeller = (siret: string) => seller({ siret, siren: siret.replace(/[^0-9]/g, "").slice(0, 9) });
const published = new Bench(), fixed = new Bench();
beforeAll(async () => {
  for (const bench of [published, fixed]) {
    await bench.setup();
    // Données existantes au moment du correctif.
    await bench.quote(10, { issuer: seller({ siret: null }) }); await bench.accept(10);
    await bench.quote(11); await bench.accept(11);
    await bench.quote(12, { issuer: seller({ siret: "98765432100019" }) }); await bench.accept(12);
    await bench.quote(13, { issuer: seller({ siret: "12345678900099" }) }); await bench.accept(13);
    await bench.quote(14, { issuer: seller({ siret: null, legalName: "Ancienne Société" }) }); await bench.accept(14);
    // Accord sans identifiant ni raison sociale, sous un autre nom d'atelier que le profil actuel.
    await bench.quote(15, { issuer: seller({ siret: null, legalName: null, workshopName: "Atelier Ancien" }) }); await bench.accept(15);
    await bench.quote(20, { status: "draft", created: "now()-interval '2 days'" });
    await bench.quote(21, { status: "draft" });
    await bench.quote(22, { status: "expired" });
    await bench.quote(23, { status: "sent", deposit: 3000 });
    await bench.quote(24, { status: "draft", deposit: 3000, created: "now()-interval '2 days'" });
  }
  await fixed.db.exec(migration(FIX));
}, 60000);
afterAll(async () => { await published.db.close(); await fixed.db.close(); });

describe("création de devis après ajout de l'époque contractuelle", () => {
  const input = { issue_date:"2026-10-06",valid_until:"2026-11-06",client_name:"Client fictif",client_id:id(3),
    currency:"EUR",issuer:seller(),vat_regime:"FRANCHISE",subtotal_cents:10000,total_ht_cents:10000,total_vat_cents:0,total_ttc_cents:10000,
    discount_type:"NONE",discount_value:0,discount_cents:0,vat_breakdown:[],deposit_type:"NONE",deposit_value:0,deposit_cents:0,
    payment_snapshot:{circuit:"own_client"} };
  const line = { line_key:"test",label:"Reliure fictive",quantity:1,unit_price_cents:10000,vat_rate_bps:0,total_ht_cents:10000,
    block_key:"format-principal",block_label:"Format principal",block_book_count:1 };
  const create = (extra: object = {}, items: unknown[] = [line]) => fixed.db.query<{id:string}>(
    "SELECT marketplace_binder_create_quote($1,$2::jsonb,$3::jsonb) id",[id(2),JSON.stringify({...input,...extra}),JSON.stringify(items)]);
  it("reproduit le refus du RPC publié et corrige sans réécrire l'historique", async () => {
    await expect(create()).rejects.toThrow("contract_epoch_immutable");
    const before = await fixed.db.query("SELECT md5(jsonb_agg(to_jsonb(q) ORDER BY id)::text) hash FROM marketplace_binder_quotes q");
    await fixed.db.exec(migration("20261007160000_workshop_quote_contract_epoch"));
    expect((await fixed.db.query("SELECT md5(jsonb_agg(to_jsonb(q) ORDER BY id)::text) hash FROM marketplace_binder_quotes q")).rows).toEqual(before.rows);
  });
  it("fixe l'époque côté base même pour un ancien Worker ou une époque falsifiée", async () => {
    for (const extra of [{},{contract_epoch:"pre_external_v1"}]) {
      const quote = (await create(extra)).rows[0].id;
      expect((await fixed.db.query<{epoch:string}>("SELECT contract_epoch epoch FROM marketplace_binder_quotes WHERE id=$1",[quote])).rows[0].epoch).toBe("external_v1");
      await expect(fixed.db.query("UPDATE marketplace_binder_quotes SET status='accepted' WHERE id=$1",[quote])).rejects.toThrow("own_agreement_required");
    }
  });
  it("conserve l'atomicité et la numérotation lorsque les lignes sont invalides", async () => {
    const before = await fixed.db.query("SELECT count(*) n FROM marketplace_binder_quotes");
    const counters = await fixed.db.query("SELECT * FROM marketplace_binder_document_counters ORDER BY binder_id,kind,year");
    await expect(create({},[{...line,quantity:0}])).rejects.toThrow();
    expect((await fixed.db.query("SELECT count(*) n FROM marketplace_binder_quotes")).rows).toEqual(before.rows);
    expect((await fixed.db.query("SELECT * FROM marketplace_binder_document_counters ORDER BY binder_id,kind,year")).rows).toEqual(counters.rows);
  });
});

describe("C1 — identité vendeur figée à l'accord", () => {
  it("reproduit l'impasse sur la version publiée", async () => {
    await expect(published.issue(10, invoiceSeller("123 456 789 00012"))).rejects.toThrow("invoice_seller_changed_new_agreement_required");
    await expect(published.issue(11, invoiceSeller("123 456 789 00012"))).rejects.toThrow("invoice_seller_changed_new_agreement_required");
    await expect(published.db.query(`UPDATE marketplace_binder_quotes SET status='refused' WHERE id='${id(10)}'`)).rejects.toThrow("accepted_payment_terms_immutable");
  });
  it("refuse un nouvel accord sans identifiant et explique pourquoi", async () => {
    await fixed.quote(30, { issuer: seller({ siret: null }) });
    expect(await fixed.contract(30)).toMatchObject({ eligible: false, agreementRequired: true, blocker: "seller_identity_missing" });
    await expect(fixed.accept(30)).rejects.toThrow("external_contract_unavailable");
    await expect(fixed.db.query(`UPDATE marketplace_binder_quotes SET status='accepted' WHERE id='${id(30)}'`)).rejects.toThrow("own_agreement_required");
  });
  it("normalise l'identifiant et accepte un nouvel établissement du même SIREN", async () => {
    await expect(fixed.issue(11, invoiceSeller("123 456 789 00012"))).resolves.toBeTruthy();
    await expect(fixed.issue(13, invoiceSeller("123.456.789-00012"))).resolves.toBeTruthy();
  });
  it("refuse toujours un autre vendeur", async () => {
    await expect(fixed.issue(12, invoiceSeller("123 456 789 00012"))).rejects.toThrow("invoice_seller_changed_new_agreement_required");
    expect(await fixed.identityState(12)).toBe("seller_changed");
  });
  it("résout un accord incomplet par une attestation explicite, sans toucher à l'accord", async () => {
    await expect(fixed.issue(10, invoiceSeller("123 456 789 00012"))).rejects.toThrow("seller_identity_completion_required");
    expect(await fixed.identityState(10)).toBe("attestation_required");
    await expect(fixed.attest(10, id(901))).rejects.toThrow("active_membership_required");
    await expect(fixed.attest(10, id(1), "court")).rejects.toThrow();
    const before = (await fixed.db.query(`SELECT terms FROM marketplace_own_client_agreements WHERE quote_id='${id(10)}'`)).rows;
    await fixed.attest(10);
    await fixed.attest(10); // reprise idempotente
    await expect(fixed.attest(10, id(1), "Autre texte d'attestation")).rejects.toThrow("identity_completion_already_recorded");
    expect((await fixed.db.query(`SELECT terms FROM marketplace_own_client_agreements WHERE quote_id='${id(10)}'`)).rows).toEqual(before);
    await expect(fixed.db.query(`UPDATE marketplace_own_agreement_identity_completions SET attestation='modifiée QA' WHERE quote_id='${id(10)}'`)).rejects.toThrow("settlement_history_immutable");
    expect(await fixed.identityState(10)).toBe("completed_by_attestation");
    const invoice = (await fixed.db.query<{ id: string }>(`SELECT id FROM marketplace_binder_invoices WHERE quote_id='${id(10)}'`)).rows[0].id;
    await fixed.db.query("SELECT marketplace_binder_issue_invoice($1,$2,'[]'::jsonb)", [id(2), invoice]);
    expect((await fixed.db.query(`SELECT status FROM marketplace_binder_invoices WHERE id='${invoice}'`)).rows).toEqual([{ status: "issued" }]);
  });
  it("n'atteste pas un vendeur dont la raison sociale diffère", async () => {
    expect(await fixed.identityState(14)).toBe("seller_changed");
    await expect(fixed.attest(14)).rejects.toThrow("identity_completion_not_applicable:seller_changed");
  });
  it("n'atteste jamais un accord dont l'entité est déjà connue", async () => {
    await expect(fixed.attest(12)).rejects.toThrow("identity_completion_not_applicable:seller_changed");
    await expect(fixed.attest(11)).rejects.toThrow("identity_completion_not_applicable:complete");
  });
  it("n'atteste pas un accord sans raison sociale dont le nom d'atelier diffère", async () => {
    expect(await fixed.identityState(15)).toBe("seller_changed");
    await expect(fixed.attest(15)).rejects.toThrow("identity_completion_not_applicable:seller_changed");
  });
  it("après attestation, refuse une facture émise sous une autre entité", async () => {
    await fixed.quote(16, { issuer: seller({ siret: null }), status: "sent", created: "now()-interval '2 days'" });
    // Accord historique (antérieur au correctif) : créé sur la base publiée puis rejoué ici avant attestation.
    await fixed.db.query(`INSERT INTO marketplace_own_client_agreements(quote_id,binder_id,actor_id,evidence,terms)
      VALUES($1,$2,$3,'Accord e-mail QA 2026',$4)`, [id(16), id(2), id(1), JSON.stringify({ version: "own-external-v1", seller: seller({ siret: null }), currency: "EUR", total_ttc_cents: 10000 })]);
    await fixed.db.query(`UPDATE marketplace_binder_quotes SET status='accepted' WHERE id='${id(16)}'`);
    await fixed.attest(16);
    await expect(fixed.issue(16, invoiceSeller("987 654 321 00019"))).rejects.toThrow("invoice_seller_changed_new_agreement_required");
  });
  it("n'impose pas un SIRET français à un atelier établi hors de France", async () => {
    const entity = async (issuer: Issuer) => (await fixed.db.query<{ e: string | null }>("SELECT marketplace_seller_entity($1::jsonb) e", [JSON.stringify(issuer)])).rows[0].e;
    expect(await entity({ country: "United Kingdom", siren: "Company 0123 4567" })).toBe("UNITEDKINGDOM:COMPANY01234567");
    expect(await entity({ country: "Italia", siret: "IT 01234567890" })).toBe("ITALIA:IT01234567890");
    expect(await entity({ country: "FR", siret: "123 456 789 00012" })).toBe("FR:123456789");
    expect(await entity({ country: "FR", siret: "123" })).toBeNull();
    await fixed.quote(40, { issuer: seller({ country: "Italia", siret: null, siren: "IT 01234567890" }) });
    expect((await fixed.contract(40)).eligible).toBe(true);
  });
  it("garde les devis acceptés non refusables", async () => {
    await expect(fixed.db.query(`UPDATE marketplace_binder_quotes SET status='refused' WHERE id='${id(12)}'`)).rejects.toThrow("accepted_payment_terms_immutable");
  });
});

describe("C2 — devis postérieurs à la publication", () => {
  it("reproduit le contournement sur la version publiée", async () => {
    await published.db.query(`UPDATE marketplace_binder_quotes SET status='accepted' WHERE id='${id(21)}'`);
    await published.db.query(`UPDATE marketplace_binder_quotes SET status='accepted' WHERE id='${id(22)}'`);
    const rows = (await published.db.query<{ v: string | null }>(`SELECT payment_snapshot->>'agreement_version' v FROM marketplace_binder_quotes WHERE id IN ('${id(21)}','${id(22)}')`)).rows;
    expect(rows).toEqual([{ v: null }, { v: null }]);
  });
  it("classe les devis selon la transaction de publication, sans toucher aux devis acceptés", async () => {
    const rows = (await fixed.db.query<{ quote_number: string; contract_epoch: string }>(
      "SELECT quote_number, contract_epoch FROM marketplace_binder_quotes WHERE quote_number IN ('QA-10','QA-20','QA-21','QA-22','QA-23','QA-24') ORDER BY 1")).rows;
    expect(rows.map((row) => `${row.quote_number}:${row.contract_epoch}`)).toEqual([
      "QA-10:pre_external_v1", "QA-20:pre_external_v1", "QA-21:external_v1", "QA-22:external_v1", "QA-23:external_v1", "QA-24:pre_external_v1"]);
  });
  it("ferme brouillon → accepté et expiré → accepté sans accord", async () => {
    expect(await fixed.contract(21)).toMatchObject({ agreementRequired: true, blocker: "send_first", eligible: false });
    await expect(fixed.db.query(`UPDATE marketplace_binder_quotes SET status='accepted' WHERE id='${id(21)}'`)).rejects.toThrow("own_agreement_required");
    await expect(fixed.db.query(`UPDATE marketplace_binder_quotes SET status='accepted' WHERE id='${id(22)}'`)).rejects.toThrow("own_agreement_required");
    await fixed.db.query(`UPDATE marketplace_binder_quotes SET status='sent' WHERE id='${id(21)}'`);
    await fixed.accept(21);
  });
  it("préserve les acceptations historiques et celles avec acompte, sans accord fabriqué", async () => {
    await fixed.db.query(`UPDATE marketplace_binder_quotes SET status='accepted' WHERE id IN ('${id(20)}','${id(23)}','${id(24)}')`);
    expect((await fixed.db.query(`SELECT count(*)::int n FROM marketplace_own_client_agreements WHERE quote_id IN ('${id(20)}','${id(23)}','${id(24)}')`)).rows).toEqual([{ n: 0 }]);
    const reason = async (n: number) => {
      const invoice = await fixed.issue(n, invoiceSeller("12345678900012"));
      return (await fixed.db.query<{ s: { eligible: boolean; reason: string } }>("SELECT marketplace_external_settlement_state($1,$2,$3) s", [invoice, id(2), id(1)])).rows[0].s;
    };
    expect(await reason(20)).toMatchObject({ eligible: false, reason: "accepted_without_agreement" });
    expect(await reason(23)).toMatchObject({ eligible: false, reason: "deposit" });
  });
  it("interdit de réécrire l'époque contractuelle", async () => {
    await expect(fixed.db.query(`UPDATE marketplace_binder_quotes SET contract_epoch='pre_external_v1' WHERE id='${id(22)}'`)).rejects.toThrow("contract_epoch_immutable");
  });
  it("refuse de créer un nouveau devis en le déclarant historique", async () => {
    await expect(fixed.quote(26, { status: "draft" , epoch: "pre_external_v1" })).rejects.toThrow("contract_epoch_immutable");
  });
  it("classe tout nouveau devis dans le circuit externe", async () => {
    await fixed.quote(25, { status: "draft" });
    expect((await fixed.db.query(`SELECT contract_epoch FROM marketplace_binder_quotes WHERE id='${id(25)}'`)).rows).toEqual([{ contract_epoch: "external_v1" }]);
  });
  it("garde les nouvelles fonctions hors de portée des rôles du navigateur", async () => {
    for (const fn of ["marketplace_complete_own_agreement_identity(uuid,uuid,uuid,text)", "marketplace_own_agreement_identity(uuid,uuid,uuid)", "marketplace_seller_entity(jsonb)"]) {
      const rows = (await fixed.db.query<{ a: boolean; u: boolean; s: boolean }>(
        `SELECT has_function_privilege('anon','public.${fn}','EXECUTE') a, has_function_privilege('authenticated','public.${fn}','EXECUTE') u, has_function_privilege('service_role','public.${fn}','EXECUTE') s`)).rows[0];
      expect(rows).toEqual({ a: false, u: false, s: true });
    }
    const table = (await fixed.db.query<{ a: boolean }>("SELECT has_table_privilege('authenticated','public.marketplace_own_agreement_identity_completions','SELECT') a")).rows[0];
    expect(table.a).toBe(false);
  });
});
