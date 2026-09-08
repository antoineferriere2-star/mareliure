/**
 * Les photographies de la landing.
 *
 * Elles viennent d'être fournies : la page n'illustre plus la reliure, elle la
 * montre. Chaque image est déclarée une fois ici, avec les largeurs réellement
 * encodées, pour que personne n'ait à retenir quel fichier existe.
 *
 * Encodage : WebP, qualité 76, largeurs 480 / 800 / 1200 (et 1600 quand la
 * source le permet), jamais au-dessus de la taille d'origine — agrandir une
 * photo coûte des octets et ne rend rien. Un téléphone télécharge la variante
 * 480, soit une vingtaine de kilo-octets par image.
 *
 * Le `sizes` ne vit pas ici mais au point d'appel : il décrit la place que
 * l'image occupe dans une mise en page donnée, et la même photographie peut
 * servir à deux endroits de largeurs différentes.
 */

/** Ce qu'un `<img>` a besoin de savoir : une source par défaut, et le jeu complet. */
export interface PhotoSources {
  readonly src: string;
  readonly srcSet: string;
}

function sources(name: string, widths: readonly number[]): PhotoSources {
  const widest = widths[widths.length - 1];
  return {
    // La plus grande largeur en `src` : c'est ce que prend un navigateur qui
    // ignore `srcset`, et mieux vaut qu'il soit trop net que flou.
    src: `/photos/${name}-${widest}.webp`,
    srcSet: widths.map((w) => `/photos/${name}-${w}.webp ${w}w`).join(", "),
  };
}

/**
 * Le nom de chaque entrée dit où elle sert, pas ce qu'elle représente : quand
 * une photographie est remplacée, c'est l'emplacement qui reste stable.
 */
export const PHOTOS = {
  /** Hero : mains de l'artisan posant la feuille d'or sur un dos à nerfs. */
  hero: sources("mains-dorure", [480, 800, 1200]),
  /** Réparer : l'atelier, la presse, les cahiers en attente. */
  repair: sources("atelier-presse", [480, 800, 1200, 1600]),
  /** Restaurer : un ouvrage ancien fatigué, entouré des outils de restauration. */
  restore: sources("livre-ancien", [480, 800, 1200]),
  /** Transformer : coffrets et emboîtages en toile, teintes neuves. */
  transform: sources("coffrets-toile", [480, 800, 1200]),
  /** Édition collector : une pièce unique, cuir, brocart et dorure. */
  collector: sources("reliure-bordeaux", [480, 800]),
  /** Fin de page : une pile de dos dorés, sur l'établi. */
  closing: sources("reliures-dorees", [480, 800, 1200, 1600]),

  /**
   * Les deux restaurations documentées, avant et après.
   *
   * Photographies de l'atelier Reliure Dorure Ferrière (Orléans), fournies
   * avec les droits d'usage. Ce sont de vrais ouvrages, vraiment restaurés :
   * c'est la seule raison pour laquelle la section avant/après peut exister.
   * La page les crédite, sinon les montrer ici laisserait croire qu'il s'agit
   * de chantiers passés par Ma Reliure.
   */
  syriaBefore: sources("syrie-avant", [480, 800, 1200]),
  syriaAfter: sources("syrie-apres", [480, 800, 1200]),
  academieBefore: sources("academie-avant", [480, 800, 1200]),
  academieAfter: sources("academie-apres", [480, 800, 1200]),
} as const;

/**
 * Les largeurs d'affichage, mesurées sur la mise en page réelle plutôt
 * qu'estimées : le conteneur plafonne à 78rem (1248 px) avec 2,5rem de marges,
 * et la grille des savoir-faire découpe 12 colonnes séparées de 2,5rem.
 *
 * Un `sizes` faux ne casse rien de visible — il fait juste télécharger une
 * image deux fois trop lourde sur un téléphone, ce qui est exactement le genre
 * de dette qu'on ne remarque jamais.
 */
export const PHOTO_SIZES = {
  /** Hero : la moitié du conteneur au-delà de 1024 px. */
  half: "(min-width: 1024px) 592px, calc(100vw - 2.5rem)",
  /** Savoir-faire, bloc large : 7 colonnes sur 12. */
  sevenOfTwelve: "(min-width: 1024px) 704px, calc(100vw - 2.5rem)",
  /** Savoir-faire, bloc étroit : 5 colonnes sur 12. */
  fiveOfTwelve: "(min-width: 1024px) 493px, calc(100vw - 2.5rem)",
  /** Fin de page : la colonne de 0,85fr. */
  closing: "(min-width: 1024px) 537px, calc(100vw - 2.5rem)",
  /** Avant / après : deux carrés côte à côte, dans une demi-page au-delà de 1024 px. */
  beforeAfter: "(min-width: 1024px) 290px, calc(50vw - 1.6rem)",
} as const;
