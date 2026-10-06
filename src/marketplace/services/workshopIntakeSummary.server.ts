import type { Supa } from "@/build/services/adminAuth.server";
import type { Answers } from "@/build/schema/answers";
import type { ProjectBrief } from "@/build/schema/brief";
import type { VisitorProjectSummary } from "@/build/schema/visitorSummary";
import { BOOKBINDING_MISSION_ID, FINE_BINDERY_MISSION_ID } from "@/build/constants";
import { REFERRAL_ANSWER_KEY } from "@/marketplace/binders/referral";
import { PROFILE_SOURCE_ANSWER_KEY, PROFILE_REQUEST_SOURCE } from "@/marketplace/binders/fineBinderyProfile";
import { publicCopy } from "@/build/pages/public/publicLocaleContext";
import { workshopIntakeCopy } from "@/marketplace/customer/workshopIntakeCopy";
import { resolveApprovedBinderBySlug, resolvePublishedFineBinderyBinderBySlug } from "./caseRepository.server";

/** A deployment projection before persistence/email; never changes an old snapshot. */
export async function workshopSubmissionProjection(sb: Supa, missionId: string, answers: Answers, summary: VisitorProjectSummary, brief?: ProjectBrief) {
  const slug = answers[REFERRAL_ANSWER_KEY];
  const fromProfile = answers[PROFILE_SOURCE_ANSWER_KEY] === PROFILE_REQUEST_SOURCE;
  if (![BOOKBINDING_MISSION_ID,FINE_BINDERY_MISSION_ID].includes(missionId) || (!fromProfile && (typeof slug !== "string" || !slug.trim()))) return { summary, brief };
  const locale = summary.locale.startsWith("de") ? "de" : summary.locale.startsWith("it") ? "it" : summary.locale.startsWith("es") ? "es" : summary.locale.startsWith("en") ? "en" : "fr";
  const t = workshopIntakeCopy[locale];
  const binder = typeof slug !== "string" || !slug.trim() ? null : fromProfile
    ? await resolvePublishedFineBinderyBinderBySlug(sb,slug.trim()) : await resolveApprovedBinderBySlug(sb,slug.trim());
  const labels = { fr:"Devis atelier",en:"Workshop quote",de:"Werkstattangebot",it:"Preventivo del laboratorio",es:"Presupuesto del taller" };
  const pending = { fr:"Votre demande est enregistrée. L’atelier indiqué doit être confirmé avant transmission. Aucun devis, paiement ou transport n’est engagé.",en:"Your request is recorded. The intended workshop must be confirmed before forwarding. No quote, payment or transport is committed.",de:"Ihre Anfrage ist gespeichert. Die gewünschte Werkstatt muss vor der Weiterleitung bestätigt werden. Es bestehen noch keine Zusagen zu Angebot, Zahlung oder Transport.",it:"La richiesta è registrata. Il laboratorio indicato deve essere confermato prima della trasmissione. Nessun preventivo, pagamento o trasporto è impegnato.",es:"Su solicitud está registrada. El taller indicado debe confirmarse antes del envío. No hay compromiso de presupuesto, pago ni transporte." };
  const priceLabel = publicCopy(summary.locale,"Prix Ma Reliure");
  const items = summary.itemsToConfirm.map(item => item.label === priceLabel || item.label === "Prix Ma Reliure" ? {label:labels[locale],value:t.budget} : item);
  return {
    summary: {...summary,businessName:binder?.displayName ?? "Oppe",confirmationText:binder ? t.next : pending[locale],itemsToConfirm:items},
    brief: brief ? {...brief,constraints:brief.constraints.map(line => line.label === "Prix Ma Reliure" ? {...line,label:labels.fr,value:workshopIntakeCopy.fr.budget} : line)} : undefined,
  };
}
