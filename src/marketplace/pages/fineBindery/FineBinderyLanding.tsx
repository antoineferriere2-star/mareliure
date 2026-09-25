import { SectionHead, SHELL } from "@/marketplace/pages/landing/LandingChrome";
import { Photograph } from "@/marketplace/pages/landing/Photograph";
import { PHOTO_SIZES } from "@/marketplace/pages/landing/photos";
import { ActionLink } from "@/marketplace/pages/landing/actions";
import { usePageViewTracking } from "@/build/pages/public/usePageViewTracking";
import { FineBinderyFooter, FineBinderyHeader, FineBinderyIntakeCta } from "./FineBinderyChrome";
import { FEATURED_WORKSHOP } from "./content";
import { fineBinderyCopy } from "@/marketplace/i18n/fineBinderyCopy";
import { ENGINE_LOCALE, fineBinderyDirectoryPath, type FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { specialtyName } from "@/marketplace/i18n/fineBinderyGlossary";
import { useFineBinderyDocumentLocale } from "@/marketplace/i18n/FineBinderyLanguageSwitch";
import {
  FERRIERE_FINE_BINDERY_OFFER_KEYS,
  FERRIERE_SERVICE_PHOTO_CREDIT,
  FERRIERE_SERVICE_PHOTO_SOURCE,
  ferriereServicePhoto,
} from "@/marketplace/pages/pricing/ferriereServiceIllustrations";

type Copy = ReturnType<typeof fineBinderyCopy>;

/**
 * L'accueil Fine Bindery : le réseau d'abord (annuaire), le projet présenté
 * ensuite. Rien d'inventé — un seul atelier réel, et le réseau dit qu'il
 * ouvre en France plutôt que de laisser croire à une Europe déjà couverte.
 */
export function FineBinderyLandingPage({ locale = "en" }: { locale?: FineBinderyLocale }) {
  const copy = fineBinderyCopy(locale); useFineBinderyDocumentLocale(locale); usePageViewTracking(ENGINE_LOCALE[locale]);
  return <div className="mr-site fb-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite"><FineBinderyHeader locale={locale} /><main id="top">
    <Hero copy={copy} locale={locale} />
    <Disciplines copy={copy} />
    <Paths copy={copy} locale={locale} />
    <HowItWorks copy={copy} />
    <Workshops copy={copy} locale={locale} />
    <Trust copy={copy} />
    <ShippingFaq copy={copy} />
    <FinalCta copy={copy} locale={locale} />
  </main><FineBinderyFooter locale={locale} /></div>;
}

function Hero({ copy, locale }: { copy: Copy; locale: FineBinderyLocale }) {
  return <section className={`${SHELL} pt-16 pb-14 text-center sm:pt-24 sm:pb-20 lg:pt-28`}>
    <p className="mr-eyebrow text-mr-bordeaux [text-wrap:balance]">{copy.home.eyebrow}</p>
    <h1 className="mr-display mx-auto mt-7 text-mr-ink">{copy.home.title}</h1>
    <span aria-hidden="true" className="mx-auto mt-9 block h-px w-12 bg-mr-bordeaux" />
    <p className="mr-lead mx-auto mt-9 max-w-[38rem]">{copy.home.lead}</p>
    <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
      <ActionLink href={fineBinderyDirectoryPath(locale)}>{copy.home.discover}</ActionLink>
      <FineBinderyIntakeCta locale={locale} variant="outline" />
    </div>
    <p className="mr-small mx-auto mt-9 max-w-[40rem] text-mr-muted [text-wrap:balance]">{copy.home.proof}</p>
  </section>;
}

function Disciplines({ copy }: { copy: Copy }) {
  return <section id="offers" className="scroll-mt-32 border-t border-mr-rule"><div className={`${SHELL} py-section-sm sm:py-section`}>
    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4"><SectionHead eyebrow={copy.home.offersEyebrow} title={copy.home.offersTitle} /><p className="mr-meta">{copy.home.photoCredit} · <a className="mr-link" href={FERRIERE_SERVICE_PHOTO_SOURCE}>{FERRIERE_SERVICE_PHOTO_CREDIT}</a></p></div>
    <ul className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">{copy.home.offers.map((item, index) => {
      const photo = ferriereServicePhoto(FERRIERE_FINE_BINDERY_OFFER_KEYS[index]);
      return <li key={item.title}><img src={photo.src} srcSet={photo.srcSet} sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw" width={640} height={800} alt="" loading="lazy" decoding="async" className="aspect-[4/5] w-full bg-mr-paper-deep object-cover" /><h3 className="mr-heading mt-5 text-mr-ink">{item.title}</h3><p className="mr-body mt-2">{item.body}</p></li>;
    })}</ul>
  </div></section>;
}

function Paths({ copy, locale }: { copy: Copy; locale: FineBinderyLocale }) {
  const [browse, present] = copy.home.paths;
  return <section className="bg-mr-paper-warm"><div className={`${SHELL} py-section-sm sm:py-section`}>
    <SectionHead eyebrow={copy.home.pathsEyebrow} title={copy.home.pathsTitle} />
    <div className="mt-12 grid gap-px border border-mr-rule bg-mr-rule md:grid-cols-2">
      {[browse, present].map((path, index) => <article key={path.title} className="flex flex-col bg-mr-paper p-7 sm:p-10">
        <span className="mr-meta">{String(index + 1).padStart(2, "0")}</span>
        <h3 className="mr-title mt-4 text-[1.75rem] text-mr-ink sm:text-[2rem]">{path.title}</h3>
        <p className="mr-body mt-4 max-w-[32rem] flex-1">{path.body}</p>
        <div className="mt-8">{index === 0 ? <ActionLink href={fineBinderyDirectoryPath(locale)}>{path.cta}</ActionLink> : <FineBinderyIntakeCta locale={locale} variant="outline" label={path.cta} />}</div>
      </article>)}
    </div>
  </div></section>;
}

function HowItWorks({ copy }: { copy: Copy }) {
  return <section id="how-it-works" className="scroll-mt-32"><div className={`${SHELL} py-section-sm sm:py-section`}>
    <SectionHead eyebrow={copy.home.howEyebrow} title={copy.home.howTitle} />
    <ol className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">{copy.home.steps.map((title, index) => <li key={title} className="flex gap-5 border-t border-mr-rule-strong pt-5"><span className="mr-title text-[1.5rem] leading-none text-mr-bordeaux">{index + 1}</span><p className="mr-heading text-mr-ink">{title}</p></li>)}</ol>
  </div></section>;
}

function Workshops({ copy, locale }: { copy: Copy; locale: FineBinderyLocale }) {
  const w = FEATURED_WORKSHOP;
  return <section id="workshops" className="scroll-mt-32 bg-mr-paper-warm"><div className={`${SHELL} py-section-sm sm:py-section`}>
    <SectionHead eyebrow={copy.home.workshopsEyebrow} title={copy.home.workshopsTitle} lead={copy.home.workshopsLead} />
    <div className="mt-12 grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
      <div className="lg:col-span-7">{w.image ? <Photograph photo={w.image} sizes={PHOTO_SIZES.artisan} ratio="landscape" alt={w.imageAlt ?? w.name} /> : null}</div>
      <div className="lg:col-span-5">
        <p className="mr-eyebrow text-mr-bordeaux">{w.city}, {copy.common.france}</p>
        <h3 className="mr-title mt-3 text-mr-ink">{w.name}</h3>
        <p className="mr-small mt-2">{w.artisan}{w.since ? ` — ${copy.home.established} ${w.since}` : ""}</p>
        <p className="mr-body mt-6">{w.specialties.map((value) => specialtyName(value.toLowerCase().replaceAll(" ", "_"), locale)).join(" · ")}</p>
        <p className="mr-small mt-6 text-mr-muted">{copy.home.selected}</p>
        <a href={fineBinderyDirectoryPath(locale)} className="mr-link mr-tap mt-7 text-[1.0625rem]">{copy.home.discoverWorkshops}</a>
      </div>
    </div>
    <p className="mr-body mt-14 max-w-[46rem] border-l-2 border-mr-bordeaux pl-5 text-mr-ink">{copy.home.networkNote}</p>
  </div></section>;
}

function Trust({ copy }: { copy: Copy }) {
  return <section className="bg-mr-umber text-mr-paper"><div className={`${SHELL} py-section sm:py-section-lg`}>
    <SectionHead eyebrow={copy.home.trustEyebrow} title={copy.home.trustTitle} tone="paper" />
    <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{copy.home.trust.map((title) => <li key={title} className="border-t border-mr-paper/25 pt-5"><p className="mr-heading text-mr-paper">{title}</p></li>)}</ul>
  </div></section>;
}

function ShippingFaq({ copy }: { copy: Copy }) {
  return <section id="faq" className="scroll-mt-32"><div className={`${SHELL} grid gap-12 py-section-sm sm:py-section lg:grid-cols-12 lg:gap-16`}>
    <div className="lg:col-span-5"><SectionHead eyebrow={copy.home.faqEyebrow} title={copy.home.faqTitle} /><div className="mt-10 border-t border-mr-rule-strong pt-6"><p className="mr-eyebrow">{copy.home.shippingEyebrow}</p><h3 className="mr-heading mt-3 text-mr-ink">{copy.home.shippingTitle}</h3><p className="mr-body mt-2">{copy.home.shippingLead}</p></div></div>
    <div className="divide-y divide-mr-rule-strong border-y border-mr-rule-strong lg:col-span-7">{copy.home.faq.map((item) => <details key={item.question} className="group py-5"><summary className="mr-body flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-mr-ink [&::-webkit-details-marker]:hidden">{item.question}<span aria-hidden="true" className="text-mr-bordeaux transition-transform group-open:rotate-45">+</span></summary><p className="mr-body mt-3 max-w-[38rem]">{item.answer}</p></details>)}</div>
  </div></section>;
}

function FinalCta({ copy, locale }: { copy: Copy; locale: FineBinderyLocale }) {
  return <section className="border-t border-mr-rule bg-mr-paper-warm"><div className={`${SHELL} py-section-sm text-center sm:py-section`}>
    <h2 className="mr-title mx-auto max-w-[34rem] text-mr-ink">{copy.home.finalTitle}</h2>
    <p className="mr-lead mx-auto mt-5 max-w-[36rem]">{copy.home.finalLead}</p>
    <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4"><ActionLink href={fineBinderyDirectoryPath(locale)}>{copy.home.discover}</ActionLink><FineBinderyIntakeCta locale={locale} variant="outline" /></div>
  </div></section>;
}
