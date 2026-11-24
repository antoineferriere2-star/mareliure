import type { FineBinderyPublicCopy } from "./types";
import { FINE_BINDERY_HOME } from "./homeCopy";

export const deSeo: FineBinderyPublicCopy["seo"] = {
    homeTitle: "Fine Bindery — Software für Angebote und Rechnungen für Buchbinder",
    homeDescription: "Fine Bindery ist die Software für Angebote und Rechnungen von Buchbindern und Restaurierungswerkstätten: Angebote, Rechnungen, Gutschriften und Zahlungen an einem Ort. Sie werden direkt von Ihren Kunden bezahlt.",
    directoryTitle: "Buchbinder und Buchrestauratoren — Fine Bindery",
    directoryDescription: "Entdecken Sie unabhängige Werkstätten für Buchbinderei, Restaurierung, Konservierung und Vergoldung und stellen Sie Ihr Projekt direkt einer von ihnen vor.",
    profileTitle: (w) => `${w} — Buchbinderei und Restaurierung | Fine Bindery`,
    profileDescription: (w, c) => `Entdecken Sie ${w}, eine unabhängige Werkstatt für Buchbinderei und Restaurierung in ${c}.`,
  };

export const deHomeFaq: FineBinderyPublicCopy["home"]["faq"] = FINE_BINDERY_HOME.de.faq;

export const deProjectStart: FineBinderyPublicCopy["common"]["start"] = "Projekt vorstellen";

export const deDirectoryLabel: FineBinderyPublicCopy["nav"]["workshops"] = "Werkstätten";

export const deProfileNotFound: FineBinderyPublicCopy["profile"]["notFound"] = "Werkstatt nicht gefunden";
