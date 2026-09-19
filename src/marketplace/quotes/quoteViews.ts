/**
 * Ce que le relieur reçoit d'un devis ou d'une facture : une vue unique
 * (`DocumentView`) pour l'écran ET le PDF, construite champ par champ à partir
 * des lignes SQL. Aucun identifiant d'un autre atelier n'y figure jamais ; les
 * seuls identifiants sont ceux du document lui-même, de son client et de son lien
 * devis ↔ facture.
 */
import type { Issuer } from "./quoteBuild";
import type { VatGroup, VatRegime } from "./quoteCalc";

export interface DocumentItemView {
  position: number;
  serviceId: string | null;
  label: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  unitPriceCents: number;
  /** Prix du catalogue à l'ajout ; `null` : ligne libre (devis seulement). */
  catalogPriceCents: number | null;
  vatRateBps: number;
  totalHtCents: number;
}

export interface DocumentView {
  kind: "quote" | "invoice";
  id: string;
  number: string;
  /** Devis : statut du devis. Facture : `issued`. */
  status: string;
  issueDate: string;
  /** Devis seulement. */
  validUntil: string | null;
  client: {
    id: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    postalCode: string | null;
    city: string | null;
    country: string | null;
  };
  book: {
    title: string | null;
    author: string | null;
    heightMm: number | null;
    widthMm: number | null;
    spineMm: number | null;
    notes: string | null;
  };
  items: DocumentItemView[];
  currency: string;
  issuer: Issuer;
  vatRegime: VatRegime;
  vatMention: string | null;
  paymentTerms: string | null;
  notes: string | null;
  subtotalCents: number;
  discountType: "NONE" | "PERCENT" | "AMOUNT";
  discountValue: number;
  discountCents: number;
  totalHtCents: number;
  totalVatCents: number;
  totalTtcCents: number;
  vatBreakdown: VatGroup[];
  depositType: "NONE" | "PERCENT" | "AMOUNT";
  depositValue: number;
  depositCents: number;
  /** Total TTC moins l'acompte demandé. */
  balanceCents: number;
  /** Devis : la facture qui en est issue. Facture : son devis d'origine. */
  linkedQuoteId: string | null;
  linkedQuoteNumber: string | null;
  linkedInvoiceId: string | null;
  linkedInvoiceNumber: string | null;
  createdAt: string;
  /** Facture seulement : le suivi de paiement (aucun encaissement n'est fait ici). */
  payment: { status: "unpaid" | "deposit_paid" | "paid"; amountPaidCents: number; depositPaidCents: number } | null;
}

/** Une ligne SQL de devis ou de facture — la partie commune. */
interface CommonRow {
  id: string;
  client_id: string | null;
  issue_date: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_address_line1: string | null;
  client_postal_code: string | null;
  client_city: string | null;
  client_country: string | null;
  book_title: string | null;
  book_author: string | null;
  height_mm: number | null;
  width_mm: number | null;
  spine_mm: number | null;
  book_notes: string | null;
  currency: string;
  issuer: Issuer;
  vat_regime: VatRegime;
  vat_mention: string | null;
  payment_terms: string | null;
  notes: string | null;
  subtotal_cents: number;
  discount_type: "NONE" | "PERCENT" | "AMOUNT";
  discount_value: number;
  discount_cents: number;
  total_ht_cents: number;
  total_vat_cents: number;
  total_ttc_cents: number;
  vat_breakdown: VatGroup[];
  deposit_type: "NONE" | "PERCENT" | "AMOUNT";
  deposit_value: number;
  deposit_cents: number;
  created_at: string;
}

export interface QuoteDbRow extends CommonRow {
  quote_number: string;
  status: string;
  valid_until: string;
}

export interface InvoiceDbRow extends CommonRow {
  quote_id: string;
  invoice_number: string;
  payment_status: "unpaid" | "deposit_paid" | "paid";
  amount_paid_cents: number;
  deposit_paid_cents: number;
}

export interface ItemDbRow {
  position: number;
  service_id: string | null;
  label: string;
  description: string | null;
  unit: string | null;
  // numeric(10,2) arrive parfois en chaîne selon le pilote
  quantity: number | string;
  unit_price_cents: number;
  catalog_price_cents?: number | null;
  vat_rate_bps: number;
  total_ht_cents: number;
}

function common(row: CommonRow, items: ItemDbRow[]) {
  return {
    client: {
      id: row.client_id,
      name: row.client_name,
      email: row.client_email,
      phone: row.client_phone,
      addressLine1: row.client_address_line1,
      postalCode: row.client_postal_code,
      city: row.client_city,
      country: row.client_country,
    },
    book: {
      title: row.book_title,
      author: row.book_author,
      heightMm: row.height_mm,
      widthMm: row.width_mm,
      spineMm: row.spine_mm,
      notes: row.book_notes,
    },
    items: [...items]
      .sort((a, b) => a.position - b.position)
      .map<DocumentItemView>((item) => ({
        position: item.position,
        serviceId: item.service_id,
        label: item.label,
        description: item.description,
        unit: item.unit,
        quantity: Number(item.quantity),
        unitPriceCents: item.unit_price_cents,
        catalogPriceCents: item.catalog_price_cents ?? null,
        vatRateBps: item.vat_rate_bps,
        totalHtCents: item.total_ht_cents,
      })),
    currency: row.currency,
    issuer: row.issuer,
    vatRegime: row.vat_regime,
    vatMention: row.vat_mention,
    paymentTerms: row.payment_terms,
    notes: row.notes,
    subtotalCents: row.subtotal_cents,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    discountCents: row.discount_cents,
    totalHtCents: row.total_ht_cents,
    totalVatCents: row.total_vat_cents,
    totalTtcCents: row.total_ttc_cents,
    vatBreakdown: row.vat_breakdown,
    depositType: row.deposit_type,
    depositValue: row.deposit_value,
    depositCents: row.deposit_cents,
    balanceCents: row.total_ttc_cents - row.deposit_cents,
    createdAt: row.created_at,
  };
}

export function quoteView(
  row: QuoteDbRow,
  items: ItemDbRow[],
  invoice: { id: string; invoice_number: string } | null,
): DocumentView {
  return {
    kind: "quote",
    id: row.id,
    number: row.quote_number,
    status: row.status,
    issueDate: row.issue_date,
    validUntil: row.valid_until,
    ...common(row, items),
    linkedQuoteId: null,
    linkedQuoteNumber: null,
    linkedInvoiceId: invoice?.id ?? null,
    linkedInvoiceNumber: invoice?.invoice_number ?? null,
    payment: null,
  };
}

export function invoiceView(
  row: InvoiceDbRow,
  items: ItemDbRow[],
  quote: { id: string; quote_number: string } | null,
): DocumentView {
  return {
    kind: "invoice",
    id: row.id,
    number: row.invoice_number,
    status: "issued",
    issueDate: row.issue_date,
    validUntil: null,
    ...common(row, items),
    linkedQuoteId: quote?.id ?? row.quote_id,
    linkedQuoteNumber: quote?.quote_number ?? null,
    linkedInvoiceId: null,
    linkedInvoiceNumber: null,
    payment: {
      status: row.payment_status,
      amountPaidCents: row.amount_paid_cents,
      depositPaidCents: row.deposit_paid_cents,
    },
  };
}

/** Un résumé pour les listes — jamais le détail des lignes. */
export interface DocumentSummary {
  kind: "quote" | "invoice";
  id: string;
  number: string;
  status: string;
  issueDate: string;
  validUntil: string | null;
  clientName: string;
  bookTitle: string | null;
  totalTtcCents: number;
  currency: string;
}

export function summaryOf(view: DocumentView): DocumentSummary {
  return {
    kind: view.kind,
    id: view.id,
    number: view.number,
    status: view.status,
    issueDate: view.issueDate,
    validUntil: view.validUntil,
    clientName: view.client.name,
    bookTitle: view.book.title,
    totalTtcCents: view.totalTtcCents,
    currency: view.currency,
  };
}
