/**
 * Classement sans suite d'un dossier resté interne. Relit l'état, refuse dès qu'un atelier a été
 * sollicité ou qu'une proposition existe, change le statut sous condition de l'état lu, puis journalise
 * le motif. Rien n'est supprimé ; aucun message n'est envoyé.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isClosableCaseStatus } from "@/marketplace/cases/closeCase";

export type CloseCaseOutcome = "closed" | "not_found" | "not_closable" | "engaged" | "changed" | "unreadable" | "not_logged";

export const CLOSE_CASE_REFUSALS: Record<Exclude<CloseCaseOutcome, "closed">, { status: number; message: string }> = {
  not_found: { status: 404, message: "Dossier introuvable." },
  not_closable: { status: 409, message: "Seul un dossier pas encore envoyé aux ateliers peut être classé sans suite." },
  engaged: { status: 409, message: "Un atelier a déjà été sollicité ou une proposition existe : ce dossier ne se classe pas sans suite." },
  changed: { status: 409, message: "Le dossier a changé entre-temps : rechargez la page." },
  unreadable: { status: 500, message: "Le dossier n'a pas pu être vérifié." },
  not_logged: { status: 500, message: "Dossier classé, mais le motif n'a pas été journalisé." },
};

export async function closeCase(sb: SupabaseClient, actorUserId: string, caseId: string, reason: string): Promise<CloseCaseOutcome> {
  const current = await sb.from("marketplace_cases").select("status").eq("id", caseId).maybeSingle();
  if (current.error) return "unreadable";
  if (!current.data) return "not_found";
  const previous = current.data.status as string;
  if (!isClosableCaseStatus(previous)) return "not_closable";
  const [matches, proposals] = await Promise.all([
    sb.from("marketplace_case_matches").select("case_id", { count: "exact", head: true }).eq("case_id", caseId),
    sb.from("marketplace_commercial_proposals").select("id", { count: "exact", head: true }).eq("case_id", caseId),
  ]);
  if (matches.error || proposals.error) return "unreadable";
  if ((matches.count ?? 0) > 0 || (proposals.count ?? 0) > 0) return "engaged";
  const closed = await sb.from("marketplace_cases").update({ status: "cancelled" }).eq("id", caseId).eq("status", previous).select("id");
  if (closed.error) return "unreadable";
  if (!closed.data?.length) return "changed";
  const event = await sb.from("marketplace_events").insert({ case_id: caseId, actor_user_id: actorUserId,
    event_type: "case_closed_without_follow_up", metadata: { reason, previous_status: previous } });
  return event.error ? "not_logged" : "closed";
}
