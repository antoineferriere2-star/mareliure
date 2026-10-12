/**
 * Les alertes que reçoit l'équipe Ma Reliure, à l'adresse de contact.
 *
 * Décision du 4 octobre 2026 : être prévenu des moments qui demandent une
 * action — un client a payé (le dossier peut partir), ou l'e-mail de prix n'a
 * pas pu atteindre le client (il faut le prévenir soi-même).
 *
 * Une alerte n'est jamais bloquante : si elle échoue, l'action qui l'a
 * déclenchée (paiement enregistré, proposition envoyée) reste valable, et
 * l'échec est seulement journalisé.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import { logOperationalError } from "@/build/services/operationalLog.server";
import { MARELIURE_CONTACT_EMAIL } from "@/marketplace/legal/legalEntity";

export interface AdminAlert {
  /** Dossier concerné : le lien de l'alerte l'ouvre dans l'admin. */
  caseId?: string;
  /** Lien explicite quand l'alerte ne porte pas sur un dossier (atelier, abonnement). */
  ctaUrl?: string;
  ctaLabel?: string;
  heading: string;
  intro: string;
  /** Une même alerte n'est envoyée qu'une fois (relance, double webhook). */
  idempotencyKey: string;
}

export function adminCaseUrl(caseId: string): string {
  return `https://mareliure.fr/admin/leads/${caseId}`;
}

export function adminWorkshopUrl(binderId: string): string {
  return `https://mareliure.fr/admin/ateliers/${binderId}`;
}

export function formatEurosForAlert(cents: number | null | undefined): string | null {
  if (typeof cents !== "number") return null;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export async function caseReference(sb: Supa, caseId: string): Promise<{ reference: string; brand: string }> {
  const { data } = await sb.from("marketplace_cases").select("reference, brand").eq("id", caseId).maybeSingle();
  return { reference: (data?.reference as string | undefined) ?? caseId.slice(0, 8), brand: (data?.brand as string | undefined) ?? "MA_RELIURE" };
}

export interface AdminAlertOutcome { sent: boolean; reason: string | null }

/** Envoi détaillé : accepté par le fournisseur, ou la raison du refus (jamais de secret). */
export async function sendAdminAlert(alert: AdminAlert): Promise<AdminAlertOutcome> {
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("case-activity", MARELIURE_CONTACT_EMAIL, {
      templateData: {
        brandName: "Ma Reliure",
        locale: "fr-FR",
        heading: alert.heading,
        intro: alert.intro,
        ctaLabel: alert.ctaLabel ?? (alert.caseId ? "Ouvrir le dossier" : "Ouvrir l'admin"),
        ctaUrl: alert.ctaUrl ?? (alert.caseId ? adminCaseUrl(alert.caseId) : "https://mareliure.fr/admin"),
      },
      brand: "MA_RELIURE",
      idempotencyKey: alert.idempotencyKey,
    });
    return { sent: result.sent, reason: result.sent ? null : ((result as { reason?: string }).reason ?? "not_sent") };
  } catch (err) {
    logOperationalError("admin-alert.failed", err, { caseId: alert.caseId, heading: alert.heading });
    return { sent: false, reason: err instanceof Error ? err.message.slice(0, 160) : "send_failed" };
  }
}

export async function notifyAdmin(alert: AdminAlert): Promise<boolean> {
  return (await sendAdminAlert(alert)).sent;
}

/**
 * Alerte de test, déclenchée depuis le pilotage : même modèle, même expéditeur, même destinataire que
 * les vraies alertes. Vérifie la chaîne (clé Resend du Worker, domaine, modèle) sans créer de dossier.
 */
export async function sendAdminAlertTest(now: Date = new Date()): Promise<AdminAlertOutcome> {
  return sendAdminAlert({
    heading: "Test des alertes — Ma Reliure",
    intro: `Alerte de test envoyée depuis le pilotage le ${now.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}. Si vous lisez ce message, les alertes de l'équipe arrivent bien.`,
    ctaLabel: "Ouvrir le pilotage",
    ctaUrl: "https://mareliure.fr/admin",
    idempotencyKey: `admin-alert-test-${now.getTime()}`,
  });
}
