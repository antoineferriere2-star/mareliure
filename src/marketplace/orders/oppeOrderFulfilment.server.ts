/**
 * Ce qui suit un paiement vérifié d'une commande Oppe (activité A). Chaque étape est
 * idempotente : un webhook rejoué, ou deux événements Stripe pour le même paiement
 * (session et PaymentIntent), ne produisent jamais deux commandes, deux factures ni deux
 * confirmations.
 *
 *   1. ouvrir la commande et son affectation atelier (marketplace_open_oppe_order) ;
 *   2. relever les frais Stripe réels du paiement (sans bloquer la suite s'ils manquent) ;
 *   3. émettre la facture de vente Oppe (marketplace_issue_oppe_invoice) ;
 *   4. confirmer la commande au client, une seule fois.
 *
 * Une étape obligatoire qui échoue fait répondre le webhook en erreur : Stripe le rejoue, les
 * étapes déjà faites ne se refont pas.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import { logOperationalError } from "@/build/services/operationalLog.server";
import { MARKETPLACE_BRAND_CONFIGS, isMarketplaceBrand, type MarketplaceBrand } from "@/marketplace/brand/brandConfig";
import { oppeSellerSnapshot, serviceLineLabel, type OppeCustomerSnapshot } from "@/marketplace/invoices/oppeInvoice";
import { loadCommercialProposalById } from "@/marketplace/services/commercialProposalRepository.server";

export async function recordStripeFees(sb: Supa, proposalId: string, paymentIntentId: string): Promise<void> {
  const { getMarketplaceStripeClient } = await import("@/marketplace/stripe/stripeClient.server");
  const intent = await getMarketplaceStripeClient().paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  const transaction = charge && typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;
  if (!transaction) return;
  const { error } = await sb
    .from("marketplace_commercial_proposal_payments")
    .update({ stripe_fee_cents: transaction.fee, stripe_net_cents: transaction.net, stripe_balance_transaction_id: transaction.id })
    .eq("proposal_id", proposalId);
  if (error) throw error;
}

async function customerEmail(sb: Supa, row: { customer_user_id: string | null; dossier_id: string | null }): Promise<string | null> {
  if (row.customer_user_id) {
    const { data } = await sb.auth.admin.getUserById(row.customer_user_id);
    if (data?.user?.email) return data.user.email;
  }
  if (row.dossier_id) {
    const { data } = await sb.from("build_dossiers").select("visitor_email").eq("id", row.dossier_id).maybeSingle();
    return ((data?.visitor_email as string | null | undefined) ?? "").trim() || null;
  }
  return null;
}

/** Client figé sur la facture : les coordonnées saisies à l'acceptation, sinon ce que le dossier sait. */
async function customerSnapshot(
  sb: Supa,
  input: { proposalId: string; caseRow: { customer_user_id: string | null; dossier_id: string | null }; billingCountry: string | null; customerType: string; businessName: string | null },
): Promise<OppeCustomerSnapshot> {
  const email = await customerEmail(sb, input.caseRow);
  const { data: billing, error } = await sb
    .from("marketplace_proposal_billing_details")
    .select("customer_type, name, business_name, vat_number, address_line1, address_line2, postal_code, city, country, email")
    .eq("proposal_id", input.proposalId)
    .maybeSingle();
  if (error) throw error;
  if (billing) {
    return {
      type: billing.customer_type === "BUSINESS" ? "BUSINESS" : "CUSTOMER",
      name: billing.name,
      business_name: billing.business_name,
      vat_number: billing.vat_number,
      address_line1: billing.address_line1,
      address_line2: billing.address_line2,
      postal_code: billing.postal_code,
      city: billing.city,
      country: billing.country,
      email: billing.email ?? email,
    };
  }
  let name = "Client";
  if (input.caseRow.dossier_id) {
    const { data } = await sb.from("build_dossiers").select("visitor_name").eq("id", input.caseRow.dossier_id).maybeSingle();
    name = ((data?.visitor_name as string | null | undefined) ?? "").trim() || name;
  }
  return {
    type: input.customerType === "BUSINESS" ? "BUSINESS" : "CUSTOMER",
    name,
    business_name: input.businessName,
    vat_number: null,
    address_line1: null,
    address_line2: null,
    postal_code: null,
    city: null,
    country: input.billingCountry,
    email,
  };
}

export async function issueOppeInvoice(
  sb: Supa,
  input: { caseId: string; proposalId: string; paymentIntentId: string; paidAt: string },
): Promise<string> {
  const proposal = await loadCommercialProposalById(sb, input.proposalId);
  if (!proposal) throw new Error("proposal_not_found");
  const { data: caseRow, error } = await sb
    .from("marketplace_cases")
    .select("reference, brand, customer_user_id, dossier_id")
    .eq("id", input.caseId)
    .single();
  if (error) throw error;
  const brand: MarketplaceBrand = isMarketplaceBrand(caseRow.brand) ? caseRow.brand : "MA_RELIURE";
  const customer = await customerSnapshot(sb, {
    proposalId: input.proposalId,
    caseRow,
    billingCountry: proposal.billingCountry ?? proposal.taxCountry,
    customerType: proposal.customerType,
    businessName: proposal.businessName,
  });
  const { data: invoiceId, error: issueError } = await sb.rpc("marketplace_issue_oppe_invoice", {
    p_proposal_id: input.proposalId,
    p_seller: oppeSellerSnapshot(brand, customer.type) as never,
    p_customer: customer as never,
    p_payment: { method: "card", paid_at: input.paidAt, payment_intent_id: input.paymentIntentId } as never,
    p_service_label: serviceLineLabel({ brand, reference: caseRow.reference, serviceDescription: proposal.workshopServiceDescription }),
  });
  if (issueError) throw issueError;
  return invoiceId as string;
}

/** Le texte de la confirmation de commande, dans la langue de la marque. */
export function orderConfirmationContent(input: {
  brand: MarketplaceBrand;
  totalTtcCents: number;
  invoiceNumber: string;
  leadTimeDays: number | null;
}): { heading: string; intro: string; ctaLabel: string } {
  const en = input.brand === "FINE_BINDERY";
  const amount = new Intl.NumberFormat(en ? "en-GB" : "fr-FR", { style: "currency", currency: "EUR" }).format(input.totalTtcCents / 100);
  if (en) {
    return {
      heading: "Your order is confirmed",
      intro: `We have received your payment of ${amount}. Your invoice ${input.invoiceNumber}, issued by OPPE SAS for Fine Bindery, is available in your customer space. Next step: your book travels to the workshop we have selected${input.leadTimeDays ? `, which will carry out the work within about ${input.leadTimeDays} days of receiving it` : ""}.`,
      ctaLabel: "Follow my order",
    };
  }
  return {
    heading: "Votre commande est confirmée",
    intro: `Nous avons bien reçu votre paiement de ${amount}. Votre facture ${input.invoiceNumber}, émise par OPPE SAS pour Ma Reliure, est disponible dans votre espace « Mes livres ». Prochaine étape : votre livre rejoint l'atelier que nous avons choisi${input.leadTimeDays ? `, qui réalisera le travail en ${input.leadTimeDays} jours environ après sa réception` : ""}.`,
    ctaLabel: "Suivre ma commande",
  };
}

export async function sendOrderConfirmation(sb: Supa, input: { caseId: string; proposalId: string; invoiceId: string }): Promise<boolean> {
  const { data: order, error } = await sb
    .from("marketplace_oppe_orders")
    .select("confirmation_sent_at, brand")
    .eq("proposal_id", input.proposalId)
    .single();
  if (error) throw error;
  if (order.confirmation_sent_at) return false;
  const [{ data: invoice, error: iError }, { data: caseRow, error: cError }, proposal] = await Promise.all([
    sb.from("marketplace_oppe_invoices").select("number, total_ttc_cents").eq("id", input.invoiceId).single(),
    sb.from("marketplace_cases").select("customer_user_id, dossier_id").eq("id", input.caseId).single(),
    loadCommercialProposalById(sb, input.proposalId),
  ]);
  if (iError) throw iError;
  if (cError) throw cError;
  const brand: MarketplaceBrand = isMarketplaceBrand(order.brand) ? order.brand : "MA_RELIURE";
  const email = await customerEmail(sb, caseRow);
  if (!email) {
    const { caseReference, notifyAdmin } = await import("@/marketplace/notifications/adminAlerts.server");
    const { reference } = await caseReference(sb, input.caseId);
    await notifyAdmin({
      caseId: input.caseId,
      heading: `Confirmation de commande non envoyée — ${reference}`,
      intro: `La commande ${reference} est payée et facturée (${invoice.number}), mais aucune adresse e-mail n'est connue pour le client.`,
      idempotencyKey: `order-confirmation-no-address-${input.proposalId}`,
    });
    return false;
  }
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  const origin = MARKETPLACE_BRAND_CONFIGS[brand].seo.canonicalOrigin;
  const result = await sendTemplateEmail("case-activity", email, {
    templateData: {
      brandName: MARKETPLACE_BRAND_CONFIGS[brand].displayName,
      locale: brand === "FINE_BINDERY" ? "en-GB" : "fr-FR",
      ...orderConfirmationContent({ brand, totalTtcCents: invoice.total_ttc_cents, invoiceNumber: invoice.number, leadTimeDays: proposal?.workshopLeadTimeDays ?? null }),
      ctaUrl: `${origin}/mes-livres/${input.caseId}`,
    },
    brand,
    idempotencyKey: `order-confirmed-${input.proposalId}`,
  });
  if (!result.sent) throw new Error("order_confirmation_send_failed");
  const { error: markError } = await sb
    .from("marketplace_oppe_orders")
    .update({ confirmation_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("proposal_id", input.proposalId)
    .is("confirmation_sent_at", null);
  if (markError) throw markError;
  return true;
}

export async function onOppePaymentConfirmed(
  sb: Supa,
  input: { caseId: string; proposalId: string; paymentIntentId: string; paidAt?: string },
): Promise<{ orderOpened: boolean; invoiceId: string }> {
  const paidAt = input.paidAt ?? new Date().toISOString();
  const { data, error } = await sb.rpc("marketplace_open_oppe_order", { p_proposal_id: input.proposalId, p_paid_at: paidAt });
  if (error) throw error;
  try {
    await recordStripeFees(sb, input.proposalId, input.paymentIntentId);
  } catch (err) {
    // Les frais se relèvent aussi plus tard (rapprochement) : jamais une raison de bloquer la facture.
    logOperationalError("oppe-order.stripe-fees-failed", err, { caseId: input.caseId });
  }
  const invoiceId = await issueOppeInvoice(sb, { caseId: input.caseId, proposalId: input.proposalId, paymentIntentId: input.paymentIntentId, paidAt });
  // La confirmation ne bloque jamais la commande ni la facture : en cas d'échec l'équipe est prévenue
  // et `confirmation_sent_at` reste vide (un rejeu de l'événement la renverra).
  try {
    await sendOrderConfirmation(sb, { caseId: input.caseId, proposalId: input.proposalId, invoiceId });
  } catch (err) {
    logOperationalError("oppe-order.confirmation-failed", err, { caseId: input.caseId });
    try {
      const { caseReference, notifyAdmin } = await import("@/marketplace/notifications/adminAlerts.server");
      const { reference } = await caseReference(sb, input.caseId);
      await notifyAdmin({
        caseId: input.caseId,
        heading: `Confirmation de commande non partie — ${reference}`,
        intro: `La commande ${reference} est payée et facturée, mais l'e-mail de confirmation n'a pas pu partir. Prévenez le client vous-même.`,
        idempotencyKey: `order-confirmation-failed-${input.proposalId}`,
      });
    } catch (alertErr) {
      logOperationalError("oppe-order.confirmation-alert-failed", alertErr, { caseId: input.caseId });
    }
  }
  return { orderOpened: data === true, invoiceId };
}
