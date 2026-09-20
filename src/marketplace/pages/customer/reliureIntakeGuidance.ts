/**
 * Ce que Ma Reliure ajoute autour du parcours « Présenter mon livre ».
 *
 * Le runtime d'intake est générique : il ne sait pas ce qu'est un dos, ni qu'un
 * livre ne part pas avant l'acceptation du prix. Ces mots sont ceux de Ma
 * Reliure, donnés au runtime par la route — le même passage que
 * `renderAfterSubmission`. Ils ne changent aucune règle du Playbook (questions,
 * obligations, prix) : ils expliquent, ils ne décident pas.
 *
 * Les clés de champ (`photos`, `photosDommages`) sont celles du Playbook
 * Reliure (bookbindingPlaybookSchema.ts). Un champ qui n'existerait plus ne
 * recevrait simplement pas de guide : rien ne casse.
 */
import type { IntakeGuidance } from "@/build/pages/public/intakeGuidance";

/** Où le parcours de la personne s'arrête, et ce qui suit — une seule source pour l'accueil, le rappel final et la confirmation. */
export const RELIURE_INTAKE_MINUTES = 5;

/**
 * Délai indicatif de première réponse, affiché après l'envoi. **C'est une valeur
 * commerciale, pas technique** : rien dans le produit ne l'engage (pas de SLA
 * mesuré aujourd'hui). À confirmer par Ma Reliure avant déploiement — la formule
 * reste volontairement « indicatif » tant qu'elle n'est pas tenue.
 */
export const RELIURE_REPLY_DELAY = "2 à 3 jours ouvrés";

export const RELIURE_PHOTO_SHOTS: NonNullable<IntakeGuidance["photoShots"]> = {
  photos: [
    {
      key: "couverture",
      label: "Couverture",
      hint: "Le plat avant, bien à plat, en pleine lumière, sans reflet.",
      exampleSrc: "/photo-guide/couverture.svg",
    },
    {
      key: "dos",
      label: "Dos",
      hint: "Le dos, là où figure le titre, cadré de haut en bas.",
      exampleSrc: "/photo-guide/dos.svg",
    },
    {
      key: "tranche",
      label: "Tranche",
      hint: "Le livre fermé, vu de côté : les pages, leurs taches ou leur jaunissement.",
      exampleSrc: "/photo-guide/tranche.svg",
    },
  ],
  photosDommages: [
    {
      key: "dommage_principal",
      label: "Dommage principal",
      hint: "Un gros plan de la zone la plus abîmée, avec une règle ou une pièce pour l'échelle.",
      exampleSrc: "/photo-guide/dommage.svg",
    },
  ],
};

/**
 * Le vocabulaire qu'un propriétaire de livre ne connaît pas forcément. Une
 * phrase, sans jargon à son tour. Chaque mot n'apparaît que sous l'étape dont
 * le texte l'emploie (voir engine/glossary.ts).
 */
export const RELIURE_GLOSSARY: NonNullable<IntakeGuidance["glossary"]> = [
  {
    term: "Dos",
    definition: "La partie du livre sur laquelle on lit le titre quand il est rangé sur une étagère.",
  },
  {
    term: "Plats",
    aliases: ["plat"],
    definition: "Les deux faces de la couverture : celle de devant et celle de derrière.",
  },
  {
    term: "Mors",
    definition: "La charnière souple entre le dos et chaque plat : c'est là que la couverture s'ouvre et se fend.",
  },
  {
    term: "Coiffes",
    aliases: ["coiffe"],
    definition: "Le haut et le bas du dos, là où la couverture s'use ou se déchire le plus souvent.",
  },
  {
    term: "Cahiers",
    aliases: ["cahier"],
    definition: "Un livre est cousu par petits groupes de pages : ce sont les cahiers. Ils tiennent ensemble grâce au fil.",
  },
  {
    term: "Tranche",
    definition: "Le côté du livre fermé, là où on voit le bord des pages.",
  },
  {
    term: "Nerfs",
    aliases: ["nerf"],
    definition: "Les reliefs horizontaux qui barrent le dos d'un livre ancien, sur les cordes de la couture.",
  },
  {
    term: "Gardes",
    aliases: ["garde"],
    definition: "Les pages de couleur ou décorées collées à l'intérieur des plats, avant la première page.",
  },
  {
    term: "Dorure",
    definition: "Un titre, un filet ou un décor posé à la feuille d'or sur la couverture.",
  },
  {
    term: "Demi-cuir",
    definition: "Le dos et les coins en cuir, les plats en papier ou en toile.",
  },
  {
    term: "Plein cuir",
    definition: "Toute la couverture recouverte de cuir.",
  },
  {
    term: "Étui",
    definition: "Un boîtier fait sur mesure pour ranger et protéger le livre.",
  },
];
