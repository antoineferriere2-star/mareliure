/**
 * Ce que le code décide du calcul, et rien de ce que Ma Reliure administre.
 *
 * Les tarifs vivent dans le Pricebook, la marge cible et la marge minimale
 * dans `marketplace_pricing_policy`, les majorations de format et de
 * complexité dans `marketplace_pricing_modifiers` : tout cela se modifie
 * depuis l'administration, sans déploiement. Ce fichier ne porte plus que la
 * version des règles de calcul, écrite dans chaque photographie de prix.
 *
 * La version change dès que la façon de calculer change : un dossier chiffré
 * hier doit pouvoir dire sous quelle règle il l'a été.
 */
export const PRICING_RULE_VERSION = "mareliure-grid-2026-09-10-v3";
