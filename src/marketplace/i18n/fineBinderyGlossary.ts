import { binderSkillLabel } from "@/marketplace/binders/skills";
import { WORK_ITEMS, WORK_FAMILIES } from "@/marketplace/pricing/catalog";
import type { FineBinderyLocale } from "./fineBinderyLocale";

type Terms = Record<FineBinderyLocale, string>;
const terms = (en: string, fr: string, de: string, it: string, es: string): Terms => ({ en, fr, de, it, es });

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
  reliure: terms("Bookbinding", "Reliure", "Buchbinderei", "Legatoria", "Encuadernación"),
  pose_de_cuir: terms("Leather covering", "Pose de cuir", "Lederbezug", "Copertura in pelle", "Recubrimiento en piel"),
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

const SERVICE_NAMES: Record<string, Terms> = {
  reemboitage: terms("Recasing", "Réemboîtage", "Neueinhängen", "Rincassatura", "Reencaje"),
  reparation_dos: terms("Spine repair", "Réparation du dos", "Rückenreparatur", "Riparazione del dorso", "Reparación del lomo"),
  reparation_mors: terms("Joint repair", "Réparation des mors", "Falzreparatur", "Riparazione delle cerniere", "Reparación de charnelas"),
  reparation_coiffes: terms("Headcap repair", "Réparation des coiffes", "Kapitalreparatur", "Riparazione delle cuffie", "Reparación de cofias"),
  reparation_coins: terms("Corner repair", "Réparation des coins", "Eckenreparatur", "Riparazione degli angoli", "Reparación de esquinas"),
  reparation_plats: terms("Board repair", "Reprise des plats", "Deckelreparatur", "Riparazione dei piatti", "Reparación de tapas"),
  pages_detachees: terms("Reattaching loose pages", "Pages détachées à remonter", "Lose Seiten wieder befestigen", "Ricollocazione di pagine staccate", "Recolocación de páginas sueltas"),
  couture_partielle: terms("Partial resewing", "Couture partielle", "Teilweise Neuheftung", "Ricucitura parziale", "Recosido parcial"),
  recouture_complete: terms("Complete resewing", "Recouture complète", "Vollständige Neuheftung", "Ricucitura completa", "Recosido completo"),
  reparation_papier: terms("Paper repair", "Réparation du papier", "Papierreparatur", "Riparazione della carta", "Reparación del papel"),
  gardes_neuves: terms("New endpapers", "Gardes neuves", "Neue Vorsätze", "Nuove carte di guardia", "Nuevas guardas"),
  pleine_toile: terms("Full cloth binding", "Pleine toile", "Ganzgewebeeinband", "Piena tela", "Plena tela"),
  demi_toile: terms("Quarter cloth binding", "Demi-toile", "Halbgewebeeinband", "Mezza tela", "Media tela"),
  dos_cuir: terms("Leather spine", "Dos cuir", "Lederrücken", "Dorso in pelle", "Lomo de piel"),
  demi_cuir: terms("Half-leather binding", "Demi-cuir", "Halbledereinband", "Mezza pelle", "Media piel"),
  demi_cuir_a_coins: terms("Half-leather with corners", "Demi-cuir à coins", "Halbleder mit Ecken", "Mezza pelle con angoli", "Media piel con puntas"),
  plein_cuir: terms("Full-leather binding", "Plein cuir", "Ganzledereinband", "Piena pelle", "Plena piel"),
  dorure_titrage: terms("Spine title tooling", "Titrage", "Titelvergoldung", "Titolo in oro", "Titulado dorado"),
  dorure_auteur: terms("Author name tooling", "Nom d’auteur", "Autorenvergoldung", "Nome dell’autore in oro", "Nombre del autor dorado"),
  dorure_tomaison: terms("Volume number tooling", "Tomaison", "Bandnummer-Vergoldung", "Numero del volume in oro", "Número de tomo dorado"),
  dorure_date: terms("Date tooling", "Date", "Datumsvergoldung", "Data in oro", "Fecha dorada"),
  dorure_initiales: terms("Initials tooling", "Initiales", "Initialenvergoldung", "Iniziali in oro", "Iniciales doradas"),
  dorure_filets: terms("Gold lines", "Filets", "Goldlinien", "Filetti in oro", "Filetes dorados"),
  dorure_fleurons: terms("Gold ornaments", "Fleurons", "Goldstempelornamente", "Fregi in oro", "Florones dorados"),
  dorure_decor: terms("Gold decoration", "Décor doré", "Golddekor", "Decorazione in oro", "Decoración dorada"),
  nerfs: terms("Raised bands", "Nerfs", "Erhabene Bünde", "Nervi", "Nervios"),
  gardes_decorees: terms("Decorated endpapers", "Gardes décorées", "Dekorierte Vorsätze", "Carte di guardia decorate", "Guardas decoradas"),
  papiers_marbres: terms("Marbled papers", "Papiers marbrés", "Marmorpapiere", "Carte marmorizzate", "Papeles marmoleados"),
  mosaique: terms("Leather mosaic", "Mosaïque de cuir", "Ledermosaik", "Mosaico in pelle", "Mosaico de piel"),
  signet: terms("Ribbon marker", "Signet", "Leseband", "Segnalibro", "Cinta de registro"),
  tranches: terms("Edge decoration", "Tranches décorées", "Schnittverzierung", "Decorazione dei tagli", "Decoración de cortes"),
  decor_personnalise: terms("Bespoke decoration", "Décor personnalisé", "Individuelles Dekor", "Decorazione personalizzata", "Decoración personalizada"),
  etui: terms("Slipcase", "Étui", "Schuber", "Custodia", "Estuche"),
  chemise: terms("Chemise", "Chemise", "Schutzmappe", "Cartella", "Carpeta de protección"),
  boite: terms("Clamshell box", "Boîte", "Klappkassette", "Scatola a conchiglia", "Caja de conservación"),
  coffret: terms("Presentation case", "Coffret", "Präsentationskassette", "Cofanetto", "Cofre de presentación"),
  restauration_cuir: terms("Existing leather restoration", "Restauration du cuir existant", "Restaurierung vorhandenen Leders", "Restauro della pelle esistente", "Restauración de la piel existente"),
  restauration_papier: terms("Paper restoration", "Restauration du papier", "Papierrestaurierung", "Restauro della carta", "Restauración del papel"),
  restauration_cartonnage: terms("Board restoration", "Restauration du cartonnage", "Deckelrestaurierung", "Restauro dei piatti", "Restauración de tapas"),
  restauration_reliure_ancienne: terms("Historic binding restoration", "Restauration d’une reliure ancienne", "Restaurierung eines historischen Einbands", "Restauro di una legatura antica", "Restauración de una encuadernación antigua"),
  restauration_patrimoniale: terms("Heritage conservation", "Restauration patrimoniale", "Kulturgutrestaurierung", "Restauro del patrimonio librario", "Restauración patrimonial"),
  rebind_collector: terms("Collector rebinding", "Nouvelle reliure de collection", "Sammler-Neueinband", "Rilegatura da collezione", "Reencuadernación de colección"),
  nouvelle_couverture: terms("New cover", "Nouvelle couverture", "Neuer Einband", "Nuova coperta", "Nueva cubierta"),
  reliure_de_creation: terms("Design binding", "Reliure de création", "Künstlerischer Bucheinband", "Legatura d’arte", "Encuadernación artística"),
  projet_sur_mesure: terms("Bespoke project", "Projet sur mesure", "Individuelles Projekt", "Progetto su misura", "Proyecto a medida"),
};

const FAMILY_NAMES: Record<string, Terms> = {
  repair: terms("Book block repair", "Réparation du corps du livre", "Buchblockreparatur", "Riparazione del corpo del libro", "Reparación del cuerpo del libro"),
  cloth: terms("Cloth binding", "Reliure toile", "Gewebeeinband", "Legatura in tela", "Encuadernación en tela"),
  leather: terms("Leather binding", "Reliure cuir", "Ledereinband", "Legatura in pelle", "Encuadernación en piel"),
  gilding: terms("Gilding", "Dorure", "Vergoldung", "Doratura", "Dorado"),
  finishing: terms("Finishing", "Finitions", "Ausstattung", "Finiture", "Acabados"),
  protection: terms("Protective enclosures", "Protection", "Schutzbehältnisse", "Contenitori protettivi", "Protección"),
  restoration: terms("Restoration", "Restauration", "Restaurierung", "Restauro", "Restauración"),
  creation: terms("Bespoke creation", "Création", "Individuelle Gestaltung", "Creazione su misura", "Creación a medida"),
};

export function languageName(code: string, locale: FineBinderyLocale): string { return LANGUAGE_NAMES[code]?.[locale] ?? code.toUpperCase(); }
/** Un réseau européen : tout pays hors glossaire est nommé par Intl plutôt qu'affiché en code ISO. */
function regionName(code: string, locale: FineBinderyLocale): string {
  try { return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code; } catch { return code; }
}
export function countryName(code: string, locale: FineBinderyLocale): string { return COUNTRY_NAMES[code]?.[locale] ?? regionName(code, locale); }
export function specialtyName(key: string, locale: FineBinderyLocale): string { return SPECIALTY_NAMES[key]?.[locale] ?? binderSkillLabel(key); }
export function techniqueName(key: string, locale: FineBinderyLocale): string { return TECHNIQUE_NAMES[key]?.[locale] ?? key; }
export function serviceName(key: string, locale: FineBinderyLocale): string { return SERVICE_NAMES[key]?.[locale] ?? WORK_ITEMS.find((item) => item.key === key)?.label ?? key; }
export function serviceFamilyName(key: string, locale: FineBinderyLocale): string { return FAMILY_NAMES[key]?.[locale] ?? WORK_FAMILIES.find((item) => item.key === key)?.label ?? key; }

export const FINE_BINDERY_TRANSLATED_SERVICE_KEYS = Object.freeze(Object.keys(SERVICE_NAMES));
