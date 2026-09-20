/**
 * Les canaux que l'équipe (le concierge) voit sur un dossier — Phase 0 / P1-6. Pur, sans React.
 *
 * Les canaux restent SÉPARÉS : le client et l'atelier retenu ne partagent jamais un fil. L'équipe les lit et y
 * répond un par un, chacun dans son audience :
 *
 * - Fine Bindery (modèle concierge) : « Client » (`customer_concierge`) et « Atelier retenu » (`workshop_platform`) ;
 * - Ma Reliure (messagerie directe) : le fil partagé client · atelier (`shared`) et le canal privé « Atelier retenu ».
 */
import { isMarketplaceBrand, marketplaceBrandConfig } from "@/marketplace/brand/brandConfig";
import type { MessageAudience } from "./audience";

export interface AdminChannel {
  audience: MessageAudience;
  heading: string;
  hint: string;
}

export function adminChannelsFor(brand: string): AdminChannel[] {
  const direct = marketplaceBrandConfig(isMarketplaceBrand(brand) ? brand : "MA_RELIURE").messaging.customerWorkshopDirectMessaging;
  return [
    direct
      ? { audience: "shared", heading: "Conversation client · atelier", hint: "Fil partagé : le client et l'atelier retenu lisent tout." }
      : { audience: "customer_concierge", heading: "Client", hint: "Le client ne voit que ce canal. L'atelier n'en lit rien." },
    { audience: "workshop_platform", heading: "Atelier retenu", hint: "Canal privé avec l'atelier retenu. Le client ne le voit jamais." },
  ];
}
