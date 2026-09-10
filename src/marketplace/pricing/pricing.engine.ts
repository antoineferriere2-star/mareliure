/**
 * Le moteur tarifaire de Ma Reliure.
 *
 * Il ne contient aucun montant et ne lit qu'une source : la grille Ma Reliure
 * (le Pricebook, ses modificateurs et la politique de marge). Le pipeline :
 *
 *   réponses structurées du Dossier → opérations (`workResolver.ts`)
 *   → tarifs de la grille → modificateurs → prix client TTC
 *   → HT et TVA → rémunération atelier proposée → marge
 *
 * Le simulateur, la composition d'un dossier et sa validation passent tous par
 * `priceProject` : un simulateur plus indulgent que la validation montrerait un
 * prix que le dossier refuserait.
 *
 * Le moteur suggère, il ne valide jamais : un dossier ne reçoit son prix que
 * par une décision de Ma Reliure.
 */
import type { CaseProfile } from "@/marketplace/cases/caseProfile";
import {
  composePrice,
  type CompositionRequest,
  type CompositionResult,
  type PricingGrid,
} from "./composition";
import { resolveWork } from "./workResolver";

/** Les opérations que le moteur lit dans un Dossier, au format et à la complexité déduits. */
export function projectRequest(profile: CaseProfile): CompositionRequest & {
  missingAnswers: string[];
} {
  const work = resolveWork(profile);
  return {
    lines: work.workItemKeys.map((workItemKey) => ({ workItemKey, quantity: 1 })),
    sizeClass: work.sizeClass,
    complexityClass: work.complexityClass,
    missingAnswers: work.missingAnswers,
  };
}

export function priceProject(request: CompositionRequest, grid: PricingGrid): CompositionResult {
  return composePrice(request, grid);
}
