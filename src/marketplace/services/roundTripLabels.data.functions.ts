import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { loadCaseContext } from "./caseRepository.server";
import { loadAcceptedCommercialProposal } from "./commercialProposalRepository.server";
import { loadCommercialPaymentState } from "./commercialPaymentRepository.server";
import { requireBinderId } from "./binderQuotes.server";

const bucket = "round-trip-labels-private";
const input = z.object({ caseId: z.string().uuid(), direction: z.enum(["outbound", "return"]) }).strict();
const jobSchema = z.object({
  id: z.string().uuid(), case_id: z.string().uuid(), proposal_id: z.string().uuid(),
  binder_id: z.string().uuid(), direction: z.enum(["outbound", "return"]),
  stripe_payment_intent_id: z.string(), status: z.string(), private_label_path: z.string().nullable(),
});

/** One-minute label URL for the verified owner (outbound) or selected atelier (return). */
export const getRoundTripLabel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => input.parse(value))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const caseContext = await loadCaseContext(sb, data.caseId);
    if (!caseContext) fail(404, "Dossier introuvable.");

    // Check ownership directly before looking up a private label or signing a URL.
    // Knowledge of a case UUID alone never grants access.
    let binderId: string | null = null;
    if (data.direction === "outbound") {
      if (!caseContext.customerUserId || caseContext.customerUserId !== context.userId)
        fail(403, "Accès refusé.");
    } else {
      binderId = await requireBinderId(sb, context.userId);
      if (!caseContext.selectedBinderId || caseContext.selectedBinderId !== binderId)
        fail(403, "Accès refusé.");
    }

    const proposal = await loadAcceptedCommercialProposal(sb, data.caseId);
    if (!proposal || proposal.shippingOfferKind !== "book_round_trip_fr" ||
      proposal.paymentCircuit !== "legacy_resale") fail(404, "Étiquette indisponible.");
    const payment = await loadCommercialPaymentState(sb, proposal.id);
    if (!payment?.paidAt || !payment.stripePaymentIntentId || !payment.stripeCheckoutSessionId)
      fail(404, "Étiquette indisponible.");

    // This draft table is validated at the boundary until Database is regenerated from test Supabase.
    const { data: raw, error } = await (sb as unknown as SupabaseClient)
      .from("marketplace_round_trip_label_jobs")
      .select("id,case_id,proposal_id,binder_id,direction,stripe_payment_intent_id,status,private_label_path")
      .eq("case_id", data.caseId).eq("direction", data.direction).maybeSingle();
    if (error) fail(503, "Étiquette indisponible.");
    const parsed = jobSchema.safeParse(raw);
    if (!parsed.success) fail(404, "Étiquette indisponible.");
    const job = parsed.data;
    if (job.status !== "confirmed" || job.case_id !== data.caseId || job.direction !== data.direction ||
      job.proposal_id !== proposal.id || job.binder_id !== caseContext.selectedBinderId ||
      (data.direction === "return" && job.binder_id !== binderId) ||
      job.stripe_payment_intent_id !== payment.stripePaymentIntentId ||
      job.private_label_path !== `${job.id}/label.pdf`) fail(404, "Étiquette indisponible.");

    const { data: signed, error: storageError } = await sb.storage.from(bucket)
      .createSignedUrl(`${job.id}/label.pdf`, 60);
    if (storageError || !signed?.signedUrl) fail(503, "Étiquette momentanément indisponible.");
    return { url: signed.signedUrl, expiresInSeconds: 60 };
  });
