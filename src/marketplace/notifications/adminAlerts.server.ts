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
  caseId: string;
  heading: string;
  intro: string;
  /** Une même alerte n'est envoyée qu'une fois (relance, double webhook). */
  idempotencyKey: string;
}

export function adminCaseUrl(caseId: string): string {
  return `https://mareliure.fr/marketplace/cases/${caseId}`;
}

export function formatEurosForAlert(cents: number | null | undefined): string | null {
  if (typeof cents !== "number") return null;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export async function caseReference(sb: Supa, caseId: string): Promise<{ reference: string; brand: string }> {
  const { data } = await sb.from("marketplace_cases").select("reference, brand").eq("id", caseId).maybeSingle();
  return { reference: (data?.reference as string | undefined) ?? caseId.slice(0, 8), brand: (data?.brand as string | undefined) ?? "MA_RELIURE" };
}

export async function notifyAdmin(alert: AdminAlert): Promise<boolean> {
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("case-activity", MARELIURE_CONTACT_EMAIL, {
      templateData: {
        brandName: "Ma Reliure",
        locale: "fr-FR",
        heading: alert.heading,
        intro: alert.intro,
        ctaLabel: "Ouvrir le dossier",
        ctaUrl: adminCaseUrl(alert.caseId),
      },
      brand: "MA_RELIURE",
      idempotencyKey: alert.idempotencyKey,
    });
    return result.sent;
  } catch (err) {
    logOperationalError("admin-alert.failed", err, { caseId: alert.caseId, heading: alert.heading });
    return false;
  }
}
