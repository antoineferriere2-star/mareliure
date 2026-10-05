/**
 * La facture de vente d'Oppe (activité A) : qui vend, à qui, et comment elle s'imprime.
 *
 * Pure : aucun accès à la base. Le serveur fige le vendeur et le client au moment de l'émission
 * (marketplace_issue_oppe_invoice) ; le PDF se recompose ensuite depuis ces seuls instantanés,
 * jamais depuis une donnée vivante qui aurait pu changer depuis.
 */
import { MARELIURE_CONTACT_EMAIL, MARELIURE_PUBLISHER } from "@/marketplace/legal/legalEntity";
import { MARKETPLACE_BRAND_CONFIGS, type MarketplaceBrand } from "@/marketplace/brand/brandConfig";
import type { CreditNoteDocumentView, DocumentItemView, DocumentView } from "@/marketplace/quotes/quoteViews";
import type { VatGroup } from "@/marketplace/quotes/quoteCalc";

const BLOCK = "format-principal";
const itemView = (key: string, position: number, label: string, quantity: number, unitHtCents: number, vatRateBps: number | null, totalHtCents: number): DocumentItemView => ({
  position, lineKey: key, blockKey: BLOCK, serviceId: null, label, description: null, unit: null, quantity,
  unitPriceCents: unitHtCents, catalogPriceCents: null, vatRateBps: vatRateBps ?? 0, totalHtCents, photos: [],
});

export interface OppeSellerSnapshot {
  legal_name: string;
  legal_form: string;
  share_capital: string;
  address: string;
  siren: string;
  siret: string;
  rcs: string;
  vat_number: string;
  brand: string;
  brand_domain: string;
  email: string;
  legal_mentions: string[];
}

export interface OppeCustomerSnapshot {
  type: "CUSTOMER" | "BUSINESS";
  name: string;
  business_name: string | null;
  vat_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
}

/** Mentions de la facture : identité du vendeur, marque, et pour un professionnel les pénalités. */
export function oppeSellerSnapshot(brand: MarketplaceBrand, customerType: "CUSTOMER" | "BUSINESS"): OppeSellerSnapshot {
  const config = MARKETPLACE_BRAND_CONFIGS[brand];
  const mentions = [
    `${config.displayName} est une marque d'${MARELIURE_PUBLISHER.name}, qui vend la prestation et émet cette facture.`,
    `${MARELIURE_PUBLISHER.name}, ${MARELIURE_PUBLISHER.legalFormInSentence} au capital de ${MARELIURE_PUBLISHER.capital}, ${MARELIURE_PUBLISHER.address}.`,
    `SIRET ${MARELIURE_PUBLISHER.siret} — ${MARELIURE_PUBLISHER.rcs} — TVA intracommunautaire ${MARELIURE_PUBLISHER.vat}.`,
  ];
  if (customerType === "BUSINESS") {
    mentions.push(
      "Facture réglée à la commande : aucun escompte pour paiement anticipé.",
      "En cas de retard de paiement : pénalités au taux d'intérêt légal majoré de dix points et indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 du Code de commerce).",
    );
  }
  return {
    legal_name: MARELIURE_PUBLISHER.name,
    legal_form: MARELIURE_PUBLISHER.legalForm,
    share_capital: MARELIURE_PUBLISHER.capital,
    address: MARELIURE_PUBLISHER.address,
    siren: MARELIURE_PUBLISHER.siren,
    siret: MARELIURE_PUBLISHER.siret,
    rcs: MARELIURE_PUBLISHER.rcs,
    vat_number: MARELIURE_PUBLISHER.vat,
    brand: config.displayName,
    brand_domain: new URL(config.seo.canonicalOrigin).hostname,
    email: MARELIURE_CONTACT_EMAIL,
    legal_mentions: mentions,
  };
}

/** Libellé de la ligne de prestation : ce que l'atelier s'est engagé à réaliser, et le dossier. */
export function serviceLineLabel(input: { brand: MarketplaceBrand; reference: string; serviceDescription: string | null }): string {
  const what = input.serviceDescription?.trim() || (input.brand === "FINE_BINDERY" ? "Bookbinding service" : "Prestation de reliure");
  return `${what} — dossier ${input.reference}`.slice(0, 400);
}

export interface OppeInvoiceRecord {
  id: string;
  number: string;
  issue_date: string;
  brand: MarketplaceBrand;
  seller: OppeSellerSnapshot;
  customer: OppeCustomerSnapshot;
  currency: string;
  total_ht_cents: number;
  total_vat_cents: number;
  total_ttc_cents: number;
  vat_breakdown: { rate_bps: number | null; base_ht_cents: number; vat_cents: number }[];
  payment: { paid_at?: string; method?: string; payment_intent_id?: string };
  issued_at: string;
}

export interface OppeInvoiceItemRecord {
  position: number;
  label: string;
  category: string;
  quantity: number;
  unit_ht_cents: number;
  vat_rate_bps: number | null;
  total_ht_cents: number;
  vat_cents: number;
  total_ttc_cents: number;
}

function issuerOf(seller: OppeSellerSnapshot): DocumentView["issuer"] {
  const [line1, ...rest] = seller.address.split(",").map((part) => part.trim());
  const postalCity = rest.join(", ");
  const match = postalCity.match(/^(\d{5})\s+(.*)$/);
  return {
    workshopName: seller.brand,
    binderName: null,
    legalName: seller.legal_name,
    legalForm: seller.legal_form,
    shareCapital: seller.share_capital,
    siren: seller.siren,
    addressLine1: line1 ?? null,
    addressLine2: null,
    postalCode: match ? match[1] : null,
    city: match ? match[2] : postalCity || null,
    country: "FR",
    siret: seller.siret,
    vatNumber: seller.vat_number,
    vatOnDebits: false,
    legalNotes: seller.legal_mentions.join(" "),
    email: seller.email,
    phone: null,
    website: seller.brand_domain,
    logoStoragePath: null,
    documentAccentColor: "#241a12",
    documentFooter: `${seller.brand} — ${seller.legal_name}`,
    iban: null,
  };
}

const vatGroups = (breakdown: OppeInvoiceRecord["vat_breakdown"]): VatGroup[] =>
  breakdown.map((group) => ({ vatRateBps: group.rate_bps ?? 0, baseHtCents: group.base_ht_cents, vatCents: group.vat_cents }));

/** La facture Oppe, mise au format que sait imprimer le générateur PDF des documents. */
export function oppeInvoiceDocument(invoice: OppeInvoiceRecord, items: OppeInvoiceItemRecord[]): DocumentView {
  const customer = invoice.customer;
  const paidOn = invoice.payment.paid_at ? new Date(invoice.payment.paid_at).toLocaleDateString("fr-FR") : null;
  return {
    kind: "invoice",
    id: invoice.id,
    number: invoice.number,
    status: "issued",
    issueDate: invoice.issue_date,
    validUntil: null,
    client: {
      id: null,
      name: customer.business_name ?? customer.name,
      email: customer.email,
      phone: null,
      addressLine1: [customer.address_line1, customer.address_line2].filter(Boolean).join(", ") || null,
      postalCode: customer.postal_code,
      city: customer.city,
      country: customer.country,
    },
    book: { title: null, author: null, heightMm: null, widthMm: null, spineMm: null, notes: null },
    blocks: [],
    items: items.map((item) => itemView(`${invoice.id}-${item.position}`, item.position, item.label, item.quantity, item.unit_ht_cents, item.vat_rate_bps, item.total_ht_cents)),
    currency: invoice.currency,
    issuer: issuerOf(invoice.seller),
    vatRegime: "VAT_LIABLE",
    vatMention: null,
    paymentTerms: paidOn ? `Payée le ${paidOn} par carte bancaire.` : "Payée à la commande.",
    notes: null,
    subtotalCents: invoice.total_ht_cents,
    discountType: "NONE",
    discountValue: 0,
    discountCents: 0,
    totalHtCents: invoice.total_ht_cents,
    totalVatCents: invoice.total_vat_cents,
    totalTtcCents: invoice.total_ttc_cents,
    vatBreakdown: vatGroups(invoice.vat_breakdown),
    depositType: "NONE",
    depositValue: 0,
    depositCents: 0,
    balanceCents: 0,
    linkedQuoteId: null,
    linkedQuoteNumber: null,
    linkedInvoiceId: null,
    linkedInvoiceNumber: null,
    createdAt: invoice.issued_at,
    payment: { status: "paid", amountPaidCents: invoice.total_ttc_cents, depositPaidCents: 0 },
    invoiceCompliance: {
      serviceDate: null,
      dueDate: invoice.issue_date,
      operationNature: "services",
      clientType: customer.type === "BUSINESS" ? "business" : "individual",
      clientLegalName: customer.business_name,
      billingAddressLine1: customer.address_line1,
      billingPostalCode: customer.postal_code,
      billingCity: customer.city,
      billingCountry: customer.country,
      clientSiren: null,
      clientVatNumber: customer.vat_number,
      purchaseOrderNumber: null,
      publicServiceCode: null,
      publicCommitmentNumber: null,
      deliveryAddressLine1: null,
      deliveryPostalCode: null,
      deliveryCity: null,
      deliveryCountry: null,
      earlyPaymentDiscountTerms: null,
      latePenaltyTerms: null,
      legalMentions: invoice.seller.legal_mentions,
    },
    creditNote: null,
  };
}

export interface OppeCreditNoteRecord {
  id: string;
  number: string;
  issue_date: string;
  reason: string;
  issued_at: string;
  items: { position: number; label: string; vat_rate_bps: number | null; total_ht_cents: number; vat_cents: number; total_ttc_cents: number }[];
  total_ht_cents: number;
  total_vat_cents: number;
  total_ttc_cents: number;
  vat_breakdown: { rate_bps: number | null; base_ht_cents: number; vat_cents: number }[];
}

/** L'avoir, imprimé comme une facture négative rattachée à la facture d'origine. */
export function oppeCreditNoteDocument(invoice: OppeInvoiceRecord, note: OppeCreditNoteRecord): CreditNoteDocumentView {
  const base = oppeInvoiceDocument(invoice, []);
  return {
    ...base,
    kind: "credit_note",
    id: note.id,
    number: note.number,
    issueDate: note.issue_date,
    createdAt: note.issued_at,
    items: note.items.map((item) => itemView(`${note.id}-${item.position}`, item.position, item.label, 1, item.total_ht_cents, item.vat_rate_bps, item.total_ht_cents)),
    subtotalCents: -note.total_ht_cents,
    totalHtCents: -note.total_ht_cents,
    totalVatCents: -note.total_vat_cents,
    totalTtcCents: -note.total_ttc_cents,
    vatBreakdown: vatGroups(note.vat_breakdown),
    paymentTerms: "Remboursement sur le moyen de paiement utilisé pour la commande.",
    payment: null,
    originalInvoice: { number: invoice.number, issueDate: invoice.issue_date },
    reason: note.reason,
  };
}
