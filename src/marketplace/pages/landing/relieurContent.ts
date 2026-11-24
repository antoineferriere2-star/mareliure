/**
 * Le texte de l'accueil Ma Reliure, depuis le pivot du 22 novembre 2026 : le logiciel
 * de devis et factures des relieurs et des ateliers de restauration.
 *
 * Aucun montant publié pour les tarifs (le consentement à payer se valide avec le
 * premier cercle d'ateliers). Le bloc « en pratique » illustre un principe,
 * il ne reproduit ni un document réel ni un tarif.
 */
export const RELIEUR_HERO = {
  eyebrow: "Logiciel de devis et factures",
  title: "Le logiciel de devis et factures des relieurs et ateliers de restauration.",
  lead: "Préparez vos devis, transformez-les en factures et suivez les règlements, au même endroit. Vos clients peuvent aussi vous écrire par un lien : leur demande arrive déjà structurée, prête à chiffrer.",
  secondary: "Voir comment ça marche",
  proof: ["Devis et factures numérotés", "Avoirs et règlements suivis", "Vos clients restent vos clients"],
} as const;

export const RELIEUR_BEFORE_AFTER = {
  eyebrow: "En pratique",
  title: "Du devis au règlement, sans changer d’outil.",
  without: {
    label: "Sans logiciel",
    caption: "Comment on s’y prend souvent",
    body: "Un devis dans un traitement de texte, une facture dans un tableur, les règlements dans un carnet — et des numéros à surveiller à la main.",
  },
  with: {
    label: "Avec Ma Reliure",
    caption: "Un dossier, de bout en bout",
    rows: [
      ["Devis", "Préparé pour chaque projet"],
      ["Facture", "Créée à partir du devis accepté"],
      ["Avoir", "Émis si le travail change"],
      ["Règlement", "Enregistré sur la facture"],
      ["Client", "Son historique, au même endroit"],
    ],
  },
  note: "Illustration du principe, pas un document réel.",
} as const;

export const RELIEUR_STEPS = [
  {
    title: "Vous faites le devis",
    body: "Vous préparez un devis clair pour chaque projet, à partir de vos prestations et de vos ouvrages.",
  },
  {
    title: "Vous facturez",
    body: "Le devis accepté devient une facture ; un avoir corrige si le travail change.",
  },
  {
    title: "Vous suivez les règlements",
    body: "Vous enregistrez ce que le client a réglé. Vous êtes payé directement, sans intermédiaire.",
  },
] as const;

export const RELIEUR_FEATURES = [
  {
    title: "Des devis prêts à envoyer",
    body: "Un devis soigné pour chaque projet, rédigé dans le vocabulaire de la reliure.",
  },
  {
    title: "Des factures et des avoirs",
    body: "Vous facturez depuis le devis accepté et corrigez par un avoir quand il le faut.",
  },
  {
    title: "Les règlements et les clients",
    body: "Ce qui est réglé, ce qui reste dû, et l’historique de chaque client.",
  },
  {
    title: "Des demandes déjà structurées",
    body: "Un lien à partager : le client décrit son livre (type de projet, état, dimensions, photos) et vous recevez une fiche prête à chiffrer.",
  },
] as const;

export const RELIEUR_PRICING = {
  eyebrow: "Tarifs",
  title: "Les tarifs arrivent bientôt.",
  body: "Votre compte atelier s’ouvre avec un essai gratuit de quinze jours, sans carte bancaire. Les tarifs, nous les fixons avec le premier cercle d’ateliers qui utilise l’outil.",
} as const;

export const RELIEUR_FAQ = [
  {
    question: "Ma Reliure encaisse-t-il les paiements de mes clients ?",
    answer:
      "Non. Vous fixez vos prix, vous facturez et vous êtes payé directement par votre client. Ma Reliure ne perçoit rien sur vos ventes.",
  },
  {
    question: "Est-ce que je garde la relation avec mes clients ?",
    answer:
      "Oui. Ma Reliure est votre outil, pas un intermédiaire : vos clients restent vos clients.",
  },
  {
    question: "Mes clients doivent-ils créer un compte ?",
    answer:
      "Non. S’ils vous écrivent par votre lien, ils suivent un parcours guidé sans compte, puis reçoivent un lien de suivi de leur projet.",
  },
  {
    question: "Combien de temps pour mettre en place mon compte ?",
    answer:
      "Vous créez votre compte atelier en quelques minutes, puis vous pouvez préparer vos premiers devis.",
  },
] as const;

export const RELIEUR_FINAL = {
  title: "Vos devis et vos factures, au même endroit.",
  lead: "Créez votre compte atelier.",
} as const;
