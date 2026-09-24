import { notFound } from "@tanstack/react-router";
import { isMaReliure } from "@/brand";

/**
 * `beforeLoad` des pages marketing de Métré Build.
 *
 * Elles existent dans l'arbre de routes des deux déploiements, et mareliure.fr
 * les servait donc en anglais (« Project Intake Pricing from $19.99/mo »),
 * indexables et sans rapport avec la reliure. Sur le déploiement Ma Reliure
 * elles sont introuvables — vraie 404, page Ma Reliure. `isMaReliure` est une
 * constante de compilation : sur Métré, rien ne change.
 */
export function metreOnly(): void {
  if (isMaReliure) throw notFound();
}
