import type { PhotoSources } from "@/marketplace/pages/landing/photos";

export const FERRIERE_SERVICE_PHOTO_CREDIT = "Atelier Reliure Dorure Ferrière, Orléans";
export const FERRIERE_SERVICE_PHOTO_SOURCE = "http://reliure-ferriere.fr/";

/**
 * Une photographie réelle de l'atelier pour chacune des 45 prestations du
 * catalogue Ma Reliure. Le numéro est celui qu'affiche la galerie source : il
 * permet de retrouver l'original sans dépendre du nom du fichier dérivé.
 */
export const FERRIERE_SERVICE_PHOTO_NUMBERS = {
  reemboitage: 832,
  reparation_dos: 564,
  reparation_mors: 494,
  reparation_coiffes: 496,
  reparation_coins: 695,
  reparation_plats: 746,
  pages_detachees: 835,
  couture_partielle: 456,
  recouture_complete: 1031,
  reparation_papier: 649,
  gardes_neuves: 757,
  pleine_toile: 23,
  demi_toile: 29,
  dos_cuir: 852,
  demi_cuir: 153,
  demi_cuir_a_coins: 91,
  plein_cuir: 1088,
  dorure_titrage: 1005,
  dorure_auteur: 1014,
  dorure_tomaison: 968,
  dorure_date: 1115,
  dorure_initiales: 121,
  dorure_filets: 1032,
  dorure_fleurons: 543,
  dorure_decor: 349,
  nerfs: 991,
  gardes_decorees: 224,
  papiers_marbres: 860,
  mosaique: 115,
  signet: 556,
  tranches: 79,
  decor_personnalise: 483,
  etui: 572,
  chemise: 987,
  boite: 977,
  coffret: 201,
  restauration_cuir: 1004,
  restauration_papier: 513,
  restauration_cartonnage: 268,
  restauration_reliure_ancienne: 495,
  restauration_patrimoniale: 298,
  rebind_collector: 984,
  nouvelle_couverture: 814,
  reliure_de_creation: 998,
  projet_sur_mesure: 320,
} as const;

export type IllustratedServiceKey = keyof typeof FERRIERE_SERVICE_PHOTO_NUMBERS;

export function ferriereServicePhoto(key: IllustratedServiceKey): PhotoSources {
  return {
    src: `/photos/services/ferriere/${key}-640.webp`,
    srcSet: [320, 640]
      .map((width) => `/photos/services/ferriere/${key}-${width}.webp ${width}w`)
      .join(", "),
  };
}

export function ferriereSourcePhotoUrl(key: IllustratedServiceKey): string {
  return `http://reliure-ferriere.fr/afficher_photo/${FERRIERE_SERVICE_PHOTO_NUMBERS[key]}`;
}
