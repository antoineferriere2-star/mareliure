/**
 * L'outil devis → facture, avec un faux client Supabase en mémoire qui applique
 * les filtres comme la base (`eq`, `in`) et émule les quatre fonctions SQL. Les
 * fonctions SQL réelles (numérotation, atomicité, immuabilité, isolation par
 * rôle) sont vérifiées séparément sur un vrai Postgres — voir le compte rendu de
 * la PR — ; ici on teste ce que le SERVEUR envoie et comment il isole deux
 * ateliers l'un de l'autre.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- le faux client Supabase est volontairement non typé */
import { describe, expect, it, beforeEach } from "vitest";
import {
  archiveService,
  BinderQuotesError,
  convertQuoteToInvoice,
  createQuote,
  getInvoice,
  getQuote,
  importStarterCatalog,
  listCatalog,
  listClients,
  listInvoices,
  listQuotes,
  loadBillingProfile,
  requireBinderId,
  saveBillingProfile,
  saveClient,
  saveService,
  setQuoteStatus,
  updateQuote,
} from "./binderQuotes.server";
import { QUOTE_ITEM_ROW_KEYS, QUOTE_ROW_KEYS } from "@/marketplace/quotes/quoteBuild";
import { renderDocumentPdf } from "@/marketplace/quotes/documentPdf";
import type { BillingProfileInput, QuoteInput } from "@/marketplace/quotes/quoteInput";

type Row = Record<string, any>;

// ---------------------------------------------------------------------------
// Faux Supabase
// ---------------------------------------------------------------------------
function makeDb() {
  const tables: Record<string, Row[]> = {};
  const counters = new Map<string, number>();
  const rpcCalls: { name: string; args: Row }[] = [];
  let seq = 0;
  const uid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const rows = (t: string) => (tables[t] ??= []);

  function from(table: string) {
    let op: "select" | "insert" | "update" | "upsert" = "select";
    let values: any;
    let onConflict: string | undefined;
    const filters: ((r: Row) => boolean)[] = [];
    let order: { col: string; asc: boolean } | null = null;
    let max = Infinity;

    const run = () => {
      let result: Row[];
      if (op === "insert") {
        const list = (Array.isArray(values) ? values : [values]).map((v: Row) => ({
          id: uid(),
          created_at: "2026-09-19T10:00:00Z",
          archived_at: null,
          sort_order: 0,
          is_active: true,
          ...v,
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
        result = result.slice(0, max);
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
      limit: (n: number) => ((max = n), q),
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      single: async () => {
        const r = run()[0];
        return r ? { data: r, error: null } : { data: null, error: { message: "no rows" } };
      },
      then: (resolve: any, reject: any) => Promise.resolve({ data: run(), error: null }).then(resolve, reject),
    };
    return q;
  }

  const number = (binder: string, kind: string, year: number) => {
    const key = `${binder}|${kind}|${year}`;
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    const profile = rows("marketplace_binder_billing_profiles").find((p) => p.binder_id === binder);
    const prefix = (kind === "quote" ? profile?.quote_prefix : profile?.invoice_prefix) ?? (kind === "quote" ? "D" : "F");
    return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
  };

  async function rpc(name: string, args: Row) {
    rpcCalls.push({ name, args: JSON.parse(JSON.stringify(args)) });
    if (name === "marketplace_binder_create_quote") {
      const id = uid();
      const year = Number(String(args.p_quote.issue_date).slice(0, 4));
      rows("marketplace_binder_quotes").push({
        ...args.p_quote, id, binder_id: args.p_binder_id, status: "draft", created_at: "2026-09-19T10:00:00Z",
        quote_number: number(args.p_binder_id, "quote", year),
      });
      args.p_items.forEach((item: Row, i: number) =>
        rows("marketplace_binder_quote_items").push({ ...item, id: uid(), quote_id: id, binder_id: args.p_binder_id, position: i + 1 }),
      );
      return { data: id, error: null };
    }
    if (name === "marketplace_binder_update_quote") {
      const q = rows("marketplace_binder_quotes").find((r) => r.id === args.p_quote_id && r.binder_id === args.p_binder_id);
      if (!q) return { data: null, error: { message: "quote_not_found" } };
      if (q.status !== "draft") return { data: null, error: { message: "quote_not_editable" } };
      Object.assign(q, args.p_quote, { id: q.id, binder_id: q.binder_id, quote_number: q.quote_number, status: q.status, issue_date: q.issue_date });
      tables.marketplace_binder_quote_items = rows("marketplace_binder_quote_items").filter((i) => i.quote_id !== q.id);
      args.p_items.forEach((item: Row, i: number) =>
        rows("marketplace_binder_quote_items").push({ ...item, id: uid(), quote_id: q.id, binder_id: q.binder_id, position: i + 1 }),
      );
      return { data: q.id, error: null };
    }
    if (name === "marketplace_binder_convert_quote_to_invoice") {
      const q = rows("marketplace_binder_quotes").find((r) => r.id === args.p_quote_id && r.binder_id === args.p_binder_id);
      if (!q) return { data: null, error: { message: "quote_not_found" } };
      if (q.status === "invoiced") return { data: null, error: { message: "quote_already_invoiced" } };
      if (q.status !== "accepted") return { data: null, error: { message: "quote_not_accepted" } };
      // Modèle de la fonction SQL : en franchise, la mention effective (celle du devis si elle est
      // renseignée, sinon celle transmise par le serveur) est obligatoire, et c'est elle qui est figée.
      const frozenMention = String(q.vat_mention ?? "").trim() || String(args.p_vat_mention ?? "").trim() || null;
      if (q.vat_regime === "FRANCHISE" && !frozenMention) return { data: null, error: { message: "vat_mention_required" } };
      const id = uid();
      const { id: _i, quote_number: _n, status: _s, valid_until: _v, ...copy } = q;
      rows("marketplace_binder_invoices").push({
        ...copy, vat_mention: q.vat_regime === "FRANCHISE" ? frozenMention : q.vat_mention,
        id, quote_id: q.id, binder_id: q.binder_id, issue_date: args.p_issue_date,
        invoice_number: number(q.binder_id, "invoice", Number(String(args.p_issue_date).slice(0, 4))),
        notes: args.p_invoice_notes, issuer: args.p_issuer ?? q.issuer,
        payment_status: "unpaid", amount_paid_cents: 0, deposit_paid_cents: 0,
      });
      rows("marketplace_binder_quote_items")
        .filter((i) => i.quote_id === q.id)
        .forEach((i) => rows("marketplace_binder_invoice_items").push({ ...i, id: uid(), invoice_id: id }));
      q.status = "invoiced";
      return { data: id, error: null };
    }
    throw new Error(`unexpected rpc ${name}`);
  }

  return { sb: { from, rpc } as any, tables, rpcCalls };
}

// ---------------------------------------------------------------------------
// Données
// ---------------------------------------------------------------------------
const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BINDER_A = "a0000000-0000-4000-8000-00000000000a";
const BINDER_B = "b0000000-0000-4000-8000-00000000000b";
const TODAY = "2026-09-19";

const profileInput = (over: Partial<BillingProfileInput> = {}): BillingProfileInput => ({
  workshopName: "Atelier Dorure",
  legalName: "Atelier Dorure SARL",
  addressLine1: "12 rue des Relieurs",
  addressLine2: null,
  postalCode: "45000",
  city: "Orléans",
  country: "FR",
  siret: "123 456 789 00012",
  vatNumber: "FR12345678901",
  legalNotes: "SARL au capital de 5 000 €",
  email: "atelier@example.test",
  phone: "02 00 00 00 00",
  vatRegime: "VAT_LIABLE",
  defaultVatRateBps: 2000,
  vatMention: null,
  quotePrefix: "D",
  invoicePrefix: "F",
  quoteValidityDays: 30,
  paymentTerms: "Paiement à réception",
  quoteNotes: "Devis valable sous réserve d'examen du livre.",
  invoiceNotes: "Pénalités de retard : 3 fois le taux légal.",
  ...over,
});

const line = (label: string, unit: number, over: Record<string, unknown> = {}) => ({
  serviceId: null,
  label,
  description: null,
  unit: null,
  quantity: 1,
  unitPriceCents: unit,
  catalogPriceCents: unit,
  vatRateBps: 2000,
  ...over,
});

const quoteInput = (over: Partial<QuoteInput> = {}): QuoteInput => ({
  clientId: null,
  client: { name: "Mme Durand", email: "durand@example.test", phone: null, addressLine1: "1 rue X", postalCode: "75001", city: "Paris", country: "FR" },
  book: { title: "Les Fleurs du Mal", author: "Baudelaire", heightMm: 220, widthMm: 145, spineMm: 32, notes: null },
  lines: [line("Plein cuir", 28000), line("Nerfs", 3000), line("Dorure titre", 4500), line("Étui", 7500, { catalogPriceCents: null })],
  discount: { type: "NONE" },
  deposit: { type: "PERCENT", bps: 3000 },
  validityDays: null,
  notes: null,
  ...over,
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

// ---------------------------------------------------------------------------

describe("qui est l'atelier de cette session", () => {
  it("un membre actif a son atelier ; personne d'autre n'en a", async () => {
    expect(await requireBinderId(world.sb, ALICE)).toBe(BINDER_A);
    expect(await requireBinderId(world.sb, BOB)).toBe(BINDER_B);
    expect(await codeOf(requireBinderId(world.sb, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"))).toBe("no_binder");
  });

  it("un membre désactivé ou seulement invité n'a pas accès à l'outil", async () => {
    world.tables.marketplace_binder_members[0].account_status = "disabled";
    expect(await codeOf(requireBinderId(world.sb, ALICE))).toBe("no_binder");
    world.tables.marketplace_binder_members[0].account_status = "invited";
    expect(await codeOf(requireBinderId(world.sb, ALICE))).toBe("no_binder");
  });

  it("un simple membre (pas seulement le propriétaire) peut utiliser l'outil", async () => {
    world.tables.marketplace_binder_members.push({ binder_id: BINDER_A, user_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", role: "MEMBER", account_status: "active", created_at: "2026-02-01" });
    expect(await requireBinderId(world.sb, "dddddddd-dddd-4ddd-8ddd-dddddddddddd")).toBe(BINDER_A);
  });
});

describe("profil de facturation", () => {
  it("sans profil : le nom de l'atelier sert de départ, mais AUCUN régime de TVA n'est présumé", async () => {
    const profile = await loadBillingProfile(world.sb, BINDER_A);
    expect(profile.workshopName).toBe("Atelier A");
    expect(profile.vatRegime).toBeNull();
  });

  it("chaque atelier a son profil, et un profil n'en modifie pas un autre", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput({ workshopName: "Atelier Dorure", siret: "111" }));
    await saveBillingProfile(world.sb, BINDER_B, profileInput({ workshopName: "Atelier Cuir", siret: "222", vatRegime: "FRANCHISE", vatMention: "TVA non applicable, art. 293 B du CGI" }));
    expect((await loadBillingProfile(world.sb, BINDER_A)).siret).toBe("111");
    expect((await loadBillingProfile(world.sb, BINDER_B)).vatRegime).toBe("FRANCHISE");
    expect((await loadBillingProfile(world.sb, BINDER_A)).vatRegime).toBe("VAT_LIABLE");
  });
});

describe("catalogue : à l'atelier seul", () => {
  const service = (over = {}) => ({ id: null, categoryId: null, name: "Plein cuir", description: null, unitPriceCents: 28000, vatRateBps: null, unit: null, isActive: true, ...over });

  it("le relieur crée, modifie, désactive et archive ses prestations", async () => {
    const created = await saveService(world.sb, BINDER_A, service());
    expect(created).toMatchObject({ name: "Plein cuir", unitPriceCents: 28000, isActive: true, archived: false });
    const renamed = await saveService(world.sb, BINDER_A, service({ id: created.id, name: "Plein cuir pleine peau", unitPriceCents: 31000, isActive: false }));
    expect(renamed).toMatchObject({ id: created.id, name: "Plein cuir pleine peau", unitPriceCents: 31000, isActive: false });
    await archiveService(world.sb, BINDER_A, created.id);
    expect((await listCatalog(world.sb, BINDER_A)).services).toHaveLength(0);
    expect((await listCatalog(world.sb, BINDER_A, { includeArchived: true })).services[0]).toMatchObject({ archived: true, isActive: false });
  });

  it("le catalogue d'un atelier est invisible et intouchable pour un autre", async () => {
    const a = await saveService(world.sb, BINDER_A, service());
    expect((await listCatalog(world.sb, BINDER_B)).services).toHaveLength(0);
    expect(await codeOf(saveService(world.sb, BINDER_B, service({ id: a.id, name: "Piraté", unitPriceCents: 1 })))).toBe("not_found");
    expect(await codeOf(archiveService(world.sb, BINDER_B, a.id))).toBe("not_found");
    expect((await listCatalog(world.sb, BINDER_A)).services[0]).toMatchObject({ name: "Plein cuir", unitPriceCents: 28000 });
  });

  it("une prestation ne peut pas être rangée dans la catégorie d'un autre atelier", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    await importStarterCatalog(world.sb, BINDER_A);
    const foreignCategory = (await listCatalog(world.sb, BINDER_A)).categories[0].id;
    expect(await codeOf(saveService(world.sb, BINDER_B, service({ categoryId: foreignCategory })))).toBe("invalid_input");
  });

  it("le catalogue de départ : des noms sans prix, inactifs, importé une seule fois, pour cet atelier seulement", async () => {
    expect(await importStarterCatalog(world.sb, BINDER_A)).toEqual({ imported: true });
    const { categories, services } = await listCatalog(world.sb, BINDER_A);
    expect(categories.length).toBe(10);
    expect(services.length).toBeGreaterThan(50);
    expect(services.every((s) => s.unitPriceCents === 0 && s.isActive === false)).toBe(true);
    expect(services.find((s) => s.name === "Plein cuir")?.categoryId).toBe(categories.find((c) => c.name === "Type de reliure")?.id);
    expect(await importStarterCatalog(world.sb, BINDER_A)).toEqual({ imported: false });
    expect((await listCatalog(world.sb, BINDER_A)).services).toHaveLength(services.length);
    expect((await listCatalog(world.sb, BINDER_B)).services).toHaveLength(0);
  });
});

describe("créer un devis", () => {
  it("sans régime de TVA choisi, le devis est refusé AVANT toute écriture — et dit ce qui manque", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: null, workshopName: null, legalName: null }));
    let error: BinderQuotesError | null = null;
    try {
      await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    } catch (e) {
      error = e as BinderQuotesError;
    }
    expect(error?.code).toBe("profile_incomplete");
    expect(error?.missing).toEqual(["Nom de l'atelier", "Régime de TVA"]);
    expect(world.rpcCalls).toHaveLength(0);
    expect(await listClients(world.sb, BINDER_A)).toHaveLength(0);
  });

  it("le scénario du brief : 430 € HT immédiatement, 516 € TTC, numéro, dimensions, acompte 30 %", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    expect(quote.number).toBe("D-2026-0001");
    expect(quote.status).toBe("draft");
    expect(quote.issueDate).toBe(TODAY);
    expect(quote.validUntil).toBe("2026-10-19");
    expect(quote.book).toMatchObject({ title: "Les Fleurs du Mal", heightMm: 220, widthMm: 145, spineMm: 32 });
    expect(quote.items.map((i) => `${i.label} ${i.totalHtCents}`)).toEqual(["Plein cuir 28000", "Nerfs 3000", "Dorure titre 4500", "Étui 7500"]);
    expect(quote.subtotalCents).toBe(43000);
    expect(quote.totalHtCents).toBe(43000);
    expect(quote.totalVatCents).toBe(8600);
    expect(quote.totalTtcCents).toBe(51600);
    expect(quote.depositCents).toBe(15480);
    expect(quote.balanceCents).toBe(51600 - 15480);
    expect(quote.notes).toBe("Devis valable sous réserve d'examen du livre.");
  });

  it("le serveur envoie à la base exactement les colonnes attendues — et des montants qu'il a calculés", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    const call = world.rpcCalls.find((c) => c.name === "marketplace_binder_create_quote")!;
    expect(Object.keys(call.args.p_quote).sort()).toEqual([...QUOTE_ROW_KEYS].sort());
    for (const item of call.args.p_items) expect(Object.keys(item).sort()).toEqual([...QUOTE_ITEM_ROW_KEYS].sort());
    expect(call.args.p_binder_id).toBe(BINDER_A);
    // Le total envoyé est celui du calcul serveur.
    expect(call.args.p_quote.total_ttc_cents).toBe(51600);
    expect(call.args.p_quote).not.toHaveProperty("quote_number");
    expect(call.args.p_quote).not.toHaveProperty("status");
  });

  it("un client créé à la volée est retrouvé pour le devis suivant", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const first = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    const clients = await listClients(world.sb, BINDER_A);
    expect(clients).toHaveLength(1);
    expect(first.client.id).toBe(clients[0].id);
    const second = await createQuote(world.sb, BINDER_A, quoteInput({ clientId: clients[0].id }), TODAY);
    expect(second.number).toBe("D-2026-0002");
    expect(await listClients(world.sb, BINDER_A)).toHaveLength(1);
  });

  it("titre, auteur, notes et dimensions sont facultatifs", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(
      world.sb,
      BINDER_A,
      quoteInput({ book: { title: null, author: null, heightMm: null, widthMm: null, spineMm: null, notes: null }, lines: [line("Réparation", 5500)] }),
      TODAY,
    );
    expect(quote.book).toMatchObject({ title: null, heightMm: null });
    expect(quote.totalTtcCents).toBe(6600);
  });

  it("en franchise en base : aucune TVA, taux enregistrés à 0, mention conservée", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatMention: "TVA non applicable, art. 293 B du CGI" }));
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    expect(quote.vatRegime).toBe("FRANCHISE");
    expect(quote.totalVatCents).toBe(0);
    expect(quote.totalTtcCents).toBe(43000);
    expect(quote.items.every((i) => i.vatRateBps === 0)).toBe(true);
    expect(quote.vatMention).toBe("TVA non applicable, art. 293 B du CGI");
  });

  it("remise en % et en €, ligne libre, acompte fixe", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const pct = await createQuote(world.sb, BINDER_A, quoteInput({ discount: { type: "PERCENT", bps: 1000 } }), TODAY);
    expect(pct).toMatchObject({ discountType: "PERCENT", discountValue: 1000, discountCents: 4300, totalHtCents: 38700, totalTtcCents: 46440 });
    const eur = await createQuote(world.sb, BINDER_A, quoteInput({ discount: { type: "AMOUNT", cents: 3000 }, deposit: { type: "AMOUNT", cents: 10000 } }), TODAY);
    expect(eur).toMatchObject({ discountCents: 3000, totalHtCents: 40000, depositCents: 10000 });
    const free = await createQuote(world.sb, BINDER_A, quoteInput({ lines: [...quoteInput().lines, line("Réparation particulière du premier cahier", 5500, { catalogPriceCents: null })] }), TODAY);
    expect(free.totalHtCents).toBe(48500);
    expect(free.items.at(-1)).toMatchObject({ serviceId: null, catalogPriceCents: null, label: "Réparation particulière du premier cahier" });
  });
});

describe("snapshots : le catalogue et le profil ne réécrivent jamais un devis", () => {
  it("un prix modifié pour CE devis ne touche pas le catalogue (280 € → 340 €)", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const plein = await saveService(world.sb, BINDER_A, { id: null, categoryId: null, name: "Plein cuir", description: null, unitPriceCents: 28000, vatRateBps: null, unit: null, isActive: true });
    const quote = await createQuote(
      world.sb,
      BINDER_A,
      quoteInput({ lines: [line("Plein cuir", 34000, { serviceId: plein.id, catalogPriceCents: 28000 })] }),
      TODAY,
    );
    expect(quote.items[0]).toMatchObject({ unitPriceCents: 34000, catalogPriceCents: 28000, serviceId: plein.id });
    expect((await listCatalog(world.sb, BINDER_A)).services[0].unitPriceCents).toBe(28000);
  });

  it("changer, renommer ou archiver la prestation plus tard ne change pas l'ancien devis", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const plein = await saveService(world.sb, BINDER_A, { id: null, categoryId: null, name: "Plein cuir", description: null, unitPriceCents: 28000, vatRateBps: null, unit: null, isActive: true });
    const quote = await createQuote(world.sb, BINDER_A, quoteInput({ lines: [line("Plein cuir", 28000, { serviceId: plein.id })] }), TODAY);

    await saveService(world.sb, BINDER_A, { id: plein.id, categoryId: null, name: "Reliure pleine peau", description: null, unitPriceCents: 99900, vatRateBps: null, unit: null, isActive: true });
    await archiveService(world.sb, BINDER_A, plein.id);

    const again = await getQuote(world.sb, BINDER_A, quote.id);
    expect(again.items[0]).toMatchObject({ label: "Plein cuir", unitPriceCents: 28000, totalHtCents: 28000 });
    expect(again.totalTtcCents).toBe(33600);
  });

  it("changer le profil (adresse, régime, mentions) ne change pas un devis déjà créé", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    await saveBillingProfile(world.sb, BINDER_A, profileInput({ workshopName: "Nouveau nom", addressLine1: "Ailleurs", vatRegime: "FRANCHISE", vatMention: "Franchise" }));
    const again = await getQuote(world.sb, BINDER_A, quote.id);
    expect(again.issuer.workshopName).toBe("Atelier Dorure");
    expect(again.issuer.addressLine1).toBe("12 rue des Relieurs");
    expect(again.vatRegime).toBe("VAT_LIABLE");
    expect(again.totalVatCents).toBe(8600);
  });
});

describe("deux relieurs, deux mondes", () => {
  it("un relieur ne voit, ne modifie ni ne fait avancer le devis d'un autre — introuvable, comme un identifiant inexistant", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    await saveBillingProfile(world.sb, BINDER_B, profileInput({ workshopName: "Atelier B" }));
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    const ghost = "99999999-9999-4999-8999-999999999999";

    expect(await listQuotes(world.sb, BINDER_B)).toEqual([]);
    expect(await codeOf(getQuote(world.sb, BINDER_B, quote.id))).toBe("not_found");
    expect(await codeOf(getQuote(world.sb, BINDER_B, ghost))).toBe("not_found");
    expect(await codeOf(updateQuote(world.sb, BINDER_B, quote.id, quoteInput()))).toBe("not_found");
    expect(await codeOf(setQuoteStatus(world.sb, BINDER_B, quote.id, "accepted"))).toBe("not_found");
    expect(await codeOf(convertQuoteToInvoice(world.sb, BINDER_B, quote.id, TODAY))).toBe("not_found");
    // …et rien n'a bougé chez A.
    const mine = await getQuote(world.sb, BINDER_A, quote.id);
    expect(mine.status).toBe("draft");
    expect(mine.client.name).toBe("Mme Durand");
  });

  it("chacun a sa propre numérotation, ses clients et ses factures", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    await saveBillingProfile(world.sb, BINDER_B, profileInput({ quotePrefix: "DEVIS", invoicePrefix: "FAC" }));
    const a = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    const b = await createQuote(world.sb, BINDER_B, quoteInput({ client: { ...quoteInput().client, name: "M. Bernard" } }), TODAY);
    expect(a.number).toBe("D-2026-0001");
    expect(b.number).toBe("DEVIS-2026-0001");
    expect((await listClients(world.sb, BINDER_A)).map((c) => c.name)).toEqual(["Mme Durand"]);
    expect((await listClients(world.sb, BINDER_B)).map((c) => c.name)).toEqual(["M. Bernard"]);
    await setQuoteStatus(world.sb, BINDER_A, a.id, "accepted");
    const invoice = await convertQuoteToInvoice(world.sb, BINDER_A, a.id, TODAY);
    expect(await listInvoices(world.sb, BINDER_B)).toEqual([]);
    expect(await codeOf(getInvoice(world.sb, BINDER_B, invoice.id))).toBe("not_found");
  });

  it("le client ou la prestation d'un autre atelier ne peuvent pas être attachés à un devis", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    await saveBillingProfile(world.sb, BINDER_B, profileInput());
    const foreignClient = await saveClient(world.sb, BINDER_A, { id: null, name: "Client de A", email: null, phone: null, addressLine1: null, postalCode: null, city: null, country: null, notes: null });
    const foreignService = await saveService(world.sb, BINDER_A, { id: null, categoryId: null, name: "Prestation de A", description: null, unitPriceCents: 100, vatRateBps: null, unit: null, isActive: true });
    expect(await codeOf(createQuote(world.sb, BINDER_B, quoteInput({ clientId: foreignClient.id }), TODAY))).toBe("not_found");
    expect(await codeOf(createQuote(world.sb, BINDER_B, quoteInput({ lines: [line("X", 100, { serviceId: foreignService.id })] }), TODAY))).toBe("invalid_input");
    expect(await listQuotes(world.sb, BINDER_B)).toEqual([]);
    expect(await listClients(world.sb, BINDER_B)).toEqual([]);
  });

  it("tout accès aux données porte le filtre d'atelier : lecture du code de la couche serveur", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(process.cwd(), "src/marketplace/services/binderQuotes.server.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // Chaque accès à une table de l'outil (ou à l'atelier lui-même) est écrit avec `binderId`
    // dans la même chaîne d'appel : filtre `eq`, valeur insérée, ou argument de la fonction SQL.
    // Une « chaîne » commence à chaque `sb.from(` / `sb.rpc(` du client typé.
    const chains = src.split(/\bsb\s*\.(?=from\(|rpc\()/).slice(1);
    let checked = 0;
    for (const chain of chains) {
      const stop = chain.search(/;\s*\n/);
      const text = chain.slice(0, stop > 0 ? stop : 700);
      if (!/marketplace_binder|\.rpc\(/.test(text)) continue;
      checked += 1;
      // Seule exception : l'import du catalogue de départ insère des lignes construites juste
      // au-dessus, chacune avec `binder_id: binderId` (vérifié ci-dessous).
      if (text.includes(".insert(rows)")) {
        expect(src).toMatch(/const rows = STARTER_CATALOG\.flatMap[\s\S]{0,200}binder_id: binderId/);
        continue;
      }
      expect(text, text.slice(0, 140)).toContain("binderId");
    }
    expect(checked).toBeGreaterThan(30);
  });
});

describe("statuts et modification", () => {
  it("brouillon → envoyé → accepté ; une transition interdite est refusée ; « facturé » ne se demande jamais", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    expect((await setQuoteStatus(world.sb, BINDER_A, quote.id, "sent")).status).toBe("sent");
    expect(await codeOf(setQuoteStatus(world.sb, BINDER_A, quote.id, "draft"))).toBe("conflict");
    expect(await codeOf(setQuoteStatus(world.sb, BINDER_A, quote.id, "invoiced"))).toBe("conflict");
    expect(await codeOf(setQuoteStatus(world.sb, BINDER_A, quote.id, "nonsense"))).toBe("invalid_input");
    expect((await setQuoteStatus(world.sb, BINDER_A, quote.id, "accepted")).status).toBe("accepted");
  });

  it("un brouillon se modifie (numéro et date inchangés) ; un devis envoyé est figé", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    const edited = await updateQuote(world.sb, BINDER_A, quote.id, quoteInput({ lines: [line("Demi-toile", 12000)] }));
    expect(edited.number).toBe(quote.number);
    expect(edited.issueDate).toBe(quote.issueDate);
    expect(edited.items.map((i) => i.label)).toEqual(["Demi-toile"]);
    expect(edited.totalHtCents).toBe(12000);
    await setQuoteStatus(world.sb, BINDER_A, quote.id, "sent");
    expect(await codeOf(updateQuote(world.sb, BINDER_A, quote.id, quoteInput()))).toBe("conflict");
    expect((await getQuote(world.sb, BINDER_A, quote.id)).items.map((i) => i.label)).toEqual(["Demi-toile"]);
  });
});

describe("devis accepté → facture", () => {
  async function acceptedQuote() {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    await setQuoteStatus(world.sb, BINDER_A, quote.id, "accepted");
    return quote;
  }

  it("un devis non accepté est refusé AVANT de parler d'identité : le relieur lit la vraie raison", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput({ siret: null, addressLine1: null }));
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    // Brouillon + profil incomplet : le blocage est le statut, pas le SIRET.
    expect(await codeOf(convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY))).toBe("conflict");
  });

  it("un devis envoyé (figé) ne peut plus être modifié, même si la base ne l'imposait pas", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    await setQuoteStatus(world.sb, BINDER_A, quote.id, "sent");
    const before = world.rpcCalls.length;
    expect(await codeOf(updateQuote(world.sb, BINDER_A, quote.id, quoteInput({ lines: [line("Autre", 1)] })))).toBe("conflict");
    // Le serveur refuse avant même d'appeler la fonction SQL de modification.
    expect(world.rpcCalls.slice(before).some((c) => c.name === "marketplace_binder_update_quote")).toBe(false);
  });

  it("seul un devis accepté se convertit", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    expect(await codeOf(convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY))).toBe("conflict");
    await setQuoteStatus(world.sb, BINDER_A, quote.id, "refused");
    expect(await codeOf(convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY))).toBe("conflict");
  });

  it("la facture reprend client, ouvrage, dimensions, lignes, prix, TVA, total et acompte — sans ressaisie", async () => {
    const quote = await acceptedQuote();
    const invoice = await convertQuoteToInvoice(world.sb, BINDER_A, quote.id, "2026-09-25");
    expect(invoice.kind).toBe("invoice");
    expect(invoice.client).toMatchObject({ name: "Mme Durand", city: "Paris" });
    expect(invoice.book).toMatchObject({ title: "Les Fleurs du Mal", heightMm: 220, widthMm: 145, spineMm: 32 });
    expect(invoice.items.map((i) => [i.label, i.unitPriceCents, i.vatRateBps, i.totalHtCents])).toEqual([
      ["Plein cuir", 28000, 2000, 28000],
      ["Nerfs", 3000, 2000, 3000],
      ["Dorure titre", 4500, 2000, 4500],
      ["Étui", 7500, 2000, 7500],
    ]);
    expect([invoice.totalHtCents, invoice.totalVatCents, invoice.totalTtcCents]).toEqual([43000, 8600, 51600]);
    expect([invoice.depositCents, invoice.balanceCents]).toEqual([15480, 36120]);
    expect(invoice.issueDate).toBe("2026-09-25");
  });

  it("un numéro de facture distinct, et le lien « facture issue du devis X » dans les deux sens", async () => {
    const quote = await acceptedQuote();
    const invoice = await convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY);
    expect(invoice.number).toBe("F-2026-0001");
    expect(invoice.number).not.toBe(quote.number);
    expect(invoice.linkedQuoteId).toBe(quote.id);
    expect(invoice.linkedQuoteNumber).toBe(quote.number);
    const after = await getQuote(world.sb, BINDER_A, quote.id);
    expect(after.status).toBe("invoiced");
    expect(after.linkedInvoiceId).toBe(invoice.id);
    expect(after.linkedInvoiceNumber).toBe("F-2026-0001");
    expect(invoice.payment).toEqual({ status: "unpaid", amountPaidCents: 0, depositPaidCents: 0 });
  });

  it("un devis n'est facturé qu'une fois", async () => {
    const quote = await acceptedQuote();
    await convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY);
    expect(await codeOf(convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY))).toBe("conflict");
    expect(await listInvoices(world.sb, BINDER_A)).toHaveLength(1);
  });

  it("une facture exige l'identité complète : adresse, SIRET, TVA — un devis, non", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput({ addressLine1: null, siret: null, vatNumber: null }));
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY); // le devis, lui, n'est pas bloqué
    await setQuoteStatus(world.sb, BINDER_A, quote.id, "accepted");
    let error: BinderQuotesError | null = null;
    try {
      await convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY);
    } catch (e) {
      error = e as BinderQuotesError;
    }
    expect(error?.code).toBe("profile_incomplete");
    expect(error?.missing).toEqual(["Adresse", "SIRET", "Numéro de TVA"]);
    expect((await getQuote(world.sb, BINDER_A, quote.id)).status).toBe("accepted");
    expect(await listInvoices(world.sb, BINDER_A)).toHaveLength(0);
  });

  it("en franchise, la facture exige la mention (et pas de numéro de TVA)", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatNumber: null, vatMention: null }));
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    await setQuoteStatus(world.sb, BINDER_A, quote.id, "accepted");
    await expect(convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY)).rejects.toMatchObject({ code: "profile_incomplete", missing: ["Mention de TVA"] });
  });

  describe("P1-8 — la mention de franchise est figée dans la facture", () => {
    const MENTION = "TVA non applicable, art. 293 B du CGI";
    const franchiseQuoteWithoutMention = async () => {
      await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatNumber: null, vatMention: null }));
      const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
      expect(quote.vatMention).toBeNull(); // un devis se chiffre sans administratif
      await setQuoteStatus(world.sb, BINDER_A, quote.id, "accepted");
      return quote;
    };

    it("devis en franchise sans mention → profil complété → conversion : la mention est dans la facture", async () => {
      const quote = await franchiseQuoteWithoutMention();
      await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatNumber: null, vatMention: MENTION }));

      const invoice = await convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY);

      expect(invoice.vatRegime).toBe("FRANCHISE");
      expect(invoice.vatMention).toBe(MENTION);
      // …et elle est effectivement imprimée sur le PDF de la facture.
      expect((await renderDocumentPdf(invoice)).printed.join("\n")).toContain(MENTION);
      // Relue depuis la base : figée, pas recalculée à l'affichage.
      expect((await getInvoice(world.sb, BINDER_A, invoice.id)).vatMention).toBe(MENTION);
    });

    it("la mention figée ne bouge plus quand le profil change ensuite", async () => {
      const quote = await franchiseQuoteWithoutMention();
      await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatNumber: null, vatMention: MENTION }));
      const invoice = await convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY);
      await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatNumber: null, vatMention: "Autre texte" }));
      expect((await getInvoice(world.sb, BINDER_A, invoice.id)).vatMention).toBe(MENTION);
    });

    it("la mention déjà portée par le devis prime sur celle du profil", async () => {
      await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatNumber: null, vatMention: "Mention du devis" }));
      const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
      await setQuoteStatus(world.sb, BINDER_A, quote.id, "accepted");
      await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatNumber: null, vatMention: "Mention du profil" }));
      expect((await convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY)).vatMention).toBe("Mention du devis");
    });

    it("une mention de devis blanche est traitée comme absente", async () => {
      const quote = await franchiseQuoteWithoutMention();
      world.tables.marketplace_binder_quotes.find((r) => r.id === quote.id)!.vat_mention = "   ";
      await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatNumber: null, vatMention: MENTION }));
      expect((await convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY)).vatMention).toBe(MENTION);
    });

    it("sans mention nulle part : refus, aucune facture, aucun numéro consommé", async () => {
      const quote = await franchiseQuoteWithoutMention();
      await expect(convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY)).rejects.toMatchObject({ code: "profile_incomplete", missing: ["Mention de TVA"] });
      expect(await listInvoices(world.sb, BINDER_A)).toHaveLength(0);
      expect((await getQuote(world.sb, BINDER_A, quote.id)).status).toBe("accepted");
    });

    it("le serveur transmet la mention effective à la fonction SQL", async () => {
      const quote = await franchiseQuoteWithoutMention();
      await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatNumber: null, vatMention: MENTION }));
      await convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY);
      const call = world.rpcCalls.find((c) => c.name === "marketplace_binder_convert_quote_to_invoice");
      expect(call?.args.p_vat_mention).toBe(MENTION);
    });

    it("un devis assujetti à la TVA n'est pas touché : pas de mention inventée", async () => {
      await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatMention: "Texte du profil" }));
      const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
      await setQuoteStatus(world.sb, BINDER_A, quote.id, "accepted");
      const invoice = await convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY);
      expect(invoice.vatRegime).toBe("VAT_LIABLE");
      expect(invoice.vatMention).toBe(quote.vatMention);
    });
  });

  it("l'identité de l'émetteur sur la facture est celle du jour de la facture", async () => {
    const quote = await acceptedQuote();
    await saveBillingProfile(world.sb, BINDER_A, profileInput({ addressLine1: "3 place Neuve" }));
    const invoice = await convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY);
    expect(invoice.issuer.addressLine1).toBe("3 place Neuve");
    expect(invoice.notes).toBe("Pénalités de retard : 3 fois le taux légal.");
  });
});

describe("PDF", () => {
  const decode = (base64: string) => Buffer.from(base64, "base64");

  it("un devis PDF valide, avec tout ce que le brief demande", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    const pdf = await renderDocumentPdf(quote);
    expect(decode(pdf.base64).subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.pageCount).toBe(1);
    const text = pdf.printed.join("\n");
    for (const expected of [
      "Atelier Dorure", "SIRET 123 456 789 00012", "TVA FR12345678901", "DEVIS", "N° D-2026-0001", "Date : 19/09/2026",
      "Valable jusqu'au 19/10/2026", "Mme Durand", "Les Fleurs du Mal", "220 × 145 × 32 mm", "Plein cuir", "280,00 €", "Nerfs", "30,00 €",
      "Dorure titre", "Étui", "Total HT", "430,00 €", "TVA 20 %", "86,00 €", "Total TTC", "516,00 €", "Acompte demandé (30 %)", "154,80 €",
      "Solde restant", "361,20 €", "Paiement à réception", "Bon pour accord",
    ]) {
      expect(text, expected).toContain(expected);
    }
  });

  it("une facture PDF porte son numéro et le lien vers son devis", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    await setQuoteStatus(world.sb, BINDER_A, quote.id, "accepted");
    const invoice = await convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY);
    const text = (await renderDocumentPdf(invoice)).printed.join("\n");
    expect(text).toContain("FACTURE");
    expect(text).toContain("N° F-2026-0001");
    expect(text).toContain("Facture issue du devis D-2026-0001");
    expect(text).toContain("Pénalités de retard");
    expect(text).not.toContain("Valable jusqu'au");
    expect(text).not.toContain("Bon pour accord");
  });

  it("en franchise : pas de colonne ni de ligne de TVA, la mention est imprimée", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatMention: "TVA non applicable, art. 293 B du CGI" }));
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    const text = (await renderDocumentPdf(quote)).printed.join("\n");
    expect(text).toContain("TVA non applicable, art. 293 B du CGI");
    expect(text).toContain("Total à payer");
    expect(text).not.toMatch(/TVA 20 %|^TVA$/m);
  });

  it("un texte accentué, des espaces insécables, un emoji : jamais d'échec de génération", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(
      world.sb,
      BINDER_A,
      quoteInput({ client: { ...quoteInput().client, name: "Éloïse Œuvre & fils 😀" }, lines: [line("Réfection « couverture » d’origine", 1234567)] }),
      TODAY,
    );
    const pdf = await renderDocumentPdf(quote);
    expect(pdf.printed.join("\n")).toContain("12 345,67 €");
    expect(pdf.printed.join("\n")).toContain("Éloïse Œuvre & fils ?");
  });

  it("un long devis passe sur plusieurs pages, pied de page compris", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const lines = Array.from({ length: 60 }, (_, i) => line(`Prestation ${i + 1}`, 1000 + i, { description: "Une description un peu longue pour occuper plusieurs lignes dans la colonne de désignation du devis." }));
    const quote = await createQuote(world.sb, BINDER_A, quoteInput({ lines }), TODAY);
    const pdf = await renderDocumentPdf(quote);
    expect(pdf.pageCount).toBeGreaterThan(1);
    expect(pdf.printed.filter((t) => /page \d+\/\d+/.test(t))).toHaveLength(pdf.pageCount);
    expect(pdf.printed.join("\n")).toContain("Prestation 60");
  });
});
