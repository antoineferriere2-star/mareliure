import type { FineBinderyPublicCopy } from "./types";

export const en: FineBinderyPublicCopy = {
  seo: {
    homeTitle: "Fine Bindery — Exceptional French bookbinding",
    homeDescription: "Bookbinders and book conservators in France, with one international point of contact for your project.",
    directoryTitle: "Bookbinders & book conservators in France — Fine Bindery",
    directoryDescription: "Discover independent French workshops for bookbinding, restoration, conservation and gilding.",
    profileTitle: (w) => `${w} — Bookbinding and restoration | Fine Bindery`,
    profileDescription: (w, c) => `Discover ${w}, an independent bookbinding and conservation workshop in ${c}, France.`,
  },
  nav: { how: "How it works", services: "What we do", workshops: "Our workshops", faq: "FAQ", signIn: "Sign in", language: "Language" },
  common: { start: "Start your project", project: "Project", france: "France", skills: "Skills", languages: "Languages", techniques: "Techniques & materials", originalText: "Workshop text shown in its original language." },
  footer: { summary: "The international network for French bookbinding and book conservation.", information: "Information", legal: "Legal notice", privacy: "Privacy policy", terms: "Terms of use", sales: "Terms of sale", closing: "French bookbinding, restoration and craftsmanship, by independent artisans." },
  home: {
    eyebrow: "French craftsmanship, personally managed", title: "We take responsibility for the entire journey of your book.",
    lead: "From the first conversation to its safe return, one Fine Bindery contact coordinates the right independent French workshop, the decisions and the international journey.",
    discover: "Discover French craftsmanship", proof: "One accountable contact · Selected French workshops · Worldwide coordination",
    benefitsEyebrow: "Your book. The right French hands.", benefitsTitle: "We select the workshop according to the book, the technique and the project — never through a bidding process.", benefitsLead: "Fine Bindery works with independent French bookbinders, gilders and conservators, selected for their specific skills.",
    benefits: [
      { title: "A project, understood", body: "You describe your book once. Fine Bindery reviews the work involved before proposing anything." },
      { title: "A price you can trust", body: "A fixed price when the project can be assessed accurately, or an estimate confirmed before your book is sent." },
      { title: "The right French hands", body: "Your project goes to the workshop whose skills match it." },
      { title: "One point of contact", body: "Fine Bindery follows the project from the first photograph to its return home." },
    ],
    offersEyebrow: "What we do", offersTitle: "Four ways to entrust your book.", photoCredit: "Photographs", offers: [
      { title: "Fine binding", body: "Traditional and contemporary bindings in leather, cloth and fine materials." },
      { title: "Book restoration", body: "Careful restoration and conservation of old, valuable and meaningful books." },
      { title: "Collector rebinding", body: "Transform a favourite or collectible edition into a unique object." },
      { title: "Bespoke commissions", body: "One-off bindings, presentation books, family books, boxes and exceptional projects." },
    ],
    howEyebrow: "How it works", howTitle: "From your home to a French workshop — and back.", steps: ["Show us your book", "Receive your proposal", "We select the right workshop", "Your book travels to France", "Follow the craftsmanship", "Receive your book home"],
    workshopsEyebrow: "Behind every book, a French artisan", workshopsTitle: "Independent bookbinders, conservators and gilders across France.", workshopsLead: "Each project is entrusted according to the skills it requires.", selected: "Selected by Fine Bindery for this network.", discoverWorkshops: "Discover the published workshops",
    trustEyebrow: "Your book travels", trustTitle: "Your book travels. Its story does not get lost.", trust: ["Documented condition", "Personal coordination", "Selected French workshop", "Tracked international journey"],
    shippingEyebrow: "Getting your book to France", shippingTitle: "Secure international shipping, adapted to the book.", shippingLead: "Fine Bindery organises the journey according to the nature and value of the book. Shipping is quoted separately from the service.",
    faqEyebrow: "Questions, answered", faqTitle: "Before you start.", faq: [
      { question: "Do I need to speak French?", answer: "No. Fine Bindery remains your point of contact throughout the project." },
      { question: "How is my workshop selected?", answer: "According to the book, the techniques required, the project's complexity and workshop availability." },
      { question: "Is shipping included?", answer: "No. International shipping is quoted separately according to destination, value and level of care required." },
      { question: "Can you handle valuable or antique books?", answer: "Yes, subject to individual review and suitable logistics." },
    ],
    finalTitle: "Your book deserves the right hands.", finalLead: "From the first photographs to its return home, Fine Bindery coordinates the entire journey to a selected French workshop.", established: "established",
  },
  directory: { eyebrow: "FineBindery Network · France", title: "Workshops chosen for their craft, experience and perspective.", lead: "Discover independent bookbinders and conservators. A project sent from a workshop page reaches that workshop directly.", country: "Country", specialty: "Specialty", language: "Language", allCountries: "All countries", allSpecialties: "All specialties", allLanguages: "All languages", empty: "No published workshop matches these filters." },
  profile: { workshop: "FineBindery workshop", discuss: "Discuss your project", specialties: "Specialties", languages: "Languages", techniques: "Techniques & materials", according: "According to the project", training: "Training & experience", approach: "Approach", portfolio: "Selected work", work: "Work from the workshop.", before: "Before", after: "After", finalEyebrow: "One book, one conversation, the right craft", finalTitle: (w) => `Discuss your project directly with ${w}.`, website: "Workshop website", call: "Call the workshop", email: "Email the workshop", notFound: "Workshop not found", notFoundBody: "This page is not published or no longer exists.", back: "Discover the professionals" },
};
