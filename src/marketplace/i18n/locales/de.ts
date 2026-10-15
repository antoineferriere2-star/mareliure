import type { FineBinderyPublicCopy } from "./types";
import { deSeo, deHomeFaq, deProjectStart, deDirectoryLabel, deProfileNotFound } from "./deHead";


export const de: FineBinderyPublicCopy = {
  seo: deSeo,
  nav: { how: "Ablauf", services: "Fachgebiete", workshops: deDirectoryLabel, faq: "Fragen", signIn: "Anmelden", language: "Sprache", menu: "Menü" },
  common: { start: deProjectStart, project: "Projekt", france: "Frankreich", skills: "Fachgebiete", languages: "Sprachen", techniques: "Techniken und Materialien", originalText: "Werkstatttext in der Originalsprache." },
  footer: { summary: "Das europäische Netzwerk für Buchbinderei und Buchrestaurierung.", information: "Informationen", legal: "Impressum", privacy: "Datenschutz", terms: "Nutzungsbedingungen", sales: "Verkaufsbedingungen", closing: "Buchbinderei, Restaurierung und Vergoldung aus unabhängigen Werkstätten." },
  home: {
    eyebrow: "Buchbinderei · Restaurierung · Vergoldung",
    title: "Das europäische Netzwerk für Buchbinderei und Buchrestaurierung.",
    lead: "Entdecken Sie erfahrene Buchbinder und Restauratoren. Stellen Sie Ihr Projekt vor. Arbeiten Sie mit der passenden Werkstatt.",
    discover: "Werkstätten entdecken",
    proof: "Unabhängige, vor der Veröffentlichung geprüfte Werkstätten · Ein Projekt, ein Gespräch · Start in Frankreich",
    offersEyebrow: "Fachgebiete", offersTitle: "Die Arbeit des Netzwerks.", photoCredit: "Fotografien", offers: [
      { title: "Handeinband", body: "Traditionelle und zeitgenössische Einbände aus Leder, Gewebe und ausgewählten Papieren." },
      { title: "Restaurierung und Konservierung", body: "Sorgfältige Arbeit an alten, wertvollen und persönlich bedeutsamen Büchern – mit Respekt vor ihrer Geschichte." },
      { title: "Neueinband für Sammler", body: "Eine geliebte oder gesuchte Ausgabe als Unikat." },
      { title: "Individuelle Anfertigungen", body: "Unikate, Familienbücher, Präsentationsexemplare, Kassetten und Schuber." },
    ],
    pathsEyebrow: "Zwei Wege zum Start", pathsTitle: "Wählen Sie Ihre Werkstatt – oder lassen Sie uns sie finden.", paths: [
      { title: "Eine Werkstatt wählen", body: "Entdecken Sie die veröffentlichten Werkstätten, ihre Arbeiten, Techniken und Sprachen. Ein Projekt, das Sie auf der Seite einer Werkstatt vorstellen, erreicht diese Werkstatt direkt.", cta: "Werkstätten ansehen" },
      { title: "Projekt vorstellen", body: "Beschreiben Sie Ihr Buch einmal. Fine Bindery prüft die Arbeit, vertraut sie der Werkstatt mit den passenden Fähigkeiten an und begleitet das Projekt bis zur Rückkehr des Buches.", cta: "Projekt vorstellen" },
    ],
    howEyebrow: "Der Ablauf eines Projekts", howTitle: "Vom ersten Foto bis zur Rückkehr des Buches.", steps: ["Buch vorstellen", "Vorschlag erhalten", "Die passende Werkstatt bestätigt", "Das Buch reist zur Werkstatt", "Die Arbeit verfolgen", "Das Buch kehrt zurück"],
    workshopsEyebrow: "Hinter jedem Buch eine Werkstatt", workshopsTitle: "Unabhängige Buchbinder, Restauratoren und Vergolder.", workshopsLead: "Jede Werkstatt wird vor der Veröffentlichung ihrer Seite geprüft: ihre Fachgebiete, ihre Erfahrung und die Arbeiten, die sie übernehmen möchte.", selected: "Von Fine Bindery geprüft und veröffentlicht.", discoverWorkshops: "Veröffentlichte Werkstätten entdecken",
    networkNote: "Das Netzwerk startet mit Werkstätten in Frankreich und wird Buchbinder und Restauratoren aus ganz Europa aufnehmen.",
    trustEyebrow: "Ihr Buch reist", trustTitle: "Ihr Buch reist. Seine Geschichte geht nicht verloren.", trust: ["Zustand dokumentiert", "Eine Ansprechperson", "Geprüfte Werkstätten", "Begleiteter Weg"],
    shippingEyebrow: "Versand", shippingTitle: "Ein Weg, der zum Buch passt.", shippingLead: "Der Weg wird nach Art und Wert des Buches organisiert und getrennt von der Arbeit selbst berechnet.",
    faqEyebrow: "Antworten auf Ihre Fragen", faqTitle: "Vor dem Start.", faq: deHomeFaq,
    finalTitle: "Ihr Buch verdient die richtigen Hände.", finalLead: "Entdecken Sie die Werkstätten des Netzwerks – oder stellen Sie Ihr Projekt vor und lassen Sie uns die passende finden.", established: "seit",
  },
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
