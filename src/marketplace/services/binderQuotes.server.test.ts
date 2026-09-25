/**
 * L'outil devis → facture, avec un faux client Supabase en mémoire qui applique
 * les filtres comme la base (`eq`, `in`) et émule les quatre fonctions SQL. Les
 * fonctions SQL réelles (numérotation, atomicité, immuabilité, isolation par
 * rôle) sont vérifiées séparément sur un vrai Postgres — voir le compte rendu de
 * la PR — ; ici on teste ce que le SERVEUR envoie et comment il isole deux
 * ateliers l'un de l'autre.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- le faux client Supabase est volontairement non typé */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import {
  archiveService,
  attachOperationPhotoToQuoteItem,
  BinderQuotesError,
  clearDocumentLogo,
  convertQuoteToInvoice,
  createQuote,
  getInvoice,
  getQuote,
  issueInvoice,
  listCatalog,
  listClients,
  listInvoices,
  listQuotes,
  loadBillingProfile,
  requireBinderId,
  requireLeadApprovedBinderId,
  saveBillingProfile,
  saveCategory,
  saveClient,
  saveService,
  setQuoteStatus,
  updateQuote,
  updateInvoiceDraft,
  uploadDocumentLogo,
  uploadQuoteItemPhoto,
} from "./binderQuotes.server";
import { deleteOperationPhoto, listOperationPhotos, updateOperationPhotoCaption, uploadOperationPhoto } from "./binderOperationPhotos.server";
import { QUOTE_OPERATION_PHOTOS_BUCKET } from "@/marketplace/quotes/quotePhotos";
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
  const storageFiles = new Map<string, Uint8Array>();
  let seq = 0;
  const uid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const rows = (t: string) => (tables[t] ??= []);

  function from(table: string) {
    let op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
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
        if (op === "delete") tables[table] = rows(table).filter((r) => !result.includes(r));
        if (order) result = [...result].sort((a, b) => (a[order!.col] > b[order!.col] ? 1 : -1) * (order!.asc ? 1 : -1));
        result = result.slice(0, max);
      }
      return result.map((r) => ({ ...r }));
    };

    const q: any = {
      select: () => q,
      insert: (v: any) => ((op = "insert"), (values = v), q),
      update: (v: any) => ((op = "update"), (values = v), q),
      delete: () => ((op = "delete"), q),
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
    if (name === "marketplace_binder_create_invoice_draft") {
      const q = rows("marketplace_binder_quotes").find((r) => r.id === args.p_quote_id && r.binder_id === args.p_binder_id);
      if (!q) return { data: null, error: { message: "quote_not_found" } };
      if (q.status !== "accepted") return { data: null, error: { message: "quote_not_accepted" } };
      const existing = rows("marketplace_binder_invoices").find((r) => r.quote_id === q.id && r.binder_id === q.binder_id);
      if (existing) return { data: existing.id, error: null };
      const id = uid();
      const { id: _i, quote_number: _n, status: _s, valid_until: _v, ...copy } = q;
      rows("marketplace_binder_invoices").push({
        ...copy, ...args.p_draft,
        id, quote_id: q.id, binder_id: q.binder_id, invoice_number: null, status: "draft", issued_at: null,
        payment_status: "unpaid", amount_paid_cents: 0, deposit_paid_cents: 0,
        legal_mentions: [],
      });
      rows("marketplace_binder_quote_items")
        .filter((i) => i.quote_id === q.id)
        .forEach((i) => rows("marketplace_binder_invoice_items").push({ ...i, id: uid(), invoice_id: id }));
      return { data: id, error: null };
    }
    if (name === "marketplace_binder_update_invoice_draft") {
      const invoice = rows("marketplace_binder_invoices").find((r) => r.id === args.p_invoice_id && r.binder_id === args.p_binder_id && r.status === "draft");
      if (!invoice) return { data: null, error: { message: "invoice_draft_not_found" } };
      Object.assign(invoice, args.p_draft);
      return { data: invoice.id, error: null };
    }
    if (name === "marketplace_binder_issue_invoice") {
      const invoice = rows("marketplace_binder_invoices").find((r) => r.id === args.p_invoice_id && r.binder_id === args.p_binder_id);
      if (!invoice) return { data: null, error: { message: "invoice_not_found" } };
      if (invoice.status === "issued") return { data: invoice.id, error: null };
      invoice.invoice_number = number(invoice.binder_id, "invoice", Number(String(invoice.issue_date).slice(0, 4)));
      invoice.status = "issued";
      invoice.issued_at = "2026-09-19T10:00:00Z";
      invoice.legal_mentions = args.p_legal_mentions;
      const quote = rows("marketplace_binder_quotes").find((r) => r.id === invoice.quote_id);
      if (quote) quote.status = "invoiced";
      return { data: invoice.id, error: null };
    }
    throw new Error(`unexpected rpc ${name}`);
  }

  const storage = {
    from: (bucket: string) => ({
      upload: async (path: string, bytes: Uint8Array) => {
        const key = `${bucket}/${path}`;
        if (storageFiles.has(key)) return { error: { message: "exists" } };
        storageFiles.set(key, bytes);
        return { error: null };
      },
      remove: async (paths: string[]) => {
        paths.forEach((path) => storageFiles.delete(`${bucket}/${path}`));
        return { error: null };
      },
      copy: async (fromPath: string, toPath: string) => {
        const source = storageFiles.get(`${bucket}/${fromPath}`);
        if (!source) return { error: { message: "not found" } };
        if (storageFiles.has(`${bucket}/${toPath}`)) return { error: { message: "exists" } };
        storageFiles.set(`${bucket}/${toPath}`, source);
        return { error: null };
      },
      createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://storage.example/${bucket}/${path}` }, error: null }),
    }),
  };

  return { sb: { from, rpc, storage } as any, tables, rpcCalls, storageFiles };
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
  binderName: null,
  legalName: "Atelier Dorure SARL",
  legalForm: "SARL",
  shareCapital: "5 000 €",
  siren: "123 456 789",
  addressLine1: "12 rue des Relieurs",
  addressLine2: null,
  postalCode: "45000",
  city: "Orléans",
  country: "FR",
  siret: "123 456 789 00012",
  vatNumber: "FR12345678901",
  vatOnDebits: false,
  legalNotes: "SARL au capital de 5 000 €",
  email: "atelier@example.test",
  phone: "02 00 00 00 00",
  website: null,
  documentAccentColor: "#7A2230",
  documentFooter: null,
  vatRegime: "VAT_LIABLE",
  defaultVatRateBps: 2000,
  vatMention: null,
  quotePrefix: "D",
  invoicePrefix: "F",
  quoteValidityDays: 30,
  paymentTerms: "Paiement à réception",
  paymentDelayDays: 30,
  earlyPaymentDiscountTerms: "Pas d'escompte pour paiement anticipé.",
  latePenaltyTerms: "Pénalités de retard : 3 fois le taux légal.",
  iban: null,
  quoteNotes: "Devis valable sous réserve d'examen du livre.",
  invoiceNotes: "Pénalités de retard : 3 fois le taux légal.",
  ...over,
});

let testLineSequence = 0;
const line = (label: string, unit: number, over: Record<string, unknown> = {}) => ({
  lineKey: `test-line-${++testLineSequence}`,
  blockKey: "format-principal",
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
  blocks: [{ key: "format-principal", label: "Format principal", bookCount: 1, heightMm: 220, widthMm: 145, spineMm: 32 }],
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
    { id: BINDER_A, workshop_name: "Atelier A", display_name: "A", city: "Orléans", postal_code: "45000", status: "approved" },
    { id: BINDER_B, workshop_name: "Atelier B", display_name: "B", city: "Lyon", postal_code: "69000", status: "approved" },
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

describe("autorisation admin pour les leads", () => {
  it("un atelier en attente garde ses outils privés mais n'accède pas aux leads", async () => {
    world.tables.marketplace_binders[0].status = "pending_review";
    expect(await requireBinderId(world.sb, ALICE)).toBe(BINDER_A);
    expect(await codeOf(requireLeadApprovedBinderId(world.sb, ALICE))).toBe("no_binder");
    world.tables.marketplace_binders[0].status = "approved";
    expect(await requireLeadApprovedBinderId(world.sb, ALICE)).toBe(BINDER_A);
    world.tables.marketplace_binders[0].status = "suspended";
    expect(await codeOf(requireLeadApprovedBinderId(world.sb, ALICE))).toBe("no_binder");
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

  it("ajoute, remplace et retire le logo sans casser le snapshot d'un devis existant", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const first = await uploadDocumentLogo(world.sb, BINDER_A, { mimeType: "image/png", imageBase64: Buffer.from("logo-a").toString("base64") });
    expect(first.logoStoragePath).toMatch(new RegExp(`^${BINDER_A}/.+\\.png$`));
    expect(first.logoUrl).toContain("marketplace-binder-document-logos");
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);

    const second = await uploadDocumentLogo(world.sb, BINDER_A, { mimeType: "image/jpeg", imageBase64: Buffer.from("logo-b").toString("base64") });
    expect(second.logoStoragePath).not.toBe(first.logoStoragePath);
    expect(world.storageFiles.size).toBe(2);
    const cleared = await clearDocumentLogo(world.sb, BINDER_A);
    expect(cleared.logoStoragePath).toBeNull();
    expect(cleared.logoUrl).toBeNull();
    expect(world.storageFiles.size).toBe(2);

    const historical = await getQuote(world.sb, BINDER_A, quote.id);
    expect(historical.issuer.logoStoragePath).toBe(first.logoStoragePath);
    expect(historical.issuer.logoUrl).toContain(first.logoStoragePath);
  });

  it("refuse un logo hors format ou au-delà de 2 Mo avant tout stockage", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    await expect(uploadDocumentLogo(world.sb, BINDER_A, { mimeType: "image/gif" as "image/png", imageBase64: Buffer.from("gif").toString("base64") })).rejects.toMatchObject({ code: "invalid_input" });
    await expect(uploadDocumentLogo(world.sb, BINDER_A, { mimeType: "image/png", imageBase64: Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64") })).rejects.toMatchObject({ code: "invalid_input" });
    expect(world.storageFiles.size).toBe(0);
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
    const foreignCategory = (await saveCategory(world.sb, BINDER_A, { id: null, name: "Étuis", sortOrder: 0 })).id;
    expect(await codeOf(saveService(world.sb, BINDER_B, service({ categoryId: foreignCategory })))).toBe("invalid_input");
  });

  it("il n'existe plus d'import massif : un catalogue neuf est vide, et le reste zéro prestation configurée", async () => {
    expect((await listCatalog(world.sb, BINDER_A)).services).toHaveLength(0);
    expect((await listCatalog(world.sb, BINDER_A)).categories).toHaveLength(0);
    const server = await import("./binderQuotes.server");
    expect(Object.keys(server)).not.toContain("importStarterCatalog");
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
      expect(text, text.slice(0, 140)).toContain("binderId");
    }
    // Un plancher, pas un compte exact : il garantit seulement que la lecture du code a trouvé de vraies
    // requêtes (le catalogue de départ, retiré en PR 2a, en comptait quatre de plus).
    expect(checked).toBeGreaterThan(25);
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

  async function issuedInvoice(quoteId: string, date = TODAY) {
    const draft = await convertQuoteToInvoice(world.sb, BINDER_A, quoteId, date);
    await updateInvoiceDraft(world.sb, BINDER_A, draft.id, {
      issueDate: date,
      serviceDate: date,
      dueDate: "2026-10-19",
      operationNature: "services",
      clientType: "business",
      clientName: draft.client.name,
      clientLegalName: draft.client.name,
      clientEmail: draft.client.email,
      clientPhone: draft.client.phone,
      clientAddressLine1: draft.client.addressLine1,
      clientPostalCode: draft.client.postalCode,
      clientCity: draft.client.city,
      clientCountry: draft.client.country,
      clientBillingAddressLine1: draft.client.addressLine1,
      clientBillingPostalCode: draft.client.postalCode,
      clientBillingCity: draft.client.city,
      clientBillingCountry: draft.client.country,
      clientSiren: null,
      clientVatNumber: null,
      clientPurchaseOrderNumber: null,
      clientPublicServiceCode: null,
      clientPublicCommitmentNumber: null,
      deliveryAddressLine1: null,
      deliveryPostalCode: null,
      deliveryCity: null,
      deliveryCountry: null,
      paymentTerms: "Paiement à réception",
      earlyPaymentDiscountTerms: "Pas d'escompte pour paiement anticipé.",
      latePenaltyTerms: "Pénalités de retard : 3 fois le taux légal.",
      notes: draft.notes,
    });
    return issueInvoice(world.sb, BINDER_A, draft.id);
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
    const draft = await convertQuoteToInvoice(world.sb, BINDER_A, quote.id, "2026-09-25");
    expect(draft.status).toBe("draft");
    expect(draft.number).toBe("Brouillon");
    const invoice = await issuedInvoice(quote.id, "2026-09-25");
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
    const invoice = await issuedInvoice(quote.id);
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
    const first = await issuedInvoice(quote.id);
    const second = await issueInvoice(world.sb, BINDER_A, first.id);
    expect(second.number).toBe(first.number);
    expect(await listInvoices(world.sb, BINDER_A)).toHaveLength(1);
  });

  it("la liste des factures porte l'échéance, et une facture annulée par avoir n'y attend plus de paiement", async () => {
    const invoice = await issuedInvoice((await acceptedQuote()).id);
    expect(await listInvoices(world.sb, BINDER_A)).toEqual([
      expect.objectContaining({ id: invoice.id, status: "unpaid", dueDate: "2026-10-19" }),
    ]);
    world.tables.marketplace_binder_invoices.find((row) => row.id === invoice.id)!.status = "credited";
    expect((await listInvoices(world.sb, BINDER_A))[0].status).toBe("credited");
  });

  it("une facture exige l'identité complète : adresse, SIRET, TVA — un devis, non", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput({ addressLine1: null, siret: null, vatNumber: null }));
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY); // le devis, lui, n'est pas bloqué
    await setQuoteStatus(world.sb, BINDER_A, quote.id, "accepted");
    let error: BinderQuotesError | null = null;
    try {
      const draft = await convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY);
      await issueInvoice(world.sb, BINDER_A, draft.id);
    } catch (e) {
      error = e as BinderQuotesError;
    }
    expect(error?.code).toBe("profile_incomplete");
    expect(error?.missing).toEqual(expect.arrayContaining(["SIRET atelier manquant", "Adresse atelier manquante", "Numéro de TVA atelier manquant"]));
    expect((await getQuote(world.sb, BINDER_A, quote.id)).status).toBe("accepted");
    expect(await listInvoices(world.sb, BINDER_A)).toHaveLength(1);
  });

  it("en franchise, la facture exige la mention (et pas de numéro de TVA)", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatNumber: null, vatMention: null }));
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    await setQuoteStatus(world.sb, BINDER_A, quote.id, "accepted");
    const draft = await convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY);
    await expect(issueInvoice(world.sb, BINDER_A, draft.id)).rejects.toMatchObject({ code: "profile_incomplete", missing: expect.arrayContaining(["Mention de TVA manquante"]) });
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

      const invoice = await issuedInvoice(quote.id);

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
      const invoice = await issuedInvoice(quote.id);
      await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatNumber: null, vatMention: "Autre texte" }));
      expect((await getInvoice(world.sb, BINDER_A, invoice.id)).vatMention).toBe(MENTION);
    });

    it("la mention déjà portée par le devis prime sur celle du profil", async () => {
      await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatNumber: null, vatMention: "Mention du devis" }));
      const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
      await setQuoteStatus(world.sb, BINDER_A, quote.id, "accepted");
      await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatNumber: null, vatMention: "Mention du profil" }));
      expect((await issuedInvoice(quote.id)).vatMention).toBe("Mention du devis");
    });

    it("une mention de devis blanche est traitée comme absente", async () => {
      const quote = await franchiseQuoteWithoutMention();
      world.tables.marketplace_binder_quotes.find((r) => r.id === quote.id)!.vat_mention = "   ";
      await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatNumber: null, vatMention: MENTION }));
      expect((await issuedInvoice(quote.id)).vatMention).toBe(MENTION);
    });

    it("sans mention nulle part : refus, aucune facture, aucun numéro consommé", async () => {
      const quote = await franchiseQuoteWithoutMention();
      await expect(issuedInvoice(quote.id)).rejects.toMatchObject({ code: "profile_incomplete", missing: expect.arrayContaining(["Mention de TVA manquante"]) });
      expect(await listInvoices(world.sb, BINDER_A)).toHaveLength(1);
      expect((await getQuote(world.sb, BINDER_A, quote.id)).status).toBe("accepted");
    });

    it("le serveur transmet la mention effective à la fonction SQL", async () => {
      const quote = await franchiseQuoteWithoutMention();
      await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatRegime: "FRANCHISE", vatNumber: null, vatMention: MENTION }));
      await issuedInvoice(quote.id);
      const call = world.rpcCalls.find((c) => c.name === "marketplace_binder_create_invoice_draft");
      expect(call?.args.p_draft.vat_mention).toBe(MENTION);
    });

    it("un devis assujetti à la TVA n'est pas touché : pas de mention inventée", async () => {
      await saveBillingProfile(world.sb, BINDER_A, profileInput({ vatMention: "Texte du profil" }));
      const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
      await setQuoteStatus(world.sb, BINDER_A, quote.id, "accepted");
      const invoice = await issuedInvoice(quote.id);
      expect(invoice.vatRegime).toBe("VAT_LIABLE");
      expect(invoice.vatMention).toBe(quote.vatMention);
    });
  });

  it("l'identité de l'émetteur sur la facture est celle du jour de la facture", async () => {
    const quote = await acceptedQuote();
    await saveBillingProfile(world.sb, BINDER_A, profileInput({ addressLine1: "3 place Neuve" }));
    const invoice = await issuedInvoice(quote.id);
    expect(invoice.issuer.addressLine1).toBe("3 place Neuve");
    expect(invoice.notes).toBe("Pénalités de retard : 3 fois le taux légal.");
  });
});

describe("provenance des lignes du workbench", () => {
  it("fige la référence officielle d'une ligne Ma Reliure sans service d'atelier", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput({ lines: [line("Plein cuir", 35000, {
      referenceVersion: "reliure-fr-v1", referenceOperationKey: "OPR-0064",
    })] }), TODAY);
    expect(quote.items[0]).toMatchObject({ label: "Plein cuir", unitPriceCents: 35000, referenceVersion: "reliure-fr-v1", referenceOperationKey: "OPR-0064" });
    await expect(getQuote(world.sb, BINDER_B, quote.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("refuse une référence inventée", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    await expect(createQuote(world.sb, BINDER_A, quoteInput({ lines: [line("X", 1000, {
      referenceVersion: "reliure-fr-v1", referenceOperationKey: "OPR-9999",
    })] }), TODAY)).rejects.toMatchObject({ code: "invalid_input" });
  });
});

describe("PDF", () => {
  const decode = (base64: string) => Buffer.from(base64, "base64");
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  afterEach(() => vi.unstubAllGlobals());

  it("relit une photo PNG enregistrée et imprime son image et son crédit dans le PDF", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    const caption = "Illustration — Atelier Reliure Dorure Ferrière, Orléans";
    await uploadQuoteItemPhoto(world.sb, BINDER_A, {
      quoteId: quote.id, lineKey: quote.items[0].lineKey!, filename: "illustration.png",
      mimeType: "image/png", imageBase64: png, caption, includeInPdf: true,
    });
    const reread = await getQuote(world.sb, BINDER_A, quote.id);
    expect(reread.items[0].photos).toHaveLength(1);
    const fetchPhoto = vi.fn().mockResolvedValue(new Response(Buffer.from(png, "base64"), { headers: { "content-type": "image/png" } }));
    vi.stubGlobal("fetch", fetchPhoto);
    const rendered = await renderDocumentPdf(reread);
    expect(fetchPhoto).toHaveBeenCalledWith(reread.items[0].photos[0].url);
    expect(rendered.printed.join(" ")).toContain(caption);
    const pdf = await PDFDocument.load(decode(rendered.base64));
    expect(pdf.context.enumerateIndirectObjects().some(([, object]) => object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype")) === PDFName.of("Image"))).toBe(true);
  });

  it("ne télécharge ni n'imprime une photo exclue du PDF", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    await uploadQuoteItemPhoto(world.sb, BINDER_A, {
      quoteId: quote.id, lineKey: quote.items[0].lineKey!, filename: "prive.png",
      mimeType: "image/png", imageBase64: png, caption: "Photo exclue", includeInPdf: false,
    });
    const fetchPhoto = vi.fn();
    vi.stubGlobal("fetch", fetchPhoto);
    const rendered = await renderDocumentPdf(await getQuote(world.sb, BINDER_A, quote.id));
    expect(fetchPhoto).not.toHaveBeenCalled();
    expect(rendered.printed.join(" ")).not.toContain("Photo exclue");
  });

  it.each(["image/png", "image/jpeg"])("une image %s endommagée ne bloque pas le devis", async (mimeType) => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    quote.issuer.logoUrl = "https://storage.example/logo";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("invalid image", { headers: { "content-type": mimeType } })));
    const rendered = await renderDocumentPdf(quote);
    expect(decode(rendered.base64).subarray(0, 5).toString()).toBe("%PDF-");
    expect(rendered.printed).toContain("Total TTC");
  });

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

  it("le PDF client masque la provenance interne et ne répète pas une TVA uniforme par ligne", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput({
      lines: [
        line("Demi-cuir", 13500, { description: "Tarif de base Ma Reliure" }),
        line("Titrage", 2000, { description: "Référentiel reliure-fr-v1 · OPR-0065" }),
      ],
    }), TODAY);
    const printed = (await renderDocumentPdf(quote)).printed;
    const text = printed.join("\n");
    expect(text).not.toContain("Tarif de base Ma Reliure");
    expect(text).not.toContain("OPR-0065");
    expect(text).not.toContain("reliure-fr-v1");
    expect(printed.filter((value) => value === "TVA 20 %")).toHaveLength(1);
  });

  it("une facture PDF porte son numéro et le lien vers son devis", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    await setQuoteStatus(world.sb, BINDER_A, quote.id, "accepted");
    const draft = await convertQuoteToInvoice(world.sb, BINDER_A, quote.id, TODAY);
    await updateInvoiceDraft(world.sb, BINDER_A, draft.id, {
      issueDate: TODAY, serviceDate: TODAY, dueDate: "2026-10-19", operationNature: "services", clientType: "individual",
      clientName: draft.client.name, clientLegalName: null, clientEmail: draft.client.email, clientPhone: draft.client.phone,
      clientAddressLine1: draft.client.addressLine1, clientPostalCode: draft.client.postalCode, clientCity: draft.client.city,
      clientCountry: draft.client.country, clientBillingAddressLine1: draft.client.addressLine1,
      clientBillingPostalCode: draft.client.postalCode, clientBillingCity: draft.client.city, clientBillingCountry: draft.client.country,
      clientSiren: null, clientVatNumber: null, clientPurchaseOrderNumber: null, clientPublicServiceCode: null,
      clientPublicCommitmentNumber: null, deliveryAddressLine1: null, deliveryPostalCode: null, deliveryCity: null,
      deliveryCountry: null, paymentTerms: draft.paymentTerms, earlyPaymentDiscountTerms: null,
      latePenaltyTerms: null, notes: draft.notes,
    });
    const invoice = await issueInvoice(world.sb, BINDER_A, draft.id);
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

  it("les noms longs client et ouvrage restent dans leurs colonnes PDF", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput({
      client: { ...quoteInput().client, name: "Jean Baptiste Dupont et ses héritiers de la société des reliures patrimoniales" },
      book: { ...quoteInput().book, title: "Les Misérables, édition complète et abondamment illustrée en plusieurs volumes" },
    }), TODAY);
    const pdf = await renderDocumentPdf(quote);
    expect(pdf.pageCount).toBeGreaterThanOrEqual(1);
    expect(pdf.printed.some((line) => line.includes("Jean Baptiste Dupont"))).toBe(true);
    expect(pdf.printed.some((line) => line.includes("Les Misérables"))).toBe(true);
    expect(pdf.printed).not.toContain(quote.client.name);
    expect(pdf.printed).not.toContain(quote.book.title);
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

describe("photos d'exemple par opération", () => {
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64");
  const service = () => ({ id: null, categoryId: null, name: "Demi-cuir", description: null, unitPriceCents: 18000, vatRateBps: null, unit: null, isActive: true });
  const upload = (binderId: string, target: { serviceId: string } | { pricingKey: string }, caption: string | null = null) =>
    uploadOperationPhoto(world.sb, binderId, { target, mimeType: "image/jpeg", imageBase64: JPEG, caption });
  const files = () => [...world.storageFiles.keys()];

  it("range un exemple sous une prestation de l'atelier ou un tarif de base, dans le dossier privé de l'atelier", async () => {
    const own = await saveService(world.sb, BINDER_A, service());
    await upload(BINDER_A, { serviceId: own.id }, "Demi-cuir à coins");
    await upload(BINDER_A, { pricingKey: "plein_cuir" });
    const library = await listOperationPhotos(world.sb, BINDER_A);
    // L'ordre n'a de sens qu'à l'intérieur d'une opération : les deux sont en position 1.
    expect(library).toHaveLength(2);
    expect(library).toEqual(expect.arrayContaining([
      expect.objectContaining({ serviceId: own.id, pricingKey: null, caption: "Demi-cuir à coins", position: 1 }),
      expect.objectContaining({ serviceId: null, pricingKey: "plein_cuir", caption: null, position: 1 }),
    ]));
    expect(files().every((key) => key.startsWith(`${QUOTE_OPERATION_PHOTOS_BUCKET}/${BINDER_A}/library/`))).toBe(true);
    expect(await listOperationPhotos(world.sb, BINDER_B)).toEqual([]);
  });

  it("refuse la prestation d'un autre atelier, une clé de tarif inconnue et une septième photo", async () => {
    const theirs = await saveService(world.sb, BINDER_B, service());
    expect(await codeOf(upload(BINDER_A, { serviceId: theirs.id }))).toBe("not_found");
    expect(await codeOf(upload(BINDER_A, { pricingKey: "cle_inventee" }))).toBe("invalid_input");
    for (let i = 0; i < 6; i++) await upload(BINDER_A, { pricingKey: "plein_cuir" });
    expect(await codeOf(upload(BINDER_A, { pricingKey: "plein_cuir" }))).toBe("invalid_input");
    expect(files()).toHaveLength(6);
  });

  it("ne laisse ni lire, ni renommer, ni supprimer l'exemple d'un autre atelier", async () => {
    const { id } = await upload(BINDER_B, { pricingKey: "plein_cuir" });
    expect(await codeOf(updateOperationPhotoCaption(world.sb, BINDER_A, id, "volé"))).toBe("not_found");
    expect(await codeOf(deleteOperationPhoto(world.sb, BINDER_A, id))).toBe("not_found");
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    const lineKey = world.tables.marketplace_binder_quote_items.find((row) => row.quote_id === quote.id)!.line_key;
    expect(await codeOf(attachOperationPhotoToQuoteItem(world.sb, BINDER_A, { quoteId: quote.id, lineKey, photoId: id, caption: null, includeInPdf: true }))).toBe("not_found");
    expect(world.tables.marketplace_binder_quote_item_photos ?? []).toEqual([]);
  });

  it("le devis reçoit une COPIE : supprimer l'exemple ne retire rien au devis", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    const lineKey = world.tables.marketplace_binder_quote_items.find((row) => row.quote_id === quote.id)!.line_key;
    const { id } = await upload(BINDER_A, { pricingKey: "plein_cuir" }, "Maroquin rouge");
    await attachOperationPhotoToQuoteItem(world.sb, BINDER_A, { quoteId: quote.id, lineKey, photoId: id, caption: "Maroquin rouge", includeInPdf: true });
    await deleteOperationPhoto(world.sb, BINDER_A, id);

    expect(await listOperationPhotos(world.sb, BINDER_A)).toEqual([]);
    const reread = await getQuote(world.sb, BINDER_A, quote.id);
    const photos = reread.items.flatMap((item) => item.photos);
    expect(photos).toEqual([expect.objectContaining({ lineKey, caption: "Maroquin rouge", includeInPdf: true, position: 1 })]);
    // Le fichier du devis vit sous le dossier du devis, et il existe toujours.
    expect(files()).toEqual([expect.stringMatching(new RegExp(`/${BINDER_A}/${quote.id}/[^/]+[.]jpg$`))]);
  });

  it("ne complète qu'un brouillon, et jamais au-delà de six photos par ligne", async () => {
    await saveBillingProfile(world.sb, BINDER_A, profileInput());
    const quote = await createQuote(world.sb, BINDER_A, quoteInput(), TODAY);
    const lineKey = world.tables.marketplace_binder_quote_items.find((row) => row.quote_id === quote.id)!.line_key;
    const photoIds = [];
    for (let i = 0; i < 6; i++) photoIds.push((await upload(BINDER_A, { pricingKey: i < 3 ? "plein_cuir" : "nerfs" })).id);
    for (const photoId of photoIds.slice(0, 6)) await attachOperationPhotoToQuoteItem(world.sb, BINDER_A, { quoteId: quote.id, lineKey, photoId, caption: null, includeInPdf: false });
    const extra = (await upload(BINDER_A, { pricingKey: "etui" })).id;
    expect(await codeOf(attachOperationPhotoToQuoteItem(world.sb, BINDER_A, { quoteId: quote.id, lineKey, photoId: extra, caption: null, includeInPdf: true }))).toBe("invalid_input");

    await setQuoteStatus(world.sb, BINDER_A, quote.id, "sent");
    const otherLine = world.tables.marketplace_binder_quote_items.filter((row) => row.quote_id === quote.id)[1].line_key;
    expect(await codeOf(attachOperationPhotoToQuoteItem(world.sb, BINDER_A, { quoteId: quote.id, lineKey: otherLine, photoId: extra, caption: null, includeInPdf: true }))).toBe("conflict");
  });
});
