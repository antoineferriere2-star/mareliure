import type { FineBinderyDisciplineCopy } from "./types";

/**
 * Le texte que les quatre pages de savoir-faire (fine-binding, book-restoration…)
 * lisaient dans l'ancien accueil. Ces pages ne sont pas touchées par la refonte
 * des vitrines du 22 novembre 2026 : leur sort est décidé à part.
 */
export const FINE_BINDERY_DISCIPLINE_COPY: Record<"en" | "fr" | "de" | "it" | "es", FineBinderyDisciplineCopy> = {
  en: {
    journeyEyebrow: "How a project unfolds", journeyTitle: "From the first photograph to the book’s return.", journeySteps: ["Present your book", "Receive a proposal", "The right atelier confirms", "Your book travels to the atelier", "Follow the work", "Your book comes home"],
    offersEyebrow: "Disciplines", offersTitle: "The work of the network.", photoCredit: "Photographs", offers: [
      { title: "Fine binding", body: "Traditional and contemporary bindings in leather, cloth and fine papers." },
      { title: "Restoration & conservation", body: "Careful work on old, valuable and meaningful books, respecting their history." },
      { title: "Collector rebinding", body: "A favourite or collectible edition, made into a unique object." },
      { title: "Bespoke commissions", body: "One-off bindings, family books, presentation copies, boxes and slipcases." },
    ],
    discover: "Discover the ateliers",
    shippingEyebrow: "Shipping", shippingTitle: "A journey adapted to the book.", shippingLead: "The journey is organised according to the nature and value of the book, and quoted separately from the work itself.",
  },
  fr: {
    journeyEyebrow: "Le déroulé d’un projet", journeyTitle: "De la première photographie au retour du livre.", journeySteps: ["Présentez votre livre", "Recevez une proposition", "Le bon atelier confirme", "Votre livre rejoint l’atelier", "Suivez le travail", "Votre livre revient chez vous"],
    offersEyebrow: "Savoir-faire", offersTitle: "Le travail du réseau.", photoCredit: "Photographies", offers: [
      { title: "Reliure d’art", body: "Reliures traditionnelles et contemporaines, en cuir, en toile et en papiers choisis." },
      { title: "Restauration et conservation", body: "Un travail attentif sur des livres anciens, précieux ou chers, dans le respect de leur histoire." },
      { title: "Reliure de collection", body: "Une édition aimée ou recherchée, devenue pièce unique." },
      { title: "Créations sur mesure", body: "Reliures uniques, livres de famille, exemplaires de présentation, boîtes et étuis." },
    ],
    discover: "Découvrir les ateliers",
    shippingEyebrow: "Transport", shippingTitle: "Un trajet adapté au livre.", shippingLead: "Le trajet est organisé selon la nature et la valeur du livre, et chiffré à part du travail lui-même.",
  },
  de: {
    journeyEyebrow: "Der Ablauf eines Projekts", journeyTitle: "Vom ersten Foto bis zur Rückkehr des Buches.", journeySteps: ["Buch vorstellen", "Vorschlag erhalten", "Die passende Werkstatt bestätigt", "Das Buch reist zur Werkstatt", "Die Arbeit verfolgen", "Das Buch kehrt zurück"],
    offersEyebrow: "Fachgebiete", offersTitle: "Die Arbeit des Netzwerks.", photoCredit: "Fotografien", offers: [
      { title: "Handeinband", body: "Traditionelle und zeitgenössische Einbände aus Leder, Gewebe und ausgewählten Papieren." },
      { title: "Restaurierung und Konservierung", body: "Sorgfältige Arbeit an alten, wertvollen und persönlich bedeutsamen Büchern – mit Respekt vor ihrer Geschichte." },
      { title: "Neueinband für Sammler", body: "Eine geliebte oder gesuchte Ausgabe als Unikat." },
      { title: "Individuelle Anfertigungen", body: "Unikate, Familienbücher, Präsentationsexemplare, Kassetten und Schuber." },
    ],
    discover: "Werkstätten entdecken",
    shippingEyebrow: "Versand", shippingTitle: "Ein Weg, der zum Buch passt.", shippingLead: "Der Weg wird nach Art und Wert des Buches organisiert und getrennt von der Arbeit selbst berechnet.",
  },
  it: {
    journeyEyebrow: "Come si svolge un progetto", journeyTitle: "Dalla prima fotografia al ritorno del libro.", journeySteps: ["Presenta il tuo libro", "Ricevi una proposta", "Il laboratorio giusto conferma", "Il libro raggiunge il laboratorio", "Segui il lavoro", "Il libro torna a casa"],
    offersEyebrow: "Competenze", offersTitle: "Il lavoro della rete.", photoCredit: "Fotografie", offers: [
      { title: "Legatoria d’arte", body: "Legature tradizionali e contemporanee in pelle, tela e carte scelte." },
      { title: "Restauro e conservazione", body: "Un lavoro attento su libri antichi, preziosi o cari, nel rispetto della loro storia." },
      { title: "Legatura da collezione", body: "Un’edizione amata o ricercata, trasformata in un pezzo unico." },
      { title: "Creazioni su misura", body: "Legature uniche, libri di famiglia, copie di presentazione, scatole e custodie." },
    ],
    discover: "Scopri i laboratori",
    shippingEyebrow: "Spedizione", shippingTitle: "Un viaggio adatto al libro.", shippingLead: "Il viaggio è organizzato secondo la natura e il valore del libro, e preventivato a parte rispetto al lavoro.",
  },
  es: {
    journeyEyebrow: "Cómo avanza un proyecto", journeyTitle: "De la primera fotografía al regreso del libro.", journeySteps: ["Presenta tu libro", "Recibe una propuesta", "El taller adecuado confirma", "Tu libro viaja al taller", "Sigue el trabajo", "Tu libro vuelve a casa"],
    offersEyebrow: "Oficios", offersTitle: "El trabajo de la red.", photoCredit: "Fotografías", offers: [
      { title: "Encuadernación artística", body: "Encuadernaciones tradicionales y contemporáneas en piel, tela y papeles escogidos." },
      { title: "Restauración y conservación", body: "Un trabajo cuidadoso sobre libros antiguos, valiosos o queridos, respetando su historia." },
      { title: "Encuadernación de colección", body: "Una edición querida o buscada, convertida en pieza única." },
      { title: "Creaciones a medida", body: "Encuadernaciones únicas, libros de familia, ejemplares de presentación, cajas y estuches." },
    ],
    discover: "Descubre los talleres",
    shippingEyebrow: "Envío", shippingTitle: "Un trayecto adaptado al libro.", shippingLead: "El trayecto se organiza según la naturaleza y el valor del libro, y se presupuesta aparte del trabajo.",
  },
};
