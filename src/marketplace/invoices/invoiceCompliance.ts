import type { BillingProfile, Issuer } from "@/marketplace/quotes/quoteBuild";
import { z } from "zod";

export type InvoiceClientType = "individual" | "business" | "public_entity";
export type InvoiceOperationNature = "goods" | "services" | "mixed";
export type InvoiceStatus = "draft" | "issued" | "credited";

export interface InvoiceBuyerSnapshot {
  type: InvoiceClientType | null;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  billingAddressLine1: string | null;
  billingPostalCode: string | null;
  billingCity: string | null;
  billingCountry: string | null;
  siren: string | null;
  vatNumber: string | null;
  purchaseOrderNumber: string | null;
  publicServiceCode: string | null;
  publicCommitmentNumber: string | null;
}

export interface InvoiceIssueCandidate {
  status: InvoiceStatus;
  issueDate: string;
  serviceDate: string | null;
  dueDate: string | null;
  operationNature: InvoiceOperationNature | null;
  issuer: Issuer;
  buyer: InvoiceBuyerSnapshot;
  vatRegime: BillingProfile["vatRegime"];
  vatMention: string | null;
  paymentTerms: string | null;
  earlyPaymentDiscountTerms: string | null;
  latePenaltyTerms: string | null;
  items: Array<{ label: string; quantity: number; unitPriceCents: number; vatRateBps: number }>;
}

export interface InvoiceComplianceResult {
  valid: boolean;
  missing: string[];
  legalMentions: string[];
}

const nullableText = (max: number) => z.string().trim().max(max).nullish().transform((value) => value || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Date invalide");

export const invoiceDraftInput = z.object({
  issueDate: date,
  serviceDate: date.nullable(),
  dueDate: date.nullable(),
  operationNature: z.enum(["goods", "services", "mixed"]).nullable(),
  clientType: z.enum(["individual", "business", "public_entity"]).nullable(),
  clientName: z.string().trim().min(1).max(200),
  clientLegalName: nullableText(200),
  clientEmail: nullableText(200),
  clientPhone: nullableText(40),
  clientAddressLine1: nullableText(300),
  clientPostalCode: nullableText(20),
  clientCity: nullableText(120),
  clientCountry: nullableText(80),
  clientBillingAddressLine1: nullableText(300),
  clientBillingPostalCode: nullableText(20),
  clientBillingCity: nullableText(120),
  clientBillingCountry: nullableText(80),
  clientSiren: nullableText(20),
  clientVatNumber: nullableText(30),
  clientPurchaseOrderNumber: nullableText(120),
  clientPublicServiceCode: nullableText(120),
  clientPublicCommitmentNumber: nullableText(120),
  deliveryAddressLine1: nullableText(300),
  deliveryPostalCode: nullableText(20),
  deliveryCity: nullableText(120),
  deliveryCountry: nullableText(80),
  paymentTerms: nullableText(1000),
  earlyPaymentDiscountTerms: nullableText(1000),
  latePenaltyTerms: nullableText(1000),
  notes: nullableText(2000),
}).strict();

export type InvoiceDraftInput = z.infer<typeof invoiceDraftInput>;

const present = (value: string | null | undefined) => Boolean(value?.trim());
const hasAddress = (line: string | null, postalCode: string | null, city: string | null) =>
  present(line) && present(postalCode) && present(city);

export function invoiceLegalMentions(candidate: InvoiceIssueCandidate): string[] {
  const mentions: string[] = [];
  if (candidate.vatRegime === "FRANCHISE") {
    mentions.push(candidate.vatMention?.trim() || "TVA non applicable, art. 293 B du CGI");
  } else if (candidate.vatRegime === "EXEMPT" && present(candidate.vatMention)) {
    mentions.push(candidate.vatMention!.trim());
  }
  if (candidate.issuer.vatOnDebits) mentions.push("Option pour le paiement de la taxe d'après les débits");
  if (candidate.buyer.type === "business" || candidate.buyer.type === "public_entity") {
    if (present(candidate.earlyPaymentDiscountTerms)) mentions.push(candidate.earlyPaymentDiscountTerms!.trim());
    if (present(candidate.latePenaltyTerms)) mentions.push(candidate.latePenaltyTerms!.trim());
    mentions.push("Indemnité forfaitaire de 40 € pour frais de recouvrement due en cas de retard de paiement.");
  }
  return mentions;
}

/**
 * Contrôle métier avant émission. Il ne complète jamais une donnée juridique :
 * chaque absence est renvoyée à l'atelier avec un libellé exploitable dans l'UI.
 */
export function validateInvoiceForIssue(candidate: InvoiceIssueCandidate): InvoiceComplianceResult {
  const missing: string[] = [];
  const issuer = candidate.issuer;
  const buyer = candidate.buyer;

  if (candidate.status !== "draft") missing.push("La facture n'est pas un brouillon");
  if (!present(issuer.legalName) && !present(issuer.workshopName)) missing.push("Raison sociale atelier manquante");
  if (!present(issuer.legalForm)) missing.push("Forme juridique atelier manquante");
  if (!present(issuer.siren)) missing.push("SIREN atelier manquant");
  if (!present(issuer.siret)) missing.push("SIRET atelier manquant");
  if (!hasAddress(issuer.addressLine1, issuer.postalCode, issuer.city)) missing.push("Adresse atelier manquante");
  if (candidate.vatRegime === null) missing.push("Régime de TVA atelier manquant");
  if (candidate.vatRegime === "VAT_LIABLE" && !present(issuer.vatNumber)) missing.push("Numéro de TVA atelier manquant");
  if ((candidate.vatRegime === "FRANCHISE" || candidate.vatRegime === "EXEMPT") && !present(candidate.vatMention)) {
    missing.push("Mention de TVA manquante");
  }
  if (!present(candidate.serviceDate)) missing.push("Date de prestation manquante");
  if (!present(candidate.dueDate)) missing.push("Échéance de paiement manquante");
  if (present(candidate.dueDate) && candidate.dueDate! < candidate.issueDate) {
    missing.push("Échéance de paiement antérieure à la date d'émission");
  }
  if (!candidate.operationNature) missing.push("Nature de l'opération manquante");
  if (!present(buyer.name)) missing.push("Nom du client manquant");
  if (!buyer.type) missing.push("Type de client manquant");
  if (!hasAddress(buyer.billingAddressLine1 ?? buyer.addressLine1, buyer.billingPostalCode ?? buyer.postalCode, buyer.billingCity ?? buyer.city)) {
    missing.push("Adresse client manquante");
  }
  if (buyer.type === "business" && !present(buyer.legalName)) missing.push("Raison sociale client manquante");
  if (buyer.type === "public_entity" && !present(buyer.legalName)) missing.push("Nom de l'entité publique manquant");
  if (buyer.type === "public_entity" && !present(buyer.siren)) missing.push("SIREN de l'entité publique manquant");
  if ((buyer.type === "business" || buyer.type === "public_entity") && !present(candidate.paymentTerms)) missing.push("Conditions de paiement manquantes");
  if ((buyer.type === "business" || buyer.type === "public_entity") && !present(candidate.earlyPaymentDiscountTerms)) missing.push("Conditions d'escompte manquantes");
  if ((buyer.type === "business" || buyer.type === "public_entity") && !present(candidate.latePenaltyTerms)) missing.push("Pénalités de retard manquantes");
  if (candidate.items.length === 0) missing.push("Ligne de facture manquante");
  if (candidate.items.some((item) => !present(item.label) || item.quantity <= 0 || item.unitPriceCents < 0 || item.vatRateBps < 0 || item.vatRateBps > 10_000)) {
    missing.push("Ligne de facture invalide");
  }

  return { valid: missing.length === 0, missing, legalMentions: invoiceLegalMentions(candidate) };
}
