/**
 * Le vocabulaire de l’atelier, page par page : les gestes que nomme un relieur, définis pour le client.
 *
 * Termes et définitions recopiés tels quels du référentiel technique `reliure-fr-v1`
 * (`canonicalName`, `customerDescription`) ; craftGlossary.test.ts vérifie qu’ils n’en divergent pas.
 * Recopiés plutôt qu’importés : les 195 opérations n’ont rien à faire dans le JavaScript des pages publiques.
 */
import type { CraftSlug } from "./craftPages";

export interface CraftTerm {
  /** Clé de l’opération dans le référentiel. */
  key: string;
  term: string;
  definition: string;
}

export const CRAFT_GLOSSARY_SOURCE =
  "Définitions tirées du référentiel technique de Ma Reliure, établi d’après des documents professionnels : référentiel du CAP Arts de la reliure, publications de la Bibliothèque nationale de France, manuels et documentation d’ateliers.";

export const CRAFT_GLOSSARY: Record<CraftSlug, readonly CraftTerm[]> = {
  reparer: [
    { key: "OPR-0073", term: "Réemboîtage", definition: "Remise en place d’un corps d’ouvrage dans une couverture existante ou refaite, sans refaire nécessairement toute la couture." },
    { key: "OPR-0132", term: "Reprise de coiffe", definition: "Réparation ou reconstitution localisée d’une coiffe endommagée." },
    { key: "OPR-0133", term: "Réparation de mors", definition: "Stabilisation ou reconstitution de la charnière entre dos et plat." },
    { key: "OPR-0134", term: "Réparation de coin", definition: "Consolidation ou reconstitution limitée d’un coin de plat ou de couvrure." },
    { key: "OPR-0042", term: "Formation des mors", definition: "Création ou rétablissement des charnières structurelles du dos permettant l’articulation des plats." },
    { key: "OPR-0017", term: "Réparation de fond de cahier", definition: "Consolidation de la pliure centrale d’un cahier fragilisé ou rompu." },
    { key: "OPR-0018", term: "Réparation de déchirure de feuillet", definition: "Raccord localisé d’une déchirure en respectant la souplesse et la lisibilité du feuillet." },
    { key: "OPR-0025", term: "Reprise de couture existante", definition: "Rétablissement partiel de points de couture sans nécessairement démonter tout le volume." },
    { key: "OPR-0087", term: "Remplacement de gardes", definition: "Dépose et montage de nouvelles gardes lorsque les gardes existantes ne peuvent être conservées." },
  ],
  restaurer: [
    { key: "OPR-0136", term: "Consolidation de cuir", definition: "Stabilisation d’un cuir fragilisé ou pulvérulent sans masquer indûment ses caractéristiques historiques." },
    { key: "OPR-0137", term: "Réintégration de cuir", definition: "Ajout localisé de cuir compatible pour combler une perte de couvrure." },
    { key: "OPR-0138", term: "Reprise de dos", definition: "Réparation localisée d’un dos conservé lorsque son état le permet." },
    { key: "OPR-0139", term: "Remontage d’ancien dos", definition: "Conservation puis repositionnement d’un dos d’origine après une intervention structurelle." },
    { key: "OPR-0115", term: "Reprise de dorure", definition: "Rétablissement ou reprise localisée d’une dorure existante lorsque l’éthique de conservation et l’état l’autorisent." },
    { key: "OPR-0144", term: "Conservation des éléments anciens", definition: "Préservation, documentation et éventuel remontage des éléments d’origine non réemployés structurellement." },
    { key: "OPR-0145", term: "Dérestauration", definition: "Retrait raisonné d’une intervention antérieure lorsque celle-ci est nocive ou compromet la lecture de l’ouvrage." },
    { key: "OPR-0146", term: "Nettoyage à sec de feuillet", definition: "Réduction de salissures superficielles sur un feuillet par des procédés secs contrôlés." },
    { key: "OPR-0149", term: "Doublage de feuillet", definition: "Renforcement d’un feuillet par ajout d’un support compatible lorsque sa fragilité le justifie." },
    { key: "OPR-0154", term: "Désacidification", definition: "Traitement chimique visant à réduire l’acidité du papier, hors intervention de reliure courante." },
  ],
  relier: [
    { key: "OPR-0062", term: "Reliure pleine toile", definition: "Reliure dont la couvrure est entièrement réalisée en toile." },
    { key: "OPR-0071", term: "Reliure Bradel", definition: "Reliure à structure de couverture distincte, couramment utilisée en pleine toile ou plein papier." },
    { key: "OPR-0068", term: "Quart de reliure", definition: "Couvrure partielle dans laquelle le cuir ou un autre matériau occupe le dos et une faible portion des plats." },
    { key: "OPR-0065", term: "Demi-reliure cuir", definition: "Reliure dont le dos et une partie des plats sont couverts de cuir, les plats recevant généralement un autre matériau." },
    { key: "OPR-0066", term: "Demi-reliure à coins", definition: "Demi-reliure complétée de pièces de cuir aux quatre coins des plats." },
    { key: "OPR-0064", term: "Reliure plein cuir", definition: "Reliure dont le cuir couvre dos et plats." },
    { key: "OPR-0027", term: "Couture de cahiers", definition: "Assemblage des cahiers par un fil et une structure de couture adaptée à l’ouvrage." },
    { key: "OPR-0041", term: "Arrondissure", definition: "Mise en forme arrondie du dos avant endossure lorsque la structure le permet." },
    { key: "OPR-0045", term: "Pose de nerfs véritables", definition: "Mise en place de supports de couture formant des nerfs structurels visibles ou non." },
    { key: "OPR-0048", term: "Broderie de tranchefiles main", definition: "Réalisation manuelle de tranchefiles cousues en tête et en queue du dos." },
  ],
  embellir: [
    { key: "OPR-0103", term: "Titrage au dos", definition: "Marquage d’un titre sur le dos du volume." },
    { key: "OPR-0104", term: "Titrage d’auteur", definition: "Marquage du nom de l’auteur sur une zone de titrage." },
    { key: "OPR-0106", term: "Titrage de tomaison", definition: "Marquage du numéro ou de l’identification d’un tome." },
    { key: "OPR-0107", term: "Pose de pièce de titre", definition: "Découpe, préparation et collage d’une pièce de cuir destinée à porter le titre." },
    { key: "OPR-0111", term: "Dorure à la feuille", definition: "Dorure réalisée avec de l’or en feuille appliqué par pression d’outils chauffés sur une zone apprêtée." },
    { key: "OPR-0114", term: "Dorure manuelle", definition: "Marquage exécuté à la main à l’aide de fers, filets, palettes ou roulettes chauffés." },
    { key: "OPR-0116", term: "Filet doré", definition: "Traçage d’une ligne dorée au filet sur dos, plats ou élément de protection." },
    { key: "OPR-0121", term: "Dorure des compartiments", definition: "Décor appliqué dans les espaces séparant les nerfs du dos." },
    { key: "OPR-0097", term: "Dorure sur tranche", definition: "Application d’or ou de film sur une tranche préparée et polie." },
    { key: "OPR-0083", term: "Pose de gardes marbrées", definition: "Montage de papiers marbrés comme gardes, selon les contraintes de structure et de décor." },
    { key: "OPR-0126", term: "Mosaïque incrustée", definition: "Insertion de pièces de cuir découpées dans une couvrure afin d’obtenir un décor de niveau affleurant." },
  ],
  transformer: [
    { key: "OPR-0044", term: "Dos brisé", definition: "Construction d’un dos séparé du corps d’ouvrage afin d’améliorer l’ouverture ou la protection." },
    { key: "OPR-0120", term: "Encadrement doré", definition: "Construction d’un cadre décoratif au filet, à la roulette ou au fer autour d’un plat." },
    { key: "OPR-0125", term: "Décor peint lié à la reliure", definition: "Application d’un décor pictural sur une couvrure, lorsque cette pratique relève de l’atelier." },
    { key: "OPR-0126", term: "Mosaïque incrustée", definition: "Insertion de pièces de cuir découpées dans une couvrure afin d’obtenir un décor de niveau affleurant." },
    { key: "OPR-0127", term: "Mosaïque sertie", definition: "Mise en place de pièces de cuir dont les contours sont marqués ou dorés après insertion." },
    { key: "OPR-0128", term: "Mosaïque superposée", definition: "Application de pièces de cuir en relief sur une couvrure existante." },
  ],
  proteger: [
    { key: "OPR-0161", term: "Chemise à rabats", definition: "Protection souple ou semi-rigide constituée d’une chemise dotée de rabats." },
    { key: "OPR-0162", term: "Chemise-étui", definition: "Ensemble associant une chemise de protection et un étui adapté au volume." },
    { key: "OPR-0159", term: "Étui gainé", definition: "Étui recouvert d’un matériau de couvrure, notamment papier, toile ou cuir." },
    { key: "OPR-0160", term: "Étui cigare", definition: "Étui à ouverture coulissante verticale ou horizontale, adapté au volume et à son usage." },
    { key: "OPR-0164", term: "Boîte de conservation", definition: "Boîte conçue pour protéger un ouvrage des contraintes physiques et des poussières avec des matériaux adaptés." },
    { key: "OPR-0165", term: "Boîte à dos", definition: "Boîte dont la structure ou la décoration rappelle le dos d’un livre relié." },
    { key: "OPR-0168", term: "Coffret", definition: "Contenant de présentation ou de protection à structure renforcée, éventuellement décoré." },
    { key: "OPR-0172", term: "Titrage de boîte", definition: "Identification dorée, imprimée ou marquée d’une boîte ou d’un étui." },
  ],
};
