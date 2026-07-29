// Sends the visitor's own confirmation email — distinct from
// dossierNotification.server.ts (which notifies workspace members). Same
// safety contract: never throws into the submission path. A failed send
// must never fail dossier creation. Only VisitorProjectSummary fields ever
// reach the template — never the internal ProjectBrief, confidence score,
// commercial notes, or any workspace-only field.
import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import type { VisitorProjectSummary } from "@/build/schema/visitorSummary";
import { logOperationalError } from "./operationalLog.server";

export async function sendVisitorSummaryEmail(params: {
  dossierId: string;
  workspaceId: string | null;
  missionId: string;
  recipientEmail: string;
  summary: VisitorProjectSummary;
}): Promise<boolean> {
  try {
    const result = await sendTemplateEmail("visitor-summary", params.recipientEmail, {
      templateData: {
        locale: params.summary.locale,
        businessName: params.summary.businessName,
        summary: params.summary.summary,
        confirmedItems: params.summary.confirmedItems,
        calculatedItems: params.summary.calculatedItems,
        budgetAndTimingItems: params.summary.budgetAndTimingItems,
        itemsToConfirm: params.summary.itemsToConfirm,
        nextStep: params.summary.confirmationText ?? undefined,
      },
      // Deterministic per dossier: submit_session only ever reaches this
      // call once per dossier (the outer idempotency guards return the
      // existing dossier on every retry instead of re-running this code),
      // so this key is defense-in-depth, not the primary safeguard.
      idempotencyKey: `visitor-summary-${params.dossierId}`,
    });
    if (!result.sent) {
      logOperationalError("visitor-summary.send-suppressed", new Error(result.reason), {
        dossierId: params.dossierId,
        workspaceId: params.workspaceId,
        missionId: params.missionId,
      });
      return false;
    }
    return true;
  } catch (err) {
    logOperationalError("visitor-summary.send-failed", err, {
      dossierId: params.dossierId,
      workspaceId: params.workspaceId,
      missionId: params.missionId,
    });
    return false;
  }
}
