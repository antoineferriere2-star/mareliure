import { createFileRoute, notFound } from "@tanstack/react-router";
import { isFineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { fineBinderyLocalizedHead } from "@/marketplace/i18n/fineBinderySeo";
import { fineBinderyLegalMeta } from "@/marketplace/legal/fineBinderyLegalCopy";
import { FineBinderyLegalPage } from "@/marketplace/pages/legal/FineBinderyLegalPage";
export const Route = createFileRoute("/$locale/terms-of-use")({
  beforeLoad: ({ params }) => {
    if (!isFineBinderyLocale(params.locale)) throw notFound();
  },
  head: ({ params }) => {
    if (!isFineBinderyLocale(params.locale)) return {};
    const page = fineBinderyLegalMeta(params.locale, "terms-of-use");
    return fineBinderyLocalizedHead(params.locale, {
      title: `${page.title} — Fine Bindery`,
      description: page.description,
      pathWithoutLocale: "terms-of-use",
    });
  },
  component: LegalPage,
});
function LegalPage() {
  const { locale } = Route.useParams();
  return isFineBinderyLocale(locale) ? (
    <FineBinderyLegalPage locale={locale} slug="terms-of-use" />
  ) : null;
}
