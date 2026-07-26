// Sends the "new Dossier Commercial" notification to every member of the
// Mission's Espace Client. Server-only — called from the public runtime
// handler after a Dossier row is created. Never throws into the submit path:
// a failed notification must not fail the visitor's submission.
import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import type { Supa } from "./adminAuth.server";

function portalUrl(dossierId: string): string {
  const base = (process.env.PUBLIC_SITE_URL || "https://metre-pro.com").replace(/\/+$/, "");
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
    const { data: members, error } = await supabase
      .from("build_workspace_members")
      .select("email")
      .eq("workspace_id", params.workspaceId);
    if (error) throw error;

    const recipients = [...new Set((members ?? []).map((m) => m.email).filter(Boolean))];

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
        console.error("new-dossier notification failed", { recipient, error: err });
      }
    }
  } catch (err) {
    console.error("new-dossier notification lookup failed", err);
  }
}
