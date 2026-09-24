import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAgenda,
  quoteFollowUp,
  summarize,
  type AgendaCase,
  type AgendaInvoice,
  type AgendaQuote,
  type AgendaWork,
} from "./todayAgenda";

const TODAY = "2026-09-24";

const aCase = (patch: Partial<AgendaCase> = {}): AgendaCase => ({
  caseId: "case-1",
  state: "selected",
  caseStatus: "in_progress",
  unreadCount: 0,
  title: "Missel de famille",
  reference: "MR-0001",
  clientName: "Claire Martin",
  ...patch,
});
const aQuote = (patch: Partial<AgendaQuote> = {}): AgendaQuote => ({
  id: "quote-1",
  workId: null,
  number: "D-2026-0001",
  status: "draft",
  validUntil: "2026-10-24",
  clientName: "Claire Martin",
  bookTitle: "Missel",
  ...patch,
});
const anInvoice = (patch: Partial<AgendaInvoice> = {}): AgendaInvoice => ({
  id: "invoice-1",
  number: "F-2026-0001",
  status: "unpaid",
  dueDate: "2026-10-24",
  clientName: "Claire Martin",
  bookTitle: "Missel",
  totalTtcCents: 42000,
  ...patch,
});
const aWork = (patch: Partial<AgendaWork> = {}): AgendaWork => ({ id: "work-1", caseId: null, status: "active", ...patch });

const agenda = (input: { cases?: AgendaCase[]; quotes?: AgendaQuote[]; invoices?: AgendaInvoice[]; works?: AgendaWork[] }) =>
  buildAgenda({ cases: [], quotes: [], invoices: [], works: [], today: TODAY, ...input });

describe("« À traiter maintenant »", () => {
  it("est vide quand rien n'attend le relieur", () => {
    expect(agenda({ quotes: [aQuote({ status: "invoiced" })], invoices: [anInvoice({ status: "paid" })], works: [aWork()] })).toEqual([]);
  });

  it("place d'abord les personnes qui attendent une réponse, puis l'argent en retard, puis les documents", () => {
    const items = agenda({
      quotes: [aQuote({ id: "draft" }), aQuote({ id: "accepted", status: "accepted" }), aQuote({ id: "expiring", status: "sent", validUntil: "2026-09-28" })],
      invoices: [anInvoice({ id: "late", dueDate: "2026-09-01" }), anInvoice({ id: "draft-invoice", status: "draft", number: "Brouillon" })],
      cases: [aCase({ caseId: "selected" }), aCase({ caseId: "new", state: "offered" }), aCase({ caseId: "unread", unreadCount: 2 })],
    });
    expect(items.map((item) => item.kind)).toEqual([
      "message",
      "request",
      "payment_overdue",
      "case_work",
      "quote_expiring",
      "invoice_draft",
      "quote_to_invoice",
      "quote_draft",
    ]);
  });

  it("un message non lu mène à la conversation, et ne double pas la ligne du dossier", () => {
    const items = agenda({ cases: [aCase({ unreadCount: 3 })] });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "message", label: "3 messages non lus", link: { to: "/atelier/messages/$conversationId", params: { conversationId: "case-1" } } });
  });

  it("n'affiche pas le nom du client d'une demande que l'atelier n'a pas encore obtenue", () => {
    const [item] = agenda({ cases: [aCase({ state: "invited", clientName: null })] });
    expect(item).toMatchObject({ kind: "request", detail: "MR-0001" });
  });

  it("ignore les dossiers clos, déclinés ou annulés", () => {
    expect(
      agenda({
        cases: [
          aCase({ caseId: "a", state: "declined", unreadCount: 1 }),
          aCase({ caseId: "b", caseStatus: "completed" }),
          aCase({ caseId: "c", caseStatus: "cancelled", state: "offered" }),
        ],
      }),
    ).toEqual([]);
  });

  it("un atelier retenu : fiche ouvrage d'abord, puis devis, puis plus rien une fois le devis établi", () => {
    expect(agenda({ cases: [aCase()] })[0].kind).toBe("case_work");
    expect(agenda({ cases: [aCase()], works: [aWork({ caseId: "case-1" })] })[0].kind).toBe("case_quote");
    const quoted = agenda({ cases: [aCase()], works: [aWork({ caseId: "case-1" })], quotes: [aQuote({ workId: "work-1", status: "sent", validUntil: "2026-12-01" })] });
    expect(quoted).toEqual([]);
    // Un devis refusé ne compte pas : il faut en refaire un.
    expect(agenda({ cases: [aCase()], works: [aWork({ caseId: "case-1" })], quotes: [aQuote({ workId: "work-1", status: "refused" })] })[0].kind).toBe("case_quote");
  });

  it("signale en retard un paiement échu et un devis dont la validité est dépassée — pas les autres", () => {
    const items = agenda({
      invoices: [anInvoice({ id: "late", dueDate: "2026-09-23" }), anInvoice({ id: "due-today", dueDate: TODAY }), anInvoice({ id: "no-due", dueDate: null })],
      quotes: [aQuote({ id: "expired", status: "sent", validUntil: "2026-09-20" })],
    });
    expect(items.map((item) => [item.key, item.late])).toEqual([
      ["payment:late", true],
      ["quote-expired:expired", true],
    ]);
  });

  it("n'attend aucun paiement d'une facture payée ou annulée par avoir", () => {
    expect(agenda({ invoices: [anInvoice({ status: "paid", dueDate: "2026-01-01" }), anInvoice({ status: "credited", dueDate: "2026-01-01" })] })).toEqual([]);
  });

  it("conserve, à type égal, l'ordre des sources (les plus récentes d'abord)", () => {
    const items = agenda({ quotes: [aQuote({ id: "recent" }), aQuote({ id: "older" })] });
    expect(items.map((item) => item.key)).toEqual(["quote-draft:recent", "quote-draft:older"]);
  });
});

describe("relance des devis envoyés", () => {
  it("relance sous sept jours, dit « expiré » une fois la date passée, se tait sinon", () => {
    expect(quoteFollowUp(aQuote({ status: "sent", validUntil: "2026-10-01" }), TODAY)).toBe("expiring");
    expect(quoteFollowUp(aQuote({ status: "sent", validUntil: "2026-10-02" }), TODAY)).toBeNull();
    expect(quoteFollowUp(aQuote({ status: "sent", validUntil: TODAY }), TODAY)).toBe("expiring");
    expect(quoteFollowUp(aQuote({ status: "sent", validUntil: "2026-09-23" }), TODAY)).toBe("expired");
    expect(quoteFollowUp(aQuote({ status: "accepted", validUntil: "2026-09-23" }), TODAY)).toBeNull();
    expect(quoteFollowUp(aQuote({ status: "sent", validUntil: null }), TODAY)).toBeNull();
  });
});

describe("compteurs de synthèse", () => {
  it("sont des comptes de données réelles", () => {
    expect(
      summarize({
        cases: [aCase({ caseId: "a", state: "offered" }), aCase({ caseId: "b", unreadCount: 2 }), aCase({ caseId: "c", unreadCount: 1 })],
        quotes: [aQuote({ status: "sent", validUntil: "2026-09-26" }), aQuote({ status: "sent", validUntil: "2026-12-01" }), aQuote()],
        invoices: [anInvoice({ dueDate: "2026-09-01" }), anInvoice({ status: "deposit_paid" }), anInvoice({ status: "paid" }), anInvoice({ status: "credited" })],
        works: [aWork(), aWork({ id: "w2", status: "archived" })],
        today: TODAY,
      }),
    ).toEqual({ newRequests: 1, unreadMessages: 3, sentQuotes: 2, quotesToFollowUp: 1, activeWorks: 1, awaitingPayment: 2, overduePayments: 1 });
  });

  it("une source indisponible vaut `null`, jamais zéro", () => {
    expect(summarize({ cases: null, quotes: null, invoices: null, works: null, today: TODAY })).toEqual({
      newRequests: null,
      unreadMessages: null,
      sentQuotes: null,
      quotesToFollowUp: null,
      activeWorks: null,
      awaitingPayment: null,
      overduePayments: null,
    });
  });
});

describe("la page « Aujourd'hui »", () => {
  const PAGE = readFileSync(resolve(process.cwd(), "src/marketplace/pages/binder/BinderDashboardPage.tsx"), "utf8");

  it("partage les clés de cache des écrans détaillés, pour ne jamais afficher un devis ou un ouvrage périmé", () => {
    expect(PAGE).toContain("queryKey: QUOTES_KEY");
    expect(PAGE).toContain("queryKey: INVOICES_KEY");
    expect(PAGE).toContain("queryKey: WORKS_KEY");
    expect(PAGE).not.toMatch(/queryKey: \["binder",/);
  });

  it.each(["LeadsPage", "BinderCasePage"])("%s lit devis et ouvrages sous les mêmes clés que le tableau de bord", (page) => {
    const source = readFileSync(resolve(process.cwd(), `src/marketplace/pages/binder/${page}.tsx`), "utf8");
    // Une clé à part (["binder", "works"]…) n'est jamais invalidée par les écrans devis et ouvrages.
    expect(source).not.toMatch(/queryKey: \["binder", "(works|work|quotes|invoices)"/);
    expect(source).toContain("queryKey: WORKS_KEY");
  });

  it("relie chaque section à un titre qui existe", () => {
    for (const [, id] of PAGE.matchAll(/aria-labelledby="([\w-]+)"/g)) expect(PAGE, id).toMatch(new RegExp(`id="${id}"`));
  });

  it("ne bloque pas toute la page sur une seule source en échec", () => {
    expect(PAGE).not.toMatch(/if \([^)]*isError[^)]*\) return/);
    expect(PAGE).toContain("<BinderRetryNote");
  });
});
