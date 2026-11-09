/**
 * Les deux moments d'une offre Oppe qui ne prévenaient personne (8 novembre 2026, dossier RL-013) :
 *
 * - l'équipe envoie un projet à un atelier : l'atelier n'en savait rien tant qu'il n'ouvrait pas son
 *   espace. Il reçoit désormais un e-mail qui renvoie vers le dossier ;
 * - l'atelier accepte ou refuse : l'équipe n'en savait rien tant qu'elle ne rouvrait pas le dossier.
 *   Elle reçoit désormais une alerte à l'adresse de contact.
 *
 * Contenu minimal, comme les autres alertes : référence et marque, jamais la rémunération, le prix
 * client ni les coordonnées du client. Le détail se lit derrière l'authentification. Aucune de ces
 * notifications ne fait échouer l'offre ou la réponse qui la déclenche.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import { logOperationalError } from "@/build/services/operationalLog.server";
import { canonicalHome, type MarketplaceBrand } from "@/marketplace/brand/brandConfig";
import { notifyAdmin } from "./adminAlerts.server";
import { notifyWorkshop } from "./workshopNotices.server";

async function caseFacts(sb: Supa, caseId: string): Promise<{ reference: string; brand: MarketplaceBrand }> {
  const { data } = await sb.from("marketplace_cases").select("reference, brand").eq("id", caseId).maybeSingle();
  return {
    reference: (data?.reference as string | undefined) ?? caseId.slice(0, 8),
    brand: data?.brand === "FINE_BINDERY" ? "FINE_BINDERY" : "MA_RELIURE",
  };
}

function normalizedInstant(value: string): string {
  const time = Date.parse(value);
  return Number.isNaN(time) ? value : new Date(time).toISOString();
}

export function workshopOfferNotice(input: {
  caseId: string;
  binderId: string;
  offeredAt: string;
  reference: string;
  brand: MarketplaceBrand;
  reassignment?: boolean;
}) {
  const brandName = input.brand === "FINE_BINDERY" ? "Fine Bindery" : "Ma Reliure";
  return {
    // Fine Bindery : la session de l'atelier vit sur finebindery.com, pas sur mareliure.fr.
    ctaOrigin: input.brand === "FINE_BINDERY" ? canonicalHome("FINE_BINDERY").replace(/\/+$/, "") : undefined,
    // Une offre = un envoi : un double clic ou une reprise ne renvoie rien, une nouvelle offre si.
    // Horodatage normalisé : relu en base (`+00:00`), il doit redonner la clé du premier envoi (`Z`).
    id: `offer-${input.caseId}-${input.binderId}-${normalizedInstant(input.offeredAt)}`,
    binderId: input.binderId,
    brand: input.brand,
    heading: `Nouvelle proposition de projet — ${input.reference}`,
    intro: input.reassignment
      ? `${brandName} vous propose de reprendre le projet ${input.reference}. La prestation et votre rémunération vous attendent dans votre espace atelier : acceptez-les avec votre délai, ou refusez-les.`
      : `${brandName} vous propose le projet ${input.reference}. La prestation et votre rémunération vous attendent dans votre espace atelier : acceptez-les avec votre délai, ou refusez-les.`,
    ctaPath: `/atelier/leads/${input.caseId}`,
    ctaLabel: "Voir la proposition",
  };
}

/** Prévient chaque atelier sollicité. Un échec est journalisé ; l'offre, elle, est déjà enregistrée. */
export async function notifyWorkshopsOfOffer(
  sb: Supa,
  input: { caseId: string; binderIds: string[]; offeredAt: string; reassignment?: boolean },
): Promise<number> {
  let sent = 0;
  try {
    const { reference, brand } = await caseFacts(sb, input.caseId);
    for (const binderId of input.binderIds) {
      try {
        await notifyWorkshop(sb, workshopOfferNotice({ ...input, binderId, reference, brand }));
        sent += 1;
      } catch (err) {
        logOperationalError("workshop-offer-notice.failed", err, { caseId: input.caseId, binderId });
      }
    }
  } catch (err) {
    logOperationalError("workshop-offer-notice.failed", err, { caseId: input.caseId });
  }
  return sent;
}

const DECLINE_LABELS: Record<string, string> = {
  payout_insufficient: "rémunération insuffisante",
  deadline_impossible: "délai impossible",
};

export function offerAnswerAlert(input: {
  caseId: string;
  binderId: string;
  reference: string;
  workshopName: string;
  accepted: boolean;
  leadTimeDays?: number | null;
  reasonCode?: string | null;
  answeredAt: string;
  /** Atelier de test : l'alerte part quand même, mais ne se confond pas avec une vente réelle. */
  testWorkshop?: boolean;
}) {
  const reason = input.reasonCode ? DECLINE_LABELS[input.reasonCode] : null;
  const test = input.testWorkshop ? "[Atelier de test] " : "";
  return {
    caseId: input.caseId,
    heading: input.accepted
      ? `${test}Offre acceptée — ${input.reference}`
      : `${test}Offre refusée — ${input.reference}`,
    intro: input.accepted
      ? `${input.workshopName} accepte la prestation et sa rémunération${input.leadTimeDays ? `, avec un délai de ${input.leadTimeDays} jours` : ""}. Vous pouvez retenir l'atelier puis envoyer le devis au client.`
      : `${input.workshopName} refuse l'offre${reason ? ` (${reason})` : ""}. Le dossier attend un autre atelier ou un nouveau prix.`,
    idempotencyKey: `offer-answer-${input.caseId}-${input.binderId}-${input.accepted ? "accepted" : "declined"}-${input.answeredAt}`,
  };
}

/** Alerte l'équipe d'une réponse d'atelier. Jamais bloquante. */
export async function alertOfferAnswer(
  sb: Supa,
  input: { caseId: string; binderId: string; workshopName: string; accepted: boolean; leadTimeDays?: number | null; reasonCode?: string | null; testWorkshop?: boolean },
): Promise<boolean> {
  try {
    const { reference } = await caseFacts(sb, input.caseId);
    return await notifyAdmin(offerAnswerAlert({ ...input, reference, answeredAt: new Date().toISOString() }));
  } catch (err) {
    logOperationalError("admin-alert.offer-answer-failed", err, { caseId: input.caseId });
    return false;
  }
}
