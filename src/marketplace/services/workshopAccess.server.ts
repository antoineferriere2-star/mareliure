import { fail } from "@/build/services/serverError";
import type { Supa } from "@/build/services/adminAuth.server";
import { BinderQuotesError, requireBinderId } from "./binderQuotes.server";

/**
 * L'atelier de la session, pour les modules qui n'utilisent pas `run()` de binderQuotes.
 * Un compte sans atelier reste refusé (403), avec le code stable `no_binder` que l'écran traduit
 * et accompagne d'une orientation — jamais une erreur brute (audit #53, C4).
 */
export async function requireWorkshopAccess(sb: Supa, userId: string): Promise<string> {
  try {
    return await requireBinderId(sb, userId);
  } catch (error) {
    if (error instanceof BinderQuotesError && error.code === "no_binder") fail(403, "no_binder");
    throw error;
  }
}
