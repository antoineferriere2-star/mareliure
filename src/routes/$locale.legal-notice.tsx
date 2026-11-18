import { createFileRoute, notFound } from "@tanstack/react-router";
import { isFineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { fineBinderyLocalizedHead } from "@/marketplace/i18n/fineBinderySeo";
import { fineBinderyLegalMeta } from "@/marketplace/legal/fineBinderyLegalCopy";
import { FineBinderyLegalPage } from "@/marketplace/pages/legal/FineBinderyLegalPage";
export const Route = createFileRoute("/$locale/legal-notice")({
  beforeLoad: ({ params }) => {
    if (!isFineBinderyLocale(params.locale)) throw notFound();
  },
  head: ({ params }) => {
    if (!isFineBinderyLocale(params.locale)) return {};
    const page = fineBinderyLegalMeta(params.locale, "legal-notice");
    return fineBinderyLocalizedHead(params.locale, {
      title: `${page.title} — Fine Bindery`,
      description: page.description,
      pathWithoutLocale: "legal-notice",
    });
  },
  component: LegalPage,
});
function LegalPage() {
  const { locale } = Route.useParams();
  return isFineBinderyLocale(locale) ? (
    <FineBinderyLegalPage locale={locale} slug="legal-notice" />
  ) : null;
}
