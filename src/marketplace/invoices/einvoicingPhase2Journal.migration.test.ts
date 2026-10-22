import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { quoteRecipePrerequisites } from "@/marketplace/commercial/quoteRecipe.fixture";
import { verifyJournalChain, type JournalEntryText } from "@/marketplace/ledger/journalChain";

// Base de recette PGlite : la vraie chaîne des migrations de facturation des ateliers, les tables OPPE
// telles que leurs migrations les créent, puis les étapes 1 et 2.
vi.setConfig({ testTimeout: 30_000 });
const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const migration = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}.sql`, import.meta.url), "utf8");
const SIREN = "732829320";
const SIRET = "73282932000009";
const BINDER = id(2);
const ISSUER = `binder:${BINDER}`;
let db: PGlite;
let n = 100;

/** Extrait d'une migration le bloc qui commence par `start` et finit au premier `end` qui suit. */
function block(file: string, start: string, end = "\n);") {
  const sql = migration(file);
  const i = sql.indexOf(start);
  if (i < 0) throw new Error(`${file}: ${start}`);
  return sql.slice(i, sql.indexOf(end, i) + end.length);
}

async function asService<T>(work: () => Promise<T>): Promise<T> {
  await db.exec("SET ROLE service_role");
  try { return await work(); } finally { await db.exec("RESET ROLE"); }
}
const service = <R>(sql: string, params: unknown[] = []) => asService(() => db.query<R>(sql, params));
/** Horloge d'émission figée (le propriétaire seul peut la remplacer). */
const setClock = (at: string | null) => db.exec(`CREATE OR REPLACE FUNCTION public.marketplace_issue_clock() RETURNS timestamptz
  LANGUAGE sql STABLE SET search_path = public AS $$ SELECT ${at ? `'${at}'::timestamptz` : "now()"} $$`);
const issuer = () => JSON.stringify({ legalForm: "EI", siren: SIREN, siret: SIRET, addressLine1: "QA fictif", postalCode: "45000",
  city: "Orléans", vatNumber: "FR40732829320", vatFilingRegime: "reel_normal" });
const journal = (issuerKey = ISSUER) => db.query<{ seq: number; event: string; document_kind: string | null; document_id: string | null;
  payload: Record<string, unknown>; canonical: string; prev_hash: string; hash: string }>(
  "SELECT seq, event, document_kind, document_id, payload, canonical, prev_hash, hash FROM marketplace_issuer_journal WHERE issuer_key=$1 ORDER BY seq",
  [issuerKey]).then((r) => r.rows);
const verify = (issuerKey = ISSUER) => service<{ v: { ok: boolean; entries: number; problems: { problem: string; seq?: number }[] } }>(
  "SELECT marketplace_journal_verify($1) v", [issuerKey]).then((r) => r.rows[0].v);

/** Brouillon de facture assujettie à la TVA : une ligne par taux (en centimes HT). */
async function draft(lines: [number, number][], date = "2026-03-10") {
  const quote = id(n++); const invoice = id(n++);
  const ht = lines.reduce((s, [c]) => s + c, 0);
  const vat = lines.reduce((s, [c, r]) => s + Math.round((c * r) / 10_000), 0);
  const breakdown = JSON.stringify(lines.map(([c, r]) => ({ vatRateBps: r, baseHtCents: c, vatCents: Math.round((c * r) / 10_000) })));
  await db.query(`INSERT INTO marketplace_binder_quotes(id,binder_id,client_id,quote_number,status,issue_date,valid_until,client_name,
    currency,issuer,vat_regime,subtotal_cents,total_ht_cents,total_vat_cents,total_ttc_cents)
    VALUES($1,$2,$3,$4,'sent',$5::date,$5::date + 30,'QA client','EUR',$6::jsonb,'VAT_LIABLE',$7,$7,$8,$9)`,
    [quote, BINDER, id(3), `QA-D-${n}`, date, issuer(), ht, vat, ht + vat]);
  await db.query(`INSERT INTO marketplace_binder_invoices(id,binder_id,quote_id,client_id,status,issue_date,service_date,due_date,
    operation_nature,client_type,client_name,client_billing_address_line1,client_billing_postal_code,client_billing_city,
    client_billing_country,currency,issuer,vat_regime,subtotal_cents,total_ht_cents,total_vat_cents,total_ttc_cents,vat_breakdown)
    VALUES($1,$2,$3,$4,'draft',$5::date,$5::date,'2099-12-31','services','individual','QA client','1 rue QA','45000','Orléans','FR','EUR',
    $6::jsonb,'VAT_LIABLE',$7,$7,$8,$9,$10::jsonb)`, [invoice, BINDER, quote, id(3), date, issuer(), ht, vat, ht + vat, breakdown]);
  for (const [i, [c, r]] of lines.entries()) {
    await db.query(`INSERT INTO marketplace_binder_invoice_items(invoice_id,binder_id,position,label,unit_price_cents,vat_rate_bps,total_ht_cents,line_key)
      VALUES($1,$2,$3,'QA reliure',$4,$5,$4,$6)`, [invoice, BINDER, i, c, r, `qa-${i}`]);
  }
  return invoice;
}
/** Ce que seul un accès d'administration de la base peut faire : suspendre les déclencheurs. */
async function bypassingTriggers<T>(work: () => Promise<T>): Promise<T> {
  await db.exec("SET session_replication_role = replica");
  try { return await work(); } finally { await db.exec("SET session_replication_role = origin"); }
}
const issue = (invoice: string) => service("SELECT marketplace_binder_issue_invoice($1,$2,'[]'::jsonb)", [BINDER, invoice]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(quoteRecipePrerequisites);
  await db.exec("GRANT SELECT, INSERT, UPDATE ON marketplace_binder_members, marketplace_binders TO service_role");
  for (const file of ["20260919090000_marketplace_binder_quotes", "20260920100000_marketplace_binder_invoice_vat_mention",
    "20260921090000_marketplace_binder_contacts_works", "20260923100000_marketplace_quote_size_blocks_photos",
    "20260923110000_marketplace_document_branding", "20260923120000_marketplace_invoice_compliance",
    "20260928090000_marketplace_payment_circuits", "20260928110000_own_client_external_settlement",
    "20261006110000_workshop_partial_credit_notes", "20261006140000_workshop_credit_franchise"]) await db.exec(migration(file));
  // Tables OPPE et paiements en ligne, telles que leurs migrations les créent.
  await db.exec(`
    CREATE TABLE marketplace_oppe_order_assignments(id uuid PRIMARY KEY);
    ${block("20261005150000_oppe_invoicing", "CREATE TABLE public.marketplace_oppe_document_counters")}
    ${block("20261005150000_oppe_invoicing", "CREATE TABLE public.marketplace_oppe_invoices (")}
    ${block("20261005150000_oppe_invoicing", "CREATE TABLE public.marketplace_oppe_invoice_items")}
    ${block("20261005150000_oppe_invoicing", "CREATE TABLE public.marketplace_oppe_credit_notes")}
    ${block("20261005150000_oppe_invoicing", "CREATE TABLE public.marketplace_oppe_refunds")}
    ${block("20261005150000_oppe_invoicing", "CREATE FUNCTION public.marketplace_forbid_oppe_document_change", "EXECUTE FUNCTION public.marketplace_forbid_oppe_document_change();\nCREATE TRIGGER marketplace_oppe_invoice_items_immutable BEFORE UPDATE OR DELETE ON public.marketplace_oppe_invoice_items\n  FOR EACH ROW EXECUTE FUNCTION public.marketplace_forbid_oppe_document_change();\nCREATE TRIGGER marketplace_oppe_credit_notes_immutable BEFORE UPDATE OR DELETE ON public.marketplace_oppe_credit_notes\n  FOR EACH ROW EXECUTE FUNCTION public.marketplace_forbid_oppe_document_change();")}
    ${block("20261005180000_oppe_supplier_invoices", "CREATE TABLE public.marketplace_oppe_supplier_invoices")}
    ${block("20261005180000_oppe_supplier_invoices", "CREATE TABLE public.marketplace_oppe_supplier_payments")}
    ${block("20261006120000_workshop_connect_payments", "CREATE TABLE public.marketplace_workshop_online_payments")}
    CREATE TABLE marketplace_commercial_proposal_payments (proposal_id uuid PRIMARY KEY REFERENCES marketplace_commercial_proposals(id) ON DELETE CASCADE,
      stripe_checkout_session_id text, stripe_payment_intent_id text, stripe_invoice_id text, paid_at timestamptz, amount_paid_cents integer,
      paid_currency text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    GRANT SELECT, INSERT, UPDATE ON marketplace_workshop_online_payments, marketplace_commercial_proposal_payments, marketplace_oppe_invoices,
      marketplace_oppe_invoice_items, marketplace_oppe_credit_notes, marketplace_oppe_refunds TO service_role;
  `);
  await db.exec(`INSERT INTO auth.users VALUES('${id(1)}'); INSERT INTO marketplace_binders VALUES('${BINDER}');
    INSERT INTO marketplace_binder_members VALUES('${BINDER}','${id(1)}','active');
    INSERT INTO marketplace_binder_clients(id,binder_id,name,billing_country) VALUES('${id(3)}','${BINDER}','QA client','FR');
    INSERT INTO marketplace_binder_billing_profiles(binder_id) VALUES('${BINDER}');`);
  await db.exec(migration("20261023100000_einvoicing_phase1"));
  // Une facture émise AVANT l'étape 2 : elle doit être journalisée par la migration.
  await setClock("2026-03-09 10:00:00+00");
  await issue(await draft([[10_000, 2000]], "2026-03-09"));
  await db.exec(migration("20261024100000_einvoicing_phase2_journal"));
}, 90_000);
afterAll(async () => { await db?.close(); });

describe("journal chaîné par émetteur", () => {
  it("journalise à la migration les pièces déjà émises", async () => {
    const rows = await journal();
    expect(rows.map((r) => [r.seq, r.event, r.document_kind])).toEqual([[1, "issued", "binder_invoice"]]);
    expect(rows[0].prev_hash).toBe("0".repeat(64));
  });

  it("enchaîne émission, PDF, règlement et avoir ; chaque empreinte se recalcule hors de la base", async () => {
    await setClock("2026-03-10 09:00:00+00");
    const invoice = await draft([[20_000, 2000], [10_000, 550]]);
    await issue(invoice);
    await service("UPDATE marketplace_binder_invoices SET pdf_path='x.pdf', pdf_sha256=$2 WHERE id=$1", [invoice, "a".repeat(64)]);
    await service("SELECT marketplace_binder_create_full_credit_note($1,$2,'2026-03-10','QA annulation')", [BINDER, invoice]);
    const rows = await journal();
    expect(rows.slice(1).map((r) => [r.event, r.document_kind])).toEqual([
      ["issued", "binder_invoice"], ["pdf_stored", "binder_invoice"], ["issued", "binder_credit_note"],
    ]);
    // Vérification indépendante (format documenté) : chaque entrée chaîne la précédente.
    const text: JournalEntryText[] = rows.map((r) => ({ seq: Number(r.seq), canonical: r.canonical, prevHash: r.prev_hash, hash: r.hash }));
    expect(await verifyJournalChain(text)).toEqual({ ok: true, problems: [] });
    expect(createHash("sha256").update(`${rows[1].prev_hash}\n${rows[1].canonical}`, "utf8").digest("hex")).toBe(rows[1].hash);
    expect((await verify()).ok).toBe(true);
  });

  it("n'accepte ni modification ni suppression du journal, même du propriétaire ; aucun accès en écriture au rôle de service", async () => {
    await expect(db.query("UPDATE marketplace_issuer_journal SET actor='x' WHERE issuer_key=$1", [ISSUER])).rejects.toThrow("issuer_journal_append_only");
    await expect(db.query("DELETE FROM marketplace_issuer_journal WHERE issuer_key=$1", [ISSUER])).rejects.toThrow("issuer_journal_append_only");
    await expect(db.query("TRUNCATE marketplace_issuer_journal")).rejects.toThrow("issuer_journal_append_only");
    await expect(service("INSERT INTO marketplace_issuer_journal(issuer_key,seq,event,event_key,occurred_at,payload,canonical,prev_hash,hash) VALUES($1,99,'export','x',now(),'{}','{}',$2,$2)",
      [ISSUER, "b".repeat(64)])).rejects.toThrow(/permission denied/);
    await expect(service("SELECT marketplace_journal_append($1,'issued','x',NULL,NULL,'{}'::jsonb,'x')", [ISSUER])).rejects.toThrow(/permission denied/);
    await expect(service("SELECT marketplace_journal_record_event($1,'issued','{}'::jsonb,NULL)", [ISSUER])).rejects.toThrow("issuer_journal_event_not_allowed");
  });

  it("journalise les événements de l'application autorisés et les changements de préfixe", async () => {
    await service("SELECT marketplace_journal_record_event($1,'pdf_integrity_failure',$2::jsonb,$3)", [ISSUER, JSON.stringify({ document_id: "x", reason: "hash_mismatch" }), id(1)]);
    await db.query("UPDATE marketplace_binder_billing_profiles SET invoice_prefix_pending='FA', prefix_pending_from_year=2027 WHERE binder_id=$1", [BINDER]);
    const rows = await journal();
    expect(rows.slice(-2).map((r) => r.event)).toEqual(["pdf_integrity_failure", "prefix_change"]);
    expect(rows.at(-1)!.payload).toMatchObject({ invoice_prefix_pending: "FA", prefix_pending_from_year: 2027 });
  });
});

describe("clôtures", () => {
  it("sont exactes sur le jeu d'essai, chaînées, rattrapées et idempotentes", async () => {
    // Mars 2026 : facture 20 % (100 €) le 9, facture 20 % + 5,5 % (300 €) le 10 annulée par avoir le 10.
    await setClock("2026-04-02 08:00:00+00");
    const created = (await service<{ c: number }>("SELECT marketplace_journal_close_due($1) c", [ISSUER])).rows[0].c;
    // Jours d'activité (9 et 10 mars, plus le 10 pour les événements de l'application) et le mois de mars.
    expect(created).toBe(3);
    const closures = (await journal()).filter((r) => r.event === "closure");
    const march = closures.find((r) => r.payload.kind === "month")!.payload;
    expect(march).toMatchObject({
      period_start: "2026-03-01", period_end: "2026-04-01", invoices: 2, credit_notes: 1,
      total_ht_cents: 10_000, total_vat_cents: 2_000, total_ttc_cents: 12_000,
      vat_by_rate: [{ rate_bps: 550, base_ht_cents: 0, vat_cents: 0 }, { rate_bps: 2000, base_ht_cents: 10_000, vat_cents: 2_000 }],
    });
    const day10 = closures.find((r) => r.payload.kind === "day" && r.payload.period_start === "2026-03-10")!.payload;
    expect(day10).toMatchObject({ invoices: 1, credit_notes: 1, total_ttc_cents: 0 });
    expect((await service<{ c: number }>("SELECT marketplace_journal_close_due($1) c", [ISSUER])).rows[0].c).toBe(0);
    // Rattrapage d'une longue absence : avril à décembre (vides compris) et l'année 2026.
    await setClock("2027-01-05 08:00:00+00");
    expect((await service<{ c: number }>("SELECT marketplace_journal_close_due($1) c", [ISSUER])).rows[0].c).toBe(10);
    const all = (await journal()).filter((r) => r.event === "closure");
    const year = all.find((r) => r.payload.kind === "year")!.payload;
    expect(year).toMatchObject({ period_start: "2026-01-01", invoices: 2, credit_notes: 1, total_ttc_cents: 12_000 });
    const months = all.filter((r) => r.payload.kind === "month");
    expect(months).toHaveLength(10);
    for (let i = 1; i < months.length; i += 1) expect(months[i].payload.previous_closure_hash).toBe(months[i - 1].hash);
    await expect(service("SELECT marketplace_journal_close_period($1,'month','2027-01-01')", [ISSUER])).rejects.toThrow(/permission denied/);
    await setClock(null);
  });
});

describe("encaissements journalisés", () => {
  it("paiement en ligne payé puis remboursé, paiement et remboursement OPPE", async () => {
    const invoice = await draft([[5_000, 2000]], "2026-10-22");
    await setClock(null);
    await issue(invoice);
    await db.query(`INSERT INTO marketplace_workshop_online_payments(id,binder_id,invoice_id,stripe_account_id,token_hash,token_expires_at,amount_cents,fee_cents,currency)
      VALUES($1,$2,$3,'acct_qa','tok-qa',now() + interval '1 day',6000,0,'eur')`, [id(500), BINDER, invoice]);
    await service("UPDATE marketplace_workshop_online_payments SET status='paid', paid_at=now(), payment_intent_id='pi_qa' WHERE id=$1", [id(500)]);
    await service("UPDATE marketplace_workshop_online_payments SET refunded_cents=1000 WHERE id=$1", [id(500)]);
    const last = (await journal()).slice(-2);
    expect(last.map((r) => [r.event, r.payload.method, r.payload.amount_cents ?? r.payload.refund_cents])).toEqual([["payment", "carte", 6000], ["refund", "carte", 1000]]);
    expect((await verify()).ok).toBe(true);
  });
});

describe("OPPE, émetteur à part entière", () => {
  it("chaîne ses factures, ses PDF et ses paiements ; la vérification relit la facture", async () => {
    await db.exec(`INSERT INTO marketplace_cases(id) VALUES('${id(700)}'); INSERT INTO marketplace_commercial_proposals(id,case_id,status) VALUES('${id(701)}','${id(700)}','accepted');`);
    // Comme marketplace_issue_oppe_invoice : la facture et ses lignes dans la même transaction.
    await db.exec(`BEGIN;
      INSERT INTO marketplace_oppe_invoices(id,proposal_id,case_id,brand,number,issue_date,seller,customer,currency,total_ht_cents,
        total_vat_cents,total_ttc_cents,vat_breakdown,payment,retained_until)
        VALUES('${id(702)}','${id(701)}','${id(700)}','MA_RELIURE','MR-2026-00001',CURRENT_DATE,'{}','{"name":"QA"}','EUR',10000,2000,12000,
        '[{"rate_bps":2000,"base_ht_cents":10000,"vat_cents":2000}]','{}',CURRENT_DATE + 3650);
      INSERT INTO marketplace_oppe_invoice_items(invoice_id,position,label,category,unit_ht_cents,vat_rate_bps,total_ht_cents,vat_cents,total_ttc_cents)
        VALUES('${id(702)}',1,'Reliure','service',10000,2000,10000,2000,12000);
      COMMIT;`);
    await service("UPDATE marketplace_oppe_invoices SET pdf_path='oppe/x.pdf', pdf_sha256=$2 WHERE id=$1", [id(702), "c".repeat(64)]);
    await expect(service("UPDATE marketplace_oppe_invoices SET pdf_sha256=$2 WHERE id=$1", [id(702), "d".repeat(64)])).rejects.toThrow("oppe_document_immutable");
    await expect(service("UPDATE marketplace_oppe_invoices SET total_ttc_cents=1 WHERE id=$1", [id(702)])).rejects.toThrow("oppe_document_immutable");
    await db.query("INSERT INTO marketplace_commercial_proposal_payments(proposal_id,paid_at,amount_paid_cents,paid_currency,stripe_payment_intent_id) VALUES($1,now(),12000,'eur','pi_oppe')", [id(701)]);
    const rows = await journal("oppe");
    expect(rows.map((r) => [r.event, r.document_kind])).toEqual([["issued", "oppe_invoice"], ["pdf_stored", "oppe_invoice"], ["payment", "proposal_payment"]]);
    expect((rows[0].payload.lines as unknown[]).length).toBe(1);
    expect(rows[2].payload).toMatchObject({ amount_cents: 12000, invoice_number: "MR-2026-00001" });
    expect((await verify("oppe")).ok).toBe(true);
  });
});

describe("détection d'une modification directe en base", () => {
  it("le rôle de service ne peut rien réécrire ; une réécriture qui contourne les déclencheurs est détectée", async () => {
    const issued = (await journal()).find((r) => r.event === "issued" && r.document_kind === "binder_invoice")!;
    await expect(service("UPDATE marketplace_binder_invoices SET total_ttc_cents=1 WHERE id=$1", [issued.document_id])).rejects.toThrow(/immutable/);
    await expect(service("DELETE FROM marketplace_binder_invoices WHERE id=$1", [issued.document_id])).rejects.toThrow(/permission denied|immutable|cannot be deleted/);
    // Un accès d'administration de la base peut suspendre les déclencheurs : la chaîne le révèle.
    await bypassingTriggers(() => db.query("UPDATE marketplace_binder_invoices SET client_name = 'Client falsifié' WHERE id=$1", [issued.document_id]));
    const result = await verify();
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual(expect.arrayContaining([expect.objectContaining({ problem: "document_modified", seq: Number(issued.seq) })]));
  });

  it("une entrée retirée ou réécrite casse la chaîne", async () => {
    await bypassingTriggers(async () => {
      await db.query("DELETE FROM marketplace_issuer_journal WHERE issuer_key='oppe' AND seq=2");
      await db.query("UPDATE marketplace_issuer_journal SET payload = payload || '{\"amount_cents\": 1}' WHERE issuer_key='oppe' AND seq=3");
    });
    const problems = (await verify("oppe")).problems.map((p) => p.problem);
    expect(problems).toEqual(expect.arrayContaining(["seq_gap", "prev_hash_mismatch", "canonical_mismatch"]));
  });

  it("une pièce émise absente du journal est signalée", async () => {
    const invoice = await draft([[1_000, 2000]], "2026-10-22");
    await bypassingTriggers(() => db.query("UPDATE marketplace_binder_invoices SET status='issued', invoice_number='F-HORS-JOURNAL', issued_at=now() WHERE id=$1", [invoice]));
    expect((await verify()).problems).toEqual(expect.arrayContaining([expect.objectContaining({ problem: "document_not_journaled" })]));
  });
});

describe("conservation", () => {
  it("supprimer l'atelier ne supprime ni ses pièces ni son journal", async () => {
    await expect(db.query("DELETE FROM marketplace_binders WHERE id=$1", [BINDER])).rejects.toThrow(/foreign key|violates/);
    expect((await journal()).length).toBeGreaterThan(0);
  });
});

describe("événements d'export et d'attestation", () => {
  it("sont chaînés comme les pièces, avec l'empreinte du manifeste", async () => {
    await service("SELECT marketplace_journal_record_event($1,'export',$2::jsonb,$3)", ["oppe", JSON.stringify({ manifest_sha256: "f".repeat(64) }), id(1)]);
    await service("SELECT marketplace_journal_record_event($1,'attestation_draft',$2::jsonb,$3)", ["oppe", JSON.stringify({ software_version: "abc" }), id(1)]);
    const rows = await journal("oppe");
    expect(rows.slice(-2).map((r) => [r.event, r.payload])).toEqual([
      ["export", { manifest_sha256: "f".repeat(64) }], ["attestation_draft", { software_version: "abc" }],
    ]);
  });
});

describe("retour arrière (docs/einvoicing/phase2-rollback.sql)", () => {
  it("cesse d'alimenter le journal sans rien en retirer, et rend aux pièces OPPE leur immuabilité d'origine", async () => {
    const before = (await db.query<{ c: number }>("SELECT count(*)::int c FROM marketplace_issuer_journal")).rows[0].c;
    await db.exec(readFileSync(new URL("../../../docs/einvoicing/phase2-rollback.sql", import.meta.url), "utf8"));
    await issue(await draft([[2_000, 2000]], "2026-10-22"));
    expect((await db.query<{ c: number }>("SELECT count(*)::int c FROM marketplace_issuer_journal")).rows[0].c).toBe(before);
    await expect(db.query("UPDATE marketplace_oppe_credit_notes SET pdf_path='y' WHERE false")).resolves.toBeDefined();
    await expect(service("SELECT marketplace_journal_verify($1)", [ISSUER])).rejects.toThrow(/permission denied/);
    await expect(db.query("DELETE FROM marketplace_issuer_journal")).rejects.toThrow("issuer_journal_append_only");
  });
});
