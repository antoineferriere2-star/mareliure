/**
 * Lire et écrire des montants dans la console de prix.
 *
 * Séparé des composants pour que le rafraîchissement à chaud de Vite suive
 * chaque fichier : un module qui exporte à la fois des composants et des
 * fonctions ne se recharge plus proprement.
 */
import { formatEuros } from "@/marketplace/pricing/money";

/** « 12,50 » ou « 12.5 » → 1250. `null` si la saisie n'est pas un montant. */
export function eurosToCents(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

export function centsToInput(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? "" : String(cents / 100).replace(".", ",");
}

export function money(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? "—" : formatEuros(cents);
}

export function percent(bps: number): string {
  return `${(bps / 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
