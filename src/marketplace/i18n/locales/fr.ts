import type { FineBinderyPublicCopy } from "./types";
import { FINE_BINDERY_HOME } from "./homeCopy";
import { FINE_BINDERY_DISCIPLINE_COPY } from "./disciplineCopy";
import { frSeo, frHomeFaq, frProjectStart, frDirectoryLabel, frProfileNotFound } from "./frHead";


export const fr: FineBinderyPublicCopy = {
  seo: frSeo,
  nav: { features: "Fonctionnalités", pricing: "Tarifs", how: "Comment ça marche", services: "Savoir-faire", workshops: frDirectoryLabel, faq: "Questions", signIn: "Se connecter", language: "Langue", menu: "Menu" },
  common: { signup: "Créer mon compte atelier", start: frProjectStart, project: "Projet", france: "France", skills: "Savoir-faire", languages: "Langues", techniques: "Techniques et matières", originalText: "Texte de l’atelier affiché dans sa langue d’origine." },
  footer: { summary: "Le logiciel de devis et factures des relieurs et des ateliers de restauration.", information: "Informations", legal: "Mentions légales", privacy: "Confidentialité", terms: "Conditions d’utilisation", sales: "Conditions de vente", closing: "Dossier, devis et suivi, pour les relieurs et les restaurateurs." },
  home: { ...FINE_BINDERY_HOME.fr, ...FINE_BINDERY_DISCIPLINE_COPY.fr },
  directory: {
    eyebrow: "Le réseau", title: "Des relieurs et des restaurateurs, choisis pour leur savoir-faire.",
    lead: "Parcourez les ateliers publiés. Un projet présenté depuis la page d’un atelier arrive directement dans cet atelier.",
    filters: "Filtrer les ateliers", country: "Pays", specialty: "Spécialité", language: "Langue",
    allCountries: "Tous les pays", allSpecialties: "Toutes les spécialités", allLanguages: "Toutes les langues",
    empty: "Aucun atelier publié ne correspond à ces critères.", reset: "Effacer les filtres",
    count: (n) => (n <= 1 ? `${n} atelier` : `${n} ateliers`), view: "Voir l’atelier",
    emptyTitle: "Les premiers ateliers sont en cours de publication.",
    emptyBody: "Leurs pages apparaîtront ici dès qu’elles auront été relues. D’ici là, présentez votre projet : Fine Bindery trouvera l’atelier qui convient à votre livre.",
    openingNote: "Le réseau ouvre avec des ateliers en France, et accueillera des relieurs et des restaurateurs de toute l’Europe.",
  },
  profile: {
    workshop: "Atelier", discuss: "Parler de mon projet", about: "L’atelier", location: "Où se trouve l’atelier",
    specialties: "Spécialités", languages: "Langues parlées", techniques: "Techniques et matières", according: "Selon le projet",
    training: "Parcours", approach: "Approche", portfolio: "Réalisations", work: "Le travail de l’atelier.", before: "Avant", after: "Après",
    finalEyebrow: "Un livre, un échange", finalTitle: (w) => `Parlez directement de votre projet à ${w}.`,
    website: "Site de l’atelier", call: "Téléphoner à l’atelier", email: "Écrire à l’atelier",
    notFound: frProfileNotFound, notFoundBody: "Cette page n’est pas publiée ou n’existe plus.", back: "Parcourir les ateliers",
  },
};
