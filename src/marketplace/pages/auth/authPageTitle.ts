import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";
import type { FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";

/**
 * Titre de l'onglet de la page d'accès : il suit l'espace choisi (client ou atelier) et, sur Fine
 * Bindery, la langue de la page (contre-revue #165 de #164). Un relieur arrivé par « Créer mon espace
 * atelier » ne lit pas « Retrouver mes livres ».
 */
const FINE_BINDERY_TITLES: Record<FineBinderyLocale, { customer: string; binder: string }> = {
  en: { customer: "My books — Fine Bindery", binder: "Workshop space — Fine Bindery" },
  fr: { customer: "Mes livres — Fine Bindery", binder: "Espace atelier — Fine Bindery" },
  de: { customer: "Meine Bücher — Fine Bindery", binder: "Werkstattbereich — Fine Bindery" },
  it: { customer: "I miei libri — Fine Bindery", binder: "Spazio laboratorio — Fine Bindery" },
  es: { customer: "Mis libros — Fine Bindery", binder: "Espacio del taller — Fine Bindery" },
};

export function authPageTitle(brand: MarketplaceBrand, audience: "customer" | "binder", locale: FineBinderyLocale = "en"): string {
  if (brand === "FINE_BINDERY") return FINE_BINDERY_TITLES[locale][audience];
  return audience === "binder" ? "Mon espace atelier — Ma Reliure" : "Retrouver mes livres — Ma Reliure";
}
