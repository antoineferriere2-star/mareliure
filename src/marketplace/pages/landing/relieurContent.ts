/**
 * Le texte de l'accueil Ma Reliure, depuis le pivot du 22 novembre 2026 : l'outil
 * de devis et de suivi des relieurs et des ateliers de restauration.
 *
 * Aucun montant publié pour les tarifs (le consentement à payer se valide avec le
 * premier cercle d'ateliers). L'exemple avant/après est un exemple illustratif,
 * annoncé comme tel : ce n'est ni un projet réel ni un tarif.
 */
export const RELIEUR_HERO = {
  eyebrow: "Pour les relieurs et ateliers de restauration",
  title: "Vos clients décrivent leur livre. Vous recevez un dossier prêt à chiffrer.",
  lead: "Fini les courriels de trois lignes et les photos envoyées par SMS. Vos clients suivent un parcours guidé — type de projet, état du livre, dimensions, budget, délai, photos — et vous recevez une fiche complète, prête à devis.",
  secondary: "Voir comment ça marche",
  proof: ["Devis plus rapides", "Moins d’allers-retours", "Chaque projet suivi jusqu’à la livraison"],
} as const;

export const RELIEUR_BEFORE_AFTER = {
  eyebrow: "Un exemple",
  title: "La même demande, avec et sans Ma Reliure.",
  without: {
    label: "Sans Ma Reliure",
    caption: "Courriel reçu par l’atelier",
    body: "« Bonjour, j’ai un livre de famille abîmé, vous pouvez me dire combien ça coûterait ? »",
  },
  with: {
    label: "Avec Ma Reliure",
    caption: "Fiche reçue par l’atelier",
    rows: [
      ["Projet", "Restauration — reliure pleine peau"],
      ["Dimensions", "21 × 14 × 3 cm"],
      ["État", "Dos et coiffes à refaire"],
      ["Budget", "250 – 400 €"],
      ["Délai", "Sous 2 mois"],
      ["Photos", "3 photos jointes"],
    ],
  },
  note: "Exemple illustratif, pas un tarif.",
} as const;

export const RELIEUR_STEPS = [
  {
    title: "Partagez votre lien",
    body: "Vous envoyez à vos clients le lien de votre parcours de prise de projet : sur votre site, par courriel, sur vos réseaux.",
  },
  {
    title: "Vous recevez la fiche",
    body: "Le client répond à un parcours pensé pour la reliure : type de projet, état du livre, dimensions, budget, délai, photos.",
  },
  {
    title: "Vous chiffrez et suivez",
    body: "Vous transformez la fiche en devis, puis vous suivez chaque dossier jusqu’à la livraison, au même endroit.",
  },
] as const;

export const RELIEUR_FEATURES = [
  {
    title: "Un parcours pensé pour la reliure",
    body: "Une prise de projet conçue pour la reliure et la restauration, pas un contact générique.",
  },
  {
    title: "Une fiche structurée à chaque demande",
    body: "Type de projet, état, dimensions, budget, délai, photos : tout ce qu’il faut pour chiffrer.",
  },
  {
    title: "Le suivi de chaque dossier",
    body: "Du premier contact à la livraison, sans quitter l’outil.",
  },
  {
    title: "L’historique de vos clients",
    body: "Vos clients et leurs projets, au même endroit.",
  },
] as const;

export const RELIEUR_PRICING = {
  eyebrow: "Tarifs",
  title: "Les tarifs arrivent bientôt.",
  body: "Nous les fixons avec le premier cercle d’ateliers qui utilise l’outil. En attendant, vous pouvez créer votre compte atelier.",
} as const;

export const RELIEUR_FAQ = [
  {
    question: "Mes clients doivent-ils créer un compte ?",
    answer:
      "Non. Ils ouvrent le lien que vous leur envoyez et suivent le parcours. Ils reçoivent ensuite un lien de suivi de leur projet.",
  },
  {
    question: "Puis-je adapter le parcours à mon activité ?",
    answer:
      "Le parcours couvre la reliure, la restauration, la dorure et la création. Son adaptation à votre spécialité se prépare avec les premiers ateliers : dites-nous ce qu’il vous faut.",
  },
  {
    question: "Est-ce que je garde la relation avec mes clients ?",
    answer:
      "Oui. Ma Reliure est votre outil, pas un intermédiaire : vos clients restent vos clients. Vous fixez vos prix, vous facturez et vous êtes payé directement.",
  },
  {
    question: "Combien de temps pour mettre en place mon compte ?",
    answer:
      "Vous créez votre compte atelier en quelques minutes, puis vous obtenez le lien de votre parcours à partager.",
  },
] as const;

export const RELIEUR_FINAL = {
  title: "Recevez des demandes prêtes à chiffrer.",
  lead: "Créez votre compte atelier et partagez votre lien.",
} as const;
