import type { FineBinderyPublicCopy } from "./types";
import { FINE_BINDERY_HOME } from "./homeCopy";

export const enSeo: FineBinderyPublicCopy["seo"] = {
    homeTitle: "Fine Bindery — quote and invoice software for bookbinders",
    homeDescription: "Fine Bindery is the quote and invoice software for bookbinders and conservation workshops: quotes, invoices, credit notes and payments tracked in one place. You are paid directly by your clients.",
    directoryTitle: "Bookbinders & book conservators — Fine Bindery",
    directoryDescription: "Browse independent ateliers for bookbinding, restoration, conservation and gilding, and present your project directly to one of them.",
    profileTitle: (w) => `${w} — Bookbinding and restoration | Fine Bindery`,
    profileDescription: (w, c) => `Discover ${w}, an independent bookbinding and conservation atelier in ${c}.`,
  };

export const enHomeFaq: FineBinderyPublicCopy["home"]["faq"] = FINE_BINDERY_HOME.en.faq;

export const enProjectStart: FineBinderyPublicCopy["common"]["start"] = "Present your project";

export const enDirectoryLabel: FineBinderyPublicCopy["nav"]["workshops"] = "Ateliers";

export const enProfileNotFound: FineBinderyPublicCopy["profile"]["notFound"] = "Atelier not found";
