export interface FineBinderyHomeCopy {
  eyebrow: string; title: string; lead: string; secondary: string; proof: readonly string[];
  beforeAfter: {
    eyebrow: string; title: string; withoutLabel: string; withoutCaption: string; withoutBody: string;
    withLabel: string; withCaption: string; rows: ReadonlyArray<readonly [string, string]>; note: string;
  };
  howEyebrow: string; howTitle: string; steps: ReadonlyArray<{ title: string; body: string }>;
  featuresEyebrow: string; featuresTitle: string; features: ReadonlyArray<{ title: string; body: string }>;
  pricingEyebrow: string; pricingTitle: string; pricingBody: string; pricingIncluded: string[];
  faqEyebrow: string; faqTitle: string; faq: Array<{ question: string; answer: string }>;
  finalTitle: string; finalLead: string;
}

/** Lu par les pages de savoir-faire, pas par l'accueil. */
export interface FineBinderyDisciplineCopy {
  offersEyebrow: string; offersTitle: string; photoCredit: string; offers: Array<{ title: string; body: string }>;
  discover: string;
  journeyEyebrow: string; journeyTitle: string; journeySteps: string[];
  shippingEyebrow: string; shippingTitle: string; shippingLead: string;
}

export interface FineBinderyPublicCopy {
  seo: {
    homeTitle: string; homeDescription: string; directoryTitle: string; directoryDescription: string;
    profileTitle: (workshop: string) => string; profileDescription: (workshop: string, city: string) => string;
  };
  nav: { features: string; pricing: string; how: string; services: string; workshops: string; faq: string; signIn: string; language: string; menu: string };
  common: { signup: string; start: string; project: string; france: string; skills: string; languages: string; techniques: string; originalText: string };
  footer: { summary: string; information: string; legal: string; privacy: string; terms: string; sales: string; closing: string };
  home: FineBinderyHomeCopy & FineBinderyDisciplineCopy;
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
