import type { FineBinderyPublicCopy } from "./types";

/**
 * English is the reference copy of Fine Bindery: plain, premium English —
 * no marketplace vocabulary, no SaaS superlatives. The network opens with
 * ateliers in France; the copy says so rather than implying a European
 * roster that does not exist yet.
 */
export const en: FineBinderyPublicCopy = {
  seo: {
    homeTitle: "Fine Bindery — The European network for bookbinding & book conservation",
    homeDescription: "Discover skilled bookbinders and book conservators, present your project and work with the right atelier. The network opens in France.",
    directoryTitle: "Bookbinders & book conservators — Fine Bindery",
    directoryDescription: "Browse independent ateliers for bookbinding, restoration, conservation and gilding, and present your project directly to one of them.",
    profileTitle: (w) => `${w} — Bookbinding and restoration | Fine Bindery`,
    profileDescription: (w, c) => `Discover ${w}, an independent bookbinding and conservation atelier in ${c}.`,
  },
  nav: { how: "How it works", services: "Disciplines", workshops: "Ateliers", faq: "FAQ", signIn: "Sign in", language: "Language", menu: "Menu" },
  common: { start: "Present your project", project: "Project", france: "France", skills: "Skills", languages: "Languages", techniques: "Techniques & materials", originalText: "Atelier text shown in its original language." },
  footer: { summary: "The European network for bookbinding and book conservation.", information: "Information", legal: "Legal notice", privacy: "Privacy policy", terms: "Terms of use", sales: "Terms of sale", closing: "Bookbinding, conservation and gilding, by independent ateliers." },
  trust: { atelier: "For ateliers", home: "Home", brands: "Ma Reliure serves clients in France. Fine Bindery welcomes international projects and is developing a European network, starting in France.", atelierAccess: "Create a workspace to manage your own projects. Publication in the directory and access to network projects require a separate review.", legalLanguage: "Legal documents are currently available in English.", pricePolicy: "A proposal is prepared from your photographs. The atelier checks the book on receipt. No work or price change proceeds without your prior agreement.", workshopImage: "A bookbinding example from Reliure Dorure Ferrière" },
  home: {
    eyebrow: "Bookbinding · Conservation · Gilding",
    title: "The European Network for Bookbinding & Book Conservation.",
    lead: "Present your book and tell us what you have in mind. We will check whether an atelier can take on the work.",
    discover: "Discover the ateliers",
    proof: "Independent ateliers, reviewed before publication · One project, one conversation · Opening in France",
    offersEyebrow: "Disciplines", offersTitle: "The work of the network.", photoCredit: "Photographs", offers: [
      { title: "Fine binding", body: "Traditional and contemporary bindings in leather, cloth and fine papers." },
      { title: "Restoration & conservation", body: "Careful work on old, valuable and meaningful books, respecting their history." },
      { title: "Collector rebinding", body: "A favourite or collectible edition, made into a unique object." },
      { title: "Bespoke commissions", body: "One-off bindings, family books, presentation copies, boxes and slipcases." },
    ],
    pathsEyebrow: "Two ways to begin", pathsTitle: "Present a project or consult the directory.", paths: [
      { title: "Choose an atelier", body: "Browse the published ateliers, their work, their techniques and the languages they speak. A project presented from an atelier’s page reaches that atelier directly.", cta: "Browse the ateliers" },
      { title: "Present your project", body: "Present your book and tell us what you have in mind. We will check whether an atelier can take on the work.", cta: "Present your project" },
    ],
    howEyebrow: "How a project unfolds", howTitle: "From the first photograph to the book’s return.", steps: ["Present your book", "Receive a proposal", "The right atelier confirms", "Your book travels to the atelier", "Follow the work", "Your book comes home"],
    workshopsEyebrow: "Behind every book, an atelier", workshopsTitle: "Independent bookbinders, conservators and gilders.", workshopsLead: "Our network is developing. Published profiles appear in the directory as they are approved.", selected: "Photographs from Reliure Dorure Ferrière, shown with permission; this feature is not a published directory profile.", discoverWorkshops: "Discover the published ateliers",
    networkNote: "The network opens with ateliers in France, and will welcome bookbinders and conservators from across Europe.",
    trustEyebrow: "Your book travels", trustTitle: "Your book travels. Its story does not get lost.", trust: ["Documented condition", "One point of contact", "Reviewed ateliers", "A followed journey"],
    shippingEyebrow: "Shipping", shippingTitle: "A journey adapted to the book.", shippingLead: "Shipping arrangements must be agreed before sending the book. Do not send it before receiving instructions.",
    faqEyebrow: "Questions, answered", faqTitle: "Before you start.", faq: [
      { question: "Can I contact an atelier directly?", answer: "Yes. A project presented from an atelier’s page reaches that atelier directly." },
      { question: "How are ateliers chosen for the network?", answer: "Fine Bindery reviews each atelier before publishing its page: its skills, its experience and the kind of work it wishes to receive. There is no ranking and no paid placement." },
      { question: "Do I need to speak French?", answer: "No. Each atelier lists the languages it speaks, and Fine Bindery remains your point of contact when you present a project to us." },
      { question: "Is shipping included?", answer: "No. Shipping is quoted separately, according to destination, value and the level of care the book requires." },
      { question: "Can valuable or antique books be entrusted?", answer: "Yes, subject to an individual review and suitable logistics." },
    ],
    finalTitle: "Your book deserves the right hands.", finalLead: "Present your book and tell us what you have in mind. We will check whether an atelier can take on the work.", established: "established",
  },
  directory: {
    eyebrow: "The network", title: "Bookbinders and conservators, chosen for their craft.",
    lead: "Browse the published ateliers. A project presented from an atelier’s page reaches that atelier directly.",
    filters: "Filter the ateliers", country: "Country", specialty: "Specialty", language: "Language",
    allCountries: "All countries", allSpecialties: "All specialties", allLanguages: "All languages",
    empty: "No published atelier matches these filters.", reset: "Clear the filters",
    count: (n) => (n === 1 ? "1 atelier" : `${n} ateliers`), view: "View the atelier",
    emptyTitle: "The first ateliers are being published.",
    emptyBody: "There are currently no published profiles. You can still present your project so we can review it.",
    openingNote: "The network opens with ateliers in France, and will welcome bookbinders and conservators from across Europe.",
  },
  profile: {
    workshop: "Atelier", discuss: "Discuss your project", about: "About the atelier", location: "Location",
    specialties: "Specialties", languages: "Languages spoken", techniques: "Techniques & materials", according: "According to the project",
    training: "Training & experience", approach: "Approach", portfolio: "Selected work", work: "Work from the atelier.", before: "Before", after: "After",
    finalEyebrow: "One book, one conversation", finalTitle: (w) => `Discuss your project directly with ${w}.`,
    website: "Atelier website", call: "Call the atelier", email: "Email the atelier",
    notFound: "Atelier not found", notFoundBody: "This page is not published or no longer exists.", back: "Browse the ateliers",
  },
};
