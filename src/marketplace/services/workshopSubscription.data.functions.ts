import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "@/build/services/adminAuth.server";
import { findActiveBinderMembership } from "./binderMembership.server";
import { fail } from "@/build/services/serverError";
import {
  createWorkshopCheckout,
  loadWorkshopSubscription,
  workshopBillingOwner,
} from "./workshopSubscription.server";
import {
  assertExpectedStripeAccount,
  getMarketplaceStripeClient,
} from "@/marketplace/stripe/stripeClient.server";
import { workshopOrigin } from "@/marketplace/billing/workshopSubscription";
import { workshopFeeDocumentView } from "./workshopFeeDocuments.server";
import { renderDocumentPdf } from "@/marketplace/quotes/documentPdf";
import { requireWorkshopAccess } from "./workshopAccess.server";

export const getMyWorkshopSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const member = await findActiveBinderMembership(sb, context.userId);
    if (!member) fail(403, "no_binder");
    const state = await loadWorkshopSubscription(sb, member!.binderId);
    const [documents, notices, feeDocuments] = await Promise.all([
      sb
        .from("marketplace_workshop_billing_documents")
        .select("*")
        .eq("binder_id", member!.binderId)
        .order("issued_at", { ascending: false })
        .limit(36),
      sb
        .from("marketplace_workshop_notices")
        .select("id,heading,intro,created_at,sent_at,captured_at")
        .eq("binder_id", member!.binderId)
        .order("created_at", { ascending: false })
        .limit(20),
      sb.from("marketplace_workshop_fee_documents")
        .select("id,kind,number,issued_at,total_ht_cents,total_vat_cents,total_ttc_cents")
        .eq("binder_id", member!.binderId).order("issued_at", { ascending: false }).limit(100),
    ]);
    if (documents.error) throw documents.error;
    if (notices.error) throw notices.error;
    if (feeDocuments.error) throw feeDocuments.error;
    return {
      ...state,
      documents: documents.data,
      notices: notices.data,
      feeDocuments: feeDocuments.data,
      isOwner: member!.role === "OWNER",
    };
  });

export const getMyWorkshopFeeDocumentPdf = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ documentId: z.string().uuid() }).strict().parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binderId = await requireWorkshopAccess(sb, context.userId);
    const row = await sb.from("marketplace_workshop_fee_documents").select("*")
      .eq("id", data.documentId).eq("binder_id", binderId).single();
    if (row.error || !row.data) fail(404, "Document de frais introuvable.");
    const original = row.data.invoice_document_id
      ? await sb.from("marketplace_workshop_fee_documents").select("*")
        .eq("id", row.data.invoice_document_id).eq("binder_id", binderId).single()
      : { data: undefined, error: null };
    if (original.error) throw original.error;
    const { base64 } = await renderDocumentPdf(workshopFeeDocumentView(row.data, original.data));
    return { filename: `${row.data.number.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`, base64 };
  });

export const createMyWorkshopCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ accepted: z.literal(true) })
      .strict()
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    createWorkshopCheckout(await admin(), context.userId, data.accepted),
  );

export const createMyWorkshopBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const binderId = await workshopBillingOwner(sb, context.userId);
    const { subscription } = await loadWorkshopSubscription(sb, binderId);
    if (!subscription.stripe_customer_id) fail(409, "Aucun abonnement à gérer.");
    await assertExpectedStripeAccount();
    const portal = await getMarketplaceStripeClient().billingPortal.sessions.create({
      ...(subscription.stripe_customer_id!.startsWith("acct_")
        ? { customer_account: subscription.stripe_customer_id! }
        : { customer: subscription.stripe_customer_id! }),
      return_url: `${workshopOrigin()}/atelier/abonnement`,
    });
    return { url: portal.url };
  });
