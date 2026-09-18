// Sends the visitor's own confirmation email — distinct from
// dossierNotification.server.ts (which notifies workspace members). Same
// safety contract: never throws into the submission path. A failed send
// must never fail dossier creation. Only VisitorProjectSummary fields ever
// reach the template — never the internal ProjectBrief, confidence score,
// commercial notes, or any workspace-only field.
import { isMaReliure } from "@/brand";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import { MARELIURE_SITE_URL } from "@/lib/structured-data";
import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";
import type { VisitorProjectSummary } from "@/build/schema/visitorSummary";
import { logOperationalError } from "./operationalLog.server";

/**
 * What the brand adds to the email: its name, its colour and — on the
 * marketplace deployment — the way to the space where the book is followed.
 * `marketplaceBrand` is the Host-resolved brand of the request that produced
 * this dossier (see build-runtime.ts) — `null` on Métré Build, which never
 * has one. The summary itself depends only on the project. `/mes-livres`
 * sends a signed-out visitor to the sign-in page, which mails a sign-in
 * link: no link that expires sits in this email.
 */
async function brandEmailData(marketplaceBrand: MarketplaceBrand | null): Promise<Record<string, string>> {
  if (!isMaReliure) return { brandName: "Métré Build", accentColor: "#047857" };
  if (marketplaceBrand === "FINE_BINDERY") {
    // Import différé : ce fichier sert aussi Métré Build, qui ne doit jamais
    // dépendre du module marketplace.
    const { canonicalHome } = await import("@/marketplace/brand/brandConfig");
    return {
      brandName: "Fine Bindery",
      accentColor: "#17130f",
      trackUrl: `${canonicalHome("FINE_BINDERY").replace(/\/+$/, "")}/mes-livres`,
    };
  }
  return { brandName: "Ma Reliure", accentColor: "#17130f", trackUrl: `${MARELIURE_SITE_URL}/mes-livres` };
}

export async function sendVisitorSummaryEmail(params: {
  dossierId: string;
  workspaceId: string | null;
  missionId: string;
  recipientEmail: string;
  summary: VisitorProjectSummary;
  /** Secure link to /project-summary/:accessToken, or null if token minting failed — the CTA is simply omitted, never a broken link. */
  summaryUrl: string | null;
  /** Host-resolved marketplace brand of the request (build-runtime.ts) — null outside the marketplace deployment (Métré Build) or when the Host matched neither brand. */
  marketplaceBrand: MarketplaceBrand | null;
}): Promise<boolean> {
  try {
    const result = await sendTemplateEmail("visitor-summary", params.recipientEmail, {
      templateData: {
        ...(await brandEmailData(params.marketplaceBrand)),
        locale: params.summary.locale,
        businessName: params.summary.businessName,
        summary: params.summary.summary,
        confirmedItems: params.summary.confirmedItems,
        calculatedItems: params.summary.calculatedItems,
        budgetAndTimingItems: params.summary.budgetAndTimingItems,
        itemsToConfirm: params.summary.itemsToConfirm,
        nextStep: params.summary.confirmationText ?? undefined,
        summaryUrl: params.summaryUrl ?? undefined,
      },
      // Deterministic per dossier: submit_session only ever reaches this
      // call once per dossier (the outer idempotency guards return the
      // existing dossier on every retry instead of re-running this code),
      // so this key is defense-in-depth, not the primary safeguard.
      idempotencyKey: `visitor-summary-${params.dossierId}`,
      brand: params.marketplaceBrand ?? undefined,
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
