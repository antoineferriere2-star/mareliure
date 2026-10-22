import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { quoteRecipePrerequisites } from "@/marketplace/commercial/quoteRecipe.fixture";
import { isValidSiren, isValidSiret } from "./siren";

// Base de recette PGlite : la vraie chaîne des migrations de facturation, puis la phase 1.
vi.setConfig({ testTimeout: 30_000 });
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const migration = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}.sql`, import.meta.url), "utf8");
const SIREN = "732829320";
const SIRET = "73282932000009";
const CLIENT_SIREN = "552100554";
let db: PGlite;
let n = 100;
const today = () => db.query<{ d: string }>("SELECT to_char((now() AT TIME ZONE 'Europe/Paris')::date,'YYYY-MM-DD') d").then((r) => r.rows[0].d);
const issuer = (extra: Record<string, string> = {}) => JSON.stringify({ legalForm: "EI", siren: SIREN, siret: SIRET,
  addressLine1: "QA fictif", postalCode: "45000", city: "Orléans", ...extra });

/** Un devis envoyé et un brouillon de facture, insérés directement (les règles testées sont celles de l'émission). */
async function draft(options: { clientType?: string; country?: string; siren?: string | null; regime?: string; mention?: string | null;
  issuer?: string; due?: string; issueDate?: string } = {}) {
  const quote = id(n++); const invoice = id(n++);
  await db.query(`INSERT INTO marketplace_binder_quotes(id,binder_id,client_id,quote_number,status,issue_date,valid_until,client_name,
    currency,issuer,vat_regime,vat_mention,subtotal_cents,total_ht_cents,total_vat_cents,total_ttc_cents)
    VALUES($1,$2,$3,$4,'sent','2026-01-02',CURRENT_DATE + 30,'QA client','EUR',$5::jsonb,$6,$7,10000,10000,0,10000)`,
    [quote, id(2), id(3), `QA-D-${n}`, options.issuer ?? issuer(), options.regime ?? "FRANCHISE", options.mention ?? null]);
  const professional = options.clientType && options.clientType !== "individual";
  await db.query(`INSERT INTO marketplace_binder_invoices(id,binder_id,quote_id,client_id,status,issue_date,service_date,due_date,
    operation_nature,client_type,client_name,client_legal_name,client_billing_address_line1,client_billing_postal_code,client_billing_city,
    client_billing_country,client_siren,currency,issuer,vat_regime,vat_mention,payment_terms,early_payment_discount_terms,late_penalty_terms,
    subtotal_cents,total_ht_cents,total_vat_cents,total_ttc_cents)
    VALUES($1,$2,$3,$4,'draft',$5,'2026-01-02',$6,'services',$7,'QA client',$8,'1 rue QA','45000','Orléans',$9,$10,'EUR',$11::jsonb,$12,$13,
    $14,$15,$16,10000,10000,0,10000)`,
    [invoice, id(2), quote, id(3), options.issueDate ?? "2020-01-01", options.due ?? "2099-12-31", options.clientType ?? "individual",
      professional ? "QA SARL" : null, options.country ?? "FR", options.siren ?? null, options.issuer ?? issuer(),
      options.regime ?? "FRANCHISE", options.mention ?? null,
      professional ? "30 jours" : null, professional ? "Pas d'escompte" : null, professional ? "3 fois le taux légal" : null]);
  await db.query(`INSERT INTO marketplace_binder_invoice_items(invoice_id,binder_id,position,label,unit_price_cents,vat_rate_bps,total_ht_cents,line_key)
    VALUES($1,$2,0,'QA reliure',10000,0,10000,'qa-line')`, [invoice, id(2)]);
  return invoice;
}
const issue = (invoice: string) => db.query("SELECT marketplace_binder_issue_invoice($1,$2,'[]'::jsonb)", [id(2), invoice]);
const row = (invoice: string) => db.query<Record<string, string | null>>(
  "SELECT status,invoice_number,to_char(issue_date,'YYYY-MM-DD') issue_date,vat_mention,client_billing_country FROM marketplace_binder_invoices WHERE id=$1",
  [invoice]).then((r) => r.rows[0]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(quoteRecipePrerequisites);
  for (const file of ["20260919090000_marketplace_binder_quotes", "20260920100000_marketplace_binder_invoice_vat_mention",
    "20260921090000_marketplace_binder_contacts_works", "20260923100000_marketplace_quote_size_blocks_photos",
    "20260923110000_marketplace_document_branding", "20260923120000_marketplace_invoice_compliance",
    "20260928090000_marketplace_payment_circuits", "20260928110000_own_client_external_settlement",
    "20261006110000_workshop_partial_credit_notes", "20261006140000_workshop_credit_franchise"]) await db.exec(migration(file));
  // Données antérieures à la phase 1 (pays en toutes lettres), puis la migration.
  await db.exec(`INSERT INTO auth.users VALUES('${id(1)}'); INSERT INTO marketplace_binders VALUES('${id(2)}');
    INSERT INTO marketplace_binder_members VALUES('${id(2)}','${id(1)}','active');
    INSERT INTO marketplace_binder_clients(id,binder_id,name,billing_country) VALUES('${id(3)}','${id(2)}','QA client','France'),
      ('${id(4)}','${id(2)}','QA Belgique','Belgique'),('${id(5)}','${id(2)}','QA UK',' united  kingdom '),('${id(6)}','${id(2)}','QA inconnu','Bretagne');
    INSERT INTO marketplace_binder_services(id,binder_id,name) VALUES('${id(7)}','${id(2)}','Étui demi-cuir'),('${id(8)}','${id(2)}','Reliure plein cuir'),
      ('${id(9)}','${id(2)}','Chemiserie fictive');
    INSERT INTO marketplace_binder_billing_profiles(binder_id) VALUES('${id(2)}');`);
  await db.exec(migration("20261023100000_einvoicing_phase1"));
}, 60_000);
afterAll(async () => { await db?.close(); });

describe("SIREN et SIRET : même clé de Luhn dans l'application et en base", () => {
  it("valide et refuse les mêmes identifiants", async () => {
    const samples = [SIREN, CLIENT_SIREN, "732829321", "12345678", "1234567890", "35600000000048", SIRET, "73282932000008",
      "35600000049837", "35600000049838", "000000000"];
    for (const value of samples) {
      const { rows } = await db.query<{ siren: boolean; siret: boolean }>(
        "SELECT marketplace_siren_valid($1) siren, marketplace_siret_valid($1) siret", [value]);
      expect(rows[0].siren, value).toBe(isValidSiren(value));
      expect(rows[0].siret, value).toBe(isValidSiret(value));
    }
    expect(isValidSiren("732 829 320")).toBe(true);
    expect(isValidSiren("732829321")).toBe(false);
  });
});

describe("émission d'une facture d'atelier", () => {
  it("fixe la date d'émission au jour même, quelle que soit celle du brouillon, et normalise le pays", async () => {
    const invoice = await draft({ issueDate: "2020-01-01" });
    await issue(invoice);
    const issued = await row(invoice);
    expect(issued.status).toBe("issued");
    expect(issued.issue_date).toBe(await today());
    expect(issued.invoice_number).toBe(`F-${(await today()).slice(0, 4)}-0001`);
    expect(issued.client_billing_country).toBe("FR");
  });

  it("rend la date d'émission et le contenu non modifiables, même avec le rôle de service", async () => {
    const invoice = await draft();
    await issue(invoice);
    await db.exec("SET ROLE service_role");
    try {
      await expect(db.query("UPDATE marketplace_binder_invoices SET issue_date='2020-01-01' WHERE id=$1", [invoice])).rejects.toThrow(/immutable|permission denied/);
      await expect(db.query("DELETE FROM marketplace_binder_invoices WHERE id=$1", [invoice])).rejects.toThrow(/cannot be deleted|permission denied/);
      await expect(db.query("UPDATE marketplace_binder_invoice_items SET unit_price_cents=1 WHERE invoice_id=$1", [invoice])).rejects.toThrow(/immutable|permission denied/);
    } finally { await db.exec("RESET ROLE"); }
  });

  it("numérote sans trou : une émission refusée ne consomme aucun numéro", async () => {
    const year = (await today()).slice(0, 4);
    const refused = await draft({ due: "2000-01-01" });
    await expect(issue(refused)).rejects.toThrow("invoice_incomplete");
    const next = await draft();
    await issue(next);
    expect((await row(next)).invoice_number).toBe(`F-${year}-0003`);
    expect((await row(refused)).status).toBe("draft");
  });

  it("pose automatiquement la mention de franchise, exige le régime d'imposition en TVA", async () => {
    const franchise = await draft({ regime: "FRANCHISE", mention: null });
    await issue(franchise);
    expect((await row(franchise)).vat_mention).toBe("TVA non applicable, art. 293 B du CGI");
    const liable = await draft({ regime: "VAT_LIABLE", issuer: issuer({ vatNumber: "FR40732829320" }) });
    await expect(issue(liable)).rejects.toThrow("invoice_incomplete");
    const filed = await draft({ regime: "VAT_LIABLE", issuer: issuer({ vatNumber: "FR40732829320", vatFilingRegime: "reel_simplifie" }) });
    await issue(filed);
    expect((await row(filed)).status).toBe("issued");
  });

  it("exige un SIREN valide de l'émetteur, et un SIRET qui le prolonge", async () => {
    await expect(issue(await draft({ issuer: issuer({ siren: "732829321" }) }))).rejects.toThrow("invoice_incomplete");
    await expect(issue(await draft({ issuer: issuer({ siret: "55210055400005" }) }))).rejects.toThrow("invoice_incomplete");
    // Profils antérieurs : un identifiant saisi avec espaces reste lu comme ses chiffres.
    const spaced = await draft({ issuer: issuer({ siren: "732 829 320", siret: "732 829 320 00009" }) });
    await issue(spaced);
    expect((await row(spaced)).status).toBe("issued");
  });

  it("SIREN client : obligatoire pour un professionnel en France et le public, valide s'il est saisi", async () => {
    await expect(issue(await draft({ clientType: "business", country: "FR" }))).rejects.toThrow("invoice_incomplete");
    await expect(issue(await draft({ clientType: "public_entity", country: "FR" }))).rejects.toThrow("invoice_incomplete");
    await expect(issue(await draft({ clientType: "business", country: "FR", siren: "552100555" }))).rejects.toThrow("invoice_incomplete");
    const french = await draft({ clientType: "business", country: "FR", siren: CLIENT_SIREN });
    await issue(french);
    const belgian = await draft({ clientType: "business", country: "BE" });
    await issue(belgian);
    expect((await row(belgian)).status).toBe("issued");
    await expect(issue(await draft({ country: "Belgique" }))).rejects.toThrow("invoice_incomplete");
  });
});

describe("PDF émis : écrit une seule fois", () => {
  const sha = (c: string) => c.repeat(64);
  it("pose le PDF et son empreinte une fois, refuse toute réécriture et tout PDF de brouillon", async () => {
    const invoice = await draft();
    await expect(db.query("UPDATE marketplace_binder_invoices SET pdf_path='x.pdf',pdf_sha256=$2 WHERE id=$1", [invoice, sha("a")])).rejects.toThrow("draft invoices have no issued pdf");
    await issue(invoice);
    await db.query("UPDATE marketplace_binder_invoices SET pdf_path='x.pdf',pdf_sha256=$2 WHERE id=$1", [invoice, sha("a")]);
    await expect(db.query("UPDATE marketplace_binder_invoices SET pdf_sha256=$2 WHERE id=$1", [invoice, sha("b")])).rejects.toThrow("written once");
    await expect(db.query("UPDATE marketplace_binder_invoices SET pdf_path=NULL,pdf_sha256=NULL WHERE id=$1", [invoice])).rejects.toThrow("written once");
  });
});

describe("avoirs", () => {
  it("datés du jour même par la base ; PDF posé une fois ; ni modification ni suppression", async () => {
    const invoice = await draft();
    await issue(invoice);
    await expect(db.query("SELECT marketplace_binder_create_full_credit_note($1,$2,'2020-01-01','QA annulation')", [id(2), invoice]))
      .rejects.toThrow("credit_note_date_must_be_today");
    const { rows } = await db.query<{ c: string }>("SELECT marketplace_binder_create_full_credit_note($1,$2,$3,'QA annulation') c", [id(2), invoice, await today()]);
    const credit = rows[0].c;
    await db.query("UPDATE marketplace_binder_credit_notes SET pdf_path='a.pdf',pdf_sha256=$2 WHERE id=$1", [credit, "c".repeat(64)]);
    await expect(db.query("UPDATE marketplace_binder_credit_notes SET pdf_sha256=$2 WHERE id=$1", [credit, "d".repeat(64)])).rejects.toThrow("credit notes are immutable");
    await expect(db.query("UPDATE marketplace_binder_credit_notes SET reason='QA autre' WHERE id=$1", [credit])).rejects.toThrow("credit notes are immutable");
    await expect(db.query("DELETE FROM marketplace_binder_credit_notes WHERE id=$1", [credit])).rejects.toThrow("credit notes are immutable");
  });
});

describe("préfixe de numérotation : jamais changé en cours de série", () => {
  it("refuse un changement direct après une première pièce, applique le préfixe en attente à l'année d'effet", async () => {
    const year = Number((await today()).slice(0, 4));
    await expect(db.query("UPDATE marketplace_binder_billing_profiles SET invoice_prefix='FA' WHERE binder_id=$1", [id(2)])).rejects.toThrow("prefix_change_deferred");
    await db.query("UPDATE marketplace_binder_billing_profiles SET invoice_prefix_pending='FA',prefix_pending_from_year=$2 WHERE binder_id=$1", [id(2), year + 1]);
    const sameYear = await draft();
    await issue(sameYear);
    expect((await row(sameYear)).invoice_number).toMatch(/^F-/);
    await db.query("UPDATE marketplace_binder_billing_profiles SET prefix_pending_from_year=$2 WHERE binder_id=$1", [id(2), year]);
    const effective = await draft();
    await issue(effective);
    expect((await row(effective)).invoice_number).toMatch(new RegExp(`^FA-${year}-`));
    const profile = await db.query<{ invoice_prefix: string; invoice_prefix_pending: string | null }>(
      "SELECT invoice_prefix,invoice_prefix_pending FROM marketplace_binder_billing_profiles WHERE binder_id=$1", [id(2)]);
    expect(profile.rows[0]).toEqual({ invoice_prefix: "FA", invoice_prefix_pending: null });
  });
});

describe("encaissements : moyen de paiement structuré", () => {
  let invoice: string;
  const record = (n: number, kind: string, amount: number, method: string | null, reference: string | null = null, note: string | null = null) =>
    db.query("SELECT marketplace_record_external_settlement($1,$2,$3,$4,$5,$6,$7,$8,$9)", [id(n), invoice, id(2), id(1), kind, amount, method, reference, note]);
  beforeAll(async () => {
    // Vrai parcours « client de l'atelier » : accord écrit sur le devis, brouillon, émission.
    const quote = id(n++);
    await db.query(`INSERT INTO marketplace_binder_quotes(id,binder_id,client_id,quote_number,status,issue_date,valid_until,client_name,
      currency,issuer,vat_regime,vat_mention,subtotal_cents,total_ht_cents,total_vat_cents,total_ttc_cents)
      VALUES($1,$2,$3,'QA-D-OWN','sent',CURRENT_DATE,CURRENT_DATE + 30,'QA client','EUR',$4::jsonb,'FRANCHISE',NULL,10000,10000,0,10000)`,
      [quote, id(2), id(3), issuer()]);
    await db.query(`INSERT INTO marketplace_binder_quote_items(quote_id,binder_id,position,label,unit_price_cents,vat_rate_bps,total_ht_cents,line_key)
      VALUES($1,$2,0,'QA reliure',10000,0,10000,'qa-line')`, [quote, id(2)]);
    const revision = (await db.query<{ r: string }>("SELECT marketplace_own_contract($1,$2,$3)->>'revision' r", [quote, id(2), id(1)])).rows[0].r;
    await db.query("SELECT marketplace_accept_own_quote($1,$2,$3,$4,$5)", [quote, id(2), id(1), "Accord écrit du client QA", revision]);
    invoice = (await db.query<{ id: string }>("SELECT marketplace_binder_create_invoice_draft($1,$2,$3::jsonb) id", [id(2), quote, JSON.stringify({
      issue_date: "2026-01-02", service_date: "2026-01-02", due_date: "2099-12-31", operation_nature: "services", client_type: "individual",
      client_billing_address_line1: "1 rue QA", client_billing_postal_code: "45000", client_billing_city: "Orléans", client_billing_country: "FR",
      issuer: JSON.parse(issuer()) })])).rows[0].id;
    await issue(invoice);
  });
  it("enregistre le moyen et la référence ; refuse un moyen inconnu et une référence déjà enregistrée", async () => {
    await record(900, "receipt", 4000, "cheque", "Chèque n° 1234567", "Acompte remis à l'atelier");
    await expect(record(901, "receipt", 1000, "bitcoin")).rejects.toThrow("payment_method_invalid");
    await expect(record(902, "receipt", 1000, null)).rejects.toThrow("payment_method_invalid");
    await expect(record(903, "receipt", 1000, "cheque", "Chèque n° 1234567")).rejects.toThrow("reference_once");
    await record(904, "receipt", 3000, "especes");
    const rows = (await db.query<{ payment_method: string; payment_reference: string | null; evidence: string | null }>(
      "SELECT payment_method,payment_reference,evidence FROM marketplace_external_settlements WHERE invoice_id=$1 ORDER BY created_at", [invoice])).rows;
    expect(rows).toEqual([
      { payment_method: "cheque", payment_reference: "Chèque n° 1234567", evidence: "Acompte remis à l'atelier" },
      { payment_method: "especes", payment_reference: null, evidence: null },
    ]);
  });
  it("garde l'ancienne signature (moyen « autre », texte libre en note) pendant le déploiement", async () => {
    await db.query("SELECT marketplace_record_external_settlement($1,$2,$3,$4,'receipt',1000,'Virement reçu le 12')", [id(905), invoice, id(2), id(1)]);
    const last = (await db.query<{ payment_method: string; evidence: string }>("SELECT payment_method,evidence FROM marketplace_external_settlements WHERE id=$1", [id(905)])).rows[0];
    expect(last).toEqual({ payment_method: "autre", evidence: "Virement reçu le 12" });
  });
  it("un encaissement ne se modifie ni ne se supprime, même avec le rôle de service", async () => {
    await db.exec("SET ROLE service_role");
    try {
      await expect(db.query("UPDATE marketplace_external_settlements SET payment_method='carte' WHERE id=$1", [id(900)])).rejects.toThrow(/immutable|permission denied/);
      await expect(db.query("DELETE FROM marketplace_external_settlements WHERE id=$1", [id(900)])).rejects.toThrow(/immutable|permission denied/);
    } finally { await db.exec("RESET ROLE"); }
  });
  it("le client fictif a son pays normalisé en code ISO", async () => {
    expect((await db.query<{ c: string }>("SELECT billing_country c FROM marketplace_binder_clients WHERE id=$1", [id(3)])).rows[0].c).toBe("FR");
  });
});

describe("date d'émission à l'heure de Paris", () => {
  it("le 31 décembre à 23 h 30 UTC est le 1er janvier à Paris", async () => {
    const r = await db.query<{ d: string; s: string }>(
      "SELECT to_char(marketplace_paris_date('2026-12-31 23:30:00+00'),'YYYY-MM-DD') d, to_char(marketplace_paris_date('2026-07-31 21:30:00+00'),'YYYY-MM-DD') s");
    expect(r.rows[0]).toEqual({ d: "2027-01-01", s: "2026-07-31" });
  });
  it("une émission à cet instant est datée du 1er janvier et numérotée dans la série de la nouvelle année", async () => {
    const invoice = await draft({ due: "2099-12-31" });
    await db.query("SELECT marketplace_binder_issue_invoice_at($1,$2,'[]'::jsonb,'2026-12-31 23:30:00+00')", [id(2), invoice]);
    const issued = await row(invoice);
    expect(issued.issue_date).toBe("2027-01-01");
    expect(issued.invoice_number).toMatch(/-2027-0001$/);
  });
  it("la fonction à instant explicite n'est pas ouverte au rôle de service", async () => {
    await db.exec("SET ROLE service_role");
    try {
      await expect(db.query("SELECT marketplace_binder_issue_invoice_at($1,$2,'[]'::jsonb,now())", [id(2), id(1)])).rejects.toThrow(/permission denied/);
    } finally { await db.exec("RESET ROLE"); }
  });
});

describe("régime « exonéré » retiré", () => {
  it("un profil ne peut plus le choisir, une facture qui le porte n'est pas émise", async () => {
    await expect(db.query("UPDATE marketplace_binder_billing_profiles SET vat_regime='EXEMPT' WHERE binder_id=$1", [id(2)])).rejects.toThrow(/no_exempt/);
    await expect(issue(await draft({ regime: "EXEMPT", mention: "Exonération, art. 261 du CGI" }))).rejects.toThrow("invoice_incomplete");
  });
});

describe("pays : correspondance exacte des noms courants", () => {
  it("convertit les noms exacts, laisse une valeur inconnue telle quelle", async () => {
    const rows = (await db.query<{ id: string; c: string }>("SELECT id, billing_country c FROM marketplace_binder_clients WHERE id = ANY($1) ORDER BY id",
      [[id(4), id(5), id(6)]])).rows.map((r) => r.c);
    expect(rows).toEqual(["BE", "GB", "Bretagne"]);
  });
});

describe("nature des prestations et des lignes", () => {
  it("étui, boîte, coffret, chemise deviennent des biens ; le reste reste service", async () => {
    const rows = (await db.query<{ n: string }>("SELECT operation_nature n FROM marketplace_binder_services WHERE id = ANY($1) ORDER BY id",
      [[id(7), id(8), id(9)]])).rows.map((r) => r.n);
    expect(rows).toEqual(["bien", "service", "service"]);
  });
  it("une ligne insérée sans nature (ancien Worker) est un service ; le brouillon recopie la nature du devis", async () => {
    const quote = id(n++);
    await db.query(`INSERT INTO marketplace_binder_quotes(id,binder_id,client_id,quote_number,status,issue_date,valid_until,client_name,
      currency,issuer,vat_regime,subtotal_cents,total_ht_cents,total_vat_cents,total_ttc_cents)
      VALUES($1,$2,$3,'QA-D-NAT','sent',CURRENT_DATE,CURRENT_DATE + 30,'QA client','EUR',$4::jsonb,'FRANCHISE',20000,20000,0,20000)`,
      [quote, id(2), id(3), issuer()]);
    await db.query(`INSERT INTO marketplace_binder_quote_items(quote_id,binder_id,position,label,unit_price_cents,vat_rate_bps,total_ht_cents,line_key,operation_nature)
      VALUES($1,$2,0,'Étui',10000,0,10000,'l-etui','bien'),($1,$2,1,'Reliure',10000,0,10000,'l-rel',NULL)`, [quote, id(2)]);
    const revision = (await db.query<{ r: string }>("SELECT marketplace_own_contract($1,$2,$3)->>'revision' r", [quote, id(2), id(1)])).rows[0].r;
    await db.query("SELECT marketplace_accept_own_quote($1,$2,$3,$4,$5)", [quote, id(2), id(1), "Accord écrit du client QA", revision]);
    const invoice = (await db.query<{ id: string }>("SELECT marketplace_binder_create_invoice_draft($1,$2,$3::jsonb) id",
      [id(2), quote, JSON.stringify({ issue_date: "2026-01-02", operation_nature: "mixed", issuer: JSON.parse(issuer()) })])).rows[0].id;
    const natures = (await db.query<{ k: string; n: string }>("SELECT line_key k, operation_nature n FROM marketplace_binder_invoice_items WHERE invoice_id=$1 ORDER BY position", [invoice])).rows;
    expect(natures).toEqual([{ k: "l-etui", n: "bien" }, { k: "l-rel", n: "service" }]);
  });
});

describe("retour arrière (docs/einvoicing/phase1-rollback.sql)", () => {
  beforeAll(async () => {
    await db.exec(readFileSync(new URL("../../../docs/einvoicing/phase1-rollback.sql", import.meta.url), "utf8"));
  });
  it("rétablit l'émission d'origine sans perdre aucune donnée de la phase 1", async () => {
    // L'émission d'origine exige la mention de franchise saisie et garde la date du brouillon.
    const invoice = await draft({ issueDate: "2026-01-05", mention: "TVA non applicable, art. 293 B du CGI" });
    await issue(invoice);
    expect((await row(invoice)).issue_date).toBe("2026-01-05");
    const kept = (await db.query<{ payment_method: string; payment_reference: string | null; evidence: string }>(
      "SELECT payment_method,payment_reference,evidence FROM marketplace_external_settlements WHERE id=$1", [id(900)])).rows[0];
    expect(kept).toEqual({ payment_method: "cheque", payment_reference: "Chèque n° 1234567", evidence: "Acompte remis à l'atelier" });
  });
  it("redonne un justificatif aux écritures sans note et rétablit l'ancienne fonction d'encaissement", async () => {
    expect((await db.query<{ evidence: string }>("SELECT evidence FROM marketplace_external_settlements WHERE id=$1", [id(904)])).rows[0].evidence)
      .toBe("Mode : especes");
    await expect(db.query("SELECT marketplace_record_external_settlement($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [id(906), id(2), id(2), id(1), "receipt", 1, "cheque", null, null])).rejects.toThrow(/does not exist/);
    await expect(db.query("INSERT INTO marketplace_external_settlements(id,invoice_id,actor_id,kind,amount_cents,currency) VALUES($1,$2,$3,'dispute_open',0,'EUR')",
      [id(907), id(2), id(1)])).rejects.toThrow(/null value|not-null/);
  });
  it("retire la fonction à instant explicite et la contrainte « exonéré » ; garde nature et pays convertis", async () => {
    await expect(db.query("SELECT marketplace_binder_issue_invoice_at($1,$2,'[]'::jsonb,now())", [id(2), id(1)])).rejects.toThrow(/does not exist/);
    const regime = (await db.query<{ v: string }>("SELECT vat_regime v FROM marketplace_binder_billing_profiles WHERE binder_id=$1", [id(2)])).rows[0].v;
    await db.query("UPDATE marketplace_binder_billing_profiles SET vat_regime='EXEMPT' WHERE binder_id=$1", [id(2)]);
    await db.query("UPDATE marketplace_binder_billing_profiles SET vat_regime=$2 WHERE binder_id=$1", [id(2), regime]);
    expect((await db.query<{ n: string }>("SELECT operation_nature n FROM marketplace_binder_services WHERE id=$1", [id(7)])).rows[0].n).toBe("bien");
    expect((await db.query<{ c: string }>("SELECT billing_country c FROM marketplace_binder_clients WHERE id=$1", [id(4)])).rows[0].c).toBe("BE");
  });
  it("les avoirs redeviennent entièrement figés, PDF compris", async () => {
    await expect(db.query("UPDATE marketplace_binder_credit_notes SET pdf_path='y.pdf',pdf_sha256=$1", ["c".repeat(64)]))
      .rejects.toThrow("credit notes are immutable");
  });
});
