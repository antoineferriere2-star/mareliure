/**
 * Une page par discipline de Fine Bindery, dans la grammaire de l'accueil : héros sur le brun du
 * cabinet avec la planche de la discipline, puis les prestations en planches, l'itinéraire d'un
 * projet, le transport et les questions — tout tiré des dictionnaires (voir disciplines.ts).
 */
import { SectionHead, SectionRule, SHELL } from "@/marketplace/pages/landing/LandingChrome";
import { Plate } from "@/marketplace/pages/landing/Plate";
import { ActionLink } from "@/marketplace/pages/landing/actions";
import { usePageViewTracking } from "@/build/pages/public/usePageViewTracking";
import { fineBinderyCopy } from "@/marketplace/i18n/fineBinderyCopy";
import { serviceName } from "@/marketplace/i18n/fineBinderyGlossary";
import { ENGINE_LOCALE, fineBinderyDirectoryPath, fineBinderyHomePath, type FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { useFineBinderyDocumentLocale } from "@/marketplace/i18n/FineBinderyLanguageSwitch";
import {
  FERRIERE_FINE_BINDERY_OFFER_KEYS,
  FERRIERE_SERVICE_PHOTO_CREDIT,
  FERRIERE_SERVICE_PHOTO_SOURCE,
  ferriereServicePhoto,
} from "@/marketplace/pages/pricing/ferriereServiceIllustrations";
import { FineBinderyFooter, FineBinderyHeader, FineBinderyIntakeCta } from "./FineBinderyChrome";
import { DISCIPLINE_LABELS, DISCIPLINES, discipline, disciplinePath, type DisciplineSlug } from "./disciplines";

const PLATE_LABEL: Record<FineBinderyLocale, string> = { en: "Pl.", fr: "Pl.", de: "Taf.", it: "Tav.", es: "Lám." };

export function FineBinderyDisciplinePage({ locale, slug }: { locale: FineBinderyLocale; slug: DisciplineSlug }) {
  const copy = fineBinderyCopy(locale); useFineBinderyDocumentLocale(locale); usePageViewTracking(ENGINE_LOCALE[locale]);
  const page = discipline(slug);
  const offer = copy.home.offers[page.offerIndex];
  const labels = DISCIPLINE_LABELS[locale];
  const heroKey = FERRIERE_FINE_BINDERY_OFFER_KEYS[page.offerIndex];
  const services = page.serviceKeys.filter((key) => key !== heroKey);
  const others = DISCIPLINES.filter((other) => other.slug !== slug);
  const crumb = "mr-tap underline-offset-4 hover:text-mr-paper hover:underline";

  return <div className="mr-site fb-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite"><FineBinderyHeader locale={locale} /><main id="contenu">
    <section className="bg-mr-umber text-mr-paper"><div className={`${SHELL} pt-10 pb-14 sm:pt-14 sm:pb-20 lg:pb-24`}>
      <nav aria-label={labels.breadcrumb} className="mr-small text-mr-paper/75">
        <ol className="flex flex-wrap items-center gap-x-2">
          <li><a href={fineBinderyHomePath(locale)} className={crumb}>Fine Bindery</a></li>
          <li aria-hidden="true">›</li>
          <li><a href={`${fineBinderyHomePath(locale)}#offers`} className={crumb}>{copy.home.offersEyebrow}</a></li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="text-mr-paper">{offer.title}</li>
        </ol>
      </nav>
      <div className="mt-8 grid gap-12 lg:mt-12 lg:grid-cols-12 lg:items-center lg:gap-16">
        <div className="lg:col-span-7">
          <p className="mr-eyebrow text-mr-paper/80">{copy.home.offersEyebrow}</p>
          <h1 className="mr-display mt-7 text-mr-paper">{offer.title}</h1>
          <p className="mr-lead mt-6 max-w-[36rem] text-mr-paper/90">{offer.body}</p>
          <p className="mr-body mt-5 max-w-[36rem] text-mr-paper/85">{page.intro[locale]}</p>
          <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
            <FineBinderyIntakeCta locale={locale} onInk />
            <ActionLink href={fineBinderyDirectoryPath(locale)} variant="secondary" onInk>{copy.home.discover}</ActionLink>
          </div>
        </div>
        <Plate className="lg:col-span-5" photo={ferriereServicePhoto(heroKey)} sizes="(min-width: 1024px) 480px, 100vw" priority mat="ink" number={1} numberLabel={PLATE_LABEL[locale]}
          alt="" caption={serviceName(heroKey, locale)} credit={FERRIERE_SERVICE_PHOTO_CREDIT} />
      </div>
    </div></section>

    <section className="bg-mr-paper-warm"><div className={`${SHELL} py-section-sm sm:py-section`}>
      <SectionHead folio="I" eyebrow={labels.coversEyebrow} title={labels.coversTitle} lead={labels.coversNote} />
      <ul className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">{services.map((key, index) =>
        <li key={key}><Plate photo={ferriereServicePhoto(key)} sizes="(min-width: 1024px) 290px, (min-width: 640px) 50vw, 100vw" tight alt="" number={index + 2} numberLabel={PLATE_LABEL[locale]} caption={serviceName(key, locale)} /></li>)}
      </ul>
      <p className="mr-meta mt-10">{copy.home.photoCredit} · <a className="mr-link" href={FERRIERE_SERVICE_PHOTO_SOURCE}>{FERRIERE_SERVICE_PHOTO_CREDIT}</a></p>
    </div></section>

    <section><div className={`${SHELL} py-section-sm sm:py-section`}>
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5"><SectionHead folio="II" eyebrow={copy.home.howEyebrow} title={copy.home.howTitle} /></div>
        <ol className="lg:col-span-7 lg:pt-14">{copy.home.steps.map((title, index) => <li key={title} className="flex items-baseline gap-6 border-b border-mr-rule py-5 first:border-t"><span className="mr-display w-10 shrink-0 text-[2.25rem] leading-none text-mr-bordeaux">{index + 1}</span><p className="mr-heading text-[1.125rem] text-mr-ink">{title}</p></li>)}</ol>
      </div>
    </div></section>

    <section className="bg-mr-paper-warm"><div className={`${SHELL} py-section-sm sm:py-section`}>
      <SectionRule folio="III" />
      <div className="mt-8 grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5"><SectionHead eyebrow={copy.home.faqEyebrow} title={copy.home.faqTitle} /><div className="mt-10 border-t border-mr-rule-strong pt-6"><p className="mr-eyebrow">{copy.home.shippingEyebrow}</p><h3 className="mr-heading mt-3 text-mr-ink">{copy.home.shippingTitle}</h3><p className="mr-body mt-2">{copy.home.shippingLead}</p></div></div>
        <div className="divide-y divide-mr-rule-strong border-y border-mr-rule-strong lg:col-span-7">{copy.home.faq.map((item) => <details key={item.question} className="group py-5"><summary className="mr-body flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-mr-ink [&::-webkit-details-marker]:hidden">{item.question}<span aria-hidden="true" className="text-mr-bordeaux transition-transform group-open:rotate-45">+</span></summary><p className="mr-body mt-3 max-w-[38rem]">{item.answer}</p></details>)}</div>
      </div>
    </div></section>

    <section className="border-t border-mr-rule"><div className={`${SHELL} py-section-sm sm:py-section`}>
      <div className="text-center">
        <h2 className="mr-title mx-auto max-w-[34rem] text-mr-ink">{copy.home.finalTitle}</h2>
        <p className="mr-lead mx-auto mt-5 max-w-[36rem]">{copy.home.finalLead}</p>
        <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4"><FineBinderyIntakeCta locale={locale} /><ActionLink href={fineBinderyDirectoryPath(locale)} variant="secondary">{copy.home.discover}</ActionLink></div>
      </div>
      <nav aria-label={labels.others} className="mt-16 border-t border-mr-rule pt-8">
        <p className="mr-eyebrow">{labels.others}</p>
        <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-3">{others.map((other) => <li key={other.slug}><a href={disciplinePath(locale, other.slug)} className="mr-link mr-tap text-[1.0625rem]">{copy.home.offers[other.offerIndex].title}</a></li>)}</ul>
      </nav>
    </div></section>
  </main><FineBinderyFooter locale={locale} /></div>;
}
