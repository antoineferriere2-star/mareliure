/**
 * La page « Démonstration » : le parcours que vit le client d'un atelier derrière le lien
 * partagé, la fiche que l'atelier reçoit, puis le devis qui en sort.
 *
 * Les étapes reprennent les titres réels du Playbook Reliure (bookbindingPlaybookSchema.ts) :
 * rien n'est inventé sur ce que le client voit. La fiche d'exemple, elle, est fictive — le
 * client, le livre et ses dimensions sont inventés pour la démonstration, et la page le dit.
 * Aucun montant, aucun délai chiffré : un exemple ne doit jamais se lire comme un tarif.
 */
export const DEMO_HERO = {
  eyebrow: "Démonstration",
  title: "Ce que voit votre client, ce que vous recevez.",
  lead: "Vous partagez un lien. Votre client décrit son livre pas à pas, avec ses photos. Vous recevez une fiche prête à chiffrer, puis vous préparez le devis. Voici le parcours, de bout en bout.",
} as const;

export const DEMO_CLIENT_STEPS = [
  { title: "Son projet", body: "Réparer, restaurer, faire relier, personnaliser, transformer ou protéger : il dit ce qu'il souhaite, ou qu'il ne sait pas encore." },
  { title: "Son ouvrage", body: "Titre, auteur, année d'édition et nature du livre : courant, ancien, bible de famille, manuscrit, édition rare, album." },
  { title: "Les dimensions", body: "Hauteur, largeur, épaisseur, pour que vous sachiez ce que vous allez avoir en main." },
  { title: "L'état du livre", body: "Couverture usée ou détachée, dos abîmé, pages détachées, traces d'humidité. Puis un regard plus précis sur le dos, les plats et les cahiers." },
  { title: "Les photos", body: "Couverture, dos, tranche et dommage principal, avec un guide qui montre quoi photographier et comment." },
  { title: "Ses attentes", body: "L'aspect souhaité, les finitions, ce que ce livre représente pour lui, son budget et son délai." },
  { title: "Ses coordonnées", body: "De quoi vous répondre. Rien de plus." },
] as const;

export const DEMO_CLIENT_NOTES = [
  "Le parcours explique les mots du métier (dos, plats, mors, coiffes) là où il les emploie.",
  "Votre client ne choisit pas de prix : il décrit son livre, c'est vous qui chiffrez.",
  "Il reste votre client : la demande arrive chez vous, à votre nom.",
] as const;

export const DEMO_BRIEF = {
  eyebrow: "La fiche que vous recevez",
  title: "Une demande déjà structurée, prête à chiffrer.",
  lead: "Plus de photos envoyées dans le désordre, plus de messages à relancer pour connaître les dimensions. Tout arrive classé, au même endroit, dans le dossier du client.",
  disclaimer: "Exemple fictif : client, livre et dimensions inventés pour la démonstration.",
  sections: [
    { label: "Projet", rows: [["Souhait", "Restaurer"], ["Priorité", "Garder la reliure d'origine"]] },
    { label: "Ouvrage", rows: [["Titre", "Chroniques du Périgord"], ["Année", "1892"], ["Nature", "Livre ancien"], ["Dimensions", "24 × 16 × 4 cm"]] },
    { label: "État", rows: [["Dos", "Fendu ou décollé"], ["Plats", "Usés aux coins"], ["Cahiers", "Un ou deux se détachent"]] },
    { label: "Photos", rows: [["Reçues", "Couverture, dos, tranche, dommage principal"]] },
    { label: "Attentes", rows: [["Budget", "À discuter"], ["Délai", "Sans urgence"]] },
  ],
} as const;

export const DEMO_QUOTE = {
  eyebrow: "Le devis",
  title: "De la fiche au devis, puis à la facture.",
  lead: "Vous chiffrez à partir de vos prestations et de vos prix. Le devis part en PDF au nom de votre atelier ; accepté, il devient une facture, et vous enregistrez les règlements.",
  steps: ["Fiche reçue", "Devis préparé", "Devis accepté", "Facture", "Règlement"],
  caption: "Captures de l'application, avec des données d'exemple fictives : les montants n'y sont pas un tarif.",
} as const;

export const DEMO_CTA = {
  title: "Essayez-le avec votre propre lien.",
  body: "Créez votre compte atelier : essai gratuit de 14 jours, sans carte bancaire.",
} as const;
