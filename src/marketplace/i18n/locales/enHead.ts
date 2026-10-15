import type { FineBinderyPublicCopy } from "./types";

export const enSeo: FineBinderyPublicCopy["seo"] = {
    homeTitle: "Fine Bindery — European bookbinding & book conservation",
    homeDescription: "Discover skilled bookbinders and book conservators, present your project and work with the right atelier. The network opens in France.",
    directoryTitle: "Bookbinders & book conservators — Fine Bindery",
    directoryDescription: "Browse independent ateliers for bookbinding, restoration, conservation and gilding, and present your project directly to one of them.",
    profileTitle: (w) => `${w} — Bookbinding and restoration | Fine Bindery`,
    profileDescription: (w, c) => `Discover ${w}, an independent bookbinding and conservation atelier in ${c}.`,
  };

export const enHomeFaq: FineBinderyPublicCopy["home"]["faq"] = [
      { question: "Can I contact an atelier directly?", answer: "Yes. A project presented from an atelier’s page reaches that atelier directly." },
      { question: "Who sells to me and who invoices me?", answer: "It depends on how you start. A project presented from an atelier’s page makes that atelier your seller: it sends its own quote and invoices you. A project presented to Fine Bindery is sold by OPPE SAS under the Fine Bindery brand, which chooses the atelier, issues the quote and the invoice, and takes payment; the atelier then invoices OPPE SAS, never you." },
      { question: "How are ateliers chosen for the network?", answer: "Fine Bindery reviews each atelier before publishing its page: its skills, its experience and the kind of work it wishes to receive. There is no ranking and no paid placement." },
      { question: "Do I need to speak French?", answer: "No. Each atelier lists the languages it speaks, and Fine Bindery remains your point of contact when you present a project to us." },
      { question: "Is shipping included?", answer: "No. Shipping is quoted separately, according to destination, value and the level of care the book requires." },
      { question: "Can valuable or antique books be entrusted?", answer: "Yes, subject to an individual review and suitable logistics." },
    ];

export const enProjectStart: FineBinderyPublicCopy["common"]["start"] = "Present your project";

export const enDirectoryLabel: FineBinderyPublicCopy["nav"]["workshops"] = "Ateliers";

export const enProfileNotFound: FineBinderyPublicCopy["profile"]["notFound"] = "Atelier not found";
