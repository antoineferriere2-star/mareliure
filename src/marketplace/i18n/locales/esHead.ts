import type { FineBinderyPublicCopy } from "./types";
import { FINE_BINDERY_HOME } from "./homeCopy";

export const esSeo: FineBinderyPublicCopy["seo"] = {
    homeTitle: "Fine Bindery — software de presupuestos y facturas para encuadernadores",
    homeDescription: "Fine Bindery es el software de presupuestos y facturas de encuadernadores y talleres de restauración: presupuestos, facturas, abonos y cobros en un solo lugar. Usted cobra directamente de sus clientes.",
    directoryTitle: "Encuadernadores y restauradores de libros — Fine Bindery",
    directoryDescription: "Descubre talleres independientes de encuadernación, restauración, conservación y dorado, y presenta tu proyecto directamente a uno de ellos.",
    profileTitle: (w) => `${w} — Encuadernación y restauración | Fine Bindery`,
    profileDescription: (w, c) => `Descubre ${w}, taller independiente de encuadernación y conservación en ${c}.`,
  };

export const esHomeFaq: FineBinderyPublicCopy["home"]["faq"] = FINE_BINDERY_HOME.es.faq;

export const esProjectStart: FineBinderyPublicCopy["common"]["start"] = "Presenta tu proyecto";

export const esDirectoryLabel: FineBinderyPublicCopy["nav"]["workshops"] = "Talleres";

export const esProfileNotFound: FineBinderyPublicCopy["profile"]["notFound"] = "Taller no encontrado";
