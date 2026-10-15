import { binderSkillLabel } from "@/marketplace/binders/skills";
import type { FineBinderyLocale } from "./fineBinderyLocale";

export type Terms = Record<FineBinderyLocale, string>;
export const terms = (en: string, fr: string, de: string, it: string, es: string): Terms => ({ en, fr, de, it, es });

export const LANGUAGE_NAMES: Record<string, Terms> = {
  en: terms("English", "Anglais", "Englisch", "Inglese", "Inglés"),
  fr: terms("French", "Français", "Französisch", "Francese", "Francés"),
  de: terms("German", "Allemand", "Deutsch", "Tedesco", "Alemán"),
  it: terms("Italian", "Italien", "Italienisch", "Italiano", "Italiano"),
  es: terms("Spanish", "Espagnol", "Spanisch", "Spagnolo", "Español"),
};

export const COUNTRY_NAMES: Record<string, Terms> = {
  FR: terms("France", "France", "Frankreich", "Francia", "Francia"),
};

export const SPECIALTY_NAMES: Record<string, Terms> = {
  // Les spécialités saisies en clair sur une fiche d'atelier (« Reliure », « Pose de cuir »).
  reliure: terms("Bookbinding", "Reliure", "Buchbinderei", "Legatoria", "Encuadernación"),
  pose_de_cuir: terms("Leather covering", "Pose de cuir", "Lederbezug", "Copertura in pelle", "Forrado en piel"),
  reliure_toile: terms("Cloth binding", "Reliure toile", "Gewebeeinband", "Legatura in tela", "Encuadernación en tela"),
  papier_decore: terms("Decorated paper binding", "Reliure en papier décoré", "Buntpapiereinband", "Legatura in carta decorata", "Encuadernación en papel decorado"),
  demi_cuir: terms("Half-leather binding", "Demi-reliure cuir", "Halbledereinband", "Mezza pelle", "Media piel"),
  plein_cuir: terms("Full-leather binding", "Pleine reliure cuir", "Ganzledereinband", "Piena pelle", "Plena piel"),
  dorure: terms("Gilding", "Dorure", "Vergoldung", "Doratura", "Dorado"),
  restauration: terms("Book restoration", "Restauration du livre", "Buchrestaurierung", "Restauro del libro", "Restauración de libros"),
  conservation: terms("Book conservation", "Conservation du livre", "Buchkonservierung", "Conservazione del libro", "Conservación de libros"),
  cartonnage: terms("Box making", "Cartonnage", "Kassettenbau", "Cartotecnica", "Estuchería"),
  rebinding_contemporain: terms("Contemporary rebinding", "Nouvelle reliure contemporaine", "Zeitgenössischer Neueinband", "Rilegatura contemporanea", "Reencuadernación contemporánea"),
  reliure_art: terms("Design binding", "Reliure de création", "Künstlerischer Bucheinband", "Legatura d’arte", "Encuadernación artística"),
};

export const TECHNIQUE_NAMES: Record<string, Terms> = {
  "OPR-0027": terms("Section sewing", "Couture de cahiers", "Lagenheftung", "Cucitura dei fascicoli", "Costura de cuadernillos"),
  "OPR-0035": terms("Conservation sewing", "Couture de conservation", "Konservatorische Heftung", "Cucitura conservativa", "Costura de conservación"),
  "OPR-0074": terms("Leather paring", "Parure du cuir", "Lederschärfen", "Scarnitura della pelle", "Rebajado de la piel"),
  "OPR-0109": terms("Direct gold tooling on leather", "Dorure directe sur cuir", "Direktvergoldung auf Leder", "Doratura diretta su pelle", "Dorado directo sobre piel"),
  "OPR-0114": terms("Hand gilding", "Dorure manuelle", "Handvergoldung", "Doratura manuale", "Dorado manual"),
  "OPR-0126": terms("Inlaid leather mosaic", "Mosaïque incrustée", "Eingelegte Ledermosaik", "Mosaico in pelle intarsiato", "Mosaico de piel incrustado"),
  "OPR-0136": terms("Leather consolidation", "Consolidation du cuir", "Lederfestigung", "Consolidamento della pelle", "Consolidación de la piel"),
  "OPR-0151": terms("Paper consolidation", "Consolidation du papier", "Papierfestigung", "Consolidamento della carta", "Consolidación del papel"),
  "OPR-0193": terms("Leather", "Cuir", "Leder", "Pelle", "Piel"),
  "OPR-0194": terms("Decorated paper", "Papier décoré", "Buntpapier", "Carta decorata", "Papel decorado"),
  "OPR-0195": terms("Book cloth", "Toile", "Buchleinen", "Tela da legatoria", "Tela de encuadernación"),
};

export function languageName(code: string, locale: FineBinderyLocale): string { return LANGUAGE_NAMES[code]?.[locale] ?? code.toUpperCase(); }
/** Un réseau européen : tout pays hors glossaire est nommé par Intl plutôt qu'affiché en code ISO. */
function regionName(code: string, locale: FineBinderyLocale): string {
  try { return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code; } catch { return code; }
}
export function countryName(code: string, locale: FineBinderyLocale): string { return COUNTRY_NAMES[code]?.[locale] ?? regionName(code, locale); }
export function specialtyName(key: string, locale: FineBinderyLocale): string { return SPECIALTY_NAMES[key]?.[locale] ?? binderSkillLabel(key); }
export function techniqueName(key: string, locale: FineBinderyLocale): string { return TECHNIQUE_NAMES[key]?.[locale] ?? key; }
