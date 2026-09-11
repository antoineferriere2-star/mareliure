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

export const PRICING_POLICY: PricingPolicy = {
  // La version change dès que la politique change : un dossier chiffré hier
  // doit pouvoir dire sous quelle règle il l'a été.
  version: "bookbinding-2026-09-13-v3",
  targetMarginBps: 1_800,
  minimumMarginBps: 1_500,
  minimumMarginCents: 2_000,
  roundingIncrementCents: 1_000,
  // §25 : 20 % ou 50 €, le plus élevé des deux — jamais un montant fixe.
  depositPercentageBps: 2_000,
  depositMinimumCents: 5_000,
};
