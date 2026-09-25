export interface FineBinderyPublicCopy {
  seo: {
    homeTitle: string; homeDescription: string; directoryTitle: string; directoryDescription: string;
    profileTitle: (workshop: string) => string; profileDescription: (workshop: string, city: string) => string;
  };
  nav: { how: string; services: string; workshops: string; faq: string; signIn: string; language: string; menu: string };
  common: { start: string; project: string; france: string; skills: string; languages: string; techniques: string; originalText: string };
  footer: { summary: string; information: string; legal: string; privacy: string; terms: string; sales: string; closing: string };
  home: {
    /** Le réseau d'abord : l'annuaire, puis le projet présenté. */
    eyebrow: string; title: string; lead: string; discover: string; proof: string;
    offersEyebrow: string; offersTitle: string; photoCredit: string; offers: Array<{ title: string; body: string }>;
    pathsEyebrow: string; pathsTitle: string; paths: Array<{ title: string; body: string; cta: string }>;
    howEyebrow: string; howTitle: string; steps: string[];
    workshopsEyebrow: string; workshopsTitle: string; workshopsLead: string; selected: string; discoverWorkshops: string;
    /** Le réseau ouvre en France : dit, jamais laissé à deviner. */
    networkNote: string;
    trustEyebrow: string; trustTitle: string; trust: string[];
    shippingEyebrow: string; shippingTitle: string; shippingLead: string;
    faqEyebrow: string; faqTitle: string; faq: Array<{ question: string; answer: string }>;
    finalTitle: string; finalLead: string; established: string;
  };
  directory: {
    eyebrow: string; title: string; lead: string; filters: string; country: string; specialty: string; language: string;
    allCountries: string; allSpecialties: string; allLanguages: string; empty: string; reset: string;
    count: (count: number) => string; view: string;
    emptyTitle: string; emptyBody: string; openingNote: string;
  };
  profile: {
    workshop: string; discuss: string; about: string; location: string; specialties: string; languages: string; techniques: string; according: string;
    training: string; approach: string; portfolio: string; work: string; before: string; after: string;
    finalEyebrow: string; finalTitle: (workshop: string) => string; website: string; call: string; email: string;
    notFound: string; notFoundBody: string; back: string;
  };
}
