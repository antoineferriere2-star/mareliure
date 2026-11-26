import type { FineBinderyPublicCopy } from "./types";
import { FINE_BINDERY_HOME } from "./homeCopy";
import { FINE_BINDERY_DISCIPLINE_COPY } from "./disciplineCopy";
import { enSeo, enHomeFaq, enProjectStart, enDirectoryLabel, enProfileNotFound } from "./enHead";


/**
 * English is the reference copy of Fine Bindery: plain, premium English —
 * no marketplace vocabulary, no SaaS superlatives. The network opens with
 * ateliers in France; the copy says so rather than implying a European
 * roster that does not exist yet.
 */
export const en: FineBinderyPublicCopy = {
  seo: enSeo,
  nav: { features: "Features", pricing: "Pricing", how: "How it works", services: "Disciplines", workshops: enDirectoryLabel, faq: "FAQ", signIn: "Sign in", language: "Language", menu: "Menu" },
  common: { signup: "Try Fine Bindery", start: enProjectStart, project: "Project", france: "France", skills: "Skills", languages: "Languages", techniques: "Techniques & materials", originalText: "Atelier text shown in its original language." },
  footer: { summary: "The quote and invoice software for bookbinders and conservation workshops.", information: "Information", legal: "Legal notice", privacy: "Privacy policy", terms: "Terms of use", sales: "Terms of sale", closing: "Brief, quote and follow-up, for bookbinders and conservators." },
  home: { ...FINE_BINDERY_HOME.en, ...FINE_BINDERY_DISCIPLINE_COPY.en },
  directory: {
    eyebrow: "The network", title: "Bookbinders and conservators, chosen for their craft.",
    lead: "Browse the published ateliers. A project presented from an atelier’s page reaches that atelier directly.",
    filters: "Filter the ateliers", country: "Country", specialty: "Specialty", language: "Language",
    allCountries: "All countries", allSpecialties: "All specialties", allLanguages: "All languages",
    empty: "No published atelier matches these filters.", reset: "Clear the filters",
    count: (n) => (n === 1 ? "1 atelier" : `${n} ateliers`), view: "View the atelier",
    emptyTitle: "The first ateliers are being published.",
    emptyBody: "Their pages will appear here as soon as they are reviewed. In the meantime, present your project: Fine Bindery will find the right atelier for your book.",
    openingNote: "The network opens with ateliers in France, and will welcome bookbinders and conservators from across Europe.",
  },
  profile: {
    workshop: "Atelier", discuss: "Discuss your project", about: "About the atelier", location: "Location",
    specialties: "Specialties", languages: "Languages spoken", techniques: "Techniques & materials", according: "According to the project",
    training: "Training & experience", approach: "Approach", portfolio: "Selected work", work: "Work from the atelier.", before: "Before", after: "After",
    finalEyebrow: "One book, one conversation", finalTitle: (w) => `Discuss your project directly with ${w}.`,
    website: "Atelier website", call: "Call the atelier", email: "Email the atelier",
    notFound: enProfileNotFound, notFoundBody: "This page is not published or no longer exists.", back: "Browse the ateliers",
  },
};
