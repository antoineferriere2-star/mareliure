/**
 * La logique PURE du mini-formulaire « Ajouter à mes prestations » et de « Prestation personnalisée » :
 * quelles unités proposer, comment lire ce que le relieur a saisi. Aucun prix n'est jamais prérempli — le
 * champ part VIDE, et un prix vide est une erreur, pas un zéro silencieux.
 */
import { parseEurosToCents } from "@/marketplace/quotes/quoteFormat";
import { REFERENCE_UNITS, referenceUnit, type ReferenceUnit } from "./units";

/** Valeurs spéciales de la liste d'unités (jamais des unités elles-mêmes). */
export const UNIT_NONE = "__none__";
export const UNIT_OTHER = "__other__";

export interface UnitOptions {
  /** Les unités habituelles pour CETTE opération (dans l'ordre du référentiel). */
  usual: ReferenceUnit[];
  /** Le reste du vocabulaire court. */
  others: ReferenceUnit[];
}

export function unitOptions(candidateKeys: readonly string[]): UnitOptions {
  const usual = candidateKeys.map((k) => referenceUnit(k)).filter((u): u is ReferenceUnit => Boolean(u));
  const taken = new Set(usual.map((u) => u.key));
  return { usual, others: REFERENCE_UNITS.filter((u) => !taken.has(u.key)) };
}

/** Le choix de départ : la première unité habituelle, sinon « aucune ». */
export const initialUnitChoice = (candidateKeys: readonly string[]): string => unitOptions(candidateKeys).usual[0]?.value ?? UNIT_NONE;

export interface ServiceFormValues {
  name: string;
  unitChoice: string;
  customUnit: string;
  price: string;
  favorite: boolean;
  description: string;
}

/** L'unité stockée : celle choisie, ou celle que l'atelier a écrite — jamais enfermée dans le vocabulaire. */
export function resolveUnit(values: Pick<ServiceFormValues, "unitChoice" | "customUnit">): string | null {
  if (values.unitChoice === UNIT_NONE) return null;
  if (values.unitChoice === UNIT_OTHER) return values.customUnit.trim() || null;
  return values.unitChoice;
}

export type ServiceFormResult =
  | { ok: true; name: string; unit: string | null; unitPriceCents: number; description: string | null }
  | { ok: false; problems: string[] };

const MAX_PRICE_CENTS = 100_000_000;

export function validateServiceForm(values: ServiceFormValues): ServiceFormResult {
  const problems: string[] = [];
  const name = values.name.trim();
  if (!name) problems.push("Donnez un nom à cette prestation.");
  else if (name.length > 200) problems.push("Le nom est trop long (200 caractères au plus).");

  let unitPriceCents = 0;
  if (values.price.trim() === "") problems.push("Indiquez votre prix (0 si c'est offert).");
  else {
    const cents = parseEurosToCents(values.price);
    if (cents === null || cents < 0 || cents > MAX_PRICE_CENTS) problems.push("Le prix doit être un montant en euros, par exemple 45 ou 45,50.");
    else unitPriceCents = cents;
  }

  if (values.unitChoice === UNIT_OTHER && values.customUnit.trim() === "") problems.push("Saisissez votre unité, ou choisissez « Aucune ».");
  const unit = resolveUnit(values);
  if (unit && unit.length > 40) problems.push("L'unité est trop longue (40 caractères au plus).");

  const description = values.description.trim();
  if (description.length > 1000) problems.push("La description est trop longue.");

  return problems.length ? { ok: false, problems } : { ok: true, name, unit, unitPriceCents, description: description || null };
}
