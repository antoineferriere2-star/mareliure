import type { FineBinderyPublicCopy } from "./types";
import { FINE_BINDERY_HOME } from "./homeCopy";
import { FINE_BINDERY_DISCIPLINE_COPY } from "./disciplineCopy";
import { itSeo, itHomeFaq, itProjectStart, itDirectoryLabel, itProfileNotFound } from "./itHead";


export const it: FineBinderyPublicCopy = {
  seo: itSeo,
  nav: { features: "Funzionalità", pricing: "Prezzi", how: "Come funziona", services: "Competenze", workshops: itDirectoryLabel, faq: "Domande", signIn: "Accedi", language: "Lingua", menu: "Menu" },
  common: { signup: "Crea il mio account laboratorio", start: itProjectStart, project: "Progetto", france: "Francia", skills: "Competenze", languages: "Lingue", techniques: "Tecniche e materiali", originalText: "Testo del laboratorio nella lingua originale." },
  footer: { summary: "Lo strumento di preventivo e monitoraggio per legatori e laboratori di restauro.", information: "Informazioni", legal: "Note legali", privacy: "Privacy", terms: "Condizioni d’uso", sales: "Condizioni di vendita", closing: "Scheda, preventivo e monitoraggio per legatori e restauratori." },
  home: { ...FINE_BINDERY_HOME.it, ...FINE_BINDERY_DISCIPLINE_COPY.it },
  directory: {
    eyebrow: "La rete", title: "Legatori e restauratori, scelti per il loro mestiere.",
    lead: "Sfoglia i laboratori pubblicati. Un progetto presentato dalla pagina di un laboratorio arriva direttamente a quel laboratorio.",
    filters: "Filtra i laboratori", country: "Paese", specialty: "Specialità", language: "Lingua",
    allCountries: "Tutti i paesi", allSpecialties: "Tutte le specialità", allLanguages: "Tutte le lingue",
    empty: "Nessun laboratorio pubblicato corrisponde a questi filtri.", reset: "Cancella i filtri",
    count: (n) => (n === 1 ? "1 laboratorio" : `${n} laboratori`), view: "Vedi il laboratorio",
    emptyTitle: "I primi laboratori sono in corso di pubblicazione.",
    emptyBody: "Le loro pagine appariranno qui non appena saranno verificate. Nel frattempo presenta il tuo progetto: Fine Bindery troverà il laboratorio adatto al tuo libro.",
    openingNote: "La rete apre con laboratori in Francia e accoglierà legatori e restauratori di tutta Europa.",
  },
  profile: {
    workshop: "Laboratorio", discuss: "Parla del tuo progetto", about: "Il laboratorio", location: "Dove si trova",
    specialties: "Specialità", languages: "Lingue parlate", techniques: "Tecniche e materiali", according: "Secondo il progetto",
    training: "Formazione ed esperienza", approach: "Approccio", portfolio: "Lavori scelti", work: "Il lavoro del laboratorio.", before: "Prima", after: "Dopo",
    finalEyebrow: "Un libro, un dialogo", finalTitle: (w) => `Parla del tuo progetto direttamente con ${w}.`,
    website: "Sito del laboratorio", call: "Chiama il laboratorio", email: "Scrivi al laboratorio",
    notFound: itProfileNotFound, notFoundBody: "Questa pagina non è pubblicata o non esiste più.", back: "Sfoglia i laboratori",
  },
};
