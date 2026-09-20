/**
 * Dix suggestions FACULTATIVES pour un atelier qui n'a encore aucune prestation : des clés du
 * référentiel, des noms — jamais un prix, jamais une sélection automatique. Le relieur peut les ajouter,
 * les ignorer, chercher autre chose ou créer sa propre prestation ; il peut commencer avec zéro prestation.
 *
 * Remplace l'import massif de 56 prestations à 0 €. Un test vérifie que chaque clé existe et est importable.
 */
export const STARTER_SUGGESTION_KEYS: readonly string[] = [
  "OPR-0064", // Reliure plein cuir
  "OPR-0065", // Demi-reliure cuir
  "OPR-0062", // Reliure pleine toile
  "OPR-0063", // Reliure pleine papier
  "OPR-0132", // Reprise de coiffe
  "OPR-0133", // Réparation de mors
  "OPR-0103", // Titrage au dos
  "OPR-0110", // Dorure sur pièce de titre
  "OPR-0157", // Étui simple
  "OPR-0164", // Boîte de conservation
];
