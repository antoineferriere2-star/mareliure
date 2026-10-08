/** Clôture réservée à l'administration : statut et motif sont atomiques dans la procédure SQL. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isClosableCaseStatus } from "@/marketplace/cases/closeCase";

export type CloseCaseOutcome = "closed" | "not_found" | "not_closable" | "engaged" | "changed" | "unreadable" | "invalid_reason" | "forbidden";
export const CLOSE_CASE_REFUSALS: Record<Exclude<CloseCaseOutcome, "closed">, { status: number; message: string }> = {
  not_found: { status: 404, message: "Dossier introuvable." },
  not_closable: { status: 409, message: "Seul un dossier pas encore envoyé aux ateliers peut être classé sans suite." },
  engaged: { status: 409, message: "Un atelier a déjà été sollicité ou une proposition existe : ce dossier ne se classe pas sans suite." },
  changed: { status: 409, message: "Le dossier a changé entre-temps : rechargez la page." },
  unreadable: { status: 500, message: "Le classement n'a pas pu être confirmé : rechargez le dossier avant de réessayer." },
  invalid_reason: { status: 400, message: "Le motif doit contenir de 5 à 300 caractères." },
  forbidden: { status: 403, message: "Le classement est réservé à l'administration." },
};
export async function closeCase(sb: SupabaseClient, actorUserId: string, caseId: string, reason: string): Promise<CloseCaseOutcome> {
  const trimmed = reason.trim();
  if (trimmed.length < 5 || trimmed.length > 300) return "invalid_reason";
  const current = await sb.from("marketplace_cases").select("status").eq("id", caseId).maybeSingle();
  if (current.error) return "unreadable";
  if (!current.data) return "not_found";
  const previous = current.data.status as string;
  if (!isClosableCaseStatus(previous)) return "not_closable";
  const result = await sb.rpc("marketplace_close_case_without_follow_up", {
    p_case_id: caseId, p_actor_user_id: actorUserId, p_reason: trimmed, p_expected_status: previous,
  });
  if (result.error) return result.error.code === "42501" ? "forbidden" : "unreadable";
  const outcome = result.data;
  if (outcome === "closed" || (typeof outcome === "string" && Object.hasOwn(CLOSE_CASE_REFUSALS, outcome))) return outcome as CloseCaseOutcome;
  return "unreadable";
}
