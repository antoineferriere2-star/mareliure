import type { FineBinderyPublicCopy } from "./types";
import { FINE_BINDERY_HOME } from "./homeCopy";

export const itSeo: FineBinderyPublicCopy["seo"] = {
    homeTitle: "Fine Bindery — preventivi e monitoraggio per legatori",
    homeDescription: "I vostri clienti descrivono il loro libro, voi ricevete una scheda pronta per il preventivo. Fine Bindery è lo strumento di preventivo e monitoraggio per legatori e laboratori di restauro.",
    directoryTitle: "Legatori e restauratori di libri — Fine Bindery",
    directoryDescription: "Scopri laboratori indipendenti di legatoria, restauro, conservazione e doratura, e presenta il tuo progetto direttamente a uno di loro.",
    profileTitle: (w) => `${w} — Legatoria e restauro | Fine Bindery`,
    profileDescription: (w, c) => `Scopri ${w}, laboratorio indipendente di legatoria e conservazione a ${c}.`,
  };

export const itHomeFaq: FineBinderyPublicCopy["home"]["faq"] = FINE_BINDERY_HOME.it.faq;

export const itProjectStart: FineBinderyPublicCopy["common"]["start"] = "Presenta il tuo progetto";

export const itDirectoryLabel: FineBinderyPublicCopy["nav"]["workshops"] = "Laboratori";

export const itProfileNotFound: FineBinderyPublicCopy["profile"]["notFound"] = "Laboratorio non trovato";
