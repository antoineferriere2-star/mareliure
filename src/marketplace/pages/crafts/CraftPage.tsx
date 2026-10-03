/**
 * Une page par besoin (Réparer, Restaurer, Relier, Embellir, Transformer,
 * Protéger), dans la direction « La table d'atelier ».
 *
 * Même grammaire que l'accueil : héros à parts égales avec une planche, puis
 * des chapitres ouverts par le double filet. Le seul bouton est celui de la
 * Mission (« Présenter mon livre ») ; tout le reste renvoie au site.
 */
import { IntakeCta, LandingFooter, LandingHeader, SectionHead, SHELL } from "@/marketplace/pages/landing/LandingChrome";
import { Plate } from "@/marketplace/pages/landing/Plate";
import { CRAFTS } from "@/marketplace/pages/landing/content";
import { WORK_ITEMS } from "@/marketplace/pricing/catalog";
import {
  FERRIERE_EDITORIAL_CRAFT_KEYS,
  FERRIERE_SERVICE_PHOTO_CREDIT,
  FERRIERE_SERVICE_PHOTO_SOURCE,
  ferriereServicePhoto,
} from "@/marketplace/pages/pricing/ferriereServiceIllustrations";
import { PRICE_FACTOR_DETAILS } from "@/marketplace/pages/pricing/priceFactors";
import { CRAFT_PAGES, craftFaq, craftPage, type CraftSlug } from "./craftPages";

export function CraftPage({ slug }: { slug: CraftSlug }) {
  const page = craftPage(slug);
  const craft = CRAFTS[page.craftIndex];
  // La planche du héros est la première de la série : la grille ne la répète pas.
  const heroKey = FERRIERE_EDITORIAL_CRAFT_KEYS[page.craftIndex];
  const hero = ferriereServicePhoto(heroKey);
  const heroItem = WORK_ITEMS.find((candidate) => candidate.key === heroKey)!;
  const items = page.itemKeys
    .filter((key) => key !== heroKey)
    .map((key) => ({ key, item: WORK_ITEMS.find((candidate) => candidate.key === key)! }));
  const factors = page.priceFactorTitles.map((title) => PRICE_FACTOR_DETAILS.find((factor) => factor.title === title)!);
  const others = CRAFT_PAGES.filter((other) => other.slug !== slug);

  return (
    <div id="top" className="mr-site min-h-screen bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main id="contenu">
        <section className={`${SHELL} pt-8 pb-14 sm:pt-12 sm:pb-20 lg:pb-24`}>
          <nav aria-label="Fil d’Ariane" className="mr-small text-mr-muted">
            <ol className="flex flex-wrap items-center gap-x-2">
              <li>
                <a href="/" className="mr-tap underline-offset-4 hover:text-mr-ink hover:underline">Accueil</a>
              </li>
              <li aria-hidden="true">›</li>
              <li>
                <a href="/#savoir-faire" className="mr-tap underline-offset-4 hover:text-mr-ink hover:underline">Les savoir-faire</a>
              </li>
              <li aria-hidden="true">›</li>
              <li aria-current="page" className="text-mr-ink">{craft.title}</li>
            </ol>
          </nav>
          <div className="mt-8 grid items-end gap-10 lg:mt-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-6 lg:pb-8">
              <p className="mr-eyebrow">Les savoir-faire · {craft.title}</p>
              <h1 className="mr-display mt-6 text-mr-ink">{page.h1}</h1>
              <p className="mr-lead mt-7 max-w-[34rem]">{page.intro}</p>
              <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
                <IntakeCta />
                <a href="#prestations" className="mr-link mr-tap text-[1.0625rem]">Voir les prestations</a>
              </div>
            </div>
            <Plate
              className="lg:col-span-6"
              photo={hero}
              sizes="(min-width: 1024px) 560px, 100vw"
              priority
              number={1}
              alt=""
              caption={heroItem.label}
              credit={FERRIERE_SERVICE_PHOTO_CREDIT}
            />
          </div>
        </section>

        <section id="prestations" className="scroll-mt-36 bg-mr-paper-warm lg:scroll-mt-28">
          <div className={`${SHELL} py-section-sm sm:py-section`}>
            <SectionHead
              folio="I"
              eyebrow="Les prestations"
              title={`Ce que recouvre « ${craft.title.toLowerCase()} ».`}
              lead={craft.detail}
            />
            <ul className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
              {items.map(({ key, item }, index) => (
                <li key={key}>
                  <Plate
                    photo={ferriereServicePhoto(key)}
                    sizes="(min-width: 1024px) 290px, (min-width: 640px) 50vw, 100vw"
                    tight
                    number={index + 2}
                    alt=""
                    caption={item.label}
                  />
                  {item.hint && <p className="mr-small mt-2">{item.hint}</p>}
                </li>
              ))}
            </ul>
            <p className="mr-meta mt-10">
              Réalisations et photographies :{" "}
              <a className="mr-link" href={FERRIERE_SERVICE_PHOTO_SOURCE}>{FERRIERE_SERVICE_PHOTO_CREDIT}</a>, reproduites avec son
              autorisation. Elles montrent le travail d’un atelier ; elles ne sont pas des projets passés par Ma Reliure.
            </p>
          </div>
        </section>

        <section className={`${SHELL} py-section-sm sm:py-section`}>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-5">
              <SectionHead folio="II" eyebrow="Le prix" title="Un prix expliqué, annoncé avant engagement." />
              <p className="mr-body mt-6">
                Nous ne publions pas de grille : elle donnerait un chiffre faux à la plupart des livres. Nous regardons
                le vôtre, puis nous vous proposons un prix ; il ne devient ferme qu’une fois confirmé.
              </p>
              <a href="/tarifs" className="mr-link mr-tap mt-6 text-[1.0625rem]">Comprendre nos tarifs</a>
            </div>
            <dl className="lg:col-span-7 lg:pt-14">
              {factors.map((factor) => (
                <div key={factor.title} className="border-t border-mr-rule py-6">
                  <dt className="mr-heading text-mr-ink">{factor.title}</dt>
                  <dd className="mr-body mt-2">{factor.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="bg-mr-paper-warm">
          <div className={`${SHELL} py-section-sm sm:py-section`}>
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-5">
                <SectionHead folio="III" eyebrow="Questions fréquentes" title="Avant de présenter votre livre." />
              </div>
              <div className="divide-y divide-mr-rule-strong border-y border-mr-rule-strong lg:col-span-7 lg:mt-14">
                {craftFaq(page).map((item) => (
                  <details key={item.question} className="group py-5">
                    <summary className="mr-body flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-mr-ink [&::-webkit-details-marker]:hidden">
                      {item.question}
                      <span aria-hidden="true" className="text-mr-bordeaux transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="mr-body mt-3 max-w-[40rem]">{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={`${SHELL} py-section-sm sm:py-section`}>
          <div className="mx-auto max-w-[40rem] text-center">
            <h2 className="mr-title text-mr-ink">Présentez votre livre.</h2>
            <p className="mr-lead mx-auto mt-5 max-w-[32rem]">
              Quelques minutes, quelques photos. Vous connaîtrez le prix avant de vous engager.
            </p>
            <div className="mt-9">
              <IntakeCta />
            </div>
          </div>
          <nav aria-label="Les autres savoir-faire" className="mt-16 border-t border-mr-rule pt-8">
            <p className="mr-eyebrow">Les autres savoir-faire</p>
            <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              {others.map((other) => (
                <li key={other.slug}>
                  <a href={other.path} className="mr-link mr-tap text-[1.0625rem]">{other.h1}</a>
                </li>
              ))}
            </ul>
          </nav>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
