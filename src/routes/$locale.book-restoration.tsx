import { createFileRoute, notFound } from "@tanstack/react-router";
import { FineBinderyDisciplinePage } from "@/marketplace/pages/fineBindery/FineBinderyDisciplinePage";
import { fineBinderyDisciplineHead } from "@/marketplace/pages/fineBindery/disciplineHead";
import { isFineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";

/** Page par discipline de Fine Bindery (voir disciplines.ts) ; chemin statique, prioritaire sur /$locale/$slug. */
export const Route = createFileRoute("/$locale/book-restoration")({
  beforeLoad: ({ params }) => { if (!isFineBinderyLocale(params.locale)) throw notFound(); },
  head: ({ params }) => (isFineBinderyLocale(params.locale) ? fineBinderyDisciplineHead(params.locale, "book-restoration") : {}),
  component: LocalizedDiscipline,
});

function LocalizedDiscipline() {
  const { locale } = Route.useParams();
  return isFineBinderyLocale(locale) ? <FineBinderyDisciplinePage locale={locale} slug="book-restoration" /> : null;
}
