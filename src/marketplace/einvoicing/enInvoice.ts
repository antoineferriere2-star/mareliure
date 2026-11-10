/**
 * Traduit une pièce émise (facture ou avoir) vers le modèle EN 16931 attendu par la plateforme agréée.
 * Fonction pure : elle lit uniquement le snapshot, sans appel réseau ni recalcul d'un montant légal.
 * Une pièce qu'elle ne sait pas traduire fidèlement est refusée avec son motif, jamais approchée.
 */
import { DEFAULT_COUNTRY } from "@/marketplace/invoices/countries";
import type { CreditNoteDocumentView, DocumentView } from "@/marketplace/quotes/quoteViews";

export type ProcessingRule = "B2B" | "B2BInt" | "B2C" | "B2G";

export type EnInvoiceBlocker =
  | "not_issued"
  | "missing_compliance"
  | "missing_client_type"
  | "vat_on_debits_not_mapped"
  | "deposit_not_mapped"
  | "unsupported_currency"
  | "unsupported_vat_regime"
  | "unsupported_public_entity"
  | "b2c_mixed"
  | "zero_rate_without_reason"
  | "missing_seller_identity"
  | "missing_buyer_identity"
  | "missing_buyer_address"
  | "international_reporting_only"
  | "amounts_mismatch";

export interface EnInvoiceContext {
  /** Adresses de facturation électronique lues dans l'annuaire. À défaut, le SIREN, cas le plus courant en France. */
  sellerElectronicAddress?: string | null;
  buyerElectronicAddress?: string | null;
}

export type EnInvoiceResult =
  | { ok: true; invoice: EnInvoice; processingRule: ProcessingRule }
  | { ok: false; blockers: EnInvoiceBlocker[] };

interface PostalAddress { address_line1?: string; city?: string; post_code?: string; country_code: string }
interface Identifier { value: string; scheme: string }

export interface EnInvoice {
  number: string;
  issue_date: string;
  type_code: 380 | 381;
  currency_code: string;
  payment_due_date?: string;
  payment_terms?: string;
  purchase_order_reference?: string;
  buyer_reference?: string;
  notes: { subject_code: string; note: string }[];
  process_control: { business_process_type: "B1" | "S1" | "M1"; specification_identifier: string };
  preceding_invoice_references?: { reference: string; issue_date: string }[];
  seller: {
    name: string;
    trading_name?: string;
    additional_legal_information?: string;
    legal_registration_identifier: Identifier;
    identifiers?: Identifier[];
    vat_identifier?: string;
    tax_registration_identifier?: string;
    electronic_address: Identifier;
    postal_address: PostalAddress;
  };
  buyer: {
    name: string;
    legal_registration_identifier?: Identifier;
    identifiers?: Identifier[];
    vat_identifier?: string;
    electronic_address?: Identifier;
    postal_address: PostalAddress;
  };
  delivery_information?: { delivery_date: string };
  deliver_to_address: PostalAddress;
  payment_instructions?: { payment_means_type_code: string; credit_transfers: { payment_account_identifier: { value: string } }[] };
  document_level_allowances?: { amount: string; reason: string; vat_category_code: string; vat_rate: string; vat_identifier: string }[];
  totals: {
    sum_invoice_lines_amount: string;
    sum_allowances_amount?: string;
    total_without_vat: string;
    total_vat_amount: { value: string; currency_code: string };
    total_with_vat: string;
    amount_due_for_payment: string;
  };
  vat_break_down: {
    vat_category_taxable_amount: string;
    vat_category_tax_amount: string;
    vat_category_code: string;
    vat_identifier: string;
    vat_category_rate: string;
    vat_exemption_reason?: string;
    vat_exemption_reason_code?: string;
  }[];
  lines: {
    identifier: string;
    invoiced_quantity: string;
    invoiced_quantity_code: string;
    net_amount: string;
    price_details: { item_net_price: string };
    vat_information: { invoiced_item_vat_category_code: string; invoiced_item_vat_rate: string };
    item_information: { name: string; description?: string };
  }[];
}

const SPECIFICATION = "urn:cen.eu:en16931:2017";
const SIREN_SCHEME = "0002";
const SIRET_SCHEME = "0009";
const FRENCH_ELECTRONIC_ADDRESS_SCHEME = "0225";
const EMAIL_ADDRESS_SCHEME = "EM";
const CREDIT_TRANSFER = "30";
const VAT_SCHEME_LABEL = "VAT";
const FRANCHISE_REASON_CODE = "VATEX-FR-FRANCHISE";
const RECOVERY_INDEMNITY = "Indemnité forfaitaire de 40 € pour frais de recouvrement due en cas de retard de paiement.";
// Le contrôle français exige ces trois notes sur toute facture, alors que ces clauses ne visent que les professionnels.
const INDIVIDUAL_RECOVERY_NOTE = "Indemnité forfaitaire de recouvrement : sans objet, vente à un particulier.";
const INDIVIDUAL_LATE_PENALTY_NOTE = "Pénalités de retard : sans objet, vente à un particulier.";
const NO_EARLY_PAYMENT_DISCOUNT = "Aucun escompte pour paiement anticipé.";

const money = (cents: number) => (cents / 100).toFixed(2);
const rate = (bps: number) => (bps / 100).toFixed(2);
const present = (value: string | null | undefined): value is string => Boolean(value?.trim());
const compactIban = (iban: string) => iban.replace(/\s+/g, "").toUpperCase();

function address(line: string | null | undefined, postCode: string | null | undefined, city: string | null | undefined, country: string): PostalAddress {
  return {
    ...(present(line) ? { address_line1: line.trim() } : {}),
    ...(present(city) ? { city: city.trim() } : {}),
    ...(present(postCode) ? { post_code: postCode.trim() } : {}),
    country_code: country,
  };
}

function ruleOf(clientType: string | null, country: string): ProcessingRule | null {
  if (clientType === "public_entity") return "B2G";
  if (clientType === "business") return country === "FR" ? "B2B" : "B2BInt";
  return clientType === "individual" ? "B2C" : null;
}

export function buildEnInvoice(document: DocumentView | CreditNoteDocumentView, context: EnInvoiceContext = {}): EnInvoiceResult {
  const blockers = new Set<EnInvoiceBlocker>();
  const compliance = document.invoiceCompliance;
  if (document.kind === "quote" || document.status === "draft" || !present(document.number)) blockers.add("not_issued");
  if (!compliance) return { ok: false, blockers: [...blockers, "missing_compliance"] };

  const isCredit = document.kind === "credit_note";
  const issuer = document.issuer;
  const franchise = document.vatRegime === "FRANCHISE";
  const country = (compliance.billingCountry ?? document.client.country ?? DEFAULT_COUNTRY).toUpperCase();
  const processingRule = ruleOf(compliance.clientType, country);
  const nature = compliance.operationNature;
  if (!processingRule) return { ok: false, blockers: [...blockers, "missing_client_type"] };

  if (document.currency !== "EUR") blockers.add("unsupported_currency");
  if (document.vatRegime !== "FRANCHISE" && document.vatRegime !== "VAT_LIABLE") blockers.add("unsupported_vat_regime");
  if (processingRule === "B2G") blockers.add("unsupported_public_entity");
  if (!nature) blockers.add("missing_compliance");
  if (processingRule === "B2C" && nature === "mixed") blockers.add("b2c_mixed");
  if (!present(issuer.siren) || !(present(issuer.legalName) || present(issuer.workshopName))) blockers.add("missing_seller_identity");
  if (!franchise && !present(issuer.vatNumber)) blockers.add("missing_seller_identity");
  // BT-8 attend un code d'exigibilité que nous n'avons pas encore validé sur la norme en vigueur.
  if (issuer.vatOnDebits) blockers.add("vat_on_debits_not_mapped");
  // Un acompte demandé n'est ni un montant payé ni une facture d'acompte : son traitement reste à arrêter.
  if (document.depositCents > 0 || (document.payment?.depositPaidCents ?? 0) > 0) blockers.add("deposit_not_mapped");
  const isIndividual = processingRule === "B2C";
  if (!isIndividual && !isCredit && (!present(compliance.latePenaltyTerms) || !present(compliance.earlyPaymentDiscountTerms))) blockers.add("missing_compliance");
  if (processingRule === "B2B" && !present(compliance.clientSiren)) blockers.add("missing_buyer_identity");
  // Un e-mail n'achemine pas une facture à l'étranger : ces ventes se déclarent en e-reporting, sans facture transmise.
  if (processingRule === "B2BInt") blockers.add("international_reporting_only");
  // BR-FR-12 : l'adresse de l'acheteur est exigée, y compris pour un particulier, dont seul l'e-mail est connu.
  const buyerEmail = document.client.email?.trim() || null;
  if (processingRule === "B2C" && !buyerEmail) blockers.add("missing_buyer_address");

  const blockOf = new Map(document.blocks.map((block) => [block.key, block]));
  const lineRate = (bps: number) => (franchise ? 0 : bps);
  const category = franchise ? "E" : "S";
  if (!franchise && document.items.some((item) => item.vatRateBps === 0)) blockers.add("zero_rate_without_reason");

  // La remise est portée par taux : la base imprimée de chaque taux est celle de la ventilation figée.
  const lineTotals = new Map<number, number>();
  for (const item of document.items) lineTotals.set(lineRate(item.vatRateBps), (lineTotals.get(lineRate(item.vatRateBps)) ?? 0) + item.totalHtCents);
  const breakdown = franchise
    ? [{ vatRateBps: 0, baseHtCents: document.totalHtCents, vatCents: 0 }]
    : document.vatBreakdown.filter((group) => group.baseHtCents !== 0 || group.vatCents !== 0);

  const linesCents = [...lineTotals.values()].reduce((sum, value) => sum + value, 0);
  const allowances = [...lineTotals.entries()]
    .map(([bps, total]) => ({ bps, cents: total - (breakdown.find((group) => group.vatRateBps === bps)?.baseHtCents ?? 0) }))
    .filter((allowance) => allowance.cents !== 0);
  const allowanceCents = allowances.reduce((sum, allowance) => sum + allowance.cents, 0);
  if (linesCents !== document.subtotalCents
    || allowances.some((allowance) => allowance.cents < 0)
    || allowanceCents !== document.discountCents
    || linesCents - allowanceCents !== document.totalHtCents
    || breakdown.reduce((sum, group) => sum + group.vatCents, 0) !== document.totalVatCents
    || document.totalHtCents + document.totalVatCents !== document.totalTtcCents) blockers.add("amounts_mismatch");

  if (blockers.size > 0) return { ok: false, blockers: [...blockers] };

  const siren = issuer.siren!.replace(/\s+/g, "");
  const buyerSiren = compliance.clientSiren?.replace(/\s+/g, "") ?? null;
  const buyerAddress = processingRule === "B2B" ? context.buyerElectronicAddress ?? buyerSiren : null;
  const name = issuer.legalName?.trim() || issuer.workshopName!.trim();
  const legalInformation = [issuer.legalForm, issuer.shareCapital ? `Capital ${issuer.shareCapital}` : null].filter(Boolean).join(", ");
  const vatMention = document.vatMention?.trim();
  const notes: EnInvoice["notes"] = [];
  if (isIndividual) notes.push({ subject_code: "BAR", note: "B2C" });
  notes.push({ subject_code: "PMT", note: isIndividual ? INDIVIDUAL_RECOVERY_NOTE : RECOVERY_INDEMNITY });
  notes.push({ subject_code: "PMD", note: isIndividual ? INDIVIDUAL_LATE_PENALTY_NOTE : compliance.latePenaltyTerms?.trim() || "Pénalités de retard : voir la facture d'origine." });
  notes.push({ subject_code: "AAB", note: compliance.earlyPaymentDiscountTerms?.trim() || NO_EARLY_PAYMENT_DISCOUNT });
  if (document.kind === "credit_note") notes.push({ subject_code: "ACD", note: document.reason });
  const deliveryCountry = (compliance.deliveryCountry ?? country).toUpperCase();

  return {
    ok: true,
    processingRule,
    invoice: {
      number: document.number,
      issue_date: document.issueDate,
      type_code: isCredit ? 381 : 380,
      currency_code: document.currency,
      ...(!isCredit && compliance.dueDate ? { payment_due_date: compliance.dueDate } : {}),
      payment_terms: isCredit ? "Avoir : aucun règlement dû par le client." : document.paymentTerms?.trim() || "Paiement à réception de facture.",
      ...(present(compliance.purchaseOrderNumber) ? { purchase_order_reference: compliance.purchaseOrderNumber } : {}),
      notes,
      process_control: { business_process_type: nature === "goods" ? "B1" : nature === "mixed" ? "M1" : "S1", specification_identifier: SPECIFICATION },
      ...(document.kind === "credit_note" ? { preceding_invoice_references: [{ reference: document.originalInvoice.number, issue_date: document.originalInvoice.issueDate }] } : {}),
      seller: {
        name,
        ...(present(issuer.workshopName) && issuer.workshopName.trim() !== name ? { trading_name: issuer.workshopName.trim() } : {}),
        ...(legalInformation ? { additional_legal_information: legalInformation } : {}),
        legal_registration_identifier: { value: siren, scheme: SIREN_SCHEME },
        ...(present(issuer.siret) ? { identifiers: [{ value: issuer.siret.replace(/\s+/g, ""), scheme: SIRET_SCHEME }] } : {}),
        ...(present(issuer.vatNumber) ? { vat_identifier: issuer.vatNumber.replace(/\s+/g, "") } : { tax_registration_identifier: siren }),
        electronic_address: { value: context.sellerElectronicAddress ?? siren, scheme: FRENCH_ELECTRONIC_ADDRESS_SCHEME },
        postal_address: address(issuer.addressLine1, issuer.postalCode, issuer.city, (issuer.country || DEFAULT_COUNTRY).toUpperCase()),
      },
      buyer: {
        name: compliance.clientLegalName?.trim() || document.client.name,
        ...(buyerSiren ? { legal_registration_identifier: { value: buyerSiren, scheme: SIREN_SCHEME } } : {}),
        ...(present(compliance.clientVatNumber) ? { vat_identifier: compliance.clientVatNumber.replace(/\s+/g, "") } : {}),
        ...(buyerAddress
          ? { electronic_address: { value: buyerAddress, scheme: FRENCH_ELECTRONIC_ADDRESS_SCHEME }, identifiers: [{ value: buyerAddress, scheme: FRENCH_ELECTRONIC_ADDRESS_SCHEME }] }
          : { electronic_address: { value: buyerEmail!, scheme: EMAIL_ADDRESS_SCHEME } }),
        postal_address: address(compliance.billingAddressLine1 ?? document.client.addressLine1, compliance.billingPostalCode ?? document.client.postalCode, compliance.billingCity ?? document.client.city, country),
      },
      ...(compliance.serviceDate ? { delivery_information: { delivery_date: compliance.serviceDate } } : {}),
      deliver_to_address: address(compliance.deliveryAddressLine1, compliance.deliveryPostalCode, compliance.deliveryCity, deliveryCountry),
      ...(!isCredit && present(issuer.iban) ? { payment_instructions: { payment_means_type_code: CREDIT_TRANSFER, credit_transfers: [{ payment_account_identifier: { value: compactIban(issuer.iban) } }] } } : {}),
      ...(allowances.length > 0 ? {
        document_level_allowances: allowances.map((allowance) => ({ amount: money(allowance.cents), reason: "Remise", vat_category_code: category, vat_rate: rate(allowance.bps), vat_identifier: VAT_SCHEME_LABEL })),
      } : {}),
      totals: {
        sum_invoice_lines_amount: money(linesCents),
        ...(allowanceCents > 0 ? { sum_allowances_amount: money(allowanceCents) } : {}),
        total_without_vat: money(document.totalHtCents),
        total_vat_amount: { value: money(document.totalVatCents), currency_code: document.currency },
        total_with_vat: money(document.totalTtcCents),
        amount_due_for_payment: money(document.totalTtcCents),
      },
      vat_break_down: breakdown.map((group) => ({
        vat_category_taxable_amount: money(group.baseHtCents),
        vat_category_tax_amount: money(group.vatCents),
        vat_category_code: category,
        vat_identifier: VAT_SCHEME_LABEL,
        vat_category_rate: rate(group.vatRateBps),
        ...(franchise ? { vat_exemption_reason: vatMention || "TVA non applicable, art. 293 B du CGI", vat_exemption_reason_code: FRANCHISE_REASON_CODE } : {}),
      })),
      lines: document.items.map((item, index) => {
        const quantity = item.quantity * (blockOf.get(item.blockKey)?.bookCount ?? 1);
        return {
          identifier: String(index + 1).padStart(3, "0"),
          invoiced_quantity: String(quantity),
          invoiced_quantity_code: "C62",
          net_amount: money(item.totalHtCents),
          price_details: { item_net_price: money(item.unitPriceCents) },
          vat_information: { invoiced_item_vat_category_code: category, invoiced_item_vat_rate: rate(lineRate(item.vatRateBps)) },
          item_information: { name: item.label, ...(present(item.description) ? { description: item.description } : {}) },
        };
      }),
    },
  };
}
