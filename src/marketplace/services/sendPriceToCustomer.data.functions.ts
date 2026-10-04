/**
 * « Valider et envoyer au client » — une demande directe Ma Reliure, en un clic.
 *
 * Décision d'Antoine du 4 octobre 2026. Le bouton enchaîne, sans en sauter
 * aucun contrôle, les quatre gestes que l'administration faisait à la main :
 *
 *   1. valider le prix (marketplace_validate_pricing, marges minimales) ;
 *   2. figer la proposition commerciale (transport au choix) ;
 *   3. appliquer la TVA française automatique (particulier en France) ;
 *   4. accepter la proposition, ce qui la rend payable par carte (Stripe) ;
 *
 * puis prévient le client par e-mail, avec un lien vers son espace où le
 * bouton « Payer » l'attend. Chaque étape réutilise la fonction « cœur » de
 * l'action manuelle correspondante : une seule règle par geste.
 *
 * Restent à la main, refusés ici avant toute écriture : Fine Bindery
 * (international), un client professionnel, un dossier qui prévoit un
 * acompte (paiement en deux temps indisponible). C'est l'administrateur qui
 * clique : il confirme le prix et que le client est un particulier en France.
 * Le moteur propose, l'humain décide.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertAdmin, type Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { logOperationalError } from "@/build/services/operationalLog.server";
import { ROUND_TRIP_PRODUCT } from "@/marketplace/shipping/logisticsPlan";
import { validateMarketplacePricingCore } from "./marketplace.data.functions";
import {
  acceptCommercialProposalCore,
  applyAutomaticFranceTaxPolicyCore,
  createCommercialProposalCore,
} from "./commercialProposal.data.functions";

const sendInput = z.object({
  caseId: z.string().uuid(),
  customerPriceCents: z.number().int().positive(),
  binderPayoutCents: z.number().int().positive(),
  priceIncludes: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  shippingOffer: z.enum(["manual", ROUND_TRIP_PRODUCT]).default("manual"),
});

export type SendPriceResult = {
  proposalId: string;
  totalTtcCents: number | null;
  /** Où l'e-mail est parti, ou pourquoi il n'est pas parti — l'écran le dit à l'administrateur. */
  email: { sent: true; to: "account" | "visitor" } | { sent: false; reason: "no_address" | "send_failed" };
};

/** Le texte de l'e-mail : montant TTC et chemin vers le paiement, rien d'autre. */
export function priceReadyEmailContent(totalTtcCents: number | null): { heading: string; intro: string; ctaLabel: string } {
  const amount =
    totalTtcCents === null
      ? null
      : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(totalTtcCents / 100);
  return {
    heading: "Le prix de votre projet est prêt",
    intro: amount
      ? `Ma Reliure a étudié votre livre. Le prix de votre projet est de ${amount} TTC. Vous pouvez le consulter et le régler par carte bancaire depuis votre espace « Mes livres ».`
      : "Ma Reliure a étudié votre livre. Le prix de votre projet vous attend dans votre espace « Mes livres », où vous pouvez le régler par carte bancaire.",
    ctaLabel: "Voir et régler",
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

export const sendPriceToCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => sendInput.parse(data))
  .handler(async ({ context, data }): Promise<SendPriceResult> => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: row, error } = await sb
      .from("marketplace_cases")
      .select("id, brand, pricing_status, deposit_cents, pricing_mode, customer_user_id, dossier_id")
      .eq("id", data.caseId)
      .maybeSingle();
    if (error) fail(500, error.message);
    if (!row) fail(404, "Dossier introuvable.");
    // Refus avant toute écriture : ces cas restent au parcours manuel.
    if (row.brand !== "MA_RELIURE")
      fail(409, "L'envoi en un clic est réservé aux demandes directes Ma Reliure. Utilisez les étapes manuelles.");
    if (row.pricing_mode === "ESTIMATE_THEN_CONFIRM" && row.deposit_cents)
      fail(409, "Ce dossier prévoit un acompte : le paiement en deux temps n'est pas disponible. Traitez-le avec les étapes manuelles.");

    const ctx = { supabase: context.supabase, userId: context.userId };
    const priceInput = {
      caseId: data.caseId,
      customerPriceCents: data.customerPriceCents,
      binderPayoutCents: data.binderPayoutCents,
      priceIncludes: data.priceIncludes,
    };
    if (row.pricing_status !== "validated") await validateMarketplacePricingCore(ctx, priceInput);

    const proposal = await createCommercialProposalCore(ctx, {
      caseId: data.caseId,
      shipping: { outboundCents: 0, returnCents: 0, otherCents: 0 },
      shippingOffer: data.shippingOffer,
    });
    const taxed = await applyAutomaticFranceTaxPolicyCore(ctx, {
      proposalId: proposal.id,
      billingCountry: "FR",
      customerType: "CUSTOMER",
      businessName: null,
      businessVatNumber: null,
    });
    await acceptCommercialProposalCore(ctx, proposal.id);

    const totalTtcCents = (taxed as { customerTotalTtcCents?: number | null }).customerTotalTtcCents ?? null;
    const email = await notifyCustomerOfProposal(sb, row, {
      caseId: data.caseId,
      proposalId: proposal.id,
      content: priceReadyEmailContent(totalTtcCents),
      emailKey: `price-ready-${proposal.id}`,
      alertKey: `price-email-failed-${proposal.id}`,
      state: "payable",
    });

    await sb.from("marketplace_events").insert({
      case_id: data.caseId,
      actor_user_id: context.userId,
      event_type: "price_sent_to_customer",
      metadata: { proposal_id: proposal.id, total_ttc_cents: totalTtcCents, shipping_offer: data.shippingOffer, email },
    });

    return { proposalId: proposal.id, totalTtcCents, email };
  });

/**
 * Prévient le client qu'une proposition l'attend (e-mail `case-activity`), et
 * l'équipe si l'e-mail n'a pas pu partir. Partagé par l'envoi en un clic et par
 * « Envoyer au client » du bloc Proposition commerciale.
 */
async function notifyCustomerOfProposal(
  sb: Supa,
  row: { customer_user_id: string | null; dossier_id: string | null },
  input: {
    caseId: string;
    proposalId: string;
    content: { heading: string; intro: string; ctaLabel: string };
    emailKey: string;
    alertKey: string;
    /** Ce que le client peut faire : payer tout de suite, ou d'abord accepter. */
    state: "payable" | "to_accept";
  },
): Promise<SendPriceResult["email"]> {
  let email: SendPriceResult["email"] = { sent: false, reason: "no_address" };
  const address = await customerAddress(sb, row);
  if (address) {
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      // Un compte existant va droit au dossier ; une adresse de visiteur passe par « Mes livres »,
      // où la connexion par lien rattache le dossier à cette adresse (claimCasesByVerifiedEmail).
      const ctaUrl = address.to === "account" ? `https://mareliure.fr/mes-livres/${input.caseId}` : "https://mareliure.fr/mes-livres";
      const result = await sendTemplateEmail("case-activity", address.email, {
        templateData: { brandName: "Ma Reliure", locale: "fr-FR", ...input.content, ctaUrl },
        brand: "MA_RELIURE",
        // Un double clic ou une relance ne doit jamais envoyer deux fois la même proposition.
        idempotencyKey: input.emailKey,
      });
      email = result.sent ? { sent: true, to: address.to } : { sent: false, reason: "send_failed" };
    } catch (err) {
      logOperationalError("send-proposal.notify-customer-failed", err, { caseId: input.caseId });
      email = { sent: false, reason: "send_failed" };
    }
  }
  // L'e-mail n'est pas parti : l'équipe est prévenue, en plus du message à l'écran.
  if (!email.sent) {
    const { caseReference, notifyAdmin } = await import("@/marketplace/notifications/adminAlerts.server");
    const { reference } = await caseReference(sb, input.caseId);
    const what = input.state === "payable" ? "est payable" : "attend l'accord du client";
    await notifyAdmin({
      caseId: input.caseId,
      heading: `E-mail de prix non parti — ${reference}`,
      intro:
        email.reason === "no_address"
          ? `La proposition du dossier ${reference} ${what}, mais aucune adresse e-mail n'est connue pour ce client. Prévenez-le vous-même.`
          : `La proposition du dossier ${reference} ${what}, mais l'e-mail au client n'a pas pu partir. Prévenez-le vous-même.`,
      idempotencyKey: input.alertKey,
    });
  }
  return email;
}

/** Le texte de l'e-mail quand le client doit d'abord accepter la proposition, puis payer. */
export function proposalReadyEmailContent(totalTtcCents: number | null): { heading: string; intro: string; ctaLabel: string } {
  const amount =
    totalTtcCents === null
      ? null
      : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(totalTtcCents / 100);
  return {
    heading: "Votre proposition est prête",
    intro: amount
      ? `Ma Reliure a préparé la proposition de votre projet : ${amount} TTC. Consultez-la dans votre espace « Mes livres », acceptez-la, puis réglez-la par carte bancaire.`
      : "Ma Reliure a préparé la proposition de votre projet. Consultez-la dans votre espace « Mes livres », acceptez-la, puis réglez-la par carte bancaire.",
    ctaLabel: "Voir ma proposition",
  };
}

/**
 * « Envoyer au client » — pour une proposition construite à la main (notamment
 * avec le transport aller-retour, qui suppose un atelier déjà retenu, donc un
 * prix déjà validé : le bouton en un clic n'est plus disponible à ce stade).
 *
 * Applique la TVA française automatique si la fiscalité n'est pas encore
 * validée (particulier en France), puis prévient le client par e-mail. Le
 * client accepte lui-même la proposition dans son espace, puis paie : rien
 * n'est accepté à sa place ici. Recette du 4 octobre 2026 : sans ce bouton,
 * le parcours manuel n'envoyait aucun e-mail.
 */
export const sendProposalToCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ proposalId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<SendPriceResult> => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { loadCommercialProposalById } = await import("./commercialProposalRepository.server");
    const proposal = await loadCommercialProposalById(sb, data.proposalId);
    if (!proposal) fail(404, "Proposition introuvable.");
    if (proposal.acceptedAt) fail(409, "Cette proposition est déjà acceptée : le client peut la régler depuis son espace.");
    if (proposal.status !== "proposed") fail(409, "Seule une proposition en cours peut être envoyée au client.");
    const { data: row, error } = await sb
      .from("marketplace_cases")
      .select("id, brand, customer_user_id, dossier_id")
      .eq("id", proposal.caseId)
      .maybeSingle();
    if (error) fail(500, error.message);
    if (!row) fail(404, "Dossier introuvable.");
    if (row.brand !== "MA_RELIURE")
      fail(409, "L'envoi au client est réservé aux demandes directes Ma Reliure. Prévenez ce client vous-même.");

    const ctx = { supabase: context.supabase, userId: context.userId };
    let totalTtcCents = proposal.customerTotalTtcCents ?? null;
    if (!proposal.taxValidatedAt) {
      const taxed = await applyAutomaticFranceTaxPolicyCore(ctx, {
        proposalId: proposal.id,
        billingCountry: "FR",
        customerType: "CUSTOMER",
        businessName: null,
        businessVatNumber: null,
      });
      totalTtcCents = (taxed as { customerTotalTtcCents?: number | null }).customerTotalTtcCents ?? null;
    }

    const email = await notifyCustomerOfProposal(sb, row, {
      caseId: proposal.caseId,
      proposalId: proposal.id,
      content: proposalReadyEmailContent(totalTtcCents),
      emailKey: `proposal-ready-${proposal.id}`,
      alertKey: `proposal-email-failed-${proposal.id}`,
      state: "to_accept",
    });

    await sb.from("marketplace_events").insert({
      case_id: proposal.caseId,
      actor_user_id: context.userId,
      event_type: "proposal_sent_to_customer",
      metadata: { proposal_id: proposal.id, total_ttc_cents: totalTtcCents, email },
    });

    return { proposalId: proposal.id, totalTtcCents, email };
  });
