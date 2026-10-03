/**
 * Ce qui fait le prix d'un travail de reliure, dans l'ordre où cela pèse sur
 * le temps d'atelier. Partagé par /tarifs et les pages par besoin : une seule
 * source, pour qu'une page n'explique jamais le prix autrement qu'une autre.
 */
export interface PriceFactor {
  title: string;
  body: string;
}

/**
 * Les sept facteurs, dans l'ordre où ils pèsent réellement sur le temps de
 * travail — pas dans l'ordre où un client les remarque. L'état passe donc
 * avant la matière, ce qui est contre-intuitif et vrai : reprendre une couture
 * coûte plus cher que choisir un beau cuir.
 */
export const PRICE_FACTOR_DETAILS: readonly PriceFactor[] = [
  {
    title: "L’état du livre",
    body: "Le premier facteur, et de loin. Un dos fendu, des cahiers désolidarisés ou des plats détachés demandent de démonter l’ouvrage avant de commencer. Un livre complet et solide qu’on habille coûte moins cher qu’un livre en morceaux qu’on remet debout.",
  },
  {
    title: "La structure à refaire",
    body: "Recoudre l’ensemble des cahiers n’a rien à voir avec en reprendre trois. C’est le travail le plus long d’un atelier, et le moins visible une fois le livre fermé.",
  },
  {
    title: "Le format",
    body: "Un in-folio ne se manipule pas comme un livre de poche : plus de matière, d’autres outils, et souvent une presse qui n’accepte qu’un ouvrage à la fois.",
  },
  {
    title: "Les matières",
    body: "Toile, papier décoré, demi-cuir, plein cuir : le coût de la matière compte, mais c’est surtout le temps de parage et de couvrure qui change d’une matière à l’autre.",
  },
  {
    title: "La dorure",
    body: "Un titre au dos, des filets, un décor composé : la dorure se compte au fer et à la ligne, posée à la main, à chaud, sans droit à l’erreur.",
  },
  {
    title: "Les finitions",
    body: "Nerfs, gardes décorées, tranches, signet, étui. Ce sont des choix, pas des obligations — et c’est là que le budget se pilote le plus facilement.",
  },
  {
    title: "La restauration",
    body: "Restaurer n’est pas relier. Un ouvrage ancien, un manuscrit ou une reliure d’époque se regardent avant de se chiffrer : le travail se décide pièce en main.",
  },
];
