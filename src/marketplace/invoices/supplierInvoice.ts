/**
 * La facture de l'atelier à Oppe, générée depuis l'outil (activité A). Pure : le serveur lui
 * donne le profil de facturation de l'atelier et l'affectation ; elle rend le document que sait
 * imprimer le générateur PDF. Le client est OPPE SAS, jamais le client final du livre.
 */
import { MARELIURE_PUBLISHER } from "@/marketplace/legal/legalEntity";
import { issuerOf, type BillingProfile } from "@/marketplace/quotes/quoteBuild";
import type { DocumentView } from "@/marketplace/quotes/quoteViews";
import { itemView } from "./oppeInvoice";

export interface SupplierInvoiceInput {
  profile: BillingProfile;
  number: string;
  issueDate: string;
  dueDate: string;
  caseReference: string;
  serviceDescription: string | null;
  amountHtCents: number;
  vatRegime: "FRANCHISE" | "VAT_LIABLE";
  vatRateBps: number | null;
  vatCents: number;
  vatMention: string | null;
}

/** Numéro attribué par l'outil : propre à l'atelier, unique par dossier. */
export function supplierInvoiceNumber(profile: Pick<BillingProfile, "invoicePrefix">, caseReference: string): string {
  const prefix = (profile.invoicePrefix || "F").replace(/[^A-Za-z0-9-]/g, "").slice(0, 12) || "F";
  return `${prefix}-OPPE-${caseReference.replace(/[^A-Za-z0-9-]/g, "")}`.slice(0, 60);
}

export function supplierInvoiceDocument(input: SupplierInvoiceInput): DocumentView {
  const ttc = input.amountHtCents + input.vatCents;
  const label = `${input.serviceDescription?.trim() || "Prestation de reliure"} — dossier ${input.caseReference} (réalisée pour ${MARELIURE_PUBLISHER.name})`.slice(0, 400);
  return {
    kind: "invoice",
    id: `supplier-${input.number}`,
    number: input.number,
    status: "issued",
    issueDate: input.issueDate,
    validUntil: null,
    client: {
      id: null,
      name: MARELIURE_PUBLISHER.name,
      email: null,
      phone: null,
      addressLine1: MARELIURE_PUBLISHER.address.split(",")[0]?.trim() ?? null,
      postalCode: MARELIURE_PUBLISHER.address.match(/\b(\d{5})\b/)?.[1] ?? null,
      city: MARELIURE_PUBLISHER.address.replace(/^.*\d{5}\s*/, "") || null,
      country: "FR",
    },
    book: { title: null, author: null, heightMm: null, widthMm: null, spineMm: null, notes: null },
    blocks: [],
    items: [itemView(`supplier-${input.number}-1`, 1, label, 1, input.amountHtCents, input.vatRateBps, input.amountHtCents)],
    currency: "EUR",
    issuer: issuerOf(input.profile),
    vatRegime: input.vatRegime,
    vatMention: input.vatMention,
    paymentTerms: `Paiement par virement sous 30 jours à compter de l'émission, soit avant le ${new Date(input.dueDate).toLocaleDateString("fr-FR")}.`,
    notes: `Client : ${MARELIURE_PUBLISHER.name} — SIRET ${MARELIURE_PUBLISHER.siret} — TVA ${MARELIURE_PUBLISHER.vat}.`,
    subtotalCents: input.amountHtCents,
    discountType: "NONE",
    discountValue: 0,
    discountCents: 0,
    totalHtCents: input.amountHtCents,
    totalVatCents: input.vatCents,
    totalTtcCents: ttc,
    vatBreakdown: input.vatRegime === "VAT_LIABLE" ? [{ vatRateBps: input.vatRateBps ?? 0, baseHtCents: input.amountHtCents, vatCents: input.vatCents }] : [],
    depositType: "NONE",
    depositValue: 0,
    depositCents: 0,
    balanceCents: ttc,
    linkedQuoteId: null,
    linkedQuoteNumber: null,
    linkedInvoiceId: null,
    linkedInvoiceNumber: null,
    createdAt: new Date().toISOString(),
    payment: { status: "unpaid", amountPaidCents: 0, depositPaidCents: 0 },
    invoiceCompliance: {
      serviceDate: null,
      dueDate: input.dueDate,
      operationNature: "services",
      clientType: "business",
      clientLegalName: MARELIURE_PUBLISHER.name,
      billingAddressLine1: MARELIURE_PUBLISHER.address.split(",")[0]?.trim() ?? null,
      billingPostalCode: MARELIURE_PUBLISHER.address.match(/\b(\d{5})\b/)?.[1] ?? null,
      billingCity: MARELIURE_PUBLISHER.address.replace(/^.*\d{5}\s*/, "") || null,
      billingCountry: "FR",
      clientSiren: MARELIURE_PUBLISHER.siren.replace(/\s/g, ""),
      clientVatNumber: MARELIURE_PUBLISHER.vat,
      purchaseOrderNumber: input.caseReference,
      publicServiceCode: null,
      publicCommitmentNumber: null,
      deliveryAddressLine1: null,
      deliveryPostalCode: null,
      deliveryCity: null,
      deliveryCountry: null,
      earlyPaymentDiscountTerms: null,
      latePenaltyTerms: null,
      legalMentions: input.profile.legalNotes ? [input.profile.legalNotes] : [],
    },
    creditNote: null,
  };
}
