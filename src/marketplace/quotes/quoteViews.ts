/**
 * Ce que le relieur reçoit d'un devis ou d'une facture : une vue unique
 * (`DocumentView`) pour l'écran ET le PDF, construite champ par champ à partir
 * des lignes SQL. Aucun identifiant d'un autre atelier n'y figure jamais ; les
 * seuls identifiants sont ceux du document lui-même, de son client et de son lien
 * devis ↔ facture.
 */
import type { Issuer } from "./quoteBuild";
import type { VatGroup, VatRegime } from "./quoteCalc";
import type { InvoiceClientType, InvoiceOperationNature } from "@/marketplace/invoices/invoiceCompliance";

export interface DocumentItemView {
  position: number;
  lineKey: string;
  blockKey: string;
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
  referenceVersion?: string | null;
  referenceOperationKey?: string | null;
  photos: DocumentPhotoView[];
}

export interface DocumentPhotoView {
  id: string;
  lineKey: string;
  url: string;
  caption: string | null;
  includeInPdf: boolean;
  position: number;
}

export interface DocumentBlockView {
  key: string;
  label: string;
  bookCount: number;
  heightMm: number | null;
  widthMm: number | null;
  spineMm: number | null;
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
  blocks: DocumentBlockView[];
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
  /**
   * Devis seulement : l'ouvrage auquel il se rattache, s'il y en a un. Une référence — les
   * blocs `client` et `book` ci-dessus restent le snapshot du document.
   */
  workId?: string | null;
  createdAt: string;
  /** Facture seulement : le suivi de paiement (aucun encaissement n'est fait ici). */
  payment: { status: "unpaid" | "deposit_paid" | "paid"; amountPaidCents: number; depositPaidCents: number } | null;
  invoiceCompliance: {
    serviceDate: string | null;
    dueDate: string | null;
    operationNature: InvoiceOperationNature | null;
    clientType: InvoiceClientType | null;
    clientLegalName: string | null;
    billingAddressLine1: string | null;
    billingPostalCode: string | null;
    billingCity: string | null;
    billingCountry: string | null;
    clientSiren: string | null;
    clientVatNumber: string | null;
    purchaseOrderNumber: string | null;
    publicServiceCode: string | null;
    publicCommitmentNumber: string | null;
    deliveryAddressLine1: string | null;
    deliveryPostalCode: string | null;
    deliveryCity: string | null;
    deliveryCountry: string | null;
    earlyPaymentDiscountTerms: string | null;
    latePenaltyTerms: string | null;
    legalMentions: string[];
  } | null;
  creditNote: { id: string; number: string; issueDate: string } | null;
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
  work_id?: string | null;
}

export interface InvoiceDbRow extends CommonRow {
  quote_id: string;
  invoice_number: string | null;
  status: "draft" | "issued" | "credited";
  service_date: string | null;
  due_date: string | null;
  operation_nature: InvoiceOperationNature | null;
  client_type: InvoiceClientType | null;
  client_legal_name: string | null;
  client_billing_address_line1: string | null;
  client_billing_postal_code: string | null;
  client_billing_city: string | null;
  client_billing_country: string | null;
  client_siren: string | null;
  client_vat_number: string | null;
  client_purchase_order_number: string | null;
  client_public_service_code: string | null;
  client_public_commitment_number: string | null;
  delivery_address_line1: string | null;
  delivery_postal_code: string | null;
  delivery_city: string | null;
  delivery_country: string | null;
  early_payment_discount_terms: string | null;
  late_penalty_terms: string | null;
  legal_mentions: string[];
  payment_status: "unpaid" | "deposit_paid" | "paid";
  amount_paid_cents: number;
  deposit_paid_cents: number;
}

export interface ItemDbRow {
  line_key?: string;
  block_key?: string;
  block_label?: string;
  block_book_count?: number;
  block_height_mm?: number | null;
  block_width_mm?: number | null;
  block_spine_mm?: number | null;
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
  reference_version?: string | null;
  reference_operation_key?: string | null;
}

export interface PhotoDbRow {
  id: string;
  line_key: string;
  caption: string | null;
  include_in_pdf: boolean;
  position: number;
  url: string;
}

function common(row: CommonRow, items: ItemDbRow[], photos: PhotoDbRow[] = []) {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const blocks = new Map<string, DocumentBlockView>();
  for (const item of sorted) {
    const key = item.block_key ?? "format-principal";
    if (!blocks.has(key)) blocks.set(key, {
      key,
      label: item.block_label ?? "Format principal",
      bookCount: item.block_book_count ?? 1,
      heightMm: item.block_height_mm ?? row.height_mm,
      widthMm: item.block_width_mm ?? row.width_mm,
      spineMm: item.block_spine_mm ?? row.spine_mm,
    });
  }
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
    blocks: [...blocks.values()],
    items: sorted
      .map<DocumentItemView>((item) => ({
        position: item.position,
        lineKey: item.line_key ?? `position-${item.position}`,
        blockKey: item.block_key ?? "format-principal",
        serviceId: item.service_id,
        label: item.label,
        description: item.description,
        unit: item.unit,
        quantity: Number(item.quantity),
        unitPriceCents: item.unit_price_cents,
        catalogPriceCents: item.catalog_price_cents ?? null,
        vatRateBps: item.vat_rate_bps,
        totalHtCents: item.total_ht_cents,
        referenceVersion: item.reference_version ?? null,
        referenceOperationKey: item.reference_operation_key ?? null,
        photos: photos
          .filter((photo) => photo.line_key === (item.line_key ?? `position-${item.position}`))
          .sort((a, b) => a.position - b.position)
          .map((photo) => ({ id: photo.id, lineKey: photo.line_key, url: photo.url, caption: photo.caption, includeInPdf: photo.include_in_pdf, position: photo.position })),
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
  invoice: { id: string; invoice_number: string | null } | null,
  photos: PhotoDbRow[] = [],
): DocumentView {
  return {
    kind: "quote",
    id: row.id,
    number: row.quote_number,
    status: row.status,
    issueDate: row.issue_date,
    validUntil: row.valid_until,
    ...common(row, items, photos),
    linkedQuoteId: null,
    linkedQuoteNumber: null,
    linkedInvoiceId: invoice?.id ?? null,
    linkedInvoiceNumber: invoice?.invoice_number ?? null,
    ...(row.work_id ? { workId: row.work_id } : {}),
    payment: null,
    invoiceCompliance: null,
    creditNote: null,
  };
}

export function invoiceView(
  row: InvoiceDbRow,
  items: ItemDbRow[],
  quote: { id: string; quote_number: string } | null,
  photos: PhotoDbRow[] = [],
  creditNote: { id: string; credit_note_number: string; issue_date: string } | null = null,
): DocumentView {
  return {
    kind: "invoice",
    id: row.id,
    number: row.invoice_number ?? "Brouillon",
    status: row.status,
    issueDate: row.issue_date,
    validUntil: null,
    ...common(row, items, photos),
    linkedQuoteId: quote?.id ?? row.quote_id,
    linkedQuoteNumber: quote?.quote_number ?? null,
    linkedInvoiceId: null,
    linkedInvoiceNumber: null,
    payment: {
      status: row.payment_status,
      amountPaidCents: row.amount_paid_cents,
      depositPaidCents: row.deposit_paid_cents,
    },
    invoiceCompliance: {
      serviceDate: row.service_date,
      dueDate: row.due_date,
      operationNature: row.operation_nature,
      clientType: row.client_type,
      clientLegalName: row.client_legal_name,
      billingAddressLine1: row.client_billing_address_line1,
      billingPostalCode: row.client_billing_postal_code,
      billingCity: row.client_billing_city,
      billingCountry: row.client_billing_country,
      clientSiren: row.client_siren,
      clientVatNumber: row.client_vat_number,
      purchaseOrderNumber: row.client_purchase_order_number,
      publicServiceCode: row.client_public_service_code,
      publicCommitmentNumber: row.client_public_commitment_number,
      deliveryAddressLine1: row.delivery_address_line1,
      deliveryPostalCode: row.delivery_postal_code,
      deliveryCity: row.delivery_city,
      deliveryCountry: row.delivery_country,
      earlyPaymentDiscountTerms: row.early_payment_discount_terms,
      latePenaltyTerms: row.late_penalty_terms,
      legalMentions: row.legal_mentions ?? [],
    },
    creditNote: creditNote ? { id: creditNote.id, number: creditNote.credit_note_number, issueDate: creditNote.issue_date } : null,
  };
}

/** Un résumé pour les listes — jamais le détail des lignes. */
export interface DocumentSummary {
  kind: "quote" | "invoice";
  id: string;
  workId?: string | null;
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
    ...(view.workId ? { workId: view.workId } : {}),
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
