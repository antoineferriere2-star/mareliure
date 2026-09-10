/**
 * Les repères web préchargés dans la console de prix.
 *
 * Chaque ligne a été relevée le 10 septembre 2026 sur la page citée, et son
 * montant retrouvé dans le texte brut de la page — pas seulement dans un
 * résumé. L'extrait est recopié tel qu'il apparaît.
 *
 * Ce qui a été écarté, et pourquoi :
 *
 * - Reliures Sélune, le bloc sous « Pastiches » (« 200 x 130 … plein cuir
 *   45 € », « 270 x 175 … plein cuir 70 € ») : la même page annonce le plein
 *   cuir à 285 € plus haut, la mise en page est manifestement cassée ;
 * - Reliure de Châtillon, « Couverture en cuir » et « Dorure » : impossible de
 *   rattacher ces lignes à un seul travail du catalogue sans l'inventer ;
 * - Reliure Deschamps, « Bradel » : une technique sans matière, sans
 *   équivalent au catalogue ;
 * - les pages qui ne publient que des PDF, des exemples de fourchettes ou qui
 *   ne répondent plus.
 *
 * Le format est rattaché à une classe par `sizeClassOf` (la hauteur, c'est-à-
 * dire la plus grande dimension) ; `referenceHeightsCm` garde les hauteurs
 * utilisées pour qu'un test le vérifie. Une source qui ne donne pas de format
 * reste en « non précisé ».
 *
 * Ce fichier n'est importé que par le script de seed et par son test.
 */
import type { SizeClass } from "./catalog";
import type { PriceBasis } from "./benchmark";

export interface WebBenchmarkSeed {
  workItemKey: string;
  sizeClass: SizeClass | null;
  referenceHeightsCm: number[];
  unitLabel: string | null;
  lowPriceCents: number;
  highPriceCents: number;
  priceBasis: PriceBasis;
  formatLabel: string | null;
  sourceName: string;
  sourceUrl: string;
  sourceExcerpt: string;
  observedAt: string;
  notes: string | null;
}

const OBSERVED_AT = "2026-09-10";

const SELUNE = {
  sourceName: "Reliures Sélune",
  sourceUrl: "https://www.reliures-selune.com/liste-de-prix",
  priceBasis: "NOT_STATED" as const,
  observedAt: OBSERVED_AT,
};
const SELUNE_NOTE =
  "La page présente ses prix comme « une base indicative moyenne pour un format donné », établis sur devis.";

const CHATILLON = {
  sourceName: "Reliure de Châtillon",
  sourceUrl: "https://www.lesreliuresdechatillon.com/tarifs",
  priceBasis: "NOT_STATED" as const,
  observedAt: OBSERVED_AT,
};

const FRANCE_RELIURE = {
  sourceName: "France Reliure",
  sourceUrl: "https://francereliure.com/nos-tarifs",
  priceBasis: "TTC" as const,
  observedAt: OBSERVED_AT,
};
const FRANCE_RELIURE_NOTE =
  "Registres au format A4, tarifs réservés aux collectivités territoriales ; prix sans remise quantitative. Un autre marché que le particulier.";

const DESCHAMPS = {
  sourceName: "Reliure Deschamps",
  sourceUrl: "https://www.reliure-deschamps.com/tarif",
  priceBasis: "TTC" as const,
  observedAt: OBSERVED_AT,
};
const DESCHAMPS_NOTE = "« Prix TTC dorure non comprise ». Formats en centimètres.";

export const WEB_BENCHMARK_SEED: readonly WebBenchmarkSeed[] = [
  // --- Reliures Sélune ------------------------------------------------------
  {
    ...SELUNE,
    workItemKey: "demi_toile",
    sizeClass: "standard",
    referenceHeightsCm: [18.5, 20, 22, 24.5, 27, 28],
    unitLabel: null,
    lowPriceCents: 4_000,
    highPriceCents: 7_000,
    formatLabel: "185 x 115 à 280 x 220 (mm)",
    sourceExcerpt:
      'Montage "Bradel" (reliure simplifiée en emboitage, demi ou pleine toile) 185 x 115 ...demi toile 40 € … 280 x 220 ...demi toile 70 €',
    notes: SELUNE_NOTE,
  },
  {
    ...SELUNE,
    workItemKey: "demi_toile",
    sizeClass: "large",
    referenceHeightsCm: [32, 35],
    unitLabel: null,
    lowPriceCents: 9_000,
    highPriceCents: 10_500,
    formatLabel: "320 x 245 à 350 x 270 (mm)",
    sourceExcerpt: "320 x 245 ...demi toile 90 € · 350 x 270 ...demi toile 105 €",
    notes: SELUNE_NOTE,
  },
  {
    ...SELUNE,
    workItemKey: "demi_toile",
    sizeClass: "oversize",
    referenceHeightsCm: [44],
    unitLabel: null,
    lowPriceCents: 13_500,
    highPriceCents: 13_500,
    formatLabel: "440 x 280 (mm)",
    sourceExcerpt: "440 x 280 ...demi toile 135 €",
    notes: SELUNE_NOTE,
  },
  {
    ...SELUNE,
    workItemKey: "pleine_toile",
    sizeClass: "standard",
    referenceHeightsCm: [18.5, 20, 22, 24.5, 27, 28],
    unitLabel: null,
    lowPriceCents: 9_800,
    highPriceCents: 14_900,
    formatLabel: "185 x 115 à 280 x 220 (mm)",
    sourceExcerpt:
      "Reliure soignée pleine toile ou demi-cuir 185 x 115... toile 98 € … 280 x 220 ...toile 149 €",
    notes: SELUNE_NOTE,
  },
  {
    ...SELUNE,
    workItemKey: "pleine_toile",
    sizeClass: "large",
    referenceHeightsCm: [32, 35],
    unitLabel: null,
    lowPriceCents: 17_300,
    highPriceCents: 21_300,
    formatLabel: "320 x 245 à 350 x 270 (mm)",
    sourceExcerpt: "320 x 245 ...toile 173 € · 350 x 270 ...toile 213 €",
    notes: SELUNE_NOTE,
  },
  {
    ...SELUNE,
    workItemKey: "pleine_toile",
    sizeClass: "oversize",
    referenceHeightsCm: [44],
    unitLabel: null,
    lowPriceCents: 23_400,
    highPriceCents: 23_400,
    formatLabel: "440 x 280 (mm)",
    sourceExcerpt: "440 x 280 ...toile 234 €",
    notes: SELUNE_NOTE,
  },
  {
    ...SELUNE,
    workItemKey: "demi_cuir",
    sizeClass: "standard",
    referenceHeightsCm: [18.5, 20, 22, 24.5, 27, 28],
    unitLabel: null,
    lowPriceCents: 12_000,
    highPriceCents: 17_000,
    formatLabel: "185 x 115 à 280 x 220 (mm)",
    sourceExcerpt:
      "Reliure soignée pleine toile ou demi-cuir 185 x 115...1/2 cuir 120 € … 280 x 220 ...1/2 cuir 170 €",
    notes: SELUNE_NOTE,
  },
  {
    ...SELUNE,
    workItemKey: "demi_cuir",
    sizeClass: "large",
    referenceHeightsCm: [32, 35],
    unitLabel: null,
    lowPriceCents: 20_500,
    highPriceCents: 24_500,
    formatLabel: "320 x 245 à 350 x 270 (mm)",
    sourceExcerpt: "320 x 245 ...1/2 cuir 205 € · 350 x 270 ...1/2 cuir 245 €",
    notes: SELUNE_NOTE,
  },
  {
    ...SELUNE,
    workItemKey: "demi_cuir",
    sizeClass: "oversize",
    referenceHeightsCm: [44],
    unitLabel: null,
    lowPriceCents: 27_500,
    highPriceCents: 27_500,
    formatLabel: "440 x 280 (mm)",
    sourceExcerpt: "440 x 280 ...1/2 cuir 275 €",
    notes: SELUNE_NOTE,
  },
  {
    ...SELUNE,
    workItemKey: "plein_cuir",
    sizeClass: "standard",
    referenceHeightsCm: [18.5, 20, 22, 24.5, 27, 28],
    unitLabel: null,
    lowPriceCents: 28_000,
    highPriceCents: 44_500,
    formatLabel: "185 x 115 à 280 x 220 (mm)",
    sourceExcerpt:
      "Reliure plein cuir moderne (cartons et cuirs affinés, papiers main) 185 x 115 ... 280 € … 280 x 220 ... 445 €",
    notes: SELUNE_NOTE,
  },
  {
    ...SELUNE,
    workItemKey: "plein_cuir",
    sizeClass: "large",
    referenceHeightsCm: [32, 35],
    unitLabel: null,
    lowPriceCents: 47_000,
    highPriceCents: 50_000,
    formatLabel: "320 x 245 à 350 x 270 (mm)",
    sourceExcerpt: "Reliure plein cuir moderne 320 x 245 ... 470 € · 350 x 270 ... 500 €",
    notes: SELUNE_NOTE,
  },
  {
    ...SELUNE,
    workItemKey: "plein_cuir",
    sizeClass: "oversize",
    referenceHeightsCm: [44],
    unitLabel: null,
    lowPriceCents: 53_500,
    highPriceCents: 53_500,
    formatLabel: "440 x 280 (mm)",
    sourceExcerpt: "Reliure plein cuir moderne 440 x 280 ... 535 €",
    notes: SELUNE_NOTE,
  },
  {
    ...SELUNE,
    workItemKey: "dorure_titrage",
    sizeClass: null,
    referenceHeightsCm: [],
    unitLabel: null,
    lowPriceCents: 2_000,
    highPriceCents: 2_500,
    formatLabel: null,
    sourceExcerpt:
      "titrage sur pièce cuir....or 25 €....film 10€ · titrage direct...........or 20 €.........film 8 €",
    notes: "À la feuille d'or. Au film doré : 8 à 10 €.",
  },
  {
    ...SELUNE,
    workItemKey: "dorure_fleurons",
    sizeClass: null,
    referenceHeightsCm: [],
    unitLabel: "par fleuron",
    lowPriceCents: 600,
    highPriceCents: 600,
    formatLabel: null,
    sourceExcerpt: "fleuron poussé.......or 6 €..........film 2 €",
    notes: "À la feuille d'or. Au film doré : 2 €.",
  },
  {
    ...SELUNE,
    workItemKey: "dorure_filets",
    sizeClass: null,
    referenceHeightsCm: [],
    unitLabel: "par filet",
    lowPriceCents: 300,
    highPriceCents: 300,
    formatLabel: null,
    sourceExcerpt: "filet.........................or 3 €..........film 1 €",
    notes: "À la feuille d'or. Au film doré : 1 €.",
  },
  {
    ...SELUNE,
    workItemKey: "reparation_coins",
    sizeClass: null,
    referenceHeightsCm: [],
    unitLabel: "par coin",
    lowPriceCents: 4_000,
    highPriceCents: 4_000,
    formatLabel: null,
    sourceExcerpt: "coin.................................................... 40 €",
    notes:
      "Rattaché à la rubrique Restauration d'après l'ordre de la page, dont la mise en page est désordonnée.",
  },
  {
    ...SELUNE,
    workItemKey: "reparation_coiffes",
    sizeClass: null,
    referenceHeightsCm: [],
    unitLabel: "par coiffe",
    lowPriceCents: 10_000,
    highPriceCents: 10_000,
    formatLabel: null,
    sourceExcerpt: "coiffe................................................ 100 €",
    notes:
      "Rattaché à la rubrique Restauration d'après l'ordre de la page, dont la mise en page est désordonnée.",
  },
  {
    ...SELUNE,
    workItemKey: "reparation_dos",
    sizeClass: null,
    referenceHeightsCm: [],
    unitLabel: null,
    lowPriceCents: 30_000,
    highPriceCents: 30_000,
    formatLabel: null,
    sourceExcerpt: "dos................................................... 300 €",
    notes:
      "Rattaché à la rubrique Restauration d'après l'ordre de la page, dont la mise en page est désordonnée.",
  },
  {
    ...SELUNE,
    workItemKey: "couture_partielle",
    sizeClass: null,
    referenceHeightsCm: [],
    unitLabel: "par cahier",
    lowPriceCents: 1_000,
    highPriceCents: 1_000,
    formatLabel: null,
    sourceExcerpt: "recouture d'un cahier........................ 10 €",
    notes: null,
  },
  {
    ...SELUNE,
    workItemKey: "restauration_reliure_ancienne",
    sizeClass: null,
    referenceHeightsCm: [],
    unitLabel: null,
    lowPriceCents: 85_000,
    highPriceCents: 500_000,
    formatLabel: null,
    sourceExcerpt: "restauration complète........ 850 € - 5000 €",
    notes: "Fourchette très large : un ordre de grandeur, pas un repère de prix.",
  },

  // --- Reliure de Châtillon ---------------------------------------------------
  {
    ...CHATILLON,
    workItemKey: "reemboitage",
    sizeClass: null,
    referenceHeightsCm: [],
    unitLabel: null,
    lowPriceCents: 800,
    highPriceCents: 1_600,
    formatLabel: null,
    sourceExcerpt: "Ré-emboîtage Entre 8 à 16 € par livre",
    notes:
      "Atelier qui propose aussi plastifiage et dossiers de thèse : sans doute un réemboîtage simple.",
  },
  {
    ...CHATILLON,
    workItemKey: "pleine_toile",
    sizeClass: null,
    referenceHeightsCm: [],
    unitLabel: null,
    lowPriceCents: 6_000,
    highPriceCents: 19_000,
    formatLabel: null,
    sourceExcerpt: "Reliure traditionnelle Couverture en toile 60 à 190 € par livre",
    notes: null,
  },

  // --- France Reliure ---------------------------------------------------------
  {
    ...FRANCE_RELIURE,
    workItemKey: "pleine_toile",
    sizeClass: "large",
    referenceHeightsCm: [29.7],
    unitLabel: null,
    lowPriceCents: 8_100,
    highPriceCents: 9_600,
    formatLabel: "A4, épaisseur jusqu'à 40 mm",
    sourceExcerpt:
      "PLEINE TOILE épaisseur inférieure à 20mm 81,00 Euros TTC · PLEINE TOILE entre 20mm et 40mm 96,00 Euros TTC",
    notes: FRANCE_RELIURE_NOTE,
  },
  {
    ...FRANCE_RELIURE,
    workItemKey: "dos_cuir",
    sizeClass: "large",
    referenceHeightsCm: [29.7],
    unitLabel: null,
    lowPriceCents: 11_900,
    highPriceCents: 13_400,
    formatLabel: "A4, épaisseur jusqu'à 40 mm",
    sourceExcerpt:
      "DOS CUIR PLATS TOILE ENDUITE épaisseur inférieure à 20mm 119,00 Euros TTC · entre 20mm et 40mm 134,00 Euros TTC",
    notes: FRANCE_RELIURE_NOTE,
  },
  {
    ...FRANCE_RELIURE,
    workItemKey: "plein_cuir",
    sizeClass: "large",
    referenceHeightsCm: [29.7],
    unitLabel: null,
    lowPriceCents: 13_900,
    highPriceCents: 15_400,
    formatLabel: "A4, épaisseur jusqu'à 40 mm",
    sourceExcerpt:
      "PLEIN CUIR épaisseur inférieure à 20mm 139,00 Euros TTC · PLEIN CUIR entre 20mm et 40mm 154,00 Euros TTC",
    notes: FRANCE_RELIURE_NOTE,
  },

  // --- Reliure Deschamps ------------------------------------------------------
  ...(
    [
      ["pleine_toile", "TOILE", [6_900, 7_900, 8_800, 9_800, 12_000, 21_000]],
      ["demi_cuir", "DEMI CUIR", [8_500, 9_700, 10_800, 12_100, 14_800, 25_800]],
      ["plein_cuir", "PLEINE PEAU", [18_600, 21_300, 23_800, 26_500, 32_400, 56_700]],
    ] as const
  ).flatMap(([workItemKey, heading, [f10x15, f13x20, f16x25, f22x30, f26x33, f30x40]]) => {
    const euros = (cents: number) => `${cents / 100} €`;
    return [
      {
        ...DESCHAMPS,
        workItemKey,
        sizeClass: "small" as const,
        referenceHeightsCm: [15],
        unitLabel: null,
        lowPriceCents: f10x15,
        highPriceCents: f10x15,
        formatLabel: "10 X 15",
        sourceExcerpt: `${heading} 10 X 15 - ${euros(f10x15)} · Prix TTC dorure non comprise`,
        notes: DESCHAMPS_NOTE,
      },
      {
        ...DESCHAMPS,
        workItemKey,
        sizeClass: "standard" as const,
        referenceHeightsCm: [20, 25],
        unitLabel: null,
        lowPriceCents: f13x20,
        highPriceCents: f16x25,
        formatLabel: "13 X 20 à 16 X 25",
        sourceExcerpt: `${heading} 16 X 25 - ${euros(f16x25)} · 13 X 20 - ${euros(f13x20)} · Prix TTC dorure non comprise`,
        notes: DESCHAMPS_NOTE,
      },
      {
        ...DESCHAMPS,
        workItemKey,
        sizeClass: "large" as const,
        referenceHeightsCm: [30, 33],
        unitLabel: null,
        lowPriceCents: f22x30,
        highPriceCents: f26x33,
        formatLabel: "22 X 30 à 26 X 33",
        sourceExcerpt: `${heading} 26 X 33 - ${euros(f26x33)} · 22 X 30 - ${euros(f22x30)} · Prix TTC dorure non comprise`,
        notes: DESCHAMPS_NOTE,
      },
      {
        ...DESCHAMPS,
        workItemKey,
        sizeClass: "oversize" as const,
        referenceHeightsCm: [40],
        unitLabel: null,
        lowPriceCents: f30x40,
        highPriceCents: f30x40,
        formatLabel: "30 X 40",
        sourceExcerpt: `${heading} 30 X 40 - ${euros(f30x40)} · Prix TTC dorure non comprise`,
        notes: DESCHAMPS_NOTE,
      },
    ];
  }),
  {
    ...DESCHAMPS,
    workItemKey: "dorure_titrage",
    sizeClass: null,
    referenceHeightsCm: [],
    unitLabel: null,
    lowPriceCents: 2_000,
    highPriceCents: 2_000,
    formatLabel: null,
    sourceExcerpt: "DORURE CLASSIQUE auteur, titre, fleurons et filets 20 € TTC",
    notes: "Forfait qui comprend auteur, titre, fleurons et filets.",
  },
  {
    ...DESCHAMPS,
    workItemKey: "dorure_decor",
    sizeClass: null,
    referenceHeightsCm: [],
    unitLabel: null,
    lowPriceCents: 4_000,
    highPriceCents: 4_000,
    formatLabel: null,
    sourceExcerpt: "DORURE XVIIIe dos décoré 40 € TTC",
    notes: null,
  },
];
