// Sends the "new Dossier Commercial" notification to every member of the
// Mission's Espace Client. Server-only — called from the public runtime
// handler after a Dossier row is created. Never throws into the submit path:
// a failed notification must not fail the visitor's submission.
import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import type { Supa } from "./adminAuth.server";
import { logOperationalError } from "./operationalLog.server";
import { recipientsFor, toBriefNotificationMode } from "@/build/settings/notifications";
import { PUBLIC_SITE_URL } from "@/lib/siteUrl";

function portalUrl(dossierId: string): string {
  const base = (process.env.PUBLIC_SITE_URL || PUBLIC_SITE_URL).replace(/\/+$/, "");
  return `${base}/portal/dossiers/${dossierId}`;
}

export async function notifyWorkspaceOfNewDossier(
  supabase: Supa,
  params: {
    workspaceId: string | null;
    dossierId: string;
    missionName: string | null;
    summary: string | null;
    nextQuestions: string[];
  },
): Promise<void> {
  if (!params.workspaceId) return;

  try {
    // The workspace decides who hears about its own customers. Read before the
    // members so an "off" workspace costs one query, not two.
    const { data: workspace, error: wErr } = await supabase
      .from("build_workspaces")
      .select("notify_on_new_brief")
      .eq("id", params.workspaceId)
      .maybeSingle();
    if (wErr) throw wErr;
    const mode = toBriefNotificationMode(workspace?.notify_on_new_brief);
    if (mode === "off") return;

    const { data: members, error } = await supabase
      .from("build_workspace_members")
      .select("email, role")
      .eq("workspace_id", params.workspaceId);
    if (error) throw error;

    const recipients = recipientsFor(members ?? [], mode);

    for (const recipient of recipients) {
      try {
        await sendTemplateEmail("new-dossier", recipient, {
          templateData: {
            missionName: params.missionName ?? undefined,
            summary: params.summary ?? undefined,
            nextQuestions: params.nextQuestions,
            dossierUrl: portalUrl(params.dossierId),
          },
          idempotencyKey: `new-dossier-${params.dossierId}-${recipient}`,
        });
      } catch (err) {
        logOperationalError("new-dossier.notification-send-failed", err, {
          recipientEmail: recipient,
          dossierId: params.dossierId,
          workspaceId: params.workspaceId,
        });
      }
    }
  } catch (err) {
    logOperationalError("new-dossier.notification-lookup-failed", err, {
      dossierId: params.dossierId,
      workspaceId: params.workspaceId,
    });
  }
}
