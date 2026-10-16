import { WORK_ITEMS, WORK_FAMILIES } from "@/marketplace/pricing/catalog";
import type { FineBinderyLocale } from "./fineBinderyLocale";
import { terms, type Terms } from "./fineBinderyPublicGlossary";
// API conservée pour les écrans existants ; la vitrine importe le module public seul.
export { LANGUAGE_NAMES, COUNTRY_NAMES, SPECIALTY_NAMES, TECHNIQUE_NAMES, languageName, countryName, specialtyName, techniqueName } from "./fineBinderyPublicGlossary";

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

export function serviceName(key: string, locale: FineBinderyLocale): string { return SERVICE_NAMES[key]?.[locale] ?? WORK_ITEMS.find((item) => item.key === key)?.label ?? key; }
export function serviceFamilyName(key: string, locale: FineBinderyLocale): string { return FAMILY_NAMES[key]?.[locale] ?? WORK_FAMILIES.find((item) => item.key === key)?.label ?? key; }

export const FINE_BINDERY_TRANSLATED_SERVICE_KEYS = Object.freeze(Object.keys(SERVICE_NAMES));
