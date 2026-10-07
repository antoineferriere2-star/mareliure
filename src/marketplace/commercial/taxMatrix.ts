/**
 * Matrice de qualification fiscale des prestations Oppe.
 * Taux approuvés administrativement par le propriétaire le 6 octobre 2026 :
 * voir administrativeTaxApproval.ts. Aucun avis d'expert-comptable ou de juriste n'est obtenu.
 *
 * Rien ici n'applique un taux : la matrice pré-remplit le formulaire de validation d'un devis, que
 * l'administration confirme (ou corrige) en justifiant sa décision. Le taux dépend de la nature
 * de l'opération et de l'ouvrage, jamais du vendeur.
 *
 * Sources officielles actualisées le 7 octobre 2026 :
 * - BOI-TVA-LIQ-30-10-40 (livres), version du 29/07/2026 : § 10 définition du livre (quatre
 *   critères cumulatifs) ; § 120 étuis/emboîtages conçus pour un livre déterminé, accessoires au
 *   taux réduit ; § 150 travaux de reliure, livres d'occasion compris : 5,5 % ; § 180 réparation et
 *   désinfection de livres : taux normal ; § 110 transport minime accessoire au livre.
 * - BOI-TVA-CHAMP-20-50-40 et art. 259 A du CGI : travaux sur biens meubles corporels pour un
 *   non-assujetti, taxables au lieu d'exécution matérielle.
 *
 * Points à confirmer par l'expert-comptable avant d'automatiser quoi que ce soit : voir
 * TAX_QUESTIONS_FOR_ACCOUNTANT.
 */
export const SERVICE_TAX_CATEGORIES = ["book_binding", "book_repair_restoration", "non_book_object"] as const;
export type ServiceTaxCategory = (typeof SERVICE_TAX_CATEGORIES)[number];

export interface TaxSuggestion {
  category: ServiceTaxCategory;
  label: string;
  /** Taux suggéré en points de base ; l'administration le confirme ou le corrige. */
  suggestedRateBps: number;
  source: string;
  caveat: string;
}

export const TAX_MATRIX: Record<ServiceTaxCategory, TaxSuggestion> = {
  book_binding: {
    category: "book_binding",
    label: "Reliure d'un livre (au sens fiscal)",
    suggestedRateBps: 550,
    source: "BOI-TVA-LIQ-30-10-40 § 150 (travaux de reliure, livres d'occasion compris)",
    caveat: "Vaut seulement si l'ouvrage répond aux critères du livre (§ 10 à 60). Examiner le contenu et les pages vierges : la seule appellation carnet ou album ne suffit pas à qualifier l'ouvrage.",
  },
  book_repair_restoration: {
    category: "book_repair_restoration",
    label: "Réparation, restauration, conservation d'un livre",
    suggestedRateBps: 2000,
    source: "BOI-TVA-LIQ-30-10-40 § 180 (réparation, désinfection : taux normal)",
    caveat: "La frontière entre reliure (taux réduit) et restauration ou réparation (taux normal) est à qualifier au cas par cas, surtout pour une restauration comprenant une re-reliure.",
  },
  non_book_object: {
    category: "non_book_object",
    label: "Autre ouvrage ou objet (boîte, carnet, album, document)",
    suggestedRateBps: 2000,
    source: "BOI-TVA-LIQ-30-10-40 § 120 (étuis et boîtes conçus pour un livre déterminé et livrés avec lui) ; sinon régime de droit commun (taux normal)",
    caveat: "Une boîte ou un étui livré avec le livre peut suivre son taux réduit ; vendu seul, il suit le taux normal.",
  },
};

/** Aucun taux automatique : qualifier autonome/accessoire avant de proposer un taux. */
export const SHIPPING_SUGGESTION = {
  suggestedRateBps: 2000,
  source: "BOI-TVA-LIQ-30-10-40 § 110 (transport de valeur minime ou marginale, inclus dans le taux réduit) ; forfait aller-retour de 12,50 € HT facturé 15 € TTC",
  caveat: "Une ligne distincte ne justifie pas à elle seule 20 %. Un transport autonome relève du taux normal ; un accessoire suit la prestation principale. Un cas ambigu exige une décision motivée. Le forfait existant à 15 € TTC/12,50 € HT ne convient qu'à un transport expressément qualifié d'autonome à 20 % ; sinon établir une version sans ce forfait avec un transport chiffré et qualifié individuellement.",
} as const;

export const TAX_QUESTIONS_FOR_ACCOUNTANT: readonly string[] = [
  "Taux applicable à la revente par Oppe d'une reliure, d'une restauration, d'une réparation et d'un étui, ligne par ligne.",
  "Traitement du forfait transport : base distincte ou accessoire de la prestation principale.",
  "Correspondance entre catégories du référentiel des 195 opérations et taux, et cas des ouvrages hors définition du livre.",
  "Fine Bindery : client particulier de l'Union européenne ou hors Union (travail exécuté en France, art. 259 A), client professionnel, réexportation après travaux et justificatifs.",
  "Atelier en franchise en base facturant Oppe : effet sur la marge et sur la TVA déductible d'Oppe.",
  "Avoirs et remboursements partiels : ventilation par taux (appliquée proportionnellement aux lignes de la facture).",
];

export function isServiceTaxCategory(value: string): value is ServiceTaxCategory {
  return (SERVICE_TAX_CATEGORIES as readonly string[]).includes(value);
}

export interface LineTaxInput {
  serviceCents: number;
  shippingCents: number;
  serviceRateBps: number;
  /** Absent : le devis n'a pas de ligne de transport. */
  shippingRateBps: number | null;
}

export interface LineTaxResult {
  serviceVatCents: number;
  shippingVatCents: number;
  vatCents: number;
  totalHtCents: number;
  totalTtcCents: number;
}

/** TVA ligne par ligne, chaque ligne arrondie au centime : la même règle que la facture en base. */
export function computeLineTax(input: LineTaxInput): LineTaxResult {
  const serviceVatCents = Math.round((input.serviceCents * input.serviceRateBps) / 10_000);
  const shippingVatCents =
    input.shippingCents > 0 && input.shippingRateBps !== null ? Math.round((input.shippingCents * input.shippingRateBps) / 10_000) : 0;
  const totalHtCents = input.serviceCents + input.shippingCents;
  const vatCents = serviceVatCents + shippingVatCents;
  return { serviceVatCents, shippingVatCents, vatCents, totalHtCents, totalTtcCents: totalHtCents + vatCents };
}
