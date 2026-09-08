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

/**
 * Affiche les sections dont le contenu réel n'existe pas encore (avant/après,
 * ateliers), sous forme d'emplacements explicitement marqués.
 *
 * `true` : on voit la mise en page complète, emplacements compris — c'est ce
 * qu'il faut pour juger le design et pour savoir quelles photographies
 * commander.
 *
 * `false` : ces deux sections disparaissent entièrement. C'est le réglage à
 * passer avant d'envoyer du trafic sur le site, si les photographies ne sont
 * pas encore arrivées. Rien d'autre à toucher : le reste de la page se referme
 * proprement.
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
  /** Ce que la photographie de cette catégorie doit montrer. */
  shotBrief: string;
}

export const CRAFTS: readonly Craft[] = [
  {
    title: "Réparer",
    body: "Un dos fendu, des pages qui se détachent ou une couverture fatiguée.",
    shotBrief:
      "Mains d'artisan recousant un cahier sur cousoir, fil de lin, gros plan sur le dos ouvert.",
  },
  {
    title: "Restaurer",
    body: "Préserver un ouvrage ancien en respectant son histoire.",
    shotBrief:
      "Ouvrage ancien à plat sous une lumière rasante, cuir patiné, comblement de papier japon à la pince.",
  },
  {
    title: "Transformer",
    body: "Donner une nouvelle allure à un livre que vous aimez.",
    shotBrief:
      "Toile et papiers décorés étalés sur l'établi, à côté d'un livre en cours de couvrure.",
  },
  {
    title: "Créer une édition collector",
    body: "Faire d'un livre courant une pièce unique.",
    shotBrief: "Dorure au fer chaud sur un dos à nerfs, feuille d'or, détail très serré.",
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
 * Une transformation réellement effectuée, photographiée avant et après.
 *
 * Le type existe, la liste est vide : c'est exactement l'état de la réalité.
 * Le jour où un atelier livre un cas documenté, on ajoute une entrée et la
 * section se remplit sans qu'une ligne de mise en page bouge.
 */
export interface BeforeAfter {
  title: string;
  body: string;
  beforeSrc?: string;
  afterSrc?: string;
  beforeAlt: string;
  afterAlt: string;
}

/** Aucune réalisation fictive (§59). Vide jusqu'à ce qu'un vrai cas existe. */
export const BEFORE_AFTER: readonly BeforeAfter[] = [];

/**
 * Les emplacements de la section avant/après tant qu'aucun cas réel n'est
 * documenté. Deux briefs de prise de vue, pas deux fausses réalisations : rien
 * ici ne prétend décrire un livre qui aurait existé.
 */
export const BEFORE_AFTER_SLOTS: readonly { before: string; after: string }[] = [
  {
    before: "Avant — reliure fatiguée, mors fendus, telle qu'elle arrive à l'atelier.",
    after: "Après — le même ouvrage, même cadrage, même lumière.",
  },
  {
    before: "Avant — livre broché courant, couverture souple, tranches à vif.",
    after: "Après — le même exemplaire relié, même cadrage, même lumière.",
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
  portraitSrc?: string;
  portfolioSrcs?: readonly string[];
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
