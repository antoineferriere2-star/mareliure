/**
 * Les pages par besoin de Ma Reliure — une par savoir-faire de l'accueil.
 *
 * Elles existent pour la recherche : quelqu'un tape « restauration livre
 * ancien » ou « faire relier un livre », pas « Ma Reliure ». Chaque page
 * répond à une de ces intentions avec ce que le site sait déjà dire vrai :
 * les prestations du catalogue (`WORK_ITEMS`), leurs photographies réelles
 * (atelier Ferrière, créditées), ce qui fait le prix (`PRICE_FACTOR_DETAILS`)
 * et ce que disent les conditions générales.
 *
 * Rien d'inventé : ni montant, ni délai, ni avis, ni chiffre. Une phrase qui
 * ne peut pas se rattacher à l'une de ces sources n'a rien à faire ici.
 */
import type { IllustratedServiceKey } from "@/marketplace/pages/pricing/ferriereServiceIllustrations";

export type CraftSlug = "reparer" | "restaurer" | "relier" | "embellir" | "transformer" | "proteger";

export interface CraftFaq {
  question: string;
  answer: string;
}

export interface CraftPageContent {
  slug: CraftSlug;
  /** L'adresse publique, choisie sur les mots que tape le visiteur. */
  path: string;
  /** Index dans CRAFTS (landing/content.ts) : même titre, même phrase qu'à l'accueil. */
  craftIndex: number;
  seoTitle: string;
  seoDescription: string;
  h1: string;
  intro: string;
  /** Les prestations du catalogue concernées (clés de WORK_ITEMS, toutes illustrées), dans l'ordre du catalogue. */
  itemKeys: readonly IllustratedServiceKey[];
  /** Titres de PRICE_FACTOR_DETAILS qui pèsent le plus pour ce besoin. */
  priceFactorTitles: readonly string[];
  /** Questions propres à ce besoin, avant les questions communes. */
  faq: readonly CraftFaq[];
}

/** Les réponses qui valent pour tous les besoins — tirées des CGV et des étapes de l'accueil. */
export const COMMON_CRAFT_FAQ: readonly CraftFaq[] = [
  {
    question: "Faut-il envoyer le livre pour connaître le prix ?",
    answer:
      "Non. Vous présentez votre livre avec quelques photos, ses dimensions, son état et ce que vous souhaitez en faire. Il reste chez vous : Ma Reliure étudie le travail et vous propose un prix avant tout engagement.",
  },
  {
    question: "Le prix annoncé peut-il changer ?",
    answer:
      "Un prix ne devient ferme qu'une fois confirmé par Ma Reliure pour votre projet, et il devient définitif quand vous le confirmez à votre tour. Un changement vous est expliqué avant d'être fait.",
  },
  {
    question: "Comment le livre voyage-t-il jusqu'à l'atelier ?",
    answer:
      "Pour un livre courant, d'une valeur déclarée inférieure à 100 €, dans un colis de 500 g et 35 × 25 × 8 cm au plus, entre deux adresses de France métropolitaine (hors Corse), la proposition peut inclure un transport aller-retour de 15 € TTC, sur une ligne distincte. Ce forfait n'inclut aucune assurance. Les livres anciens, rares, uniques ou de plus grande valeur ne voyagent pas par ce forfait : leur trajet est convenu avec vous.",
  },
  {
    question: "Comment se passe le paiement ?",
    answer:
      "Une fois le prix confirmé, vous passez commande depuis votre espace client et payez par carte bancaire, via notre prestataire de paiement Stripe. Le contrat est formé au moment où vous validez ce paiement.",
  },
  {
    question: "Qui réalise le travail ?",
    answer:
      "Un atelier artisanal indépendant installé en France, choisi parce que son savoir-faire correspond à votre livre. Vous ne négociez pas avec l'atelier : Ma Reliure reste votre interlocuteur du début à la fin.",
  },
];

export const CRAFT_PAGES: readonly CraftPageContent[] = [
  {
    slug: "reparer",
    path: "/reparation-de-livres",
    craftIndex: 0,
    seoTitle: "Réparation de livres abîmés : dos, coiffes, coutures — Ma Reliure",
    seoDescription:
      "Dos fendu, mors rompus, coiffes usées, pages détachées, couture à reprendre : un artisan relieur remet votre livre en état. Prix annoncé avant engagement.",
    h1: "Réparer un livre abîmé",
    intro:
      "Un livre abîmé n'est pas un livre perdu. Dos fendu, mors rompus, coiffes usées, pages détachées ou couture à reprendre : chaque dommage a son geste, et parfois il suffit de remettre le corps d'ouvrage dans sa couverture d'origine.",
    itemKeys: [
      "reemboitage",
      "reparation_dos",
      "reparation_mors",
      "reparation_coiffes",
      "reparation_coins",
      "reparation_plats",
      "pages_detachees",
      "couture_partielle",
      "recouture_complete",
      "reparation_papier",
      "gardes_neuves",
    ],
    priceFactorTitles: ["L’état du livre", "La structure à refaire", "Le format"],
    faq: [
      {
        question: "Peut-on garder la couverture d'origine ?",
        answer:
          "C'est l'objet du réemboîtage : remettre le corps d'ouvrage dans sa couverture d'origine. Que ce soit possible dépend de l'état de la couverture ; c'est l'une des premières choses que nous regardons.",
      },
    ],
  },
  {
    slug: "restaurer",
    path: "/restauration-de-livres-anciens",
    craftIndex: 1,
    seoTitle: "Restauration de livres anciens par des artisans — Ma Reliure",
    seoDescription:
      "Cuir d'origine, papier, cartonnage, reliure ancienne : préserver un livre ancien en respectant son histoire. Restauration patrimoniale sur étude.",
    h1: "Restaurer un livre ancien",
    intro:
      "Restaurer, c'est préserver un ouvrage ancien en respectant son histoire, plutôt que de la remplacer. Le cuir d'origine, le papier, le cartonnage ou la reliure d'époque sont repris tels qu'ils sont ; un ouvrage patrimonial fait toujours l'objet d'une étude.",
    itemKeys: [
      "restauration_cuir",
      "restauration_papier",
      "restauration_cartonnage",
      "restauration_reliure_ancienne",
      "restauration_patrimoniale",
    ],
    priceFactorTitles: ["La restauration", "L’état du livre", "Les matières"],
    faq: [
      {
        question: "Un livre patrimonial peut-il être restauré ?",
        answer:
          "Oui, sur étude. Une restauration patrimoniale ne se chiffre jamais sur catalogue : un ouvrage ancien, un manuscrit ou une reliure d'époque se regardent avant de se chiffrer, et le travail se décide pièce en main.",
      },
      {
        question: "Restaurer ou relier à neuf ?",
        answer:
          "Restaurer n'est pas relier. La restauration garde ce qui existe — cuir, papier, pièces de titre, fers d'origine — quand une nouvelle reliure remplace la couverture. Dites-nous ce que vous attendez du livre ; c'est la première question que nous vous poserons.",
      },
    ],
  },
  {
    slug: "relier",
    path: "/reliure-de-livres",
    craftIndex: 2,
    seoTitle: "Faire relier un livre : toile, demi-cuir, plein cuir — Ma Reliure",
    seoDescription:
      "Pleine toile, demi-toile, demi-cuir, plein cuir : une reliure durable, faite à la main par un artisan relieur. Prix annoncé avant engagement.",
    h1: "Faire relier un livre",
    intro:
      "Une reliure donne au livre une couverture durable, faite pour être ouverte pendant un siècle. De la pleine toile au plein cuir, la matière choisie change surtout le temps de travail de l'atelier — parage, couvrure — plus que le prix de la matière elle-même.",
    itemKeys: ["pleine_toile", "demi_toile", "dos_cuir", "demi_cuir", "demi_cuir_a_coins", "plein_cuir"],
    priceFactorTitles: ["Les matières", "Le format", "La structure à refaire"],
    faq: [
      {
        question: "Quelle différence entre demi-cuir et plein cuir ?",
        answer:
          "En demi-cuir, le cuir couvre le dos (et les coins pour un demi-cuir à coins), les plats étant en papier ou en toile ; en plein cuir, il couvre tout l'ouvrage. Plus il y a de cuir, plus le parage et la couvrure demandent de temps.",
      },
    ],
  },
  {
    slug: "embellir",
    path: "/dorure-et-finitions",
    craftIndex: 3,
    seoTitle: "Dorure sur livre : titrage, filets, décor doré — Ma Reliure",
    seoDescription:
      "Titrage, nom d'auteur, filets, fleurons, nerfs, gardes décorées, tranches : la dorure et les finitions, posées à la main. Prix annoncé avant engagement.",
    h1: "Embellir un livre : dorure et finitions",
    intro:
      "Quelques traits d'or suffisent parfois à changer un livre. La dorure se compte au fer et à la ligne, posée à la main, à chaud, sans droit à l'erreur ; les finitions — nerfs, gardes décorées, tranches, signet — sont des choix, et c'est là que le budget se pilote le plus facilement.",
    itemKeys: [
      "dorure_titrage",
      "dorure_auteur",
      "dorure_tomaison",
      "dorure_date",
      "dorure_initiales",
      "dorure_filets",
      "dorure_fleurons",
      "dorure_decor",
      "nerfs",
      "gardes_decorees",
      "papiers_marbres",
      "mosaique",
      "signet",
      "tranches",
      "decor_personnalise",
    ],
    priceFactorTitles: ["La dorure", "Les finitions", "Les matières"],
    faq: [
      {
        question: "Peut-on ajouter une dorure sur une reliure existante ?",
        answer:
          "Un titrage, un nom d'auteur, une tomaison ou des initiales se posent sur un dos ou un plat existant quand la matière s'y prête. Présentez votre livre : l'atelier dit ce qui est possible avant tout prix.",
      },
    ],
  },
  {
    slug: "transformer",
    path: "/reliure-de-creation",
    craftIndex: 4,
    seoTitle: "Reliure de création et édition collector — Ma Reliure",
    seoDescription:
      "Faire de votre édition préférée une pièce unique : reliure de création, nouvelle couverture, mosaïque de cuir, décor sur mesure. Sur étude.",
    h1: "Transformer un livre en pièce unique",
    intro:
      "Faire de votre édition préférée une pièce unique : reliure de création dessinée avec vous, nouvelle couverture, mosaïque de cuir, décor sur mesure. Ce sont des travaux sur étude, qui se décident à partir du livre et de ce que vous voulez en faire.",
    itemKeys: ["rebind_collector", "nouvelle_couverture", "reliure_de_creation", "projet_sur_mesure"],
    priceFactorTitles: ["Les matières", "La dorure", "Les finitions"],
    faq: [
      {
        question: "Comment se décide une reliure de création ?",
        answer:
          "Une reliure de création est une pièce unique dessinée avec vous, toujours sur étude. Vous présentez le livre et vos intentions ; l'atelier propose, Ma Reliure vous annonce le prix avant tout engagement.",
      },
    ],
  },
  {
    slug: "proteger",
    path: "/etuis-et-boites",
    craftIndex: 5,
    seoTitle: "Étui, boîte et coffret sur mesure pour livre — Ma Reliure",
    seoDescription:
      "Étui, chemise, boîte ou coffret montés sur mesure autour de l'ouvrage : mettre un livre à l'abri sans rien lui faire subir. Prix annoncé avant engagement.",
    h1: "Protéger un livre : étui, chemise, boîte, coffret",
    intro:
      "Mettre un livre à l'abri sans rien lui faire subir : un étui, une chemise, une boîte ou un coffret montés sur mesure autour de l'ouvrage. Le livre n'est ni démonté ni modifié.",
    itemKeys: ["etui", "chemise", "boite", "coffret"],
    priceFactorTitles: ["Le format", "Les matières", "Les finitions"],
    faq: [
      {
        question: "La protection modifie-t-elle le livre ?",
        answer:
          "Non. Étui, chemise, boîte ou coffret sont montés sur mesure autour de l'ouvrage, sans rien lui faire subir. C'est la solution pour un livre qu'on ne veut pas toucher.",
      },
    ],
  },
];

export function craftPage(slug: CraftSlug): CraftPageContent {
  const page = CRAFT_PAGES.find((candidate) => candidate.slug === slug);
  if (!page) throw new Error(`Unknown craft page: ${slug}`);
  return page;
}

/** Toutes les questions d'une page : les siennes, puis les communes. */
export function craftFaq(page: CraftPageContent): readonly CraftFaq[] {
  return [...page.faq, ...COMMON_CRAFT_FAQ];
}
