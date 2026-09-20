/**
 * Contacts et ouvrages de l'atelier, avec un faux client Supabase en mémoire qui applique les
 * filtres comme la base (`eq`, `in`) et émule les fonctions SQL utilisées. Le comportement réel de
 * la base (numérotation, contraintes, triggers d'isolation, RLS) est vérifié séparément sur un vrai
 * Postgres — voir le compte rendu de la PR ; ici on teste ce que le SERVEUR envoie et comment il
 * isole deux ateliers l'un de l'autre.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- le faux client Supabase est volontairement non typé */
import { beforeEach, describe, expect, it } from "vitest";
import { BinderQuotesError, createQuote, listClients, requireBinderId, saveBillingProfile } from "./binderQuotes.server";
import {
  getContact,
  getWork,
  listContacts,
  listWorks,
  saveContact,
  saveWork,
  setContactArchived,
  setWorkArchived,
} from "./binderWorks.server";
import { QUOTE_ROW_KEYS } from "@/marketplace/quotes/quoteBuild";
import type { BillingProfileInput, QuoteInput } from "@/marketplace/quotes/quoteInput";
import type { ContactInput, WorkInput } from "@/marketplace/works/workInput";

type Row = Record<string, any>;

function makeDb() {
  const tables: Record<string, Row[]> = {};
  const rpcCalls: { name: string; args: Row }[] = [];
  const counters = new Map<string, number>();
  let seq = 0;
  const uid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const rows = (t: string) => (tables[t] ??= []);

  function from(table: string) {
    let op: "select" | "insert" | "update" | "upsert" = "select";
    let values: any;
    let onConflict: string | undefined;
    const filters: ((r: Row) => boolean)[] = [];
    let order: { col: string; asc: boolean } | null = null;
    const run = () => {
      let result: Row[];
      if (op === "insert") {
        const list = (Array.isArray(values) ? values : [values]).map((v: Row) => ({
          id: uid(), created_at: "2026-09-21T10:00:00Z", updated_at: "2026-09-21T10:00:00Z", archived_at: null, ...v,
        }));
        rows(table).push(...list);
        result = list;
      } else if (op === "upsert") {
        const key = onConflict ?? "id";
        const found = rows(table).find((r) => r[key] === values[key]);
        if (found) Object.assign(found, values);
        else rows(table).push({ ...values });
        result = [found ?? rows(table)[rows(table).length - 1]];
      } else {
        result = rows(table).filter((r) => filters.every((f) => f(r)));
        if (op === "update") result.forEach((r) => Object.assign(r, values));
        if (order) result = [...result].sort((a, b) => (a[order!.col] > b[order!.col] ? 1 : -1) * (order!.asc ? 1 : -1));
      }
      return result.map((r) => ({ ...r }));
    };
    const q: any = {
      select: () => q,
      insert: (v: any) => ((op = "insert"), (values = v), q),
      update: (v: any) => ((op = "update"), (values = v), q),
      upsert: (v: any, o?: { onConflict?: string }) => ((op = "upsert"), (values = v), (onConflict = o?.onConflict), q),
      eq: (col: string, v: any) => (filters.push((r) => r[col] === v), q),
      in: (col: string, v: any[]) => (filters.push((r) => v.includes(r[col])), q),
      order: (col: string, o?: { ascending?: boolean }) => ((order = { col, asc: o?.ascending !== false }), q),
      limit: () => q,
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      single: async () => {
        const r = run()[0];
        return r ? { data: r, error: null } : { data: null, error: { message: "no rows" } };
      },
      then: (resolve: any, reject: any) => Promise.resolve({ data: run(), error: null }).then(resolve, reject),
    };
    return q;
  }

  async function rpc(name: string, args: Row) {
    rpcCalls.push({ name, args: JSON.parse(JSON.stringify(args)) });
    if (name === "marketplace_binder_create_work") {
      // Le modèle de la fonction SQL : atelier, référence, source, dossier et statut sont IMPOSÉS.
      const year = 2026;
      const key = `${args.p_binder_id}|${year}`;
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      const id = uid();
      rows("marketplace_binder_works").push({
        ...args.p_work, id, binder_id: args.p_binder_id, reference: `O-${year}-${String(next).padStart(4, "0")}`,
        status: "active", source: "mon_client", case_id: null, created_at: "2026-09-21T10:00:00Z", updated_at: "2026-09-21T10:00:00Z",
      });
      return { data: id, error: null };
    }
    if (name === "marketplace_binder_create_quote") {
      const id = uid();
      rows("marketplace_binder_quotes").push({
        ...args.p_quote, id, binder_id: args.p_binder_id, status: "draft", created_at: "2026-09-21T10:00:00Z",
        quote_number: `D-2026-${String(rows("marketplace_binder_quotes").length + 1).padStart(4, "0")}`,
      });
      args.p_items.forEach((item: Row, i: number) =>
        rows("marketplace_binder_quote_items").push({ ...item, id: uid(), quote_id: id, binder_id: args.p_binder_id, position: i + 1 }),
      );
      return { data: id, error: null };
    }
    throw new Error(`unexpected rpc ${name}`);
  }
  return { sb: { from, rpc } as any, tables, rpcCalls };
}

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BINDER_A = "a0000000-0000-4000-8000-00000000000a";
const BINDER_B = "b0000000-0000-4000-8000-00000000000b";

const contact = (over: Partial<ContactInput> = {}): ContactInput => ({
  id: null, firstName: "Claire", lastName: "Martin", organization: null, email: "claire@example.test", phone: "06 00 00 00 00",
  addressLine1: "1 rue X", postalCode: "75001", city: "Paris", country: null, notes: null, ...over,
});
const work = (contactId: string, over: Partial<WorkInput> = {}): WorkInput => ({
  id: null, contactId, title: "Les Misérables", author: "Victor Hugo", editionNote: "Édition de 1890", description: null,
  heightMm: 220, widthMm: 145, thicknessMm: 32, weightGrams: 900, declaredValueCents: 45000,
  conditionNotes: "Dos détaché, coins usés", internalNotes: null, ...over,
});
const profile = (): BillingProfileInput => ({
  workshopName: "Atelier A", legalName: "Atelier A SARL", addressLine1: "12 rue des Relieurs", addressLine2: null, postalCode: "45000",
  city: "Orléans", country: "FR", siret: "123 456 789 00012", vatNumber: "FR12345678901", legalNotes: null, email: "a@example.test",
  phone: "02 00 00 00 00", vatRegime: "VAT_LIABLE", defaultVatRateBps: 2000, vatMention: null, quotePrefix: "D", invoicePrefix: "F",
  quoteValidityDays: 30, paymentTerms: null, quoteNotes: null, invoiceNotes: null,
});
const line = (label: string, unit: number) => ({
  serviceId: null, label, description: null, unit: null, quantity: 1, unitPriceCents: unit, catalogPriceCents: null, vatRateBps: 2000,
});
const quote = (over: Partial<QuoteInput> = {}): QuoteInput => ({
  clientId: null,
  client: { name: "Nom saisi dans le devis", email: null, phone: null, addressLine1: null, postalCode: null, city: null, country: null },
  book: { title: "Titre saisi dans le devis", author: null, heightMm: 220, widthMm: 145, spineMm: 32, notes: null },
  lines: [line("Plein cuir", 28000), line("Nerfs", 3000), line("Dorure titre", 4500), line("Étui", 7500)],
  discount: { type: "NONE" }, deposit: { type: "NONE" }, validityDays: null, notes: null, ...over,
});

let world: ReturnType<typeof makeDb>;
beforeEach(() => {
  world = makeDb();
  world.tables.marketplace_binder_members = [
    { binder_id: BINDER_A, user_id: ALICE, role: "OWNER", account_status: "active", created_at: "2026-01-01" },
    { binder_id: BINDER_B, user_id: BOB, role: "OWNER", account_status: "active", created_at: "2026-01-01" },
  ];
  world.tables.marketplace_binders = [
    { id: BINDER_A, workshop_name: "Atelier A", display_name: "A", city: "Orléans", postal_code: "45000" },
    { id: BINDER_B, workshop_name: "Atelier B", display_name: "B", city: "Lyon", postal_code: "69000" },
  ];
});

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof BinderQuotesError) return error.code;
    throw error;
  }
  return "no error";
};
const rpcNames = () => world.rpcCalls.map((c) => c.name);

describe("contacts", () => {
  it("crée un contact : le nom d'affichage est déduit, l'origine est toujours « mon client »", async () => {
    const created = await saveContact(world.sb, BINDER_A, contact());
    expect(created.name).toBe("Claire Martin");
    expect(created.origin).toBe("mon_client");
    expect(created.archived).toBe(false);
    const row = world.tables.marketplace_binder_clients[0];
    expect(row.binder_id).toBe(BINDER_A);
    expect(row.origin).toBe("mon_client");
    expect(row.origin_case_id).toBeUndefined(); // jamais posé par ce chemin
  });

  it("une institution, ou une personne rattachée à une institution", async () => {
    expect((await saveContact(world.sb, BINDER_A, contact({ firstName: null, lastName: null, organization: "Bibliothèque municipale" }))).name).toBe("Bibliothèque municipale");
    expect((await saveContact(world.sb, BINDER_A, contact({ organization: "Bibliothèque municipale" }))).name).toBe("Claire Martin — Bibliothèque municipale");
  });

  it("modifier un contact ne touche ni son origine, ni son archivage, ni son atelier", async () => {
    const created = await saveContact(world.sb, BINDER_A, contact());
    Object.assign(world.tables.marketplace_binder_clients[0], { origin: "ma_reliure", archived_at: "2026-09-20T00:00:00Z" });
    await saveContact(world.sb, BINDER_A, contact({ id: created.id, phone: "07 00 00 00 00" }));
    const row = world.tables.marketplace_binder_clients[0];
    expect(row.phone).toBe("07 00 00 00 00");
    expect(row.origin).toBe("ma_reliure"); // une modification ne « convertit » jamais un contact
    expect(row.archived_at).toBe("2026-09-20T00:00:00Z");
    expect(row.binder_id).toBe(BINDER_A);
  });

  it("l'atelier B ne lit, ne modifie, n'archive ni ne consulte un contact de l'atelier A : il est introuvable", async () => {
    const created = await saveContact(world.sb, BINDER_A, contact());
    expect(await codeOf(saveContact(world.sb, BINDER_B, contact({ id: created.id, lastName: "Piraté" })))).toBe("not_found");
    expect(await codeOf(setContactArchived(world.sb, BINDER_B, created.id, true))).toBe("not_found");
    expect(await codeOf(getContact(world.sb, BINDER_B, created.id))).toBe("not_found");
    expect(world.tables.marketplace_binder_clients[0].last_name).toBe("Martin");
    expect(await listContacts(world.sb, BINDER_B)).toEqual([]);
  });

  it("archiver retire le contact de la liste (et du constructeur de devis), désarchiver le rend", async () => {
    const a = await saveContact(world.sb, BINDER_A, contact());
    await saveContact(world.sb, BINDER_A, contact({ firstName: "Paul", lastName: "Durand" }));
    await setContactArchived(world.sb, BINDER_A, a.id, true);
    expect((await listContacts(world.sb, BINDER_A)).map((c) => c.name)).toEqual(["Paul Durand"]);
    expect((await listContacts(world.sb, BINDER_A, { includeArchived: true })).map((c) => c.name).sort()).toEqual(["Claire Martin", "Paul Durand"]);
    expect((await listClients(world.sb, BINDER_A)).map((c) => c.name)).toEqual(["Paul Durand"]);
    await setContactArchived(world.sb, BINDER_A, a.id, false);
    expect((await listContacts(world.sb, BINDER_A)).length).toBe(2);
  });

  it("la liste compte les ouvrages actifs et les documents de chaque contact", async () => {
    const c = await saveContact(world.sb, BINDER_A, contact());
    await saveWork(world.sb, BINDER_A, work(c.id));
    await saveWork(world.sb, BINDER_A, work(c.id, { title: "Candide" }));
    world.tables.marketplace_binder_quotes = [{ id: "q1", binder_id: BINDER_A, client_id: c.id, work_id: null }];
    world.tables.marketplace_binder_invoices = [{ id: "i1", binder_id: BINDER_A, client_id: c.id, quote_id: "q1" }];
    const [row] = await listContacts(world.sb, BINDER_A);
    expect(row.workCount).toBe(2);
    expect(row.documentCount).toBe(2);
  });

  it("la fiche réunit ses ouvrages, ses devis et ses factures — et seulement les siens", async () => {
    const c = await saveContact(world.sb, BINDER_A, contact());
    const other = await saveContact(world.sb, BINDER_A, contact({ firstName: "Paul", lastName: "Durand" }));
    const w = await saveWork(world.sb, BINDER_A, work(c.id));
    world.tables.marketplace_binder_quotes = [
      { id: "q1", binder_id: BINDER_A, client_id: c.id, work_id: w.work.id, quote_number: "D-2026-0001", status: "accepted", issue_date: "2026-09-20", valid_until: "2026-10-20", client_name: "Claire Martin", book_title: "Les Misérables", total_ttc_cents: 43000, currency: "EUR", created_at: "2026-09-20" },
      { id: "q2", binder_id: BINDER_A, client_id: other.id, work_id: null, quote_number: "D-2026-0002", status: "draft", issue_date: "2026-09-20", valid_until: "2026-10-20", client_name: "Paul Durand", book_title: null, total_ttc_cents: 100, currency: "EUR", created_at: "2026-09-20" },
    ];
    world.tables.marketplace_binder_invoices = [
      { id: "i1", binder_id: BINDER_A, client_id: c.id, quote_id: "q1", invoice_number: "F-2026-0001", payment_status: "unpaid", issue_date: "2026-09-21", client_name: "Claire Martin", book_title: "Les Misérables", total_ttc_cents: 43000, currency: "EUR", created_at: "2026-09-21" },
    ];
    const detail = await getContact(world.sb, BINDER_A, c.id);
    expect(detail.works.map((x) => x.title)).toEqual(["Les Misérables"]);
    expect(detail.works[0].quoteCount).toBe(1);
    expect(detail.quotes.map((x) => x.number)).toEqual(["D-2026-0001"]);
    expect(detail.invoices.map((x) => x.number)).toEqual(["F-2026-0001"]);
  });
});

describe("ouvrages", () => {
  it("crée un ouvrage : l'atelier vient de la session, la référence de la base — jamais de l'entrée", async () => {
    const c = await saveContact(world.sb, BINDER_A, contact());
    const detail = await saveWork(world.sb, BINDER_A, work(c.id));
    expect(detail.work.reference).toBe("O-2026-0001");
    expect(detail.work.source).toBe("mon_client");
    expect(detail.contact?.name).toBe("Claire Martin");
    const call = world.rpcCalls.find((x) => x.name === "marketplace_binder_create_work")!;
    expect(call.args.p_binder_id).toBe(BINDER_A);
    // Ce que le serveur envoie ne contient JAMAIS l'atelier, la référence, la source, le dossier ni le statut.
    for (const forbidden of ["binder_id", "reference", "source", "case_id", "status", "id", "created_at"]) {
      expect(Object.keys(call.args.p_work), forbidden).not.toContain(forbidden);
    }
    expect(call.args.p_work.height_mm).toBe(220);
    expect(call.args.p_work.thickness_mm).toBe(32);
  });

  it("deux ouvrages, deux références ; chaque atelier a sa propre suite", async () => {
    const a = await saveContact(world.sb, BINDER_A, contact());
    const b = await saveContact(world.sb, BINDER_B, contact());
    expect((await saveWork(world.sb, BINDER_A, work(a.id))).work.reference).toBe("O-2026-0001");
    expect((await saveWork(world.sb, BINDER_A, work(a.id, { title: "Candide" }))).work.reference).toBe("O-2026-0002");
    expect((await saveWork(world.sb, BINDER_B, work(b.id))).work.reference).toBe("O-2026-0001");
  });

  it("refuse le contact d'un autre atelier — et n'écrit rien", async () => {
    const foreign = await saveContact(world.sb, BINDER_B, contact());
    expect(await codeOf(saveWork(world.sb, BINDER_A, work(foreign.id)))).toBe("invalid_input");
    expect(rpcNames()).not.toContain("marketplace_binder_create_work");
    expect(world.tables.marketplace_binder_works ?? []).toHaveLength(0);
  });

  it("modifier un ouvrage ne change ni sa référence, ni sa source, ni son dossier, ni son statut, ni son atelier", async () => {
    const c = await saveContact(world.sb, BINDER_A, contact());
    const created = await saveWork(world.sb, BINDER_A, work(c.id));
    Object.assign(world.tables.marketplace_binder_works[0], { source: "ma_reliure", case_id: "case-1", status: "archived" });
    await saveWork(world.sb, BINDER_A, work(c.id, { id: created.work.id, title: "Les Misérables (titre corrigé)", weightGrams: 950 }));
    const row = world.tables.marketplace_binder_works[0];
    expect(row.title).toBe("Les Misérables (titre corrigé)");
    expect(row.weight_grams).toBe(950);
    expect(row.reference).toBe("O-2026-0001");
    expect(row.source).toBe("ma_reliure");
    expect(row.case_id).toBe("case-1");
    expect(row.status).toBe("archived");
    expect(row.binder_id).toBe(BINDER_A);
  });

  it("l'atelier B ne modifie, n'archive ni ne consulte l'ouvrage de l'atelier A ; il ne peut pas non plus le rattacher à son contact", async () => {
    const a = await saveContact(world.sb, BINDER_A, contact());
    const b = await saveContact(world.sb, BINDER_B, contact());
    const created = await saveWork(world.sb, BINDER_A, work(a.id));
    expect(await codeOf(saveWork(world.sb, BINDER_B, work(b.id, { id: created.work.id, title: "Piraté" })))).toBe("not_found");
    expect(await codeOf(setWorkArchived(world.sb, BINDER_B, created.work.id, true))).toBe("not_found");
    expect(await codeOf(getWork(world.sb, BINDER_B, created.work.id))).toBe("not_found");
    expect(await listWorks(world.sb, BINDER_B)).toEqual([]);
    // Refusé APRÈS coup ne suffit pas : rien n'a été écrit sur la fiche de A.
    expect(world.tables.marketplace_binder_works[0]).toMatchObject({ title: "Les Misérables", status: "active", contact_id: a.id });
  });

  it("même si la base contenait des lignes croisées (elle les interdit, mais un test ne s'y fie pas), les comptes, listes et fiches d'un atelier ignorent celles de l'autre", async () => {
    const a = await saveContact(world.sb, BINDER_A, contact());
    const w = await saveWork(world.sb, BINDER_A, work(a.id));
    const alien = { binder_id: BINDER_B, issue_date: "2026-09-20", valid_until: "2026-10-20", client_name: "x", book_title: null, total_ttc_cents: 100, currency: "EUR", created_at: "2026-09-20" };
    world.tables.marketplace_binder_quotes = [
      { ...alien, id: "qa", client_id: a.id, work_id: w.work.id, quote_number: "D-2026-0009", status: "invoiced" },
    ];
    world.tables.marketplace_binder_invoices = [
      { ...alien, id: "ia", client_id: a.id, quote_id: "qa", invoice_number: "F-2026-0009", payment_status: "unpaid" },
    ];
    world.tables.marketplace_binder_works.push({ ...world.tables.marketplace_binder_works[0], id: "wb", binder_id: BINDER_B, reference: "O-2026-0001", contact_id: a.id, status: "active" });
    const [row] = await listContacts(world.sb, BINDER_A);
    expect(row).toMatchObject({ workCount: 1, documentCount: 0 });
    const detail = await getContact(world.sb, BINDER_A, a.id);
    expect(detail.works.map((x) => x.id)).toEqual([w.work.id]);
    expect(detail.quotes).toEqual([]);
    expect(detail.invoices).toEqual([]);
    expect((await listWorks(world.sb, BINDER_A))[0].quoteCount).toBe(0);
    const fiche = await getWork(world.sb, BINDER_A, w.work.id);
    expect(fiche.quotes).toEqual([]);
    expect(fiche.invoices).toEqual([]);
  });

  it("une référence croisée corrompue ne fait jamais fuiter le nom d'un contact, ni une facture, de l'autre atelier", async () => {
    const a = await saveContact(world.sb, BINDER_A, contact());
    const foreign = await saveContact(world.sb, BINDER_B, contact({ firstName: "Secret", lastName: "Contact-de-B" }));
    const w = await saveWork(world.sb, BINDER_A, work(a.id));
    // Corruption que la base interdit (deux triggers) : l'ouvrage de A pointe le contact de B.
    world.tables.marketplace_binder_works[0].contact_id = foreign.id;
    expect((await listWorks(world.sb, BINDER_A))[0].contactName).toBeNull();
    expect((await getWork(world.sb, BINDER_A, w.work.id)).contact).toBeNull();
    // Un devis de A sur cet ouvrage, et une facture de B qui prétend en être issue.
    world.tables.marketplace_binder_works[0].contact_id = a.id;
    const base = { issue_date: "2026-09-20", valid_until: "2026-10-20", client_name: "x", book_title: null, total_ttc_cents: 100, currency: "EUR", created_at: "2026-09-20" };
    world.tables.marketplace_binder_quotes = [{ ...base, id: "qa", binder_id: BINDER_A, work_id: w.work.id, quote_number: "D-2026-0001", status: "invoiced" }];
    world.tables.marketplace_binder_invoices = [
      { ...base, id: "ib", binder_id: BINDER_B, quote_id: "qa", invoice_number: "F-2026-0001", payment_status: "unpaid" },
      { ...base, id: "ia", binder_id: BINDER_A, quote_id: "qa", invoice_number: "F-2026-0002", payment_status: "unpaid" },
    ];
    expect((await getWork(world.sb, BINDER_A, w.work.id)).invoices.map((i) => i.number)).toEqual(["F-2026-0002"]);
  });

  it("re-pointer son propre ouvrage vers le contact d'un autre atelier est refusé", async () => {
    const a = await saveContact(world.sb, BINDER_A, contact());
    const foreign = await saveContact(world.sb, BINDER_B, contact());
    const created = await saveWork(world.sb, BINDER_A, work(a.id));
    expect(await codeOf(saveWork(world.sb, BINDER_A, work(foreign.id, { id: created.work.id })))).toBe("invalid_input");
    expect(world.tables.marketplace_binder_works[0].contact_id).toBe(a.id);
  });

  it("la liste : ouvrages actifs seulement (les archivés sur demande), avec le contact et le nombre de devis", async () => {
    const c = await saveContact(world.sb, BINDER_A, contact());
    const w1 = await saveWork(world.sb, BINDER_A, work(c.id));
    const w2 = await saveWork(world.sb, BINDER_A, work(c.id, { title: "Candide" }));
    world.tables.marketplace_binder_quotes = [
      { id: "q1", binder_id: BINDER_A, work_id: w1.work.id }, { id: "q2", binder_id: BINDER_A, work_id: w1.work.id },
    ];
    await setWorkArchived(world.sb, BINDER_A, w2.work.id, true);
    const active = await listWorks(world.sb, BINDER_A);
    expect(active.map((w) => [w.title, w.contactName, w.quoteCount])).toEqual([["Les Misérables", "Claire Martin", 2]]);
    expect((await listWorks(world.sb, BINDER_A, { includeArchived: true })).length).toBe(2);
    expect((await listWorks(world.sb, BINDER_A, { contactId: c.id })).length).toBe(1);
    expect(await listWorks(world.sb, BINDER_A, { contactId: "00000000-0000-4000-8000-0000000000ff" })).toEqual([]);
  });

  it("la fiche rattache ses devis, et ses factures PAR LEURS DEVIS", async () => {
    const c = await saveContact(world.sb, BINDER_A, contact());
    const w = await saveWork(world.sb, BINDER_A, work(c.id));
    const base = { binder_id: BINDER_A, issue_date: "2026-09-20", valid_until: "2026-10-20", client_name: "x", book_title: null, total_ttc_cents: 100, currency: "EUR", created_at: "2026-09-20" };
    world.tables.marketplace_binder_quotes = [
      { ...base, id: "q1", work_id: w.work.id, quote_number: "D-2026-0001", status: "invoiced" },
      { ...base, id: "q2", work_id: null, quote_number: "D-2026-0002", status: "draft" },
      { ...base, id: "q3", binder_id: BINDER_B, work_id: w.work.id, quote_number: "D-2026-0003", status: "draft" }, // n'appartient pas à l'atelier A
    ];
    world.tables.marketplace_binder_invoices = [
      { ...base, id: "i1", quote_id: "q1", invoice_number: "F-2026-0001", payment_status: "unpaid" },
      { ...base, id: "i2", quote_id: "q2", invoice_number: "F-2026-0002", payment_status: "unpaid" },
    ];
    const detail = await getWork(world.sb, BINDER_A, w.work.id);
    expect(detail.quotes.map((q) => q.number)).toEqual(["D-2026-0001"]);
    expect(detail.invoices.map((i) => i.number)).toEqual(["F-2026-0001"]);
  });

  it("archiver une fiche ne supprime rien", async () => {
    const c = await saveContact(world.sb, BINDER_A, contact());
    const w = await saveWork(world.sb, BINDER_A, work(c.id));
    const archived = await setWorkArchived(world.sb, BINDER_A, w.work.id, true);
    expect(archived.work.status).toBe("archived");
    expect(world.tables.marketplace_binder_works).toHaveLength(1);
    expect((await setWorkArchived(world.sb, BINDER_A, w.work.id, false)).work.status).toBe("active");
  });
});

describe("le lien devis → ouvrage", () => {
  beforeEach(async () => {
    await saveBillingProfile(world.sb, BINDER_A, profile());
  });

  it("un devis sans ouvrage envoie EXACTEMENT ce qu'il envoyait avant : aucune clé `work_id`", async () => {
    await createQuote(world.sb, BINDER_A, quote(), "2026-09-21");
    const call = world.rpcCalls.find((x) => x.name === "marketplace_binder_create_quote")!;
    expect(Object.keys(call.args.p_quote).sort()).toEqual([...QUOTE_ROW_KEYS].sort());
  });

  it("un devis rattaché à un ouvrage de l'atelier l'enregistre", async () => {
    const c = await saveContact(world.sb, BINDER_A, contact());
    const w = await saveWork(world.sb, BINDER_A, work(c.id));
    const created = await createQuote(world.sb, BINDER_A, quote({ workId: w.work.id, clientId: c.id }), "2026-09-21");
    const call = world.rpcCalls.find((x) => x.name === "marketplace_binder_create_quote")!;
    expect(call.args.p_quote.work_id).toBe(w.work.id);
    expect(world.tables.marketplace_binder_quotes[0].work_id).toBe(w.work.id);
    expect(created.id).toBeTruthy();
  });

  it("le devis garde SON snapshot : ni le nom du contact ni le titre de l'ouvrage ne sont relus", async () => {
    const c = await saveContact(world.sb, BINDER_A, contact());
    const w = await saveWork(world.sb, BINDER_A, work(c.id));
    await createQuote(world.sb, BINDER_A, quote({ workId: w.work.id, clientId: c.id }), "2026-09-21");
    const row = world.tables.marketplace_binder_quotes[0];
    expect(row.client_name).toBe("Nom saisi dans le devis");
    expect(row.book_title).toBe("Titre saisi dans le devis");
    // Corriger la fiche ensuite ne change rien au document.
    await saveWork(world.sb, BINDER_A, work(c.id, { id: w.work.id, title: "Autre titre" }));
    await saveContact(world.sb, BINDER_A, contact({ id: c.id, lastName: "Autre" }));
    expect(world.tables.marketplace_binder_quotes[0].book_title).toBe("Titre saisi dans le devis");
    expect(world.tables.marketplace_binder_quotes[0].client_name).toBe("Nom saisi dans le devis");
  });

  it("l'ouvrage d'un autre atelier — ou inexistant — est refusé AVANT toute écriture", async () => {
    const foreignContact = await saveContact(world.sb, BINDER_B, contact());
    const foreign = await saveWork(world.sb, BINDER_B, work(foreignContact.id));
    const clientsBefore = (world.tables.marketplace_binder_clients ?? []).length;
    expect(await codeOf(createQuote(world.sb, BINDER_A, quote({ workId: foreign.work.id }), "2026-09-21"))).toBe("invalid_input");
    expect(await codeOf(createQuote(world.sb, BINDER_A, quote({ workId: "00000000-0000-4000-8000-0000000000ff" }), "2026-09-21"))).toBe("invalid_input");
    expect(rpcNames()).not.toContain("marketplace_binder_create_quote");
    expect((world.tables.marketplace_binder_clients ?? []).length).toBe(clientsBefore); // pas de fiche client créée pour rien
  });
});

describe("qui est l'atelier de cette session", () => {
  it("un membre actif a son atelier ; personne d'autre n'en a", async () => {
    expect(await requireBinderId(world.sb, ALICE)).toBe(BINDER_A);
    expect(await codeOf(requireBinderId(world.sb, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"))).toBe("no_binder");
  });
});
