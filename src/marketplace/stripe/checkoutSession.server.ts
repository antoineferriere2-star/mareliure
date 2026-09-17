/**
 * Créer un Checkout Stripe pour une proposition commerciale acceptée.
 *
 * `marketplace_commercial_proposals` (acceptée, immuable) est la SEULE
 * source du montant (§10) — jamais un montant envoyé par le navigateur. Le
 * client ne transmet qu'un `caseId` ; le serveur recharge le dossier, sa
 * proposition acceptée, vérifie que la fiscalité est résolue (§12) et que
 * personne n'a déjà payé (§17, §22 — fail closed sur toute donnée
 * manquante), puis construit le Checkout à partir de ce qu'il vient de
 * relire, jamais à partir de ce qu'on lui a dit.
 *
 * NO SANDBOX en production : `getMarketplaceStripeClient` doit parler au
 * compte live dédié `acct_1UGI34K0Q47WbZPf` — jamais `acct_1S530YKEMCwyPCrw`
 * (ancien compte partagé) ni `acct_1UGISJKB3EBc6Slh` (test, local
 * uniquement). `assertExpectedStripeAccount`, appelé plus bas, refuse
 * (fail closed) toute exécution si la clé posée répond pour un autre
 * compte — voir stripeAccountGuard.ts et CODEX_HANDOFF.md.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { canViewCase } from "@/marketplace/permissions";
import { loadCaseContext } from "@/marketplace/services/caseRepository.server";
import { loadAcceptedCommercialProposal } from "@/marketplace/services/commercialProposalRepository.server";
import {
  loadCommercialPaymentState,
  recordCheckoutSession,
} from "@/marketplace/services/commercialPaymentRepository.server";
import {
  buildCheckoutLineItems,
  checkoutEligibility,
  statementDescriptorSuffixForBrand,
} from "./checkoutPlan";
import { getStripeProductIds } from "./stripeConfig.server";
import { assertExpectedStripeAccount, getMarketplaceStripeClient } from "./stripeClient.server";

const uuid = z.string().uuid();

async function isAdminCaller(sb: Awaited<ReturnType<typeof admin>>, userId: string) {
  const { data } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!data;
}

export const createCommercialCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId: uuid }).parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();

    const caseContext = await loadCaseContext(sb, data.caseId);
    if (!caseContext) fail(404, "Dossier introuvable.");

    const isAdmin = await isAdminCaller(context.supabase, context.userId);
    const viewer = isAdmin
      ? ({ role: "admin" } as const)
      : ({ role: "customer", userId: context.userId } as const);
    const canView = canViewCase(viewer, {
      invitedBinderIds: caseContext.invitedBinderIds,
      selectedBinderId: caseContext.selectedBinderId,
      customerUserId: caseContext.customerUserId,
    });
    if (!canView) fail(403, "Forbidden");

    const proposal = await loadAcceptedCommercialProposal(sb, data.caseId);
    if (!proposal) fail(409, "Aucune proposition commerciale acceptée pour ce dossier.");

    const paymentState = await loadCommercialPaymentState(sb, proposal.id);
    if (paymentState?.paidAt) fail(409, "Cette commande est déjà payée.");

    const eligibility = checkoutEligibility({
      status: proposal.status,
      acceptedAt: proposal.acceptedAt,
      taxPolicy: proposal.taxPolicy,
      taxValidatedAt: proposal.taxValidatedAt,
      alreadyPaid: !!paymentState?.paidAt,
    });
    if (!eligibility.eligible) {
      const messages: Record<string, string> = {
        proposal_not_accepted: "Cette proposition n'est pas (encore) acceptée.",
        tax_review_required:
          "Le traitement fiscal de ce dossier doit d'abord être validé par un administrateur.",
        already_paid: "Cette commande est déjà payée.",
      };
      fail(409, messages[eligibility.reason]);
    }

    // Avant tout appel Stripe réel — jamais après (§1 du brief du 16
    // septembre 2026, migration vers acct_1UGI34K0Q47WbZPf) : la clé posée
    // doit répondre pour le compte dédié, jamais l'ancien compte partagé.
    await assertExpectedStripeAccount();

    // Idempotent : une session déjà créée pour cette proposition est
    // réutilisée plutôt que dupliquée (§17) — Stripe renvoie l'URL de la
    // session existante tant qu'elle n'a pas expiré.
    if (paymentState?.stripeCheckoutSessionId) {
      const stripe = getMarketplaceStripeClient();
      const existing = await stripe.checkout.sessions.retrieve(paymentState.stripeCheckoutSessionId);
      if (existing.status === "open" && existing.url) {
        return { url: existing.url };
      }
    }

    const host = getRequestHost();
    const origin = `https://${host}`;
    const productIds = getStripeProductIds();
    const lineItems = buildCheckoutLineItems(
      {
        brand: proposal.brand,
        currency: proposal.currency,
        customerServicePriceCents: proposal.customerServicePriceCents,
        shippingTotalCents: proposal.shippingTotalCents,
      },
      productIds,
    );

    const stripe = getMarketplaceStripeClient();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: caseContext.customerEmail ?? undefined,
        line_items: lineItems.map((line) => ({
          quantity: line.quantity,
          price_data: {
            currency: line.currency,
            product: line.productId,
            unit_amount: line.unitAmountCents,
          },
        })),
        success_url: `${origin}/mes-livres/${data.caseId}?checkout=success`,
        cancel_url: `${origin}/mes-livres/${data.caseId}?checkout=cancelled`,
        metadata: {
          case_id: data.caseId,
          proposal_id: proposal.id,
          brand: proposal.brand,
        },
        payment_intent_data: {
          // Le suffixe de relevé bancaire par marque — jamais fourni par
          // le navigateur, dérivé ici du brand de la proposition acceptée
          // (voir checkoutPlan.ts). Combiné par Stripe avec le préfixe
          // raccourci du compte ("OPPE", à poser côté Dashboard) pour
          // donner par exemple "OPPE* MARELIURE" sur un paiement carte.
          statement_descriptor_suffix: statementDescriptorSuffixForBrand(proposal.brand),
          metadata: {
            case_id: data.caseId,
            proposal_id: proposal.id,
            brand: proposal.brand,
          },
        },
      },
      // Une clé stable par proposition : un retry réseau sur cet appel ne
      // crée jamais une deuxième session Stripe pour la même commande.
      { idempotencyKey: `checkout-session-${proposal.id}` },
    );

    await recordCheckoutSession(sb, proposal.id, session.id);

    await sb.from("marketplace_events").insert({
      case_id: data.caseId,
      actor_user_id: context.userId,
      event_type: "stripe_checkout_created",
      metadata: { proposal_id: proposal.id, checkout_session_id: session.id },
    });

    if (!session.url) fail(500, "Stripe n'a pas renvoyé d'URL de paiement.");
    return { url: session.url };
  });
