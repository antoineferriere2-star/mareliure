/**
 * Le catalogue de DÉPART proposé au relieur : des catégories et des noms de
 * prestations, jamais un prix. Ma Reliure n'impose aucun tarif — chaque atelier
 * fixe les siens. Importé à la demande, une seule fois, puis entièrement à lui.
 *
 * Une prestation importée n'a pas de prix : elle reste inactive tant que le
 * relieur n'en a pas saisi un (voir `importStarterCatalog`).
 */
export interface StarterCategory {
  name: string;
  services: readonly string[];
}

export const STARTER_CATALOG: readonly StarterCategory[] = [
  {
    name: "Type de reliure",
    services: ["Plein cuir", "Demi-cuir", "Pleine toile", "Demi-toile", "Reliure papier", "Couverture souple", "Couverture rigide"],
  },
  {
    name: "Dos",
    services: ["Dos cuir", "Dos toile", "Dos papier", "Dos rapporté", "Dos arrondi", "Nerfs", "Faux nerfs", "Reprise du dos"],
  },
  {
    name: "Plats / couverture",
    services: [
      "Plat cuir",
      "Plat toile",
      "Plat papier",
      "Réfection couverture",
      "Conservation couverture originale",
      "Incrustation couverture originale",
    ],
  },
  { name: "Coins", services: ["Coins cuir", "Coins toile", "Renfort coins", "Réparation coins"] },
  { name: "Gardes", services: ["Gardes simples", "Gardes papier décoré", "Gardes marbrées", "Remplacement gardes"] },
  {
    name: "Couture / corps d'ouvrage",
    services: ["Couture complète", "Reprise couture", "Recousage partiel", "Remise en ordre cahiers", "Réparation cahiers"],
  },
  {
    name: "Restauration",
    services: ["Réparation pages", "Réparation déchirures", "Consolidation papier", "Nettoyage", "Reprise charnières", "Réparation mors"],
  },
  {
    name: "Dorure / titrage",
    services: ["Dorure titre", "Dorure auteur", "Dorure dos", "Dorure décorative", "Filets", "Fleurons"],
  },
  { name: "Finitions", services: ["Tranchefile", "Signet", "Nervures", "Finition manuelle", "Patine"] },
  { name: "Protection / accessoires", services: ["Étui", "Boîte", "Chemise", "Coffret", "Jaquette de protection"] },
];
