/**
 * Fine Bindery's homepage.
 *
 * Not a translation of ReliureLanding.tsx — a different page, for a
 * different reader: someone abroad who has never dealt with a French
 * bookbinder and doesn't want to have to. Same engine underneath (the
 * "Start your project" button opens the same Guided Project Intake, at
 * Fine Bindery's own Mission — FINE_BINDERY_PUBLIC_TOKEN), same design
 * system (SHELL, SectionHead, the mr- tokens), same honesty rule: no
 * invented number, no fabricated workshop, no fake testimonial (§59).
 *
 * Sections intentionally written in the future tense, because the features
 * they describe are not live yet: the 80/20 payout split (Stripe Connect is
 * not connected — see docs/transactional-platform-audit.md) and workshop
 * showcase pages (/workshops/:slug, never built). Saying so plainly is the
 * whole point of the rule, not a hedge to work around it.
 */
import { SectionHead, SHELL } from "@/marketplace/pages/landing/LandingChrome";
import { Photograph } from "@/marketplace/pages/landing/Photograph";
import { PHOTO_SIZES } from "@/marketplace/pages/landing/photos";
import { usePageViewTracking } from "@/build/pages/public/usePageViewTracking";
import {
  FineBinderyFooter,
  FineBinderyHeader,
  FineBinderyIntakeCta,
} from "./FineBinderyChrome";
import {
  BENEFITS,
  FAQ,
  FEATURED_WORKSHOP,
  HOW_IT_WORKS,
  OFFERS,
  TRUST_POINTS,
  englishSpecialty,
} from "./content";

export function FineBinderyLandingPage() {
  usePageViewTracking("en-US");
  return (
    <div className="mr-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite">
      <FineBinderyHeader />
      <main id="top">
        <Hero />
        <Benefits />
        <Offers />
        <HowItWorks />
        <Workshops />
        <TrustBlock />
        <ShippingNote />
        <Faq />
        <FinalCta />
      </main>
      <FineBinderyFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className={`${SHELL} pt-14 pb-16 sm:pt-20 sm:pb-20 lg:pt-24 lg:pb-28`}>
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
          <p className="mr-eyebrow">Exceptional French bookbinding</p>
          <h1 className="mr-display mt-6 text-mr-ink">
            Exceptional books deserve exceptional craftsmanship.
          </h1>
          <p className="mr-lead mt-7 max-w-[34rem]">
            Entrust a book you value to selected independent bookbinders in France. Fine Bindery
            manages every step — from the first photographs to its safe return home.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
            <FineBinderyIntakeCta />
            <a href="#offers" className="mr-link mr-tap text-[1.0625rem]">
              Discover French craftsmanship
            </a>
          </div>
          <p className="mr-small mt-8 max-w-[34rem]">
            Selected French workshops <span aria-hidden="true">·</span> Worldwide service{" "}
            <span aria-hidden="true">·</span> Personal concierge
          </p>
        </div>
        <div className="lg:col-span-5">
          {FEATURED_WORKSHOP.image ? (
            <Photograph
              photo={FEATURED_WORKSHOP.image}
              sizes={PHOTO_SIZES.hero}
              ratio="landscape"
              priority
              alt={FEATURED_WORKSHOP.imageAlt ?? FEATURED_WORKSHOP.name}
            />
          ) : (
            <Photograph
              alt={FEATURED_WORKSHOP.name}
              shotBrief="A fine binding by the featured workshop, natural light."
              ratio="landscape"
            />
          )}
          <p className="mr-meta mt-3">
            Fine binding — Atelier {FEATURED_WORKSHOP.name}, {FEATURED_WORKSHOP.city}
          </p>
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  return (
    <section className="bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead
          eyebrow="Your book. The right French hands."
          title="We select the workshop according to the book, the technique and the project — never through a bidding process."
          lead="Fine Bindery works with independent French bookbinders, gilders and restorers, selected for their specific skills."
        />
        <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:mt-16">
          {BENEFITS.map((benefit, index) => (
            <div key={benefit.title} className="border-t border-mr-rule pt-5">
              <span className="mr-meta tabular-nums">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="mr-heading mt-3 text-mr-ink">{benefit.title}</h3>
              <p className="mr-body mt-2">{benefit.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Offers() {
  return (
    <section id="offers" className={`${SHELL} scroll-mt-24 py-section-sm sm:py-section`}>
      <SectionHead eyebrow="What we do" title="Four ways to entrust your book." />
      <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:mt-16">
        {OFFERS.map((offer) => (
          <div key={offer.title} className="border-t border-mr-rule-strong pt-5">
            <h3 className="mr-heading text-mr-ink">{offer.title}</h3>
            <p className="mr-body mt-2">{offer.body}</p>
            <FineBinderyIntakeCta variant="outline" size="compact" />
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead
          eyebrow="How it works"
          title="From your home to a French workshop — and back."
        />
        <ol className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
          {HOW_IT_WORKS.map((step) => (
            <li key={step.index} className="border-t border-mr-rule-strong pt-5">
              <span className="mr-meta tabular-nums">{step.index}</span>
              <p className="mr-heading mt-3 text-mr-ink">{step.title}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * §47 — real profiles or none. One workshop exists in the system today
 * (Ferrière, already shown on Ma Reliure's own landing); it is shown here
 * too rather than a placeholder grid suggesting a network that isn't built.
 */
function Workshops() {
  return (
    <section id="workshops" className={`${SHELL} scroll-mt-24 py-section-sm sm:py-section`}>
      <SectionHead
        eyebrow="Behind every book, a French artisan"
        title="Fine Bindery works with independent bookbinders, restorers and gilders across France."
        lead="Each project is entrusted according to the skills it requires."
      />
      <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-6">
          {FEATURED_WORKSHOP.image ? (
            <Photograph
              photo={FEATURED_WORKSHOP.image}
              sizes={PHOTO_SIZES.artisan}
              ratio="landscape"
              alt={FEATURED_WORKSHOP.imageAlt ?? FEATURED_WORKSHOP.name}
            />
          ) : (
            <Photograph
              alt={FEATURED_WORKSHOP.name}
              shotBrief="Portrait of the artisan at the bench, in their workshop, natural light."
              ratio="landscape"
            />
          )}
        </div>
        <div className="lg:col-span-6 lg:pt-2">
          <h3 className="mr-title text-[1.75rem] text-mr-ink">{FEATURED_WORKSHOP.name}</h3>
          <p className="mr-small mt-2">
            {FEATURED_WORKSHOP.artisan ? `${FEATURED_WORKSHOP.artisan} · ` : ""}
            {FEATURED_WORKSHOP.city}, France
            {FEATURED_WORKSHOP.since ? ` — established ${FEATURED_WORKSHOP.since}` : ""}
          </p>
          {FEATURED_WORKSHOP.specialties.length > 0 && (
            <>
              <h4 className="mr-eyebrow mt-8">Skills</h4>
              <p className="mr-body mt-3">
                {FEATURED_WORKSHOP.specialties.map(englishSpecialty).join(" · ")}
              </p>
            </>
          )}
          <p className="mr-small mt-8 text-mr-muted">Selected by Fine Bindery for this network.</p>
        </div>
      </div>
      {/* Per-workshop public pages (/workshops/:slug) don't exist yet — this
          page will link there once Phase E of the marketplace build reaches
          them, rather than pointing at a page that would 404 today. */}
    </section>
  );
}

function TrustBlock() {
  return (
    <section className="bg-mr-ink text-mr-paper">
      <div className={`${SHELL} py-section sm:py-section-lg`}>
        <SectionHead
          eyebrow="Your book travels"
          title="Your book travels. Its story does not get lost."
          tone="paper"
        />
        <ul className="mt-12 grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {TRUST_POINTS.map((point, index) => (
            <li key={point.title} className="border-t border-mr-paper/25 pt-5">
              <span className="mr-meta tabular-nums">{String(index + 1).padStart(2, "0")}</span>
              <p className="mr-heading mt-3 text-mr-paper">{point.title}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * §16-17, §49 — transport is priced separately, never bundled into the
 * service price, and the level of care depends on the book, not a flat
 * rate. Deliberately no carrier named publicly (§49: only if a real
 * partnership exists — it does not yet).
 */
function ShippingNote() {
  return (
    <section className={`${SHELL} py-section-sm sm:py-section`}>
      <SectionHead
        eyebrow="Getting your book to France"
        title="Secure international shipping, adapted to the book."
        lead="Fine Bindery organises the journey according to the nature and value of the book. Standard projects may travel with major international carriers; sensitive or heritage books require individual logistics review. Shipping is always quoted separately from the Fine Bindery service."
      />
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead eyebrow="Questions, answered" title="Before you start." />
        <div className="mt-10 max-w-[42rem] divide-y divide-mr-rule-strong lg:mt-14">
          {FAQ.map((item) => (
            <details key={item.question} className="group py-5">
              <summary className="mr-body flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-mr-ink">
                {item.question}
                <span aria-hidden="true" className="mr-meta text-mr-muted group-open:hidden">
                  +
                </span>
                <span aria-hidden="true" className="mr-meta hidden text-mr-muted group-open:inline">
                  −
                </span>
              </summary>
              <p className="mr-body mt-3 text-mr-graphite">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className={`${SHELL} py-section-sm text-center sm:py-section`}>
      <h2 className="mr-title mx-auto max-w-[32rem] text-mr-ink">
        Your book deserves the right hands.
      </h2>
      <p className="mr-lead mx-auto mt-5 max-w-[32rem]">
        From the first photographs to its return home, Fine Bindery coordinates the entire journey
        to a selected French workshop.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        <FineBinderyIntakeCta />
      </div>
      {/* A dedicated "Speak with Fine Bindery" contact path (§53) is not
          built yet — /contact is Métré Build's own form and would be the
          wrong destination for this brand. Left out rather than pointed
          somewhere misleading. */}
    </section>
  );
}
