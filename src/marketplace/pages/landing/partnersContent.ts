/**
 * Le texte de /partenaires-relieurs, sur le même principe que content.ts :
 * rien d'inventé, et une correction de texte ne doit pas obliger à relire du
 * JSX. Aucun chiffre de partenaires, aucun témoignage, aucun logo — parce
 * qu'aucun n'est encore réel.
 *
 * La page présente d'abord l'OUTIL (devis, tarifs, ouvrages, documents,
 * factures), qui existe et fonctionne, puis le réseau. Chaque fonction citée
 * ici est en production ; ce qui ne l'est pas est écrit comme tel (« en
 * préparation »).
 */

export interface ToolFeature {
  /** Ancre de la section détaillée. */
  anchor: string;
  title: string;
  body: string;
}

/** Le survol de l'outil, juste sous le premier écran. */
export const TOOL_OVERVIEW: readonly ToolFeature[] = [
  { anchor: "devis", title: "Devis", body: "Vos prestations et vos prix à portée de clic, un PDF prêt à envoyer." },
  { anchor: "tarifs", title: "Tarifs", body: "45 prestations de départ, que vous ajustez à votre atelier." },
  { anchor: "ouvrages", title: "Ouvrages", body: "Chaque livre a sa fiche, avec son client, ses devis et ses factures." },
  { anchor: "factures", title: "Factures", body: "Du devis accepté à la facture, avec acompte et suivi des paiements." },
];

/** Ce que le constructeur de devis fait réellement (voir QuoteBuilderPage). */
export const QUOTE_POINTS: readonly string[] = [
  "Vos prestations fréquentes et vos favoris, en tête de liste",
  "Vos catégories et une recherche dans toutes vos prestations",
  "Vos prix d'atelier, repris automatiquement",
  "Une ligne libre pour tout ce qui sort de l'ordinaire",
  "Une TVA pour tout le devis, modifiable en un geste",
  "Plusieurs formats et plusieurs livres dans le même devis",
  "Un PDF prêt à envoyer, à votre nom",
];

export const PRICING_POINTS: readonly string[] = [
  "Les 45 prestations Ma Reliure comme point de départ",
  "Un prix, plusieurs, ou une catégorie entière ajustés d'un coup",
  "Vos propres prestations, rangées dans vos catégories",
  "« Sur étude » pour ce qui se chiffre pièce en main",
];

export const WORK_POINTS: readonly string[] = [
  "Titre, auteur, dimensions et état du livre",
  "Le client, et tous les devis et factures de l'ouvrage",
  "Retrouvé en tapant un titre, un auteur ou un nom",
];

export const DOCUMENT_POINTS: readonly string[] = [
  "Votre logo, votre couleur et vos mentions sur chaque document",
  "Des photos d'exemple sur les lignes du devis, jusque dans le PDF",
  "Un devis accepté devient une facture en un geste",
  "Acompte, paiement reçu, avoir : chaque facture garde son histoire",
  "Une numérotation continue et les mentions obligatoires",
];

export interface PartnerBenefit {
  title: string;
  body: string;
}

/** Le réseau : ce que Ma Reliure apporte en plus de l'outil. */
export const BENEFITS: PartnerBenefit[] = [
  {
    title: "Des projets déjà qualifiés",
    body: "Photos, format, état du livre et attentes du client sont recueillis avant que le projet vous soit proposé.",
  },
  {
    title: "Une rémunération connue",
    body: "Vous connaissez le travail envisagé et votre rémunération avant d'accepter.",
  },
  {
    title: "Vous choisissez vos projets",
    body: "Planning complet, projet hors spécialité, délai incompatible : vous restez libre de refuser.",
  },
  {
    title: "Vos clients restent les vôtres",
    body: "Un client que vous invitez avec votre lien personnel reste affecté à votre atelier, jamais mis en concurrence.",
  },
];

export interface PartnerStep {
  index: string;
  title: string;
}

export const HOW_IT_WORKS_STEPS: PartnerStep[] = [
  { index: "01", title: "Le client présente son livre" },
  { index: "02", title: "Ma Reliure étudie la demande et fixe le prix" },
  { index: "03", title: "Nous vous proposons le projet" },
  { index: "04", title: "Le livre rejoint votre atelier" },
  { index: "05", title: "Vous échangez avec le client dans Ma Reliure" },
  { index: "06", title: "Le livre retourne chez son propriétaire" },
];

/** Ce que comprend l'espace atelier gratuit. */
export const FREE_INCLUDES: readonly string[] = ["Clients", "Ouvrages", "Devis", "Factures", "Prestations et tarifs", "Messages"];

export interface PartnerFaqItem {
  question: string;
  answer: string;
}

export const PARTNER_FAQ: PartnerFaqItem[] = [
  {
    question: "L'outil est-il vraiment gratuit ?",
    answer:
      "Oui : 0 € par mois, sans engagement. Devis, factures, ouvrages, clients, prestations et messages sont inclus. Seul le paiement en ligne, quand vous l'activerez, coûtera 3 % du montant encaissé ; un paiement direct (virement, chèque, espèces) ne coûte rien.",
  },
  {
    question: "Puis-je utiliser l'outil sans recevoir de projets Ma Reliure ?",
    answer:
      "Oui. Devis, tarifs, ouvrages, clients et factures fonctionnent dès la création de votre espace. L'accès aux projets confiés par Ma Reliure s'ouvre ensuite, après validation de votre atelier.",
  },
  {
    question: "Est-ce que je suis obligé d'accepter les projets proposés ?",
    answer:
      "Non. Chaque projet est une proposition : planning complet, projet hors spécialité ou délai incompatible, vous restez libre de refuser.",
  },
  {
    question: "Qui fixe les prix ?",
    answer:
      "Pour vos propres clients, vous : vos tarifs sont les vôtres. Pour un projet confié par Ma Reliure, Ma Reliure fixe le prix présenté au client et vous annonce votre rémunération avant que vous acceptiez.",
  },
  {
    question: "Puis-je utiliser Ma Reliure avec un client que j'ai trouvé moi-même ?",
    answer:
      "Oui, c'est même une des raisons d'être de l'outil : faites-lui un devis, ou invitez-le avec votre lien personnel pour qu'il présente son livre. Le dossier arrive directement dans votre espace, et il reste votre client.",
  },
  {
    question: "Mes documents portent-ils le nom de mon atelier ?",
    answer:
      "Oui. Devis et factures sont émis au nom de votre atelier, avec votre logo, votre couleur, vos mentions légales et vos conditions de paiement.",
  },
  {
    question: "Puis-je parler directement avec le client d'un projet Ma Reliure ?",
    answer:
      "Les échanges passent par la conversation du dossier, dans Ma Reliure : messages, photos et décisions restent réunis au même endroit, pour vous comme pour le client.",
  },
  {
    question: "Que se passe-t-il si je découvre un problème après réception ?",
    answer:
      "Vous le signalez dans le dossier, avec des photos. Ma Reliure reprend la gestion commerciale avec le client avant toute modification du périmètre : ce n'est jamais à vous de renégocier le prix.",
  },
];
