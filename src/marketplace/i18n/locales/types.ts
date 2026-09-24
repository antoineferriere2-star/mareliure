export interface FineBinderyPublicCopy {
  seo: {
    homeTitle: string; homeDescription: string; directoryTitle: string; directoryDescription: string;
    profileTitle: (workshop: string) => string; profileDescription: (workshop: string, city: string) => string;
  };
  nav: { how: string; services: string; workshops: string; faq: string; signIn: string; language: string };
  common: { start: string; project: string; france: string; skills: string; languages: string; techniques: string; originalText: string };
  footer: { summary: string; information: string; legal: string; privacy: string; terms: string; sales: string; closing: string };
  home: {
    eyebrow: string; title: string; lead: string; discover: string; proof: string;
    benefitsEyebrow: string; benefitsTitle: string; benefitsLead: string;
    benefits: Array<{ title: string; body: string }>;
    offersEyebrow: string; offersTitle: string; photoCredit: string; offers: Array<{ title: string; body: string }>;
    howEyebrow: string; howTitle: string; steps: string[];
    workshopsEyebrow: string; workshopsTitle: string; workshopsLead: string; selected: string; discoverWorkshops: string;
    trustEyebrow: string; trustTitle: string; trust: string[];
    shippingEyebrow: string; shippingTitle: string; shippingLead: string;
    faqEyebrow: string; faqTitle: string; faq: Array<{ question: string; answer: string }>;
    finalTitle: string; finalLead: string; established: string;
  };
  directory: {
    eyebrow: string; title: string; lead: string; country: string; specialty: string; language: string;
    allCountries: string; allSpecialties: string; allLanguages: string; empty: string;
  };
  profile: {
    workshop: string; discuss: string; specialties: string; languages: string; techniques: string; according: string;
    training: string; approach: string; portfolio: string; work: string; before: string; after: string;
    finalEyebrow: string; finalTitle: (workshop: string) => string; website: string; call: string; email: string;
    notFound: string; notFoundBody: string; back: string;
  };
}
