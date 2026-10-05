import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { admin } from "@/build/services/adminAuth.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fail } from "@/build/services/serverError";
import { requireWorkshopAccess } from "./workshopAccess.server";
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
    if (!settings.online_payment_open) fail(409, "Le paiement en ligne n’est pas encore ouvert.");
    const consent = await sb
      .from("marketplace_workshop_connect_consents")
      .upsert({
        binder_id: binderId,
        accepted_by: context.userId,
        terms_version: WORKSHOP_SUBSCRIPTION_TERMS,
        fee_bps: 300,
      });
    if (consent.error) throw consent.error;
    const url = `${workshopOrigin()}/atelier/abonnement`;
    return createBinderOnboardingLink(sb, binderId, { returnUrl: url, refreshUrl: url });
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
    const status = await refreshBinderConnectStatus(sb, binderId);
    if (!status.onboarded) fail(409, "Terminez la configuration Stripe de votre atelier.");
    return createWorkshopInvoicePaymentLink(sb, binderId, data.invoiceId);
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
        "id,status,amount_cents,fee_cents,stripe_fee_cents,refunded_cents,disputed,reconciliation_required,paid_at",
      )
      .eq("invoice_id", data.invoiceId)
      .eq("binder_id", binderId)
      .maybeSingle();
    if (result.error) throw result.error;
    const { settings } = await loadWorkshopSubscription(sb, binderId);
    return { payment: result.data, open: settings.online_payment_open };
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
    const issuer = invoice.data.issuer as { legalName?: string; workshopName?: string };
    return {
      number: invoice.data.invoice_number,
      seller: issuer.legalName ?? issuer.workshopName ?? "Votre atelier",
      amountCents: p.amount_cents,
      status: p.status,
      refundedCents: p.refunded_cents,
    };
  });
export const createPublicWorkshopCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => token.parse(data))
  .handler(async ({ data }) => createWorkshopInvoiceCheckout(await admin(), data.token));
