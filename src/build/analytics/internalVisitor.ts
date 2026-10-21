/**
 * Navigateurs de l'équipe (propriétaire, Claude Code, Codex) exclus des mesures de fréquentation et du
 * parcours de présentation. Aucun cookie ni donnée personnelle : un drapeau local au navigateur.
 *
 * - posé automatiquement à l'ouverture du pilotage (`/admin`) ;
 * - posé ou retiré à la main par `?interne=1` / `?interne=0` sur n'importe quelle page publique
 *   (recettes de Codex et de Claude Code, téléphone du propriétaire) ;
 * - basculé depuis le pilotage.
 * Ce drapeau vaut pour ce navigateur seulement, et à partir de sa pose : l'historique n'est pas réécrit.
 */
export const INTERNAL_VISITOR_STORAGE_KEY = "mareliure-internal-visitor";

/** Clé de réponse de la Mission qui marque une session ouverte par un navigateur de l'équipe. */
export { INTERNAL_VISIT_KEY as INTERNAL_VISIT_ANSWER_KEY } from "@/build/runtime/sessionMetadata";

export function setInternalVisitor(internal: boolean): void {
  try {
    if (internal) window.localStorage.setItem(INTERNAL_VISITOR_STORAGE_KEY, "1");
    else window.localStorage.removeItem(INTERNAL_VISITOR_STORAGE_KEY);
  } catch {
    // Stockage indisponible (navigation privée stricte) : le navigateur reste compté.
  }
}

/** Lit le drapeau, après avoir appliqué un éventuel `?interne=1|0` de l'adresse courante. */
export function isInternalVisitor(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const flag = new URLSearchParams(window.location.search).get("interne");
    if (flag === "1") setInternalVisitor(true);
    if (flag === "0") setInternalVisitor(false);
    return window.localStorage.getItem(INTERNAL_VISITOR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
