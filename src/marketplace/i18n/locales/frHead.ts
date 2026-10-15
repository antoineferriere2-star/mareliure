import type { FineBinderyPublicCopy } from "./types";

export const frSeo: FineBinderyPublicCopy["seo"] = {
    homeTitle: "Fine Bindery — Reliure et conservation du livre en Europe",
    homeDescription: "Découvrez des relieurs et des restaurateurs de talent, présentez votre projet et travaillez avec le bon atelier. Le réseau ouvre en France.",
    directoryTitle: "Relieurs et restaurateurs de livres — Fine Bindery",
    directoryDescription: "Parcourez des ateliers indépendants de reliure, restauration, conservation et dorure, et présentez votre projet directement à l’un d’eux.",
    profileTitle: (w) => `${w} — Reliure et restauration | Fine Bindery`,
    profileDescription: (w, c) => `Découvrez ${w}, atelier indépendant de reliure et de conservation à ${c}.`,
  };

export const frHomeFaq: FineBinderyPublicCopy["home"]["faq"] = [
      { question: "Puis-je contacter un atelier directement ?", answer: "Oui. Un projet présenté depuis la page d’un atelier arrive directement dans cet atelier." },
      { question: "Qui me vend la prestation et qui me facture ?", answer: "Cela dépend de votre point de départ. Un projet présenté depuis la page d’un atelier fait de cet atelier votre vendeur : il vous adresse son devis et vous facture. Un projet présenté à Fine Bindery est vendu par OPPE SAS sous la marque Fine Bindery, qui choisit l’atelier, émet le devis et la facture et encaisse ; l’atelier facture alors OPPE SAS, jamais vous." },
      { question: "Comment les ateliers sont-ils choisis ?", answer: "Fine Bindery relit chaque atelier avant de publier sa page : ses savoir-faire, son parcours et le type de travail qu’il souhaite recevoir. Il n’y a ni classement, ni mise en avant payante." },
      { question: "Dois-je parler la langue de l’atelier ?", answer: "Non. Chaque atelier indique les langues qu’il parle, et Fine Bindery reste votre interlocuteur quand vous nous présentez un projet." },
      { question: "Le transport est-il inclus ?", answer: "Non. Il est chiffré à part, selon la destination, la valeur du livre et le soin qu’il demande." },
      { question: "Peut-on confier un livre ancien ou précieux ?", answer: "Oui, après une étude individuelle et avec une logistique adaptée." },
    ];

export const frProjectStart: FineBinderyPublicCopy["common"]["start"] = "Présenter mon projet";

export const frDirectoryLabel: FineBinderyPublicCopy["nav"]["workshops"] = "Ateliers";

export const frProfileNotFound: FineBinderyPublicCopy["profile"]["notFound"] = "Atelier introuvable";
