import type { FineBinderyPublicCopy } from "./types";
import { FINE_BINDERY_HOME } from "./homeCopy";

export const frSeo: FineBinderyPublicCopy["seo"] = {
    homeTitle: "Fine Bindery — logiciel de devis et factures pour relieurs",
    homeDescription: "Fine Bindery est le logiciel de devis et factures des relieurs et des ateliers de restauration : devis, factures, avoirs et règlements suivis au même endroit. Vous êtes payé directement par vos clients.",
    directoryTitle: "Relieurs et restaurateurs de livres — Fine Bindery",
    directoryDescription: "Parcourez des ateliers indépendants de reliure, restauration, conservation et dorure, et présentez votre projet directement à l’un d’eux.",
    profileTitle: (w) => `${w} — Reliure et restauration | Fine Bindery`,
    profileDescription: (w, c) => `Découvrez ${w}, atelier indépendant de reliure et de conservation à ${c}.`,
  };

export const frHomeFaq: FineBinderyPublicCopy["home"]["faq"] = FINE_BINDERY_HOME.fr.faq;

export const frProjectStart: FineBinderyPublicCopy["common"]["start"] = "Présenter mon projet";

export const frDirectoryLabel: FineBinderyPublicCopy["nav"]["workshops"] = "Ateliers";

export const frProfileNotFound: FineBinderyPublicCopy["profile"]["notFound"] = "Atelier introuvable";
