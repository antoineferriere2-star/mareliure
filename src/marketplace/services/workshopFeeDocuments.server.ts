import type { Supa } from "@/build/services/adminAuth.server";
import type { Tables, Json } from "@/integrations/supabase/types";
import { oppeSellerSnapshot, oppeInvoiceDocument, oppeCreditNoteDocument,
  type OppeCustomerSnapshot, type OppeInvoiceRecord, type OppeInvoiceItemRecord, type OppeCreditNoteRecord } from "@/marketplace/invoices/oppeInvoice";
import { isMarketplaceBrand } from "@/marketplace/brand/brandConfig";

export async function issueWorkshopFeeDocuments(sb: Supa, payment: Tables<"marketplace_workshop_online_payments">,
  feeId: string | null, feeRefunded: number) {
  if (!isMarketplaceBrand(payment.fee_brand ?? "")) throw new Error("fee_invoice_brand_missing");
  const existing = await sb.from("marketplace_workshop_fee_documents").select("*")
    .eq("payment_id", payment.id).eq("kind", "invoice").maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    const frozen = existing.data.document as unknown as OppeInvoiceRecord;
    const result = await sb.rpc("marketplace_issue_workshop_fee_documents", {
      p_payment_id: payment.id, p_fee_id: feeId, p_fee_amount: payment.fee_cents,
      p_fee_refunded: feeRefunded, p_brand: existing.data.brand,
      p_seller: frozen.seller as unknown as Json, p_customer: frozen.customer as unknown as Json,
    });
    if (result.error) throw result.error;
    return;
  }
  if (!payment.fee_customer_snapshot) throw new Error('fee_invoice_fiscal_profile_missing');
  const customer = payment.fee_customer_snapshot as unknown as OppeCustomerSnapshot;
  const seller = oppeSellerSnapshot(payment.fee_brand as "MA_RELIURE" | "FINE_BINDERY", "BUSINESS");
  seller.legal_mentions[0] = `${seller.brand} est une marque d'OPPE SAS, qui facture à l'atelier les frais de plateforme. L'atelier reste vendeur à son client.`;
  seller.legal_mentions.push("Frais déjà retenus par Stripe sur l’encaissement client : aucun second paiement. Frais Stripe facturés séparément par Stripe.");
  const result = await sb.rpc("marketplace_issue_workshop_fee_documents", {
    p_payment_id: payment.id, p_fee_id: feeId, p_fee_amount: payment.fee_cents,
    p_fee_refunded: feeRefunded, p_brand: payment.fee_brand!,
    p_seller: seller as unknown as Json, p_customer: customer as unknown as Json,
  });
  if (result.error) throw result.error;
}

/** Les PDF se recomposent exclusivement depuis les instantanés émis. */
export function workshopFeeDocumentView(record: Tables<"marketplace_workshop_fee_documents">,
  original?: Tables<"marketplace_workshop_fee_documents">) {
  const document = record.document as unknown as OppeInvoiceRecord & { items: OppeInvoiceItemRecord[] };
  if (record.kind === "credit_note") {
    if (!original || original.id !== record.invoice_document_id || original.payment_id !== record.payment_id)
      throw new Error("fee_credit_invoice_mismatch");
    const view = oppeCreditNoteDocument(original.document as unknown as OppeInvoiceRecord,
      record.document as unknown as OppeCreditNoteRecord);
    view.paymentTerms = "Avoir correspondant aux frais d’application effectivement remboursés par Stripe à l’atelier.";
    return view;
  }
  const view = oppeInvoiceDocument(document, document.items);
  view.paymentTerms = "Payée par retenue des frais d’application Stripe sur l’encaissement client. Aucun second paiement.";
  return view;
}
