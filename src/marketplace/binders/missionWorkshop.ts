/**
 * Une Mission qui appartient à un atelier.
 *
 * La Mission Ferrière est servie dans le site de l'atelier
 * (reliure-ferriere.fr, page « Présenter mon ouvrage ») : un visiteur qui la
 * remplit est le client de l'atelier, exactement comme celui qui suit le lien
 * personnel `/a/:slug`. La différence est d'où vient l'attribution : ici,
 * de la Mission elle-même — un identifiant connu du serveur — et jamais d'une
 * valeur envoyée par le navigateur. Le slug d'un lien d'atelier peut changer
 * ou n'avoir jamais été défini ; la Mission, elle, ne change pas d'atelier.
 *
 * Pur et sans dépendance au framework, comme referral.ts.
 */
import { FERRIERE_MISSION_ID } from "@/build/constants";
import { FERRIERE_WORKSHOP_ID } from "@/marketplace/config";

/** L'atelier auquel une Mission rattache d'office ses demandes, ou `null`. */
export function missionBoundWorkshopId(missionId: string | null | undefined): string | null {
  return missionId === FERRIERE_MISSION_ID ? FERRIERE_WORKSHOP_ID : null;
}

/** Source inscrite dans l'événement d'attribution, pour l'historique du cas. */
export const FERRIERE_SITE_SOURCE = "ferriere_site" as const;
