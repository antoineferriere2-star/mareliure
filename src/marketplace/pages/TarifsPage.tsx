/**
 * La page qui répond à « combien ça coûte ? ».
 *
 * C'est la première question que se pose quelqu'un devant un livre abîmé, et
 * la recherche la plus fréquente du domaine. Elle mérite donc une vraie page —
 * mais une page qui n'invente rien.
 *
 * D'où sa forme : elle explique **comment se construit un prix** et **ce qui le
 * fait varier**, plutôt que d'annoncer des prix. C'est honnête, et c'est
 * accessoirement plus utile qu'une grille, parce qu'un visiteur qui comprend
 * que l'état du dos et la couture pèsent plus que la couleur du cuir décrit
 * mieux son projet ensuite.
 *
 * Aucune fourchette n'y figure aujourd'hui. Elle ne pourra en porter que
 * lorsque `isPublishableRange` sera vrai pour un travail — au moins trois
 * ateliers de référence — et ce sera alors une fourchette relevée, pas
 * estimée. En attendant, « sur étude » n'est pas une dérobade : c'est ce qui
 * se passe réellement.
 *
 * Typographie : le système Ma Reliure (mr-display, mr-title, mr-body…). La
 * page utilisait `font-serif`, soit la serif du système d'exploitation — un
 * Georgia gras qui n'apparaissait nulle part ailleurs sur le site.
 */
import { IntakeCta, LandingFooter, LandingHeader, SectionHead, SHELL } from "./landing/LandingChrome";
import { WORK_FAMILIES, workItemsByFamily } from "@/marketplace/pricing/catalog";
import {
  FERRIERE_SERVICE_PHOTO_CREDIT,
  FERRIERE_SERVICE_PHOTO_NUMBERS,
  FERRIERE_SERVICE_PHOTO_SOURCE,
  ferriereServicePhoto,
  ferriereSourcePhotoUrl,
  type IllustratedServiceKey,
} from "./pricing/ferriereServiceIllustrations";

interface Step {
  when: string;
  title: string;
  body: string;
}

/**
 * Comment un prix se construit, dans l'ordre où cela se passe. Le deuxième
 * temps est celui où le visiteur décide ; le troisième dit ce qui arrive si
 * le livre, une fois ouvert, révèle autre chose — sans jamais engager sans
 * son accord.
 */
const STEPS: readonly Step[] = [
  {
    when: "Vous",
    title: "Vous décrivez le livre",
    body: "Quelques photos, ses dimensions, son état et ce que vous souhaitez. Pas besoin de connaître les termes techniques : nous vous guidons.",
  },
  {
    when: "Nous",
    title: "Nous vous proposons un prix",
    body: "Un prix pour l’ensemble du travail, établi d’après ce que vos photos montrent. Vous l’acceptez ou non : rien n’est engagé avant votre accord.",
  },
  {
    when: "L’atelier",
    title: "Le prix est confirmé livre en main",
    body: "À réception, l’atelier examine le livre et vérifie la proposition établie sur photos. Aucun travail ni changement de prix n’est engagé sans votre accord préalable.",
  },
];

interface Factor {
  title: string;
  body: string;
}

/**
 * Les sept facteurs, dans l'ordre où ils pèsent réellement sur le temps de
 * travail — pas dans l'ordre où un client les remarque. L'état passe donc
 * avant la matière, ce qui est contre-intuitif et vrai : reprendre une couture
 * coûte plus cher que choisir un beau cuir.
 */
const FACTORS: readonly Factor[] = [
  {
    title: "L’état du livre",
    body: "Le premier facteur, et de loin. Un dos fendu, des cahiers désolidarisés ou des plats détachés demandent de démonter l’ouvrage avant de commencer. Un livre complet et solide qu’on habille coûte moins cher qu’un livre en morceaux qu’on remet debout.",
  },
  {
    title: "La structure à refaire",
    body: "Recoudre l’ensemble des cahiers n’a rien à voir avec en reprendre trois. C’est le travail le plus long d’un atelier, et le moins visible une fois le livre fermé.",
  },
  {
    title: "Le format",
    body: "Un in-folio ne se manipule pas comme un livre de poche : plus de matière, d’autres outils, et souvent une presse qui n’accepte qu’un ouvrage à la fois.",
  },
  {
    title: "Les matières",
    body: "Toile, papier décoré, demi-cuir, plein cuir : le coût de la matière compte, mais c’est surtout le temps de parage et de couvrure qui change d’une matière à l’autre.",
  },
  {
    title: "La dorure",
    body: "Un titre au dos, des filets, un décor composé : la dorure se compte au fer et à la ligne, posée à la main, à chaud, sans droit à l’erreur.",
  },
  {
    title: "Les finitions",
    body: "Nerfs, gardes décorées, tranches, signet, étui. Ce sont des choix, pas des obligations — et c’est là que le budget se pilote le plus facilement.",
  },
  {
    title: "La restauration",
    body: "Restaurer n’est pas relier. Un ouvrage ancien, un manuscrit ou une reliure d’époque se regardent avant de se chiffrer : le travail se décide pièce en main.",
  },
];

const INCLUDED: readonly string[] = [
  "Le travail proposé sur photos, vérifié à réception du livre. Votre accord est nécessaire avant tout travail ou changement de prix.",
  "Le choix de l’artisan dont le savoir-faire correspond à votre ouvrage.",
  "Un interlocuteur unique du début à la fin : vous ne négociez pas avec l’atelier.",
  "Aucune surprise engagée sans vous : un changement vous est expliqué avant d’être fait.",
];

export function TarifsPage() {
  return (
    <div className="mr-site min-h-screen bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main>
        <section className={`${SHELL} pt-14 pb-16 sm:pt-20 sm:pb-20 lg:pt-24`}>
          <div className="max-w-[46rem]">
            <p className="mr-eyebrow">Tarifs</p>
            <h1 className="mr-display mt-6 text-mr-ink">Combien coûte la reliure ou la restauration d’un livre ?</h1>
            <p className="mr-lead mt-7 max-w-[38rem]">
              Chaque livre est différent : son état, son format, les matériaux et le temps de travail
              font son prix. Nous ne publions donc pas de grille, qui donnerait un chiffre faux à la
              plupart des projets. Nous regardons votre livre, puis nous vous proposons un prix — avant
              tout engagement.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              <IntakeCta />
              <a href="#ce-qui-fait-le-prix" className="mr-link mr-tap text-[1.0625rem]">
                Ce qui fait le prix
              </a>
            </div>
          </div>
        </section>

        <section aria-labelledby="construction-du-prix" className="bg-mr-paper-warm">
          <div className={`${SHELL} py-section-sm sm:py-section`}>
            <SectionHead eyebrow="Votre prix, pas à pas" title={<span id="construction-du-prix">Un prix proposé, puis confirmé. Jamais imposé.</span>} />
            <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8 lg:mt-16 lg:gap-12">
              {STEPS.map((step, index) => (
                <li key={step.title} className="border-t border-mr-rule-strong pt-5">
                  <p className="flex items-baseline gap-3">
                    <span className="mr-meta tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                    <span className="text-[0.8125rem] font-semibold text-mr-bordeaux">{step.when}</span>
                  </p>
                  <h3 className="mr-title mt-4 text-[1.5rem] text-mr-ink sm:text-[1.625rem]">{step.title}</h3>
                  <p className="mr-body mt-3">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="ce-qui-fait-le-prix" className="scroll-mt-36 lg:scroll-mt-28">
          <div className={`${SHELL} py-section-sm sm:py-section`}>
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
              <SectionHead
                eyebrow="Ce qui fait le prix"
                title="Sept choses que nous regardons."
                lead="Dans l’ordre où elles pèsent sur le temps de travail — pas dans l’ordre où on les remarque."
                className="lg:sticky lg:top-32 lg:col-span-4 lg:self-start"
              />
              <dl className="grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:col-span-8">
                {FACTORS.map((factor, index) => (
                  <div key={factor.title} className="border-t border-mr-rule pt-5">
                    <dt className="flex items-baseline gap-3">
                      <span className="mr-meta tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                      <span className="mr-heading text-mr-ink">{factor.title}</span>
                    </dt>
                    <dd className="mr-body mt-2">{factor.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section aria-labelledby="service-gallery-title" className="bg-mr-paper-warm">
          <div className={`${SHELL} py-section-sm sm:py-section`}>
            <SectionHead
              eyebrow="Les prestations en images"
              title={<span id="service-gallery-title">Un repère visuel pour chacun des 45 savoir-faire.</span>}
              lead="Certaines photographies montrent l’état reçu, d’autres le geste ou le résultat. Elles aident à nommer le travail ; l’intervention exacte se décide après examen du livre."
            />
            <p className="mr-meta mt-5">
              Réalisations et photographies :{" "}
              <a className="mr-link" href={FERRIERE_SERVICE_PHOTO_SOURCE}>
                {FERRIERE_SERVICE_PHOTO_CREDIT}
              </a>
              , reproduites avec son autorisation.
            </p>

            <div className="mt-10 space-y-3 lg:mt-12">
              {WORK_FAMILIES.map((family, familyIndex) => {
                const items = workItemsByFamily(family.key);
                return (
                  <details key={family.key} open={familyIndex === 0} className="group border-t border-mr-rule-strong">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
                      <span className="flex items-baseline gap-3">
                        <span className="font-editorial text-[1.375rem] leading-tight text-mr-ink">{family.label}</span>
                        <span className="mr-meta tabular-nums">{items.length}</span>
                      </span>
                      <span aria-hidden="true" className="text-lg text-mr-muted transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <ul className="grid gap-x-6 gap-y-10 pb-10 pt-2 sm:grid-cols-2 lg:grid-cols-4">
                      {items.map((item) => {
                        const key = item.key as IllustratedServiceKey;
                        const photo = ferriereServicePhoto(key);
                        const photoNumber = FERRIERE_SERVICE_PHOTO_NUMBERS[key];
                        return (
                          <li key={item.key}>
                            <figure>
                              <img
                                src={photo.src}
                                srcSet={photo.srcSet}
                                sizes="(min-width: 1024px) 290px, (min-width: 640px) 50vw, 100vw"
                                width={640}
                                height={480}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="aspect-[4/3] w-full bg-mr-ink/5 object-cover"
                              />
                              <figcaption className="pt-4">
                                <h3 className="mr-heading text-mr-ink">{item.label}</h3>
                                {item.hint && <p className="mr-small mt-1.5">{item.hint}</p>}
                                <a href={ferriereSourcePhotoUrl(key)} className="mr-meta mr-tap underline decoration-mr-bordeaux/50 underline-offset-4">
                                  Photo n°{photoNumber} — {FERRIERE_SERVICE_PHOTO_CREDIT}
                                </a>
                              </figcaption>
                            </figure>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                );
              })}
            </div>
          </div>
        </section>

        <section className={`${SHELL} py-section-sm sm:py-section`}>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <SectionHead eyebrow="Ce que comprend le prix" title="Un prix pour tout le trajet du travail." className="lg:col-span-5" />
            <ul className="space-y-5 lg:col-span-7">
              {INCLUDED.map((item) => (
                <li key={item} className="mr-body border-l-2 border-mr-bordeaux/70 pl-5 text-mr-ink">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-mr-ink text-mr-paper">
          <div className={`${SHELL} py-section sm:py-section-lg`}>
            <div className="max-w-[38rem]">
              <h2 className="mr-title text-mr-paper">Obtenir le prix de votre projet.</h2>
              <p className="mr-lead mt-6">
                Quelques questions et deux photographies suffisent à décrire un livre. Nous vous
                répondons avec le travail que nous proposons et son prix.
              </p>
              <div className="mt-9">
                <IntakeCta onInk />
              </div>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
