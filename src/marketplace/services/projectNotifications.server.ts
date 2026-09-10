/**
 * Les e-mails du suivi de commande.
 *
 * Ils disent qu'il se passe quelque chose et renvoient à l'espace Ma Reliure ;
 * ils ne recopient jamais le contenu d'un message ni la question posée. Un
 * e-mail se transfère, s'imprime, se lit par-dessus une épaule : l'échange
 * reste dans le projet.
 *
 * Un envoi raté ne défait jamais l'action qui l'a déclenché. Et tant que le
 * service d'envoi n'est pas configuré pour Ma Reliure, l'absence de clé est
 * journalisée comme un envoi sauté, pas comme une panne.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import { logOperationalError } from "@/build/services/operationalLog.server";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import { MARELIURE_CANONICAL_HOME } from "@/marketplace/config";

export const PROJECT_NOTICES = [
  "decision_requested",
  "binder_message",
  "book_received",
  "work_finished",
] as const;
export type ProjectNotice = (typeof PROJECT_NOTICES)[number];

function projectUrl(caseId: string): string {
  const base = (process.env.PUBLIC_SITE_URL || MARELIURE_CANONICAL_HOME).replace(/\/+$/, "");
  return `${base}/mes-livres/${caseId}`;
}

/**
 * Prévient le client propriétaire du dossier. L'adresse est celle de son
 * compte, vérifiée par l'authentification — jamais celle saisie dans le
 * formulaire, qui n'autorise rien.
 */
export async function notifyCustomer(
  sb: Supa,
  input: { caseId: string; notice: ProjectNotice; dedupeKey: string },
): Promise<void> {
  try {
    const { data: row } = await sb
      .from("marketplace_cases")
      .select("reference, customer_user_id")
      .eq("id", input.caseId)
      .maybeSingle();
    if (!row?.customer_user_id) return;

    const { data: user } = await sb.auth.admin.getUserById(row.customer_user_id);
    const email = user?.user?.email;
    if (!email) return;

    if (!process.env.LOVABLE_API_KEY) {
      console.warn(
        `[project-notification] envoi sauté (${input.notice}) : service d'e-mail non configuré.`,
      );
      return;
    }

    await sendTemplateEmail("project-notification", email, {
      templateData: {
        notice: input.notice,
        reference: row.reference,
        projectUrl: projectUrl(input.caseId),
      },
      idempotencyKey: `project-${input.notice}-${input.dedupeKey}`,
    });
  } catch (error) {
    logOperationalError("project-notification.send-failed", error, {
      caseId: input.caseId,
      notice: input.notice,
    });
  }
}
