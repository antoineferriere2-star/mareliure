/**
 * « Aujourd'hui » : ce qui mérite l'attention du relieur, dérivé des seules
 * données déjà chargées par l'atelier (demandes, devis, factures, ouvrages).
 * Pur : aucune lecture, aucune écriture, la date du jour est fournie.
 *
 * Aucun chiffre n'est inventé ici — chaque compteur est une longueur de liste
 * ou une somme de champs lus en base. Une source indisponible vaut `null` :
 * l'écran l'affiche comme telle, jamais comme zéro.
 */
import { addDays, effectiveStatus, isQuoteStatus } from "@/marketplace/quotes/quoteStatus";

/** Un devis envoyé dont la validité s'achève dans ce délai mérite une relance. */
export const QUOTE_FOLLOW_UP_DAYS = 7;

export type AgendaCase = {
  caseId: string;
  state: string;
  caseStatus: string;
  unreadCount: number;
  title: string;
  reference: string;
  clientName: string | null;
};

export type AgendaQuote = {
  id: string;
  workId?: string | null;
  number: string;
  status: string;
  validUntil: string | null;
  clientName: string;
  bookTitle: string | null;
};

export type AgendaInvoice = {
  id: string;
  number: string;
  status: string;
  dueDate?: string | null;
  clientName: string;
  bookTitle: string | null;
  totalTtcCents: number;
};

export type AgendaWork = { id: string; caseId?: string | null; status: string };

export type AgendaKind =
  | "message"
  | "request"
  | "payment_overdue"
  | "case_work"
  | "case_quote"
  | "quote_expired"
  | "quote_expiring"
  | "quote_draft"
  | "quote_to_invoice"
  | "invoice_draft";

export type AgendaLink =
  | { to: "/atelier/messages/$conversationId"; params: { conversationId: string } }
  | { to: "/atelier/leads/$leadId"; params: { leadId: string } }
  | { to: "/atelier/devis/$quoteId"; params: { quoteId: string } }
  | { to: "/atelier/devis/$quoteId/modifier"; params: { quoteId: string } }
  | { to: "/atelier/factures/$invoiceId"; params: { invoiceId: string } };

/**
 * Un élément de l'agenda : des faits, jamais une phrase. L'écran les formule dans
 * la langue de l'atelier (voir `pages/binder/dashboardCopy.ts`).
 */
export type AgendaItem = {
  key: string;
  kind: AgendaKind;
  /** Titre du projet ou du livre ; vide quand la donnée n'en a pas (l'écran écrit « Sans titre »). */
  title: string;
  /** Référence du projet (demandes, messages, dossiers retenus). */
  reference?: string;
  /** Nom du client, quand l'atelier a le droit de le connaître. */
  clientName?: string | null;
  /** Numéro du devis ou de la facture. */
  documentNumber?: string;
  /** Fin de validité (devis) ou échéance (facture), AAAA-MM-JJ. */
  date?: string;
  unreadCount?: number;
  link: AgendaLink;
  /** Un retard, un délai dépassé : signalé autrement que par la couleur seule. */
  late: boolean;
};

/** L'ordre de traitement : d'abord les personnes qui attendent une réponse, puis l'argent en retard, puis le reste. */
const ORDER: readonly AgendaKind[] = [
  "message",
  "request",
  "payment_overdue",
  "case_work",
  "case_quote",
  "quote_expired",
  "quote_expiring",
  "invoice_draft",
  "quote_to_invoice",
  "quote_draft",
];

const isClosed = (row: AgendaCase) =>
  row.state === "declined" || row.state === "cancelled" || row.caseStatus === "cancelled" || row.caseStatus === "completed";

const isNewRequest = (row: AgendaCase) => row.state === "offered" || row.state === "invited";

/** Une facture émise, non annulée par avoir, dont le solde reste dû. */
export function awaitsPayment(invoice: AgendaInvoice): boolean {
  return invoice.status === "unpaid" || invoice.status === "deposit_paid";
}

export function isPaymentOverdue(invoice: AgendaInvoice, today: string): boolean {
  return awaitsPayment(invoice) && Boolean(invoice.dueDate) && invoice.dueDate! < today;
}

/** `expired` quand la validité est dépassée, `expiring` quand elle s'achève sous QUOTE_FOLLOW_UP_DAYS jours. */
export function quoteFollowUp(quote: AgendaQuote, today: string): "expired" | "expiring" | null {
  if (quote.status !== "sent" || !quote.validUntil || !isQuoteStatus(quote.status)) return null;
  if (effectiveStatus(quote.status, quote.validUntil, today) === "expired") return "expired";
  return quote.validUntil <= addDays(today, QUOTE_FOLLOW_UP_DAYS) ? "expiring" : null;
}

const documentTitle = (doc: { bookTitle: string | null; clientName: string }) => doc.bookTitle || doc.clientName || "";

export function buildAgenda(input: {
  cases: readonly AgendaCase[];
  quotes: readonly AgendaQuote[];
  invoices: readonly AgendaInvoice[];
  works: readonly AgendaWork[];
  today: string;
}): AgendaItem[] {
  const { cases, quotes, invoices, works, today } = input;
  const items: AgendaItem[] = [];
  const workByCase = new Map(works.filter((work) => work.caseId).map((work) => [work.caseId!, work] as const));
  const quotedWorks = new Set(quotes.filter((quote) => quote.workId && quote.status !== "refused").map((quote) => quote.workId!));

  for (const row of cases) {
    if (isClosed(row)) continue;
    const project = { title: row.title || row.reference, reference: row.reference, clientName: row.clientName };
    const caseLink = { to: "/atelier/leads/$leadId", params: { leadId: row.caseId } } as const;
    if (row.unreadCount > 0) {
      items.push({
        key: `message:${row.caseId}`,
        kind: "message",
        ...project,
        unreadCount: row.unreadCount,
        link: { to: "/atelier/messages/$conversationId", params: { conversationId: row.caseId } },
        late: false,
      });
      continue;
    }
    if (isNewRequest(row)) {
      items.push({ key: `request:${row.caseId}`, kind: "request", ...project, link: caseLink, late: false });
      continue;
    }
    if (row.state !== "selected") continue;
    const work = workByCase.get(row.caseId);
    if (!work) items.push({ key: `case-work:${row.caseId}`, kind: "case_work", ...project, link: caseLink, late: false });
    else if (!quotedWorks.has(work.id)) items.push({ key: `case-quote:${row.caseId}`, kind: "case_quote", ...project, link: caseLink, late: false });
  }

  for (const quote of quotes) {
    const doc = { title: documentTitle(quote), documentNumber: quote.number, clientName: quote.clientName };
    const followUp = quoteFollowUp(quote, today);
    if (followUp) {
      items.push({
        key: `quote-${followUp}:${quote.id}`,
        kind: followUp === "expired" ? "quote_expired" : "quote_expiring",
        ...doc,
        date: quote.validUntil!,
        link: { to: "/atelier/devis/$quoteId", params: { quoteId: quote.id } },
        late: followUp === "expired",
      });
    } else if (quote.status === "draft") {
      items.push({ key: `quote-draft:${quote.id}`, kind: "quote_draft", ...doc, link: { to: "/atelier/devis/$quoteId/modifier", params: { quoteId: quote.id } }, late: false });
    } else if (quote.status === "accepted") {
      items.push({ key: `quote-invoice:${quote.id}`, kind: "quote_to_invoice", ...doc, link: { to: "/atelier/devis/$quoteId", params: { quoteId: quote.id } }, late: false });
    }
  }

  for (const invoice of invoices) {
    const doc = { title: documentTitle(invoice), documentNumber: invoice.number, clientName: invoice.clientName };
    const link = { to: "/atelier/factures/$invoiceId", params: { invoiceId: invoice.id } } as const;
    if (invoice.status === "draft") items.push({ key: `invoice-draft:${invoice.id}`, kind: "invoice_draft", ...doc, link, late: false });
    else if (isPaymentOverdue(invoice, today)) items.push({ key: `payment:${invoice.id}`, kind: "payment_overdue", ...doc, date: invoice.dueDate!, link, late: true });
  }

  // Tri stable : l'ordre des sources (les plus récentes d'abord) est conservé à l'intérieur d'un même type.
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => ORDER.indexOf(a.item.kind) - ORDER.indexOf(b.item.kind) || a.index - b.index)
    .map(({ item }) => item);
}

/** Les compteurs de synthèse. `null` = source indisponible, jamais confondu avec zéro. */
export function summarize(input: {
  cases: readonly AgendaCase[] | null;
  quotes: readonly AgendaQuote[] | null;
  invoices: readonly AgendaInvoice[] | null;
  works: readonly AgendaWork[] | null;
  today: string;
}) {
  const { cases, quotes, invoices, works, today } = input;
  return {
    newRequests: cases ? cases.filter((row) => !isClosed(row) && isNewRequest(row)).length : null,
    unreadMessages: cases ? cases.reduce((total, row) => total + row.unreadCount, 0) : null,
    sentQuotes: quotes ? quotes.filter((quote) => quote.status === "sent").length : null,
    quotesToFollowUp: quotes ? quotes.filter((quote) => quoteFollowUp(quote, today) !== null).length : null,
    activeWorks: works ? works.filter((work) => work.status === "active").length : null,
    awaitingPayment: invoices ? invoices.filter(awaitsPayment).length : null,
    overduePayments: invoices ? invoices.filter((invoice) => isPaymentOverdue(invoice, today)).length : null,
  };
}
