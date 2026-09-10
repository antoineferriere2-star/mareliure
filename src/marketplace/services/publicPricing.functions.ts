/**
 * Les prix que `/tarifs` a le droit d'afficher.
 *
 * La seule server function du pricing qu'on peut appeler sans être connecté.
 * Elle ne lit qu'une table — le Pricebook, entrées publiées et marquées
 * publiques — et ne renvoie ni rémunération, ni marge, ni référence. Le
 * benchmark web et les grilles d'ateliers ne sont pas seulement filtrés ici :
 * ils ne sont pas lus. Un test vérifie que ce fichier ne les nomme pas.
 */
import { createServerFn } from "@tanstack/react-start";
import { admin } from "@/build/services/adminAuth.server";
import { publicPriceRows, type PublicPriceRow } from "@/marketplace/pricing/publicPrices";
import { loadPublicPricebook } from "./pricingRepository.server";

export const getPublicPrices = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPriceRow[]> => {
    try {
      return publicPriceRows(await loadPublicPricebook(await admin()));
    } catch (error) {
      // Une page publique ne tombe pas parce que le Pricebook est injoignable :
      // elle se contente de ne pas afficher de prix, ce qu'elle sait déjà faire.
      console.error("[tarifs] Pricebook indisponible :", (error as Error).message);
      return [];
    }
  },
);
