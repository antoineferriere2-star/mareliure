/**
 * Atelier de test ou de démonstration : `marketplace_binders.is_demo`, seul marqueur (audit Codex du 22/10/2026).
 *
 * Un tel atelier ne reçoit aucun projet réel, n'a aucune présence publique, ne déclenche aucun envoi externe
 * de recette et sort des indicateurs d'exploitation. Ses pièces émises, elles, restent conservées et
 * vérifiées comme toutes les autres : le marqueur n'efface ni ne cache jamais une pièce.
 *
 * Le marqueur ne bascule PAS les fournisseurs en environnement de test : il REFUSE leurs opérations réelles
 * (Stripe : abonnement, compte Connect, paiement de facture ; Sendcloud : achat d'étiquette). Les essais
 * fournisseurs se font dans leurs environnements isolés, jamais depuis un atelier de production.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";

export async function isTestWorkshop(sb: Supa, binderId: string): Promise<boolean> {
  const { data, error } = await sb.from("marketplace_binders").select("is_demo").eq("id", binderId).maybeSingle();
  if (error) throw error;
  return Boolean(data?.is_demo);
}

export const TEST_WORKSHOP_PROVIDER_REFUSED =
  "Atelier de test : aucune opération réelle n'est faite chez Stripe ou Sendcloud depuis cet atelier.";

/** Refuse (409, message lisible), avant tout effet externe, une opération fournisseur réelle pour un atelier de test. */
export async function assertNotTestWorkshop(sb: Supa, binderId: string): Promise<void> {
  if (await isTestWorkshop(sb, binderId)) fail(409, TEST_WORKSHOP_PROVIDER_REFUSED);
}

/**
 * Un dossier relève-t-il d'un atelier de test ? Apporté par lui, ou confié à lui ACTUELLEMENT
 * (affectation OPPE active, ou atelier sélectionné). Une affectation terminée ne compte plus.
 */
export async function isTestCase(sb: Supa, caseId: string): Promise<boolean> {
  const [{ data: row, error }, { data: assignments, error: aError }, { data: matches, error: mError }] = await Promise.all([
    sb.from("marketplace_cases").select("referred_binder_id").eq("id", caseId).maybeSingle(),
    sb.from("marketplace_oppe_order_assignments").select("binder_id").eq("case_id", caseId).is("ended_at", null),
    sb.from("marketplace_case_matches").select("binder_id").eq("case_id", caseId).eq("state", "selected"),
  ]);
  if (error || aError || mError) throw error ?? aError ?? mError;
  const ids = [row?.referred_binder_id, ...(assignments ?? []).map((a) => a.binder_id), ...(matches ?? []).map((m) => m.binder_id)]
    .filter((id): id is string => Boolean(id));
  if (!ids.length) return false;
  const { data: binders, error: bError } = await sb.from("marketplace_binders").select("id").in("id", ids).eq("is_demo", true);
  if (bError) throw bError;
  return (binders ?? []).length > 0;
}

export const TEST_WORKSHOP_NOTICE_CAPTURE =
  "Atelier de test : notification conservée ici, aucun e-mail envoyé.";
