/**
 * Les photographies de la landing.
 *
 * Neuf images, toutes réelles, toutes venues de l'atelier Reliure Dorure
 * Ferrière à Orléans. Cinq autres ont été retirées le 9 septembre 2026 : elles
 * étaient générées, et elles se voyaient — une presse dont la vis n'engageait
 * rien, des coffrets dont les couvercles étaient à la fois ouverts et fermés,
 * un fer à dorer sans géométrie. Elles donnaient à la page la chaleur brune et
 * le flou de studio qui font reconnaître une image fabriquée, et l'une d'elles
 * était créditée à l'atelier, qui ne l'avait pas faite.
 *
 * D'où la règle : **une case vide vaut mieux qu'une fausse image.** Le site
 * compose désormais avec ce qu'il a, et les sections qui n'ont pas de
 * photographie légitime n'en montrent aucune.
 *
 * Encodage : WebP, qualité 76, largeurs 480 / 800 / 1200 (et 1600 quand la
 * source le permet), jamais au-dessus de la taille d'origine. Le `sizes` ne
 * vit pas ici mais au point d'appel : il décrit la place que l'image occupe
 * dans une mise en page donnée, et la même photographie peut servir à deux
 * endroits de largeurs différentes.
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

export const PHOTOS = {
  /**
   * Les deux restaurations documentées, avant et après.
   *
   * Ce sont de vrais ouvrages, vraiment restaurés. C'est la seule raison pour
   * laquelle une section avant/après peut exister — et, depuis le retrait des
   * images générées, ce sont elles qui portent la preuve du site.
   */
  syriaBefore: sources("syrie-avant", [480, 800, 1200]),
  syriaAfter: sources("syrie-apres", [480, 800, 1200]),
  academieBefore: sources("academie-avant", [480, 800, 1200]),
  academieAfter: sources("academie-apres", [480, 800, 1200]),

  /** Les pièces de l'atelier Ferrière. */
  ferriereBaudelaire: sources("ferriere-baudelaire", [480, 800, 1024]),
  ferriereOmnia: sources("ferriere-omnia", [320, 640]),
  ferriereDoublures: sources("ferriere-doublures", [320, 640]),
  ferriereLarousse: sources("ferriere-larousse", [320, 640]),
  /** Maroquin bordeaux à plats de brocart, titré « Venise ». */
  ferriereVenise: sources("reliure-bordeaux", [480, 800]),
} as const;

/**
 * Les largeurs d'affichage, mesurées sur la mise en page réelle plutôt
 * qu'estimées : le conteneur plafonne à 80rem (1280 px) avec 2,5rem de marges.
 * Un `sizes` trop généreux fait télécharger une variante inutilement lourde ;
 * trop avare, il rend l'image floue.
 */
export const PHOTO_SIZES = {
  /** Pleine largeur d'une colonne de 7/12 sur grand écran. */
  hero: "(min-width: 1024px) 47vw, 100vw",
  /** Les deux volets d'un avant/après, côte à côte. */
  beforeAfter: "(min-width: 1024px) 300px, (min-width: 640px) 45vw, 100vw",
  /** La pièce de tête d'un atelier. */
  artisan: "(min-width: 1024px) 44vw, 100vw",
  /** Une vignette de portfolio. */
  thumb: "(min-width: 1024px) 220px, 45vw",
} as const;
