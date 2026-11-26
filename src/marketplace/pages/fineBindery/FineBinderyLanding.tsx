import { SectionHead, SectionRule, SHELL } from "@/marketplace/pages/landing/LandingChrome";
import { ActionLink } from "@/marketplace/pages/landing/actions";
import { usePageViewTracking } from "@/build/pages/public/usePageViewTracking";
import { FineBinderyFooter, FineBinderyHeader, FineBinderySignupCta } from "./FineBinderyChrome";
import { fineBinderyCopy } from "@/marketplace/i18n/fineBinderyCopy";
import { ENGINE_LOCALE, type FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { useFineBinderyDocumentLocale } from "@/marketplace/i18n/FineBinderyLanguageSwitch";

type Copy = ReturnType<typeof fineBinderyCopy>;

/**
 * L'accueil Fine Bindery depuis le pivot du 22 novembre 2026 : l'outil de devis
 * et de suivi des relieurs et des ateliers de restauration. Texte seul, sans
 * photographie. Le visiteur est le relieur ; son client reçoit de lui le lien du
 * parcours. Aucun tarif publié : le bloc tarifs est un emplacement.
 */
export function FineBinderyLandingPage({ locale = "en" }: { locale?: FineBinderyLocale }) {
  const copy = fineBinderyCopy(locale); useFineBinderyDocumentLocale(locale); usePageViewTracking(ENGINE_LOCALE[locale]);
  return <div className="mr-site fb-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite"><FineBinderyHeader locale={locale} /><main id="contenu">
    <Hero copy={copy} locale={locale} />
    <BeforeAfter copy={copy} />
    <HowItWorks copy={copy} />
    <Features copy={copy} />
    <Pricing copy={copy} locale={locale} />
    <Faq copy={copy} />
    <FinalCta copy={copy} locale={locale} />
  </main><FineBinderyFooter locale={locale} /></div>;
}

function Hero({ copy, locale }: { copy: Copy; locale: FineBinderyLocale }) {
  return <section className="bg-mr-umber text-mr-paper"><div className={`${SHELL} pt-14 pb-14 sm:pt-20 sm:pb-20 lg:pt-24 lg:pb-24`}>
    <div className="max-w-[46rem]">
      <p className="mr-eyebrow text-mr-paper/80 [text-wrap:balance]">{copy.home.eyebrow}</p>
      <h1 className="mr-display mt-7 text-mr-paper">{copy.home.title}</h1>
      <p className="mr-lead mt-8 max-w-[38rem] text-mr-paper/85">{copy.home.lead}</p>
      <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
        <FineBinderySignupCta locale={locale} onInk />
        <ActionLink href="#how-it-works" variant="secondary" onInk>{copy.home.secondary}</ActionLink>
      </div>
    </div>
    <ul className="mt-14 grid gap-3 border-t border-mr-paper/20 pt-6 sm:grid-cols-3 sm:gap-8">
      {copy.home.proof.map((fact) => <li key={fact} className="mr-small text-mr-paper/90">{fact}</li>)}
    </ul>
  </div></section>;
}

function BeforeAfter({ copy }: { copy: Copy }) {
  const b = copy.home.beforeAfter;
  return <section className="bg-mr-paper-warm"><div className={`${SHELL} py-section-sm sm:py-section`}>
    <SectionHead folio="I" eyebrow={b.eyebrow} title={b.title} />
    <div className="mt-12 grid gap-px border border-mr-rule bg-mr-rule md:grid-cols-2">
      <article className="bg-mr-paper p-7 sm:p-10"><p className="mr-eyebrow">{b.withoutLabel}</p><p className="mr-small mt-2 text-mr-muted">{b.withoutCaption}</p><p className="mr-body mt-6 max-w-[28rem] text-mr-ink">{b.withoutBody}</p></article>
      <article className="bg-mr-paper p-7 sm:p-10"><p className="mr-eyebrow text-mr-bordeaux">{b.withLabel}</p><p className="mr-small mt-2 text-mr-muted">{b.withCaption}</p>
        <dl className="mt-6 divide-y divide-mr-rule border-y border-mr-rule">{b.rows.map(([term, value]) => <div key={term} className="grid grid-cols-[7rem_1fr] gap-4 py-3"><dt className="mr-small text-mr-muted">{term}</dt><dd className="mr-body text-mr-ink">{value}</dd></div>)}</dl>
      </article>
    </div>
    <p className="mr-meta mt-6">{b.note}</p>
  </div></section>;
}

function HowItWorks({ copy }: { copy: Copy }) {
  return <section id="how-it-works" className="scroll-mt-32"><div className={`${SHELL} py-section-sm sm:py-section`}>
    <SectionHead folio="II" eyebrow={copy.home.howEyebrow} title={copy.home.howTitle} />
    <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8 lg:mt-16 lg:gap-12">{copy.home.steps.map((step, index) => <li key={step.title}><span className="mr-display text-[2.75rem] leading-none text-mr-bordeaux sm:text-[3.25rem]">{index + 1}</span><h3 className="mr-title mt-5 text-[1.5rem] text-mr-ink sm:text-[1.625rem]">{step.title}</h3><p className="mr-body mt-3 max-w-[24rem]">{step.body}</p></li>)}</ol>
  </div></section>;
}

function Features({ copy }: { copy: Copy }) {
  return <section id="features" className="scroll-mt-32 bg-mr-paper-warm"><div className={`${SHELL} py-section-sm sm:py-section`}>
    <SectionHead folio="III" eyebrow={copy.home.featuresEyebrow} title={copy.home.featuresTitle} />
    <dl className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">{copy.home.features.map((feature) => <div key={feature.title} className="border-t border-mr-rule-strong pt-5"><dt className="mr-heading text-mr-ink">{feature.title}</dt><dd className="mr-body mt-2">{feature.body}</dd></div>)}</dl>
  </div></section>;
}

function Pricing({ copy, locale }: { copy: Copy; locale: FineBinderyLocale }) {
  return <section id="pricing" className="scroll-mt-32"><div className={`${SHELL} py-section-sm sm:py-section`}>
    <SectionRule folio="IV" />
    <div className="mt-8 max-w-[40rem]"><SectionHead eyebrow={copy.home.pricingEyebrow} title={copy.home.pricingTitle} /><p className="mr-body mt-6">{copy.home.pricingBody}</p><ul className="mr-body mt-6 space-y-2">{copy.home.pricingIncluded.map((item) => <li key={item} className="flex gap-3"><span aria-hidden="true" className="text-mr-bordeaux">—</span>{item}</li>)}</ul><div className="mt-8"><FineBinderySignupCta locale={locale} size="compact" /></div></div>
  </div></section>;
}

function Faq({ copy }: { copy: Copy }) {
  return <section id="faq" className="scroll-mt-32 bg-mr-paper-warm"><div className={`${SHELL} py-section-sm sm:py-section`}>
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
      <div className="lg:col-span-4"><SectionHead folio="V" eyebrow={copy.home.faqEyebrow} title={copy.home.faqTitle} /></div>
      <div className="divide-y divide-mr-rule-strong border-y border-mr-rule-strong lg:col-span-8">{copy.home.faq.map((item) => <details key={item.question} className="group py-5"><summary className="mr-body flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-mr-ink [&::-webkit-details-marker]:hidden">{item.question}<span aria-hidden="true" className="text-mr-bordeaux transition-transform group-open:rotate-45">+</span></summary><p className="mr-body mt-3 max-w-[38rem]">{item.answer}</p></details>)}</div>
    </div>
  </div></section>;
}

function FinalCta({ copy, locale }: { copy: Copy; locale: FineBinderyLocale }) {
  return <section className={`${SHELL} py-section sm:py-section-lg`}><div className="mx-auto max-w-[40rem] text-center">
    <h2 className="mr-title text-mr-ink">{copy.home.finalTitle}</h2>
    <p className="mr-lead mx-auto mt-6 max-w-[32rem]">{copy.home.finalLead}</p>
    <div className="mt-9"><FineBinderySignupCta locale={locale} /></div>
    <span aria-hidden="true" className="mr-filet mx-auto mt-14 w-16 text-mr-bordeaux" />
  </div></section>;
}
