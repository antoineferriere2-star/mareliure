/**
 * La démonstration du parcours client d'un atelier Ma Reliure : ce que voit le client derrière
 * le lien partagé, la fiche reçue par l'atelier, le devis qui en sort. Le contenu vit dans
 * landing/demonstrationContent.ts.
 */
import { LandingFooter, LandingHeader, SectionHead, SHELL, WORKSHOP_SIGNUP_HREF, WORKSHOP_SIGNUP_LABEL } from "./landing/LandingChrome";
import { ActionLink } from "./landing/actions";
import { ProductShot } from "./landing/ProductShot";
import { DEMO_BRIEF, DEMO_CLIENT_NOTES, DEMO_CLIENT_STEPS, DEMO_CTA, DEMO_HERO, DEMO_QUOTE } from "./landing/demonstrationContent";

export function DemonstrationPage() {
  return (
    <div id="top" className="mr-site min-h-screen bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main id="contenu">
        <section className={`${SHELL} py-section-sm sm:py-section`}>
          <SectionHead eyebrow={DEMO_HERO.eyebrow} title={DEMO_HERO.title} lead={DEMO_HERO.lead} />
        </section>

        <section aria-labelledby="demo-client" className={`${SHELL} border-t border-mr-rule pb-section-sm sm:pb-section`}>
          <h2 id="demo-client" className="mr-title mt-10 text-mr-ink">Ce que voit votre client</h2>
          <ol className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {DEMO_CLIENT_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span aria-hidden="true" className="mr-title text-mr-bordeaux">{index + 1}</span>
                <div>
                  <h3 className="mr-heading text-mr-ink">{step.title}</h3>
                  <p className="mr-body mt-1">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <ul className="mr-body mt-10 max-w-[44rem] space-y-2">
            {DEMO_CLIENT_NOTES.map((note) => <li key={note} className="flex gap-3"><span aria-hidden="true" className="text-mr-bordeaux">—</span>{note}</li>)}
          </ul>
        </section>

        <section className={`${SHELL} border-t border-mr-rule py-section-sm sm:py-section`}>
          <SectionHead eyebrow={DEMO_BRIEF.eyebrow} title={DEMO_BRIEF.title} lead={DEMO_BRIEF.lead} />
          <figure className="mt-10 max-w-[44rem]">
            <div className="rounded-[3px] border border-mr-rule-strong/70 bg-white p-6 sm:p-8">
              {DEMO_BRIEF.sections.map((section) => (
                <div key={section.label} className="border-b border-mr-rule py-4 first:pt-0 last:border-b-0 last:pb-0">
                  <h3 className="mr-eyebrow">{section.label}</h3>
                  <dl className="mt-2 grid gap-y-1 sm:grid-cols-[10rem_1fr]">
                    {section.rows.map(([term, value]) => (
                      <div key={term} className="contents">
                        <dt className="mr-small font-semibold text-mr-ink">{term}</dt>
                        <dd className="mr-body">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
            <figcaption className="mr-meta mt-3">{DEMO_BRIEF.disclaimer}</figcaption>
          </figure>
        </section>

        <section className={`${SHELL} border-t border-mr-rule py-section-sm sm:py-section`}>
          <SectionHead eyebrow={DEMO_QUOTE.eyebrow} title={DEMO_QUOTE.title} lead={DEMO_QUOTE.lead} />
          <ol className="mr-small mt-8 flex flex-wrap gap-x-3 gap-y-2 text-mr-ink">
            {DEMO_QUOTE.steps.map((step, index) => (
              <li key={step} className="flex items-center gap-3">
                {index > 0 && <span aria-hidden="true" className="text-mr-bordeaux">→</span>}
                <span className="font-semibold">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-10 grid gap-10 lg:grid-cols-2">
            <ProductShot shot="devis" caption={null} />
            <ProductShot shot="pdf" caption={null} />
          </div>
          <p className="mr-meta mt-4">{DEMO_QUOTE.caption}</p>
        </section>

        <section className={`${SHELL} border-t border-mr-rule py-section-sm sm:py-section`}>
          <SectionHead eyebrow="Pour commencer" title={DEMO_CTA.title} lead={DEMO_CTA.body} />
          <div className="mt-8">
            <ActionLink href={WORKSHOP_SIGNUP_HREF}>{WORKSHOP_SIGNUP_LABEL}</ActionLink>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
