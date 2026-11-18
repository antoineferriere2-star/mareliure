import { Fragment, type ReactNode } from "react";
import {
  LegalLayout,
  LegalNoticePage,
  PrivacyPage,
  TermsPage,
  TermsOfSalePage,
} from "./LegalPages";
import { ENGINE_LOCALE, type FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { useFineBinderyDocumentLocale } from "@/marketplace/i18n/FineBinderyLanguageSwitch";
import {
  FINE_BINDERY_LEGAL_SLUGS,
  fineBinderyLegalPath,
  type FineBinderyLegalSlug,
} from "@/marketplace/legal/fineBinderyLegalPaths";
import {
  FINE_BINDERY_LEGAL_TRANSLATIONS,
  type TranslatedLegalLocale,
} from "@/marketplace/legal/fineBinderyLegalTranslations";
import {
  MARELIURE_PUBLISHER as publisher,
  MARELIURE_PROVIDERS as providers,
  MARELIURE_CONTACT_EMAIL,
  SUMMARY_LINK_VALIDITY_DAYS,
  LEGAL_REVIEW_NOTE_FR,
  MEDIATOR_PENDING_NOTE_FR,
  formatLegalPagesUpdatedAt,
} from "@/marketplace/legal/legalEntity";

const REVIEW: Record<TranslatedLegalLocale, string> = {
  fr: LEGAL_REVIEW_NOTE_FR,
  de: "Diese Klausel folgt üblichen Formulierungen im Fernabsatz; sie wurde noch nicht von einem Juristen für die tatsächliche Tätigkeit von OPPE SAS geprüft. LEGAL REVIEW REQUIRED vor jedem tatsächlichen Verkauf.",
  it: "Questa clausola riprende una formulazione usuale della vendita a distanza; non è ancora stata convalidata da un giurista per l’attività effettiva di OPPE SAS. LEGAL REVIEW REQUIRED prima di qualsiasi vendita reale.",
  es: "Esta cláusula sigue la redacción habitual de la venta a distancia; aún no ha sido validada por un jurista para la actividad real de OPPE SAS. LEGAL REVIEW REQUIRED antes de cualquier venta real.",
};
const MEDIATOR: Record<TranslatedLegalLocale, string> = {
  fr: MEDIATOR_PENDING_NOTE_FR,
  de: "Die zuständige Verbraucherschlichtungsstelle wurde noch nicht benannt. BLOCKED — MEDIATOR DETAILS REQUIRED: Dieser Abschnitt wird vor der Freigabe einer Zahlung um ihre Kontaktdaten ergänzt.",
  it: "Il mediatore competente per i consumatori non è ancora stato designato. BLOCKED — MEDIATOR DETAILS REQUIRED: questa sezione sarà completata con i suoi recapiti prima dell’apertura di qualsiasi pagamento.",
  es: "El mediador de consumo competente aún no ha sido designado. BLOCKED — MEDIATOR DETAILS REQUIRED: esta sección se completará con sus datos de contacto antes de abrir cualquier pago.",
};
const REGIONS: Record<TranslatedLegalLocale, string> = {
  fr: providers.dataHost.region,
  de: "Europäische Union (Irland)",
  it: "Unione europea (Irlanda)",
  es: "Unión Europea (Irlanda)",
};
const COUNTRIES: Record<TranslatedLegalLocale, string> = {
  fr: "États-Unis",
  de: "USA",
  it: "Stati Uniti",
  es: "Estados Unidos",
};

function paragraph(text: string, locale: TranslatedLegalLocale): ReactNode {
  const pages = FINE_BINDERY_LEGAL_TRANSLATIONS[locale].pages;
  const legalLink = (slug: FineBinderyLegalSlug) => (
    <a href={fineBinderyLegalPath(locale, slug)} className="mr-link">
      {pages[slug].title}
    </a>
  );
  const values: Record<string, ReactNode> = {
    ...publisher,
    form: publisher.legalForm,
    webHost: providers.webHost.name,
    webAddress: providers.webHost.address.replace("États-Unis", COUNTRIES[locale]),
    dataHost: providers.dataHost.name,
    region: REGIONS[locale],
    emailProvider: providers.email.name,
    senderDomain: providers.email.senderDomain,
    ai: providers.ai.name,
    days: SUMMARY_LINK_VALIDITY_DAYS,
    mail: (
      <a href={`mailto:${MARELIURE_CONTACT_EMAIL}`} className="mr-link">
        {MARELIURE_CONTACT_EMAIL}
      </a>
    ),
    notice: legalLink("legal-notice"),
    privacy: legalLink("privacy-policy"),
    sales: legalLink("terms-of-sale"),
    cnil: (
      <a href="https://www.cnil.fr" className="mr-link" rel="noreferrer" target="_blank">
        www.cnil.fr
      </a>
    ),
    review: REVIEW[locale],
    mediator: MEDIATOR[locale],
  };
  return text
    .split(/({{[a-zA-Z]+}})/g)
    .map((part, index) => (
      <Fragment key={index}>{part.startsWith("{{") ? values[part.slice(2, -2)] : part}</Fragment>
    ));
}

const EN_PAGES = {
  "legal-notice": LegalNoticePage,
  "privacy-policy": PrivacyPage,
  "terms-of-use": TermsPage,
  "terms-of-sale": TermsOfSalePage,
};
export function FineBinderyLegalPage({
  locale,
  slug,
}: {
  locale: FineBinderyLocale;
  slug: FineBinderyLegalSlug;
}) {
  useFineBinderyDocumentLocale(locale);
  if (locale === "en") {
    const Page = EN_PAGES[slug];
    return <Page />;
  }
  const copy = FINE_BINDERY_LEGAL_TRANSLATIONS[locale];
  const page = copy.pages[slug];
  return (
    <LegalLayout
      brand="FINE_BINDERY"
      locale={locale}
      path={fineBinderyLegalPath(locale, slug)}
      title={page.title}
      eyebrow={copy.eyebrow}
      updatedLabel={`${copy.updated} ${formatLegalPagesUpdatedAt(ENGINE_LOCALE[locale])}`}
      seeAlso={copy.seeAlso}
      otherLabel={copy.other}
      intro={page.description}
      siblingPages={FINE_BINDERY_LEGAL_SLUGS.map((key) => ({
        href: fineBinderyLegalPath(locale, key),
        label: copy.pages[key].title,
      }))}
      sections={page.sections.map((section) => ({
        heading: section.heading,
        body: section.body.map((text) => paragraph(text, locale)),
      }))}
    />
  );
}
