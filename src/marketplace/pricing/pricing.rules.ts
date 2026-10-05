/**
 * Ce que Ma Reliure décide elle-même.
 *
 * Ce fichier portait jusqu'ici une quinzaine de montants — 140 € pour une
 * réparation, 200 € pour une belle reliure, 80 € pour un demi-cuir — posés
 * pour que le moteur produise un résultat. Ils ont été retirés : aucun relieur
 * ne les avait jamais vus, et un tarif que personne n'a prononcé n'a pas sa
 * place dans le chemin qui mène à un prix de vente.
 *
 * Ne restent que des décisions commerciales, qui appartiennent légitimement à
 * Ma Reliure : quelle marge viser, quel plancher refuser, comment arrondir. Ce
 * ne sont pas des tarifs, ce sont des règles — les tarifs viennent du terrain,
 * par `rateCard.ts`.
 *
 * Les anciens montants n'ont pas disparu : ils vivent dans
 * `testReferences.fixture.ts`, marqués `TEST_ONLY`, où ils servent de jeu
 * d'essai et ne peuvent atteindre personne.
 */
import type { PricingPolicy } from "./pricing.types";

/**
 * Modèle Oppe du 5 octobre 2026 (activité A) : marge brute cible de 25 % du prix de vente HT
 * de la prestation, transport exclu. Une marge sur vente, pas une majoration du coût :
 * rémunération atelier 150 € HT → prix de vente 200 € HT (150 / (1 − 0,25)).
 *
 * Remplace pour les nouvelles propositions les règles contradictoires de la v5 (marge cible
 * 18 %, minimum 15 %, plancher de contribution 80 € HT, arrondi à 10 €, coefficient Fine
 * Bindery ×1,30). Les propositions figées gardent la version sous laquelle elles l'ont été.
 *
 * Seul écart permis sans dérogation : l'arrondi à l'euro supérieur, qui ne peut que relever la
 * marge de moins d'un euro. Tout autre prix exige une dérogation motivée.
 */
export const PRICING_POLICY: PricingPolicy = {
  // La version change dès que la politique change : un dossier chiffré hier
  // doit pouvoir dire sous quelle règle il l'a été.
  version: "oppe-a-2026-10-05-v6",
  targetMarginBps: 2_500,
  minimumMarginBps: 2_500,
  minimumMarginCents: 0,
  minimumContributionCents: 0,
  roundingIncrementCents: 100,
  pricebookBindsPrice: false,
  // §25 : 20 % ou 50 €, le plus élevé des deux — jamais un montant fixe.
  depositPercentageBps: 2_000,
  depositMinimumCents: 5_000,
};
