import type { FineBinderyPublicCopy } from "./types";

export const itSeo: FineBinderyPublicCopy["seo"] = {
    homeTitle: "Fine Bindery — Legatoria e restauro del libro in Europa",
    homeDescription: "Scopri legatori e restauratori esperti, presenta il tuo progetto e lavora con il laboratorio giusto. La rete apre in Francia.",
    directoryTitle: "Legatori e restauratori di libri — Fine Bindery",
    directoryDescription: "Scopri laboratori indipendenti di legatoria, restauro, conservazione e doratura, e presenta il tuo progetto direttamente a uno di loro.",
    profileTitle: (w) => `${w} — Legatoria e restauro | Fine Bindery`,
    profileDescription: (w, c) => `Scopri ${w}, laboratorio indipendente di legatoria e conservazione a ${c}.`,
  };

export const itHomeFaq: FineBinderyPublicCopy["home"]["faq"] = [
      { question: "Posso contattare direttamente un laboratorio?", answer: "Sì. Un progetto presentato dalla pagina di un laboratorio arriva direttamente a quel laboratorio." },
      { question: "Chi mi vende il servizio e chi mi fattura?", answer: "Dipende da come iniziate. Un progetto presentato dalla pagina di un laboratorio rende quel laboratorio il vostro venditore: invia il proprio preventivo e vi fattura. Un progetto presentato a Fine Bindery è venduto da OPPE SAS con il marchio Fine Bindery, che sceglie il laboratorio, emette preventivo e fattura e incassa; il laboratorio fattura poi OPPE SAS, mai voi." },
      { question: "Come vengono scelti i laboratori?", answer: "Fine Bindery verifica ogni laboratorio prima di pubblicarne la pagina: competenze, esperienza e tipo di lavori che desidera ricevere. Non ci sono classifiche né posizionamenti a pagamento." },
      { question: "Devo parlare la lingua del laboratorio?", answer: "No. Ogni laboratorio indica le lingue che parla, e Fine Bindery resta il tuo interlocutore quando ci presenti un progetto." },
      { question: "La spedizione è inclusa?", answer: "No. Viene preventivata a parte, secondo destinazione, valore e cura richiesta." },
      { question: "Posso affidare un libro antico o prezioso?", answer: "Sì, dopo una valutazione individuale e con una logistica adeguata." },
    ];

export const itProjectStart: FineBinderyPublicCopy["common"]["start"] = "Presenta il tuo progetto";

export const itDirectoryLabel: FineBinderyPublicCopy["nav"]["workshops"] = "Laboratori";

export const itProfileNotFound: FineBinderyPublicCopy["profile"]["notFound"] = "Laboratorio non trovato";
