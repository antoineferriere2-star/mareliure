import type { FineBinderyPublicCopy } from "./types";
import { FINE_BINDERY_HOME } from "./homeCopy";

export const itSeo: FineBinderyPublicCopy["seo"] = {
    homeTitle: "Fine Bindery — software per preventivi e fatture per legatori",
    homeDescription: "Fine Bindery è il software per preventivi e fatture di legatori e laboratori di restauro: preventivi, fatture, note di credito e pagamenti seguiti nello stesso posto. Siete pagati direttamente dai vostri clienti.",
    directoryTitle: "Legatori e restauratori di libri — Fine Bindery",
    directoryDescription: "Scopri laboratori indipendenti di legatoria, restauro, conservazione e doratura, e presenta il tuo progetto direttamente a uno di loro.",
    profileTitle: (w) => `${w} — Legatoria e restauro | Fine Bindery`,
    profileDescription: (w, c) => `Scopri ${w}, laboratorio indipendente di legatoria e conservazione a ${c}.`,
  };

export const itHomeFaq: FineBinderyPublicCopy["home"]["faq"] = FINE_BINDERY_HOME.it.faq;

export const itProjectStart: FineBinderyPublicCopy["common"]["start"] = "Presenta il tuo progetto";

export const itDirectoryLabel: FineBinderyPublicCopy["nav"]["workshops"] = "Laboratori";

export const itProfileNotFound: FineBinderyPublicCopy["profile"]["notFound"] = "Laboratorio non trovato";
