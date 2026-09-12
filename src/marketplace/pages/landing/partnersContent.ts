/**
 * Le texte de /partenaires-relieurs, sur le même principe que content.ts :
 * rien d'inventé, et une correction de texte ne doit pas obliger à relire du
 * JSX. Aucun chiffre de partenaires, aucun témoignage, aucun logo — parce
 * qu'aucun n'est encore réel.
 */

export interface PartnerBenefit {
  title: string;
  body: string;
}

export const BENEFITS: PartnerBenefit[] = [
  {
    title: "Des projets qualifiés",
    body: "Les photos, le format, l'état du livre, les attentes du client et les principales options sont recueillis avant que le projet ne vous soit proposé.",
  },
  {
    title: "Une rémunération connue",
    body: "Lorsque Ma Reliure vous propose un projet, vous connaissez le travail envisagé et la rémunération proposée avant de l'accepter.",
  },
  {
    title: "Une relation à distance organisée",
    body: "Messages, photographies, validations de matières ou de titrage et suivi du projet restent réunis dans un même dossier.",
  },
  {
    title: "Vous choisissez vos projets",
    body: "Planning complet, projet hors spécialité, délai incompatible : vous restez libre d'accepter ou de refuser.",
  },
];

export interface PartnerStep {
  index: string;
  title: string;
}

export const HOW_IT_WORKS_STEPS: PartnerStep[] = [
  { index: "01", title: "Le client présente son livre" },
  { index: "02", title: "Ma Reliure étudie et qualifie la demande" },
  { index: "03", title: "Nous vous proposons le projet" },
  { index: "04", title: "Le livre rejoint votre atelier" },
  { index: "05", title: "Vous travaillez avec le client dans Ma Reliure" },
  { index: "06", title: "Le livre retourne chez son propriétaire" },
];

export interface WorkspaceCapability {
  label: string;
}

export const WORKSPACE_CAPABILITIES: WorkspaceCapability[] = [
  { label: "Propositions" },
  { label: "En cours" },
  { label: "Attente client" },
  { label: "Messages" },
  { label: "Décisions" },
  { label: "Photos" },
  { label: "Rémunérations" },
  { label: "Terminés" },
];

export interface OfferRow {
  label: string;
  value: string;
}

export const OFFER_ROWS: OfferRow[] = [
  { label: "Vitrine atelier", value: "Incluse" },
  { label: "Espace atelier", value: "Inclus" },
  { label: "Réception de projets", value: "Selon vos savoir-faire et disponibilités" },
  { label: "Invitation de vos propres clients", value: "Incluse" },
  { label: "Qualification des demandes", value: "Incluse" },
  { label: "Abonnement", value: "Aucun abonnement prévu au lancement" },
];

export interface PartnerFaqItem {
  question: string;
  answer: string;
}

export const PARTNER_FAQ: PartnerFaqItem[] = [
  {
    question: "Est-ce que je suis obligé d'accepter les projets proposés ?",
    answer:
      "Non. Chaque projet est une proposition : planning complet, projet hors spécialité ou délai incompatible, vous restez libre de refuser.",
  },
  {
    question: "Dois-je communiquer toute ma grille tarifaire ?",
    answer:
      "Non. Ma Reliure fixe le prix présenté au client et vous propose une rémunération correspondant au projet — vous n'avez pas à maintenir une grille publique de dizaines de prestations.",
  },
  {
    question: "Mon atelier reste-t-il visible auprès du client ?",
    answer:
      "Oui. Le client sait quel atelier travaille son livre, et votre atelier dispose de sa propre vitrine sur Ma Reliure.",
  },
  {
    question: "Puis-je utiliser Ma Reliure avec un client que j'ai trouvé moi-même ?",
    answer:
      "Oui, c'est même une des raisons d'être du produit : invitez-le avec votre lien personnel, il présente son livre et le dossier arrive directement dans votre espace.",
  },
  {
    question: "Ma Reliure peut-elle envoyer mon propre client à un autre atelier ?",
    answer:
      "Non. Un client que vous invitez reste affecté à votre atelier et n'est jamais mis en concurrence avec un autre partenaire.",
  },
  {
    question: "Est-ce que Ma Reliure crée mon site internet ?",
    answer:
      "Ma Reliure vous offre une vitrine professionnelle dans un format commun à tous les ateliers, enrichie de votre histoire, vos photographies et vos réalisations — pas un site sur mesure, pas de branding personnalisé.",
  },
  {
    question: "Est-ce payant ?",
    answer: "Aucun abonnement n'est prévu pour rejoindre le réseau au lancement.",
  },
  {
    question: "Qui fixe le prix au client ?",
    answer:
      "Ma Reliure. Le client ne négocie pas avec l'atelier ; vous connaissez votre rémunération avant d'accepter le projet.",
  },
  {
    question: "Puis-je parler directement avec le client ?",
    answer:
      "Les échanges passent par la conversation du dossier, dans Ma Reliure — messages, photos et décisions restent réunis au même endroit, pour vous comme pour le client.",
  },
  {
    question: "Que se passe-t-il si je découvre un problème après réception ?",
    answer:
      "Vous le signalez dans le dossier, avec des photos. Ma Reliure reprend la gestion commerciale avec le client avant toute modification du périmètre — ce n'est jamais à vous de renégocier le prix.",
  },
];
