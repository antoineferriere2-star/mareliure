/**
 * Lire et écrire des montants dans la grille tarifaire et le simulateur.
 *
 * Séparé des composants pour que le rafraîchissement à chaud de Vite suive
 * chaque fichier : un module qui exporte à la fois des composants et des
 * fonctions ne se recharge plus proprement.
 */
import { formatEuros } from "@/marketplace/pricing/money";

/** La grille, lue par la page de grille et par le simulateur : une seule requête. */
export const PRICING_GRID_QUERY_KEY = ["marketplace", "pricing", "grid"] as const;

/** « 12,50 » ou « 12.5 » → 1250. `null` si la saisie n'est pas un montant. */
export function eurosToCents(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

/** « 25 » ou « 12,5 » (pour cent) → 2500 ou 1250 points de base. */
export function percentToBps(value: string): number | null {
  return eurosToCents(value);
}

export function centsToInput(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? "" : String(cents / 100).replace(".", ",");
}

export function bpsToInput(bps: number): string {
  return String(bps / 100).replace(".", ",");
}

export function money(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? "—" : formatEuros(cents);
}

/** « 350 € » plutôt que « 350,00 € » quand le montant tombe juste : une grille se lit vite. */
export function wholeEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function percent(bps: number): string {
  return `${(bps / 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
