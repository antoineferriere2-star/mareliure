import type { FineBinderyPublicCopy } from "./types";
import { FINE_BINDERY_HOME } from "./homeCopy";

export const enSeo: FineBinderyPublicCopy["seo"] = {
    homeTitle: "Fine Bindery — quotes and project tracking for bookbinders",
    homeDescription: "Your clients describe their book, you receive a brief that’s ready to quote. Fine Bindery is the quote and project tool for bookbinders and conservation workshops.",
    directoryTitle: "Bookbinders & book conservators — Fine Bindery",
    directoryDescription: "Browse independent ateliers for bookbinding, restoration, conservation and gilding, and present your project directly to one of them.",
    profileTitle: (w) => `${w} — Bookbinding and restoration | Fine Bindery`,
    profileDescription: (w, c) => `Discover ${w}, an independent bookbinding and conservation atelier in ${c}.`,
  };

export const enHomeFaq: FineBinderyPublicCopy["home"]["faq"] = FINE_BINDERY_HOME.en.faq;

export const enProjectStart: FineBinderyPublicCopy["common"]["start"] = "Present your project";

export const enDirectoryLabel: FineBinderyPublicCopy["nav"]["workshops"] = "Ateliers";

export const enProfileNotFound: FineBinderyPublicCopy["profile"]["notFound"] = "Atelier not found";
