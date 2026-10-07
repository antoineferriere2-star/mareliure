import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { admin } from "@/build/services/adminAuth.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fail } from "@/build/services/serverError";
import { requireWorkshopAccess } from "./workshopAccess.server";
import { getInvoice, getCreditNote } from "./binderQuotes.server";
import { renderDocumentPdf } from "@/marketplace/quotes/documentPdf";
import { getRequestHost } from "@tanstack/react-start/server";
import { resolveMarketplaceBrandForRequest } from "@/marketplace/brand/resolveRequestBrand.server";
import { frenchWorkshopTaxEligibility } from "@/marketplace/billing/workshopTax";
import { workshopBillingOwner, loadWorkshopSubscription } from "./workshopSubscription.server";
import {
  workshopOrigin,
  WORKSHOP_SUBSCRIPTION_TERMS,
} from "@/marketplace/billing/workshopSubscription";
import {
  createBinderOnboardingLink,
  refreshBinderConnectStatus,
} from "@/marketplace/stripe/binderConnect.server";
import {
  createWorkshopInvoicePaymentLink,
  createWorkshopInvoiceCheckout,
  paymentByToken,
  refundWorkshopInvoice,
} from "@/marketplace/stripe/workshopOnlinePayment.server";

export const startMyWorkshopConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ accepted: z.literal(true) })
      .strict()
      .parse(data),
  )
  .handler(async ({ context }) => {
    const sb = await admin();
    const binderId = await workshopBillingOwner(sb, context.userId);
    const { settings } = await loadWorkshopSubscription(sb, binderId);
    if (!settings.online_payment_open && !settings.connect_onboarding_open) fail(409, "La configuration des paiements n’est pas encore ouverte.");
    const profile = await sb.from("marketplace_binder_billing_profiles").select("*").eq("binder_id", binderId).maybeSingle();
    if (profile.error) throw profile.error;
    const eligibility = frenchWorkshopTaxEligibility(profile.data);
    if (eligibility) fail(409, eligibility);
    const previous = await sb.from("marketplace_workshop_connect_consents").select("*").eq("binder_id", binderId).maybeSingle();
    if (previous.error) throw previous.error;
    if (previous.data?.fee_tax_basis === "explicit_ht_legacy")
      fail(409, "Votre convention prévoit des frais HT. Contactez Oppe pour une transition administrative explicite avant toute modification.");
    if (previous.data?.terms_version !== WORKSHOP_SUBSCRIPTION_TERMS) {
    const consent = await sb.from("marketplace_workshop_connect_consents").upsert({
      binder_id: binderId,
      accepted_by: context.userId,
      accepted_at: new Date().toISOString(),
      terms_version: WORKSHOP_SUBSCRIPTION_TERMS,
      fee_bps: 300,
      fee_tax_basis: "vat_inclusive_fr_20",
    });
    if (consent.error) throw consent.error;
    }
    const url = `${workshopOrigin()}/atelier/abonnement`;
    return createBinderOnboardingLink(sb, binderId, {
      returnUrl: `${url}?connect=returned`,
      refreshUrl: `${url}?connect=refresh`,
    });
  });
export const resumeMyWorkshopConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const binderId = await workshopBillingOwner(sb, context.userId);
    const { settings } = await loadWorkshopSubscription(sb, binderId);
    if (!settings.online_payment_open && !settings.connect_onboarding_open) fail(409, "La configuration des paiements n’est pas encore ouverte.");
    const consent = await sb
      .from("marketplace_workshop_connect_consents")
      .select("binder_id")
      .eq("binder_id", binderId)
      .maybeSingle();
    if (consent.error) throw consent.error;
    if (!consent.data) fail(409, "Votre accord aux conditions ateliers est requis.");
    const url = `${workshopOrigin()}/atelier/abonnement`;
    return createBinderOnboardingLink(sb, binderId, {
      returnUrl: `${url}?connect=returned`,
      refreshUrl: `${url}?connect=refresh`,
    });
  });
export const refreshMyWorkshopConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    return refreshBinderConnectStatus(sb, await workshopBillingOwner(sb, context.userId));
  });
export const createMyInvoicePaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ invoiceId: z.string().uuid() }).strict().parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binderId = await workshopBillingOwner(sb, context.userId);
    const existing = await sb.from("marketplace_workshop_online_payments").select("id")
      .eq("binder_id", binderId).eq("invoice_id", data.invoiceId).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) {
      const status = await refreshBinderConnectStatus(sb, binderId);
      if (!status.onboarded) fail(409, "Terminez la configuration Stripe de votre atelier.");
    }
    return createWorkshopInvoicePaymentLink(sb, binderId, data.invoiceId,
      resolveMarketplaceBrandForRequest(getRequestHost(), process.env.MARKETPLACE_BRAND_OVERRIDE));
  });
export const getMyInvoiceOnlinePayment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ invoiceId: z.string().uuid() }).strict().parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binderId = await requireWorkshopAccess(sb, context.userId);
    const result = await sb
      .from("marketplace_workshop_online_payments")
      .select(
        "id,status,amount_cents,fee_cents,fee_tax_basis,fee_refunded_cents,stripe_fee_cents,refunded_cents,disputed,reconciliation_required,paid_at",
      )
      .eq("invoice_id", data.invoiceId)
      .eq("binder_id", binderId)
      .maybeSingle();
    if (result.error) throw result.error;
    const refunds = result.data
      ? await sb
          .from("marketplace_workshop_online_refunds")
          .select("credit_note_id,amount_cents,stripe_refund_id,status")
          .eq("payment_id", result.data.id)
      : { data: [], error: null };
    if (refunds.error) throw refunds.error;
    const { settings } = await loadWorkshopSubscription(sb, binderId);
    return {
      payment: result.data,
      refunds: refunds.data ?? [],
      open: settings.online_payment_open,
    };
  });
export const refundMyWorkshopOnlinePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ paymentId: z.string().uuid(), creditId: z.string().uuid() }).strict().parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    return refundWorkshopInvoice(
      sb,
      await workshopBillingOwner(sb, context.userId),
      data.paymentId,
      data.creditId,
    );
  });
const token = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const getWorkshopPublicPayment = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => token.parse(data))
  .handler(async ({ data }) => {
    const sb = await admin();
    const p = await paymentByToken(sb, data.token);
    const invoice = await sb
      .from("marketplace_binder_invoices")
      .select("invoice_number,issuer")
      .eq("id", p.invoice_id)
      .eq("binder_id", p.binder_id)
      .single();
    if (invoice.error) throw invoice.error;
    const credits = await sb
      .from("marketplace_binder_credit_notes")
      .select("id,credit_note_number,total_ttc_cents")
      .eq("binder_id", p.binder_id)
      .eq("invoice_id", p.invoice_id);
    if (credits.error) throw credits.error;
    const issuer = invoice.data.issuer as { legalName?: string; workshopName?: string };
    const settings = await sb.from("marketplace_workshop_offer_settings").select("online_payment_open").eq("id", true).single();
    if (settings.error) throw settings.error;
    return {
      number: invoice.data.invoice_number,
      seller: issuer.legalName ?? issuer.workshopName ?? "Votre atelier",
      amountCents: p.amount_cents,
      status: p.status,
      refundedCents: p.refunded_cents,
      receiptUrl: p.receipt_url,
      credits: credits.data,
      canPay: settings.data.online_payment_open,
    };
  });
export const getWorkshopPublicInvoicePdf = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => token.parse(data))
  .handler(async ({ data }) => {
    const sb = await admin();
    const p = await paymentByToken(sb, data.token);
    const invoice = await getInvoice(sb, p.binder_id, p.invoice_id);
    if (invoice.status === "draft") fail(409, "La facture doit être émise.");
    const { base64 } = await renderDocumentPdf(invoice);
    return { filename: `facture-${invoice.number.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`, base64 };
  });
export const getWorkshopPublicCreditPdf = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({ token: z.string().regex(/^[a-f0-9]{64}$/), creditId: z.string().uuid() })
      .strict()
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const p = await paymentByToken(sb, data.token);
    const row = await sb
      .from("marketplace_binder_credit_notes")
      .select("id")
      .eq("id", data.creditId)
      .eq("binder_id", p.binder_id)
      .eq("invoice_id", p.invoice_id)
      .maybeSingle();
    if (row.error) throw row.error;
    if (!row.data) fail(404, "Avoir introuvable.");
    const credit = await getCreditNote(sb, p.binder_id, data.creditId);
    const { base64 } = await renderDocumentPdf(credit);
    return { filename: `avoir-${credit.number.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`, base64 };
  });
export const createPublicWorkshopCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => token.parse(data))
  .handler(async ({ data }) => createWorkshopInvoiceCheckout(await admin(), data.token));
