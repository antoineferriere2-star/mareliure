/**
 * Ce qui différencie la rémunération entre ateliers (§31) — sans revenir à
 * une grille complète par atelier.
 *
 * Un seul Pricebook fixe le prix client (pricing.engine.ts, pricebook.ts) :
 * ça ne change pas ici. Ce que ce module ajoute, c'est un multiplicateur —
 * par atelier, par famille de savoir-faire (`WORK_FAMILIES`, catalog.ts) —
 * appliqué à la rémunération de référence de Ma Reliure au moment où une
 * offre part vers un atelier précis (`sendCaseToBinders`). Un atelier sans
 * condition particulière touche exactement le montant de référence : ni
 * majoration, ni minoration inventée.
 */
import { workItem, type WorkFamilyKey } from "./catalog";

export interface CommercialTerm {
  familyKey: WorkFamilyKey;
  payoutMultiplierBps: number;
  manualPayoutRequired: boolean;
}

/**
 * La famille qui gouverne la rémunération d'un projet : celle de son travail
 * *structure* (catalog.ts — un projet en porte au plus un). Les compléments
 * (dorure sur une reliure cuir, par exemple) ne changent pas quel taux
 * s'applique ; ils entrent déjà dans le montant de référence que ce
 * multiplicateur ajuste globalement, pas travail par travail — la
 * simplicité que le §31 demande explicitement.
 */
export function structuralFamily(workItemKeys: readonly string[]): WorkFamilyKey | null {
  for (const key of workItemKeys) {
    const item = workItem(key);
    if (item?.role === "structure") return item.family;
  }
  return null;
}

export interface ResolvedPayout {
  payoutCents: number;
  /** true si un humain doit fixer ce montant — jamais calculé automatiquement. */
  manualRequired: boolean;
}

/**
 * Applique les conditions commerciales d'un atelier au montant de référence.
 *
 * Aucune condition trouvée pour la famille → le montant de référence,
 * inchangé (multiplicateur 10 000 pb implicite) : un atelier sans condition
 * particulière n'est jamais pénalisé ni avantagé par défaut.
 *
 * `manualPayoutRequired` gagne toujours : le montant renvoyé est alors le
 * montant de référence, marqué comme provisoire — à fixer à la main, jamais
 * à multiplier à l'aveugle (l'exemple du cahier des charges : restauration
 * patrimoniale, "manuel").
 */
export function resolvePayout(
  referencePayoutCents: number,
  term: CommercialTerm | null,
): ResolvedPayout {
  if (!term || term.manualPayoutRequired) {
    return { payoutCents: referencePayoutCents, manualRequired: Boolean(term?.manualPayoutRequired) };
  }
  return {
    payoutCents: Math.round((referencePayoutCents * term.payoutMultiplierBps) / 10_000),
    manualRequired: false,
  };
}
