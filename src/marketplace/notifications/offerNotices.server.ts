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
import { FERRIERE_NEW_REQUEST_COPY_EMAIL, FERRIERE_WORKSHOP_ID } from "@/marketplace/config";
import { workshopOrigin } from "@/marketplace/billing/workshopSubscription";
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

/**
 * Une demande arrive par le lien ou le site d'un atelier : l'atelier ne recevait aucun e-mail
 * (dossier RL-014, 25 novembre 2026). Seules l'équipe Oppe et les membres de l'espace de travail de
 * la Mission étaient prévenus ; l'atelier, qui vend et facture, ne l'apprenait qu'en ouvrant son espace.
 *
 * Une demande = un e-mail à l'atelier rattaché : le rattachement ne se fait qu'une fois (tri initial du
 * dossier) et l'identifiant du message suffit, de toute façon, à ne rien renvoyer en cas de reprise.
 * Contenu minimal : la référence et la marque, jamais les coordonnées ni le texte du client.
 */
export function workshopNewRequestNotice(input: { caseId: string; binderId: string; reference: string; brand: MarketplaceBrand }) {
  return {
    ctaOrigin: input.brand === "FINE_BINDERY" ? canonicalHome("FINE_BINDERY").replace(/\/+$/, "") : undefined,
    id: `request-${input.caseId}-${input.binderId}`,
    binderId: input.binderId,
    brand: input.brand,
    heading: `Nouvelle demande reçue par votre site — ${input.reference}`,
    intro: `Un client vient de vous écrire par votre lien de prise de projet : la demande ${input.reference} vous attend dans votre espace atelier, avec la fiche prête à chiffrer.`,
    ctaPath: `/atelier/cases/${input.caseId}`,
    ctaLabel: "Voir la demande",
  };
}

/**
 * La copie à l'adresse de contact de l'atelier Ferrière. Un échec de la copie ne remet pas en cause
 * l'e-mail principal, déjà parti : il est journalisé seul. Identifiant d'envoi propre à la demande,
 * donc jamais deux copies pour la même demande.
 */
async function copyNewRequestToWorkshopContact(notice: ReturnType<typeof workshopNewRequestNotice>): Promise<void> {
  if (notice.binderId !== FERRIERE_WORKSHOP_ID) return;
  const caseId = notice.id.replace(`request-`, "").replace(`-${notice.binderId}`, "");
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("case-activity", FERRIERE_NEW_REQUEST_COPY_EMAIL, {
      brand: notice.brand,
      idempotencyKey: `workshop-request-copy-${caseId}`,
      templateData: {
        brandName: notice.brand === "FINE_BINDERY" ? "Fine Bindery" : "Ma Reliure",
        locale: "fr-FR",
        heading: notice.heading,
        intro: notice.intro,
        ctaLabel: notice.ctaLabel,
        ctaUrl: `${notice.ctaOrigin ?? workshopOrigin()}${notice.ctaPath}`,
      },
    });
    if (!result.sent) throw new Error("workshop_request_copy_not_delivered");
  } catch (err) {
    logOperationalError("workshop-new-request-copy.failed", err, { binderId: notice.binderId });
  }
}

/** Jamais bloquant : le visiteur a déjà envoyé sa demande, un échec d'e-mail est journalisé. */
export async function notifyWorkshopOfNewRequest(sb: Supa, input: { caseId: string; binderId: string }): Promise<boolean> {
  try {
    const { reference, brand } = await caseFacts(sb, input.caseId);
    const notice = workshopNewRequestNotice({ ...input, reference, brand });
    await notifyWorkshop(sb, notice);
    await copyNewRequestToWorkshopContact(notice);
    return true;
  } catch (err) {
    logOperationalError("workshop-new-request-notice.failed", err, { caseId: input.caseId, binderId: input.binderId });
    return false;
  }
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
