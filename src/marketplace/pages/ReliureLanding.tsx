/**
 * Le visage public de Ma Reliure : le logiciel de devis et factures des relieurs et
 * des ateliers de restauration (pivot du 22 novembre 2026).
 *
 * Le visiteur de cette page est le relieur, pas le propriétaire du livre. Le
 * client final n'arrive plus ici : il reçoit de son relieur le lien d'un
 * parcours de prise de projet (`/m/:publicToken`), qui n'a pas changé.
 *
 * Texte seul, sans photographie : chaque section dit une chose et n'affiche
 * aucun chiffre qui ne soit pas réel. Les tarifs sont un emplacement, pas une
 * grille.
 */
import { LandingFooter, LandingHeader, SectionHead, SectionRule, SHELL, FAQ_ANCHOR, FEATURES_ANCHOR, WORKSHOP_SIGNUP_HREF, WORKSHOP_SIGNUP_LABEL } from "./landing/LandingChrome";
import { ActionLink } from "./landing/actions";
import { ANCHORS } from "./landing/content";
import {
  RELIEUR_BEFORE_AFTER,
  RELIEUR_FAQ,
  RELIEUR_FEATURES,
  RELIEUR_FINAL,
  RELIEUR_HERO,
  RELIEUR_PRICING,
  RELIEUR_STEPS,
} from "./landing/relieurContent";

function SignupCta({ size = "default" }: { size?: "default" | "compact" }) {
  return (
    <ActionLink href={WORKSHOP_SIGNUP_HREF} size={size}>
      {WORKSHOP_SIGNUP_LABEL}
    </ActionLink>
  );
}

function Hero() {
  return (
    <section className={`${SHELL} pt-10 pb-14 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24`}>
      <div className="max-w-[46rem]">
        <p className="mr-eyebrow">{RELIEUR_HERO.eyebrow}</p>
        <h1 className="mr-display mt-6 text-mr-ink">{RELIEUR_HERO.title}</h1>
        <p className="mr-lead mt-7 max-w-[38rem]">{RELIEUR_HERO.lead}</p>
        <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
          <SignupCta />
          <a href={`#${ANCHORS.howItWorks}`} className="mr-link mr-tap text-[1.0625rem]">
            {RELIEUR_HERO.secondary}
          </a>
        </div>
      </div>
      <ul className="mt-14 grid gap-3 border-t border-mr-rule pt-6 sm:grid-cols-3 sm:gap-8">
        {RELIEUR_HERO.proof.map((item) => (
          <li key={item} className="mr-small text-mr-ink">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function BeforeAfter() {
  const { without, with: withTool } = RELIEUR_BEFORE_AFTER;
  return (
    <section className="bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead folio="I" eyebrow={RELIEUR_BEFORE_AFTER.eyebrow} title={RELIEUR_BEFORE_AFTER.title} />
        <div className="mt-12 grid gap-px border border-mr-rule bg-mr-rule md:grid-cols-2">
          <article className="bg-mr-paper p-7 sm:p-10">
            <p className="mr-eyebrow">{without.label}</p>
            <p className="mr-small mt-2 text-mr-muted">{without.caption}</p>
            <p className="mr-body mt-6 max-w-[28rem] text-mr-ink">{without.body}</p>
          </article>
          <article className="bg-mr-paper p-7 sm:p-10">
            <p className="mr-eyebrow text-mr-bordeaux">{withTool.label}</p>
            <p className="mr-small mt-2 text-mr-muted">{withTool.caption}</p>
            <dl className="mt-6 divide-y divide-mr-rule border-y border-mr-rule">
              {withTool.rows.map(([term, value]) => (
                <div key={term} className="grid grid-cols-[7rem_1fr] gap-4 py-3">
                  <dt className="mr-small text-mr-muted">{term}</dt>
                  <dd className="mr-body text-mr-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </article>
        </div>
        <p className="mr-meta mt-6">{RELIEUR_BEFORE_AFTER.note}</p>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id={ANCHORS.howItWorks} className={`${SHELL} scroll-mt-36 lg:scroll-mt-28 py-section-sm sm:py-section`}>
      <SectionHead folio="II" eyebrow="Comment ça marche" title="Trois étapes, du devis au règlement." />
      <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8 lg:mt-16 lg:gap-12">
        {RELIEUR_STEPS.map((step, index) => (
          <li key={step.title}>
            <span className="mr-display text-[2.75rem] leading-none text-mr-bordeaux sm:text-[3.25rem]">{index + 1}</span>
            <h3 className="mr-title mt-5 text-[1.5rem] text-mr-ink sm:text-[1.625rem]">{step.title}</h3>
            <p className="mr-body mt-3 max-w-[24rem]">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Features() {
  return (
    <section id={FEATURES_ANCHOR} className="scroll-mt-36 bg-mr-paper-warm lg:scroll-mt-28">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead folio="III" eyebrow="Fonctionnalités" title="Ce que le logiciel fait pour vous." />
        <dl className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
          {RELIEUR_FEATURES.map((feature) => (
            <div key={feature.title} className="border-t border-mr-rule-strong pt-5">
              <dt className="mr-heading text-mr-ink">{feature.title}</dt>
              <dd className="mr-body mt-2">{feature.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section className={`${SHELL} py-section-sm sm:py-section`}>
      <SectionRule folio="IV" />
      <div className="mt-8 max-w-[40rem]">
        <SectionHead eyebrow={RELIEUR_PRICING.eyebrow} title={RELIEUR_PRICING.title} />
        <p className="mr-body mt-6">{RELIEUR_PRICING.body}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
          <SignupCta size="compact" />
          <a href="/tarifs" className="mr-link mr-tap text-[1.0625rem]">
            Voir la page tarifs
          </a>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id={FAQ_ANCHOR} className="scroll-mt-36 bg-mr-paper-warm lg:scroll-mt-28">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <SectionHead folio="V" eyebrow="Questions" title="Avant de vous lancer." />
          </div>
          <div className="divide-y divide-mr-rule-strong border-y border-mr-rule-strong lg:col-span-8">
            {RELIEUR_FAQ.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="mr-body flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-mr-ink [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span aria-hidden="true" className="text-mr-bordeaux transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mr-body mt-3 max-w-[38rem]">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className={`${SHELL} py-section sm:py-section-lg`}>
      <div className="mx-auto max-w-[40rem] text-center">
        <h2 className="mr-title text-mr-ink">{RELIEUR_FINAL.title}</h2>
        <p className="mr-lead mx-auto mt-6 max-w-[32rem]">{RELIEUR_FINAL.lead}</p>
        <div className="mt-9">
          <SignupCta />
        </div>
        <span aria-hidden="true" className="mr-filet mx-auto mt-14 w-16 text-mr-bordeaux" />
      </div>
    </section>
  );
}

export function ReliureLanding() {
  return (
    <div id="top" className="mr-site min-h-screen bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main id="contenu">
        <Hero />
        <BeforeAfter />
        <HowItWorks />
        <Features />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
