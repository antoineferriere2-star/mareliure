/**
 * Atelier de test ou de démonstration : `marketplace_binders.is_demo`, seul marqueur (audit Codex du 22/10/2026).
 *
 * Un tel atelier ne reçoit aucun projet réel, n'a aucune présence publique, ne déclenche aucun envoi externe
 * de recette et sort des indicateurs d'exploitation. Ses pièces émises, elles, restent conservées et
 * vérifiées comme toutes les autres : le marqueur n'efface ni ne cache jamais une pièce.
 */
import type { Supa } from "@/build/services/adminAuth.server";

export async function isTestWorkshop(sb: Supa, binderId: string): Promise<boolean> {
  const { data, error } = await sb.from("marketplace_binders").select("is_demo").eq("id", binderId).maybeSingle();
  if (error) throw error;
  return Boolean(data?.is_demo);
}

export const TEST_WORKSHOP_NOTICE_CAPTURE =
  "Atelier de test : notification conservée ici, aucun e-mail envoyé.";
