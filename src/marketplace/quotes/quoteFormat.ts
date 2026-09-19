/**
 * Saisie et affichage des montants dans l'outil devis — le pont entre ce que le
 * relieur tape (« 280 », « 1 250,5 ») et les centimes entiers que le calcul
 * manipule. Aucune virgule flottante n'entre dans un montant : la saisie est lue
 * comme du texte, découpée en euros et centimes.
 */
import { formatEuros } from "@/marketplace/pricing/money";

const MAX_CENTS = 100_000_000;

/** « 280 » → 28000 ; « 280,5 » → 28050 ; « 1 250,00 » → 125000 ; `null` si vide ou invalide. */
export function parseEurosToCents(input: string): number | null {
  const cleaned = input.replace(/[\s\u00A0\u202F\u20AC]/g, "");
  if (cleaned === "" || /[^0-9.,]/.test(cleaned)) return null;
  // Le dernier séparateur est la virgule décimale ; les autres sont des milliers.
  const lastSep = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  const integerPart = (lastSep === -1 ? cleaned : cleaned.slice(0, lastSep)).replace(/[.,]/g, "");
  const decimalPart = lastSep === -1 ? "" : cleaned.slice(lastSep + 1);
  if (integerPart === "" && decimalPart === "") return null;
  // Arrondi au centime, demi vers le haut, lu sur le TROISIÈME chiffre : jamais de flottant.
  const roundUp = decimalPart.length > 2 && decimalPart[2] >= "5" ? 1 : 0;
  const cents = Number(integerPart || "0") * 100 + Number(decimalPart.padEnd(2, "0").slice(0, 2)) + roundUp;
  return Number.isFinite(cents) && cents >= 0 && cents <= MAX_CENTS ? cents : null;
}

/** 28000 → « 280 » ; 28050 → « 280,50 » — la valeur d'un champ de saisie. */
export function centsToEuroInput(cents: number): string {
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(euros) : `${euros},${String(rest).padStart(2, "0")}`;
}

/** « 1,5 » → 1.5 ; `null` si invalide, négatif, nul, ou avec plus de deux décimales. */
export function parseQuantity(input: string): number | null {
  const value = Number(input.trim().replace(",", "."));
  if (!Number.isFinite(value) || value <= 0 || value > 9999.99) return null;
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6 ? value : null;
}

/** « 30 » (pourcent) → 3000 points de base ; `null` si hors 0–100. */
export function parsePercentToBps(input: string): number | null {
  const value = Number(input.trim().replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return Math.round(value * 100);
}

export const bpsToPercentInput = (bps: number): string => String(bps / 100).replace(".", ",");

export const euros = (cents: number): string => formatEuros(cents, "fr-FR");

export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/**
 * Ce que le serveur répond quand le profil ne suffit pas : `profile_incomplete:Nom|Régime`.
 * Le client lit une LISTE de choses à renseigner, jamais un message technique.
 */
export function parseServerError(error: unknown): { code: "profile_incomplete" | "other"; missing: string[] } {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.startsWith("profile_incomplete")) {
    const list = message.split(":")[1] ?? "";
    return { code: "profile_incomplete", missing: list ? list.split("|") : [] };
  }
  return { code: "other", missing: [] };
}

// --- Téléchargement d'un PDF reçu en base64 -----------------------------------------------

function pdfBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "application/pdf" });
}

export function downloadPdf(filename: string, base64: string): void {
  const url = URL.createObjectURL(pdfBlob(base64));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Ouvre le PDF dans le lecteur du navigateur : c'est de là qu'on l'imprime. */
export function openPdf(base64: string): void {
  const url = URL.createObjectURL(pdfBlob(base64));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
