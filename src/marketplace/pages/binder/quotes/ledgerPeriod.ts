/** Période d'archive choisie à l'écran, et téléchargement d'un fichier reçu en base64. */
import { useState } from "react";
import { todayInParis } from "@/marketplace/quotes/quoteStatus";

export function useArchivePeriod() {
  const currentYear = Number(todayInParis().slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | null>(Number(todayInParis().slice(5, 7)));
  const years = Array.from({ length: Math.max(1, currentYear - 2026 + 1) }, (_, i) => 2026 + i);
  return { value: { year, month }, setYear, setMonth, years };
}

export function downloadBase64(filename: string, base64: string, type: string): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
