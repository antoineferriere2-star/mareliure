/**
 * « Créer et envoyer le devis au client » — activité A, modèle Oppe du 5 octobre 2026.
 *
 * Préalables vérifiés avant toute écriture : prix validé (marge cible de 25 % ou dérogation
 * motivée), atelier retenu ayant accepté la prestation, sa rémunération et son délai. Le bouton
 * enchaîne alors, chacun par sa fonction « cœur » :
 *
 *   1. figer le devis Oppe (brouillon lié à l'accord atelier, transport au choix) ;
 *   2. contrôler que la fiscalité (qualification de la prestation, taux de chaque ligne) est validée ;
 *   3. l'envoyer : il devient visible dans l'espace du client, qui l'accepte lui-même — case des
 *      conditions générales cochée — puis le règle. Rien n'est jamais accepté à sa place.
 *
 * Tant que l'administration n'a pas validé la fiscalité, le devis reste en brouillon : elle la
 * valide dans le panneau du devis, puis l'envoie avec « Envoyer au client ». Aucun taux unique
 * n'est présumé, ni pour Oppe ni pour un atelier.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertAdmin, type Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { logOperationalError } from "@/build/services/operationalLog.server";
import { ROUND_TRIP_PRODUCT } from "@/marketplace/shipping/logisticsPlan";
import { MARKETPLACE_BRAND_CONFIGS, isMarketplaceBrand, type MarketplaceBrand } from "@/marketplace/brand/brandConfig";
import { createCommercialProposalCore } from "./commercialProposal.data.functions";
import { loadCommercialProposalById, markCommercialProposalSent } from "./commercialProposalRepository.server";

const sendInput = z.object({
  caseId: z.string().uuid(),
  shippingOffer: z.enum(["manual", ROUND_TRIP_PRODUCT]).default("manual"),
});

export type SendPriceResult = {
  proposalId: string;
  totalTtcCents: number | null;
  /** Où l'e-mail est parti, ou pourquoi il n'est pas parti — l'écran le dit à l'administrateur. */
  email:
    | { sent: true; to: "account" | "visitor" }
    | { sent: false; reason: "no_address" | "send_failed" | "tax_review_required" };
};

const formatAmount = (cents: number, brand: MarketplaceBrand) =>
  new Intl.NumberFormat(brand === "FINE_BINDERY" ? "en-GB" : "fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

/** Le texte de l'e-mail : le devis attend l'accord du client, puis son règlement. */
export function proposalReadyEmailContent(
  totalTtcCents: number | null,
  brand: MarketplaceBrand = "MA_RELIURE",
): { heading: string; intro: string; ctaLabel: string } {
  const amount = totalTtcCents === null ? null : formatAmount(totalTtcCents, brand);
  if (brand === "FINE_BINDERY") {
    return {
      heading: "Your quote is ready",
      intro: amount
        ? `Fine Bindery has prepared the quote for your project: ${amount} including tax. Review it in your customer space, accept it and the terms of sale, then pay securely by card.`
        : "Fine Bindery has prepared the quote for your project. Review it in your customer space, accept it and the terms of sale, then pay securely by card.",
      ctaLabel: "View my quote",
    };
  }
  return {
    heading: "Votre devis est prêt",
    intro: amount
      ? `Ma Reliure a préparé le devis de votre projet : ${amount} TTC. Consultez-le dans votre espace « Mes livres », acceptez-le avec les conditions générales de vente, puis réglez-le par carte bancaire.`
      : "Ma Reliure a préparé le devis de votre projet. Consultez-le dans votre espace « Mes livres », acceptez-le avec les conditions générales de vente, puis réglez-le par carte bancaire.",
    ctaLabel: "Voir mon devis",
  };
}

async function customerAddress(
  sb: Supa,
  row: { customer_user_id: string | null; dossier_id: string | null },
): Promise<{ email: string; to: "account" | "visitor" } | null> {
  if (row.customer_user_id) {
    const { data } = await sb.auth.admin.getUserById(row.customer_user_id);
    if (data?.user?.email) return { email: data.user.email, to: "account" };
  }
  if (row.dossier_id) {
    const { data } = await sb.from("build_dossiers").select("visitor_email").eq("id", row.dossier_id).maybeSingle();
    const email = (data?.visitor_email as string | null | undefined)?.trim();
    if (email) return { email, to: "visitor" };
  }
  return null;
}

type CaseRowForSend = { id: string; brand: string; customer_user_id: string | null; dossier_id: string | null };

/**
 * Prévient le client qu'un devis l'attend (e-mail `case-activity`, au nom de la marque), et
 * l'équipe si l'e-mail n'a pas pu partir.
 */
async function notifyCustomerOfProposal(
  sb: Supa,
  row: CaseRowForSend,
  input: { proposalId: string; totalTtcCents: number | null },
): Promise<SendPriceResult["email"]> {
  const brand: MarketplaceBrand = isMarketplaceBrand(row.brand) ? row.brand : "MA_RELIURE";
  const origin = MARKETPLACE_BRAND_CONFIGS[brand].seo.canonicalOrigin;
  let email: SendPriceResult["email"] = { sent: false, reason: "no_address" };
  const address = await customerAddress(sb, row);
  if (address) {
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      // Un compte existant va droit au dossier ; une adresse de visiteur passe par « Mes livres »,
      // où la connexion par lien rattache le dossier à cette adresse (claimCasesByVerifiedEmail).
      const ctaUrl = address.to === "account" ? `${origin}/mes-livres/${row.id}` : `${origin}/mes-livres`;
      const result = await sendTemplateEmail("case-activity", address.email, {
        templateData: {
          brandName: MARKETPLACE_BRAND_CONFIGS[brand].displayName,
          locale: brand === "FINE_BINDERY" ? "en-GB" : "fr-FR",
          ...proposalReadyEmailContent(input.totalTtcCents, brand),
          ctaUrl,
        },
        brand,
        // Un double clic ou une relance n'envoie jamais deux fois le même devis.
        idempotencyKey: `proposal-ready-${input.proposalId}`,
      });
      email = result.sent ? { sent: true, to: address.to } : { sent: false, reason: "send_failed" };
    } catch (err) {
      logOperationalError("send-proposal.notify-customer-failed", err, { caseId: row.id });
      email = { sent: false, reason: "send_failed" };
    }
  }
  if (!email.sent) {
    const { caseReference, notifyAdmin } = await import("@/marketplace/notifications/adminAlerts.server");
    const { reference } = await caseReference(sb, row.id);
    await notifyAdmin({
      caseId: row.id,
      heading: `E-mail de devis non parti — ${reference}`,
      intro:
        email.reason === "no_address"
          ? `Le devis du dossier ${reference} attend l'accord du client, mais aucune adresse e-mail n'est connue. Prévenez-le vous-même.`
          : `Le devis du dossier ${reference} attend l'accord du client, mais l'e-mail n'a pas pu partir. Prévenez-le vous-même.`,
      idempotencyKey: `proposal-email-failed-${input.proposalId}`,
    });
  }
  return email;
}

/**
 * Rend visible un devis brouillon dont la fiscalité est validée par l'administration, puis prévient le client.
 */
async function sendDraft(
  sb: Supa,
  ctx: { supabase: Parameters<typeof assertAdmin>[0]; userId: string },
  row: CaseRowForSend,
  proposalId: string,
): Promise<SendPriceResult> {
  const proposal = await loadCommercialProposalById(sb, proposalId);
  if (!proposal) fail(404, "Devis introuvable.");
  if (proposal.acceptedAt) fail(409, "Ce devis est déjà accepté : le client peut le régler depuis son espace.");
  // Aucun taux n'est appliqué en silence : un devis Oppe sans validation fiscale reste en brouillon.
  if (!proposal?.taxValidatedAt) {
    return { proposalId, totalTtcCents: null, email: { sent: false, reason: "tax_review_required" } };
  }
  if (proposal.status === "draft") await markCommercialProposalSent(sb, proposalId);
  else if (proposal.status !== "proposed") fail(409, "Seul un devis en cours peut être envoyé au client.");

  const totalTtcCents = proposal.customerTotalTtcCents ?? null;
  const email = await notifyCustomerOfProposal(sb, row, { proposalId, totalTtcCents });
  await sb.from("marketplace_events").insert({
    case_id: row.id,
    actor_user_id: ctx.userId,
    event_type: "proposal_sent_to_customer",
    metadata: { proposal_id: proposalId, total_ttc_cents: totalTtcCents, email },
  });
  return { proposalId, totalTtcCents, email };
}

async function loadCaseForSend(sb: Supa, caseId: string) {
  const { data: row, error } = await sb
    .from("marketplace_cases")
    .select("id, brand, deposit_cents, pricing_mode, customer_user_id, dossier_id")
    .eq("id", caseId)
    .maybeSingle();
  if (error) fail(500, error.message);
  if (!row) fail(404, "Dossier introuvable.");
  return row;
}

export const sendPriceToCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => sendInput.parse(data))
  .handler(async ({ context, data }): Promise<SendPriceResult> => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const row = await loadCaseForSend(sb, data.caseId);
    if (row.pricing_mode === "ESTIMATE_THEN_CONFIRM" && row.deposit_cents)
      fail(409, "Ce dossier prévoit un acompte : le paiement en deux temps n'est pas disponible.");
    const ctx = { supabase: context.supabase, userId: context.userId };
    const proposal = await createCommercialProposalCore(ctx, {
      caseId: data.caseId,
      shipping: { outboundCents: 0, returnCents: 0, otherCents: 0 },
      shippingOffer: data.shippingOffer,
    });
    return sendDraft(sb, ctx, row, proposal.id);
  });

/** « Envoyer au client » — un devis brouillon (après validation de sa fiscalité), ou un rappel. */
export const sendProposalToCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ proposalId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<SendPriceResult> => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const proposal = await loadCommercialProposalById(sb, data.proposalId);
    if (!proposal) fail(404, "Devis introuvable.");
    const row = await loadCaseForSend(sb, proposal.caseId);
    return sendDraft(sb, { supabase: context.supabase, userId: context.userId }, row, proposal.id);
  });
