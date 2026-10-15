import type { FineBinderyPublicCopy } from "./types";
import { frSeo, frHomeFaq, frProjectStart, frDirectoryLabel, frProfileNotFound } from "./frHead";


export const fr: FineBinderyPublicCopy = {
  seo: frSeo,
  nav: { how: "Comment ça marche", services: "Savoir-faire", workshops: frDirectoryLabel, faq: "Questions", signIn: "Se connecter", language: "Langue", menu: "Menu" },
  common: { start: frProjectStart, project: "Projet", france: "France", skills: "Savoir-faire", languages: "Langues", techniques: "Techniques et matières", originalText: "Texte de l’atelier affiché dans sa langue d’origine." },
  footer: { summary: "Le réseau européen de la reliure et de la conservation du livre.", information: "Informations", legal: "Mentions légales", privacy: "Confidentialité", terms: "Conditions d’utilisation", sales: "Conditions de vente", closing: "Reliure, conservation et dorure, par des ateliers indépendants." },
  home: {
    eyebrow: "Reliure · Conservation · Dorure",
    title: "Le réseau européen de la reliure et de la conservation du livre.",
    lead: "Découvrez des relieurs et des restaurateurs de talent. Présentez votre projet. Travaillez avec le bon atelier.",
    discover: "Découvrir les ateliers",
    proof: "Des ateliers indépendants, relus avant publication · Un projet, un interlocuteur · Ouverture en France",
    offersEyebrow: "Savoir-faire", offersTitle: "Le travail du réseau.", photoCredit: "Photographies", offers: [
      { title: "Reliure d’art", body: "Reliures traditionnelles et contemporaines, en cuir, en toile et en papiers choisis." },
      { title: "Restauration et conservation", body: "Un travail attentif sur des livres anciens, précieux ou chers, dans le respect de leur histoire." },
      { title: "Reliure de collection", body: "Une édition aimée ou recherchée, devenue pièce unique." },
      { title: "Créations sur mesure", body: "Reliures uniques, livres de famille, exemplaires de présentation, boîtes et étuis." },
    ],
    pathsEyebrow: "Deux façons de commencer", pathsTitle: "Choisissez votre atelier — ou laissez-nous le trouver.", paths: [
      { title: "Choisir un atelier", body: "Parcourez les ateliers publiés, leurs réalisations, leurs techniques et les langues qu’ils parlent. Un projet présenté depuis la page d’un atelier arrive directement dans cet atelier.", cta: "Parcourir les ateliers" },
      { title: "Présenter votre projet", body: "Décrivez votre livre une fois. Fine Bindery étudie le travail, le confie à l’atelier dont le savoir-faire lui correspond, et suit le projet jusqu’au retour du livre.", cta: "Présenter mon projet" },
    ],
    howEyebrow: "Le déroulé d’un projet", howTitle: "De la première photographie au retour du livre.", steps: ["Présentez votre livre", "Recevez une proposition", "Le bon atelier confirme", "Votre livre rejoint l’atelier", "Suivez le travail", "Votre livre revient chez vous"],
    workshopsEyebrow: "Derrière chaque livre, un atelier", workshopsTitle: "Des relieurs, des restaurateurs et des doreurs indépendants.", workshopsLead: "Chaque atelier est relu avant la publication de sa page : ses savoir-faire, son parcours et le travail qu’il souhaite recevoir.", selected: "Relu et publié par Fine Bindery.", discoverWorkshops: "Découvrir les ateliers publiés",
    networkNote: "Le réseau ouvre avec des ateliers en France, et accueillera des relieurs et des restaurateurs de toute l’Europe.",
    trustEyebrow: "Votre livre voyage", trustTitle: "Votre livre voyage. Son histoire ne se perd pas.", trust: ["État documenté", "Un seul interlocuteur", "Des ateliers relus", "Un trajet suivi"],
    shippingEyebrow: "Transport", shippingTitle: "Un trajet adapté au livre.", shippingLead: "Le trajet est organisé selon la nature et la valeur du livre, et chiffré à part du travail lui-même.",
    faqEyebrow: "Vos questions", faqTitle: "Avant de commencer.", faq: frHomeFaq,
    finalTitle: "Votre livre mérite les bonnes mains.", finalLead: "Parcourez les ateliers du réseau, ou présentez votre projet et laissez-nous trouver le bon.", established: "depuis",
  },
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
