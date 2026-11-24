import type { FineBinderyPublicCopy } from "./types";
import { FINE_BINDERY_HOME } from "./homeCopy";
import { FINE_BINDERY_DISCIPLINE_COPY } from "./disciplineCopy";
import { deSeo, deHomeFaq, deProjectStart, deDirectoryLabel, deProfileNotFound } from "./deHead";


export const de: FineBinderyPublicCopy = {
  seo: deSeo,
  nav: { features: "Funktionen", pricing: "Preise", how: "Ablauf", services: "Fachgebiete", workshops: deDirectoryLabel, faq: "Fragen", signIn: "Anmelden", language: "Sprache", menu: "Menü" },
  common: { signup: "Werkstattkonto anlegen", start: deProjectStart, project: "Projekt", france: "Frankreich", skills: "Fachgebiete", languages: "Sprachen", techniques: "Techniken und Materialien", originalText: "Werkstatttext in der Originalsprache." },
  footer: { summary: "Die Software für Angebote und Rechnungen von Buchbindern und Restaurierungswerkstätten.", information: "Informationen", legal: "Impressum", privacy: "Datenschutz", terms: "Nutzungsbedingungen", sales: "Verkaufsbedingungen", closing: "Dossier, Angebot und Verfolgung für Buchbinder und Restauratoren." },
  home: { ...FINE_BINDERY_HOME.de, ...FINE_BINDERY_DISCIPLINE_COPY.de },
  directory: {
    eyebrow: "Das Netzwerk", title: "Buchbinder und Restauratoren, ausgewählt für ihr Handwerk.",
    lead: "Entdecken Sie die veröffentlichten Werkstätten. Ein Projekt, das Sie auf der Seite einer Werkstatt vorstellen, erreicht diese Werkstatt direkt.",
    filters: "Werkstätten filtern", country: "Land", specialty: "Fachgebiet", language: "Sprache",
    allCountries: "Alle Länder", allSpecialties: "Alle Fachgebiete", allLanguages: "Alle Sprachen",
    empty: "Keine veröffentlichte Werkstatt entspricht diesen Filtern.", reset: "Filter zurücksetzen",
    count: (n) => (n === 1 ? "1 Werkstatt" : `${n} Werkstätten`), view: "Werkstatt ansehen",
    emptyTitle: "Die ersten Werkstätten werden gerade veröffentlicht.",
    emptyBody: "Ihre Seiten erscheinen hier, sobald sie geprüft sind. Stellen Sie bis dahin Ihr Projekt vor: Fine Bindery findet die passende Werkstatt für Ihr Buch.",
    openingNote: "Das Netzwerk startet mit Werkstätten in Frankreich und wird Buchbinder und Restauratoren aus ganz Europa aufnehmen.",
  },
  profile: {
    workshop: "Werkstatt", discuss: "Projekt besprechen", about: "Über die Werkstatt", location: "Standort",
    specialties: "Fachgebiete", languages: "Gesprochene Sprachen", techniques: "Techniken und Materialien", according: "Je nach Projekt",
    training: "Ausbildung und Erfahrung", approach: "Arbeitsweise", portfolio: "Ausgewählte Arbeiten", work: "Arbeiten der Werkstatt.", before: "Vorher", after: "Nachher",
    finalEyebrow: "Ein Buch, ein Gespräch", finalTitle: (w) => `Besprechen Sie Ihr Projekt direkt mit ${w}.`,
    website: "Website der Werkstatt", call: "Werkstatt anrufen", email: "E-Mail an die Werkstatt",
    notFound: deProfileNotFound, notFoundBody: "Diese Seite ist nicht veröffentlicht oder nicht mehr vorhanden.", back: "Werkstätten ansehen",
  },
};
