/**
 * Tout ce que la landing dit, et rien de ce qu'elle fait.
 *
 * Le texte vit ici pour deux raisons. D'abord parce qu'il changera plus souvent
 * que la mise en page, et qu'une correction de virgule ne doit pas obliger à
 * relire du JSX. Ensuite parce que la règle la plus stricte de cette page — ne
 * rien inventer (§59) — se vérifie en lisant un seul fichier : s'il n'y a ici
 * ni chiffre de clients, ni note, ni avis, ni nom d'atelier, la page ne peut
 * pas en afficher.
 *
 * Les listes vides plus bas ne sont pas des oublis. Elles sont la forme que
 * prend l'honnêteté tant que les contenus réels n'existent pas.
 */

import { PHOTOS, type PhotoSources } from "./photos";
/**
 * Affiche la section dont le contenu réel n'existe pas encore — les ateliers —
 * sous forme d'emplacements explicitement marqués.
 *
 * L'avant/après n'en dépend plus : deux restaurations réelles y sont
 * documentées et créditées. Il ne reste que les vitrines d'atelier, qui
 * attendent qu'un premier relieur rejoigne la plateforme.
 *
 * `true` : on voit la mise en page complète, emplacements compris.
 *
 * `false` : la section ateliers disparaît entièrement, et le reste de la page
 * se referme proprement. C'est le réglage à passer si l'on préfère ne rien
 * montrer plutôt qu'un emplacement, une fois du trafic envoyé sur le site.
 */
export const SHOW_UNFILLED_SECTIONS = true;

/** Ancres de navigation. Nommées ici pour que le header et les sections ne puissent pas diverger. */
export const ANCHORS = {
  howItWorks: "comment-ca-marche",
  crafts: "savoir-faire",
  binders: "pour-les-relieurs",
} as const;

export interface LandingStep {
  index: string;
  title: string;
  body: string;
}

/**
 * Trois étapes, pas six. Six décrivaient notre processus ; trois décrivent ce
 * que la personne aura à faire — et la troisième est déjà une décision qui lui
 * appartient.
 */
export const STEPS: readonly LandingStep[] = [
  {
    index: "01",
    title: "Présentez votre livre",
    body: "Quelques photos et quelques questions suffisent.",
  },
  {
    index: "02",
    title: "Nous sélectionnons les ateliers",
    body: "Jusqu'à trois relieurs dont le savoir-faire correspond à votre projet.",
  },
  {
    index: "03",
    title: "Choisissez votre proposition",
    body: "Comparez les approches, les matériaux, le délai et le prix.",
  },
];

export interface Craft {
  title: string;
  body: string;
  /** La photographie de la catégorie, et ce qu'elle montre réellement. */
  photo: PhotoSources;
  alt: string;
}

export const CRAFTS: readonly Craft[] = [
  {
    title: "Réparer",
    body: "Un dos fendu, des pages qui se détachent ou une couverture fatiguée.",
    photo: PHOTOS.repair,
    alt: "Un atelier de reliure : la presse en bois, les cahiers en attente et les outils au mur",
  },
  {
    title: "Restaurer",
    body: "Préserver un ouvrage ancien en respectant son histoire.",
    photo: PHOTOS.restore,
    alt: "Un ouvrage ancien en cuir, coiffes usées, posé sur l'établi entre les outils de restauration",
  },
  {
    title: "Transformer",
    body: "Donner une nouvelle allure à un livre que vous aimez.",
    photo: PHOTOS.transform,
    alt: "Des emboîtages et coffrets en toile, teintes ivoire, bordeaux et vert, empilés sur un établi",
  },
  {
    title: "Créer une édition collector",
    body: "Faire d'un livre courant une pièce unique.",
    photo: PHOTOS.collector,
    alt: "Une reliure en maroquin bordeaux à plats de brocart, titre doré au dos",
  },
];

export interface Commitment {
  title: string;
  body: string;
}

export const COMMITMENTS: readonly Commitment[] = [
  {
    title: "Ateliers sélectionnés",
    body: "Nous vérifions chaque atelier avant son arrivée sur Ma Reliure.",
  },
  {
    title: "Trois propositions maximum",
    body: "Votre projet n'est jamais envoyé à une foule d'artisans.",
  },
  {
    title: "Paiement sécurisé",
    body: "Vous choisissez l'atelier avant de vous engager.",
  },
  {
    title: "Suivi du livre",
    body: "Les principales étapes sont documentées jusqu'au retour.",
  },
];

/**
 * Une restauration réellement effectuée, photographiée avant et après.
 *
 * `credit` n'est pas décoratif. Ces ouvrages n'ont pas transité par Ma Reliure :
 * les montrer sans dire de quel atelier ils viennent laisserait entendre le
 * contraire, et ce serait exactement la réalisation inventée que le brief
 * interdit. Avec le crédit, la section dit une chose vraie — voici du travail
 * de reliure, fait par un atelier nommé, sur un livre nommé.
 */
export interface BeforeAfter {
  title: string;
  body: string;
  before: PhotoSources;
  after: PhotoSources;
  beforeAlt: string;
  afterAlt: string;
  credit: string;
}

const FERRIERE = "Atelier Reliure Dorure Ferrière, Orléans";

/**
 * Deux cas réels, documentés et crédités. Rien ici n'est reconstitué : les
 * photographies viennent de l'atelier, les ouvrages existent, et les états
 * « avant » sont ceux dans lesquels les livres sont arrivés.
 */
export const BEFORE_AFTER: readonly BeforeAfter[] = [
  {
    title: "Views in Syria, trois volumes, 1830",
    body: "Dos usés, dorure écaillée, coins éclatés et plats détachés. Après restauration, le décor doré est repris et les trois volumes retrouvent leur tenue.",
    before: PHOTOS.syriaBefore,
    after: PHOTOS.syriaAfter,
    beforeAlt:
      "Les trois volumes de Views in Syria avant restauration : cuir noir usé, dorure écaillée, coiffes abîmées",
    afterAlt:
      "Les trois mêmes volumes après restauration : dorure reprise, cuir nettoyé et teinté, coiffes refaites",
    credit: FERRIERE,
  },
  {
    title: "Dictionnaire de l'Académie, deux volumes, XVIIIᵉ siècle",
    body: "Plein cuir épidermé, mors fendus et coins usés. Après restauration et reprise de teinte, les pièces de titre et les fers d'origine sont conservés.",
    before: PHOTOS.academieBefore,
    after: PHOTOS.academieAfter,
    beforeAlt:
      "Les deux volumes du Dictionnaire de l'Académie avant restauration : cuir marbré épidermé, coins et coiffes usés",
    afterAlt:
      "Les deux mêmes volumes après restauration : cuir reteinté, dos à nerfs et dorure rénovée",
    credit: FERRIERE,
  },
];

/**
 * Un atelier référencé : ce que la carte affichera quand des ateliers réels
 * auront rejoint la plateforme.
 *
 * Ces données viendront de `marketplace_binders`, pas d'un fichier — ce type
 * décrit la vitrine, jamais la source.
 */
export interface ArtisanProfile {
  id: string;
  name: string;
  city: string;
  specialties: readonly string[];
  portrait?: PhotoSources;
  portfolio?: readonly PhotoSources[];
}

/** Aucun faux artisan en production (§59). */
export const ARTISANS: readonly ArtisanProfile[] = [];

/**
 * Le préchargement de la serif éditoriale.
 *
 * Le H1 de la page est en Fraunces. Sans ce lien, le navigateur ne découvre la
 * police qu'après avoir lu la feuille de style et calculé quels éléments en ont
 * besoin — soit un aller-retour de trop sur l'élément qui décide du LCP. Avec
 * lui, la requête part en même temps que le CSS.
 *
 * `crossOrigin` est obligatoire même pour un fichier servi par notre propre
 * domaine : les polices sont toujours récupérées en mode anonyme, et un
 * préchargement sans cet attribut télécharge le fichier une seconde fois.
 *
 * Réservé aux pages Ma Reliure : sur une page Métré la police n'est jamais
 * utilisée, la précharger serait 67 Ko jetés.
 */
export const EDITORIAL_FONT_PRELOAD = {
  rel: "preload",
  href: "/fonts/fraunces-latin-var.woff2",
  as: "font",
  type: "font/woff2",
  crossOrigin: "anonymous",
} as const;
