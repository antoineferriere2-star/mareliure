import type { FineBinderyPublicCopy } from "./types";

export const deSeo: FineBinderyPublicCopy["seo"] = {
    homeTitle: "Fine Bindery — Buchbinderei und Buchrestaurierung in Europa",
    homeDescription: "Entdecken Sie erfahrene Buchbinder und Restauratoren, stellen Sie Ihr Projekt vor und arbeiten Sie mit der passenden Werkstatt. Das Netzwerk startet in Frankreich.",
    directoryTitle: "Buchbinder und Buchrestauratoren — Fine Bindery",
    directoryDescription: "Entdecken Sie unabhängige Werkstätten für Buchbinderei, Restaurierung, Konservierung und Vergoldung und stellen Sie Ihr Projekt direkt einer von ihnen vor.",
    profileTitle: (w) => `${w} — Buchbinderei und Restaurierung | Fine Bindery`,
    profileDescription: (w, c) => `Entdecken Sie ${w}, eine unabhängige Werkstatt für Buchbinderei und Restaurierung in ${c}.`,
  };

export const deHomeFaq: FineBinderyPublicCopy["home"]["faq"] = [
      { question: "Kann ich eine Werkstatt direkt kontaktieren?", answer: "Ja. Ein Projekt, das Sie auf der Seite einer Werkstatt vorstellen, erreicht diese Werkstatt direkt." },
      { question: "Wer verkauft mir die Leistung und wer stellt die Rechnung?", answer: "Das hängt vom Ausgangspunkt ab. Ein Projekt, das Sie auf der Seite einer Werkstatt vorstellen, macht diese Werkstatt zu Ihrem Verkäufer: Sie sendet ihr eigenes Angebot und stellt Ihnen die Rechnung. Ein Projekt, das Sie Fine Bindery vorstellen, wird von OPPE SAS unter der Marke Fine Bindery verkauft; sie wählt die Werkstatt, erstellt Angebot und Rechnung und nimmt die Zahlung entgegen. Die Werkstatt stellt dann OPPE SAS die Rechnung, nie Ihnen." },
      { question: "Wie werden die Werkstätten ausgewählt?", answer: "Fine Bindery prüft jede Werkstatt vor der Veröffentlichung ihrer Seite: Fachgebiete, Erfahrung und die Art der Arbeiten, die sie übernehmen möchte. Es gibt weder ein Ranking noch bezahlte Platzierungen." },
      { question: "Muss ich die Sprache der Werkstatt sprechen?", answer: "Nein. Jede Werkstatt nennt die Sprachen, die sie spricht, und Fine Bindery bleibt Ihre Ansprechperson, wenn Sie uns ein Projekt vorstellen." },
      { question: "Ist der Versand enthalten?", answer: "Nein. Er wird je nach Ziel, Wert und erforderlicher Sorgfalt separat berechnet." },
      { question: "Kann ich wertvolle oder alte Bücher anvertrauen?", answer: "Ja, nach individueller Prüfung und mit geeigneter Logistik." },
    ];

export const deProjectStart: FineBinderyPublicCopy["common"]["start"] = "Projekt vorstellen";

export const deDirectoryLabel: FineBinderyPublicCopy["nav"]["workshops"] = "Werkstätten";

export const deProfileNotFound: FineBinderyPublicCopy["profile"]["notFound"] = "Werkstatt nicht gefunden";
