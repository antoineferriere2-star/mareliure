/**
 * La page qui répond à « combien ça coûte ? ».
 *
 * C'est la première question que se pose quelqu'un devant un livre abîmé, et
 * la recherche la plus fréquente du domaine. Elle mérite donc une vraie page —
 * mais une page qui n'invente rien.
 *
 * D'où sa forme : elle explique **ce qui fait le prix** plutôt que d'annoncer
 * des prix. C'est honnête, et c'est accessoirement plus utile qu'une grille,
 * parce qu'un visiteur qui comprend que l'état du dos et la couture pèsent
 * plus que la couleur du cuir décrit mieux son projet ensuite.
 *
 * Aucune fourchette n'y figure aujourd'hui. Elle ne pourra en porter que
 * lorsque `isPublishableRange` sera vrai pour un travail — au moins trois
 * ateliers de référence — et ce sera alors une fourchette relevée, pas
 * estimée. En attendant, « sur étude » n'est pas une dérobade : c'est ce qui
 * se passe réellement.
 */
import { IntakeCta, LandingFooter, LandingHeader } from "./landing/LandingChrome";
import { WORK_FAMILIES, workItemsByFamily } from "@/marketplace/pricing/catalog";
import {
  FERRIERE_SERVICE_PHOTO_CREDIT,
  FERRIERE_SERVICE_PHOTO_NUMBERS,
  FERRIERE_SERVICE_PHOTO_SOURCE,
  ferriereServicePhoto,
  ferriereSourcePhotoUrl,
  type IllustratedServiceKey,
} from "./pricing/ferriereServiceIllustrations";

const SHELL = "mx-auto w-full max-w-[52rem] px-5 sm:px-8";
const WIDE_SHELL = "mx-auto w-full max-w-[78rem] px-5 sm:px-8";

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
    body: "C’est le premier facteur, et de loin. Un dos fendu, des cahiers désolidarisés ou des plats détachés demandent de démonter l’ouvrage avant de commencer quoi que ce soit. Un livre complet et solide qu’on habille coûte moins cher qu’un livre en morceaux qu’on remet debout.",
  },
  {
    title: "La structure à refaire",
    body: "Recoudre l’ensemble des cahiers n’a rien à voir avec en reprendre trois. C’est le travail le plus long d’un atelier, et le moins visible une fois le livre fermé.",
  },
  {
    title: "Le format",
    body: "Un in-folio ne se manipule pas comme un livre de poche : plus de matière, des outils différents, et souvent une presse qui n’accepte qu’un ouvrage à la fois.",
  },
  {
    title: "Les matières",
    body: "Toile, papier décoré, demi-cuir, plein cuir : le coût de la matière compte, mais c’est surtout le temps de parage et de couvrure qui change d’une matière à l’autre.",
  },
  {
    title: "La dorure",
    body: "Un titre au dos, des filets, un décor composé : la dorure se compte au fer et à la ligne. Chaque élément est posé à la main, à chaud, sans droit à l’erreur.",
  },
  {
    title: "Les finitions",
    body: "Nerfs, gardes décorées, tranches, signet, étui de protection. Ce sont des choix, pas des obligations — et c’est là que le budget se pilote le plus facilement.",
  },
  {
    title: "La restauration",
    body: "Restaurer n’est pas relier. Un ouvrage ancien, un manuscrit ou une reliure d’époque se regardent avant de se chiffrer : le travail se décide pièce en main.",
  },
];

export function TarifsPage() {
  return (
    <div className="mr-site min-h-screen bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main>
        <section className="border-b border-mr-ink/10 py-16 sm:py-24">
          <div className={SHELL}>
            <h1 className="font-serif text-[2.25rem] leading-[1.1] sm:text-[3rem]">
              Combien coûte la reliure ou la restauration d’un livre ?
            </h1>
            <p className="mt-6 max-w-[38rem] text-[1.0625rem] leading-[1.7] text-mr-ink/75">
              Chaque livre est différent. Son état, son format, les matériaux et le temps de travail
              déterminent son prix.
            </p>
            <p className="mt-4 max-w-[38rem] text-[1.0625rem] leading-[1.7] text-mr-ink/75">
              Nous ne publions pas de grille tarifaire, parce qu’une grille donnerait un chiffre
              faux à la plupart des projets. Présentez-nous votre livre : nous regardons le travail
              à faire, puis nous vous annonçons un prix ferme.
            </p>
            <div className="mt-9">
              <IntakeCta />
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className={SHELL}>
            <p className="font-sans text-[0.75rem] uppercase tracking-[0.18em] text-mr-muted">
              Ce qui fait le prix
            </p>
            <h2 className="mt-3 font-serif text-[1.75rem] leading-[1.2] sm:text-[2.125rem]">
              Sept choses que nous regardons
            </h2>
            <dl className="mt-10 space-y-9">
              {FACTORS.map((factor, index) => (
                <div key={factor.title} className="border-t border-mr-ink/10 pt-6">
                  <dt className="flex items-baseline gap-4">
                    <span className="font-sans text-[0.75rem] tabular-nums text-mr-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-serif text-[1.3125rem]">{factor.title}</span>
                  </dt>
                  <dd className="mt-3 pl-[2.25rem] text-[1rem] leading-[1.75] text-mr-ink/70">
                    {factor.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-t border-mr-ink/10 bg-white/45 py-16 sm:py-20" aria-labelledby="service-gallery-title">
          <div className={WIDE_SHELL}>
            <div className="max-w-[48rem]">
              <p className="font-sans text-[0.75rem] uppercase tracking-[0.18em] text-mr-muted">
                Les prestations en images
              </p>
              <h2 id="service-gallery-title" className="mt-3 font-serif text-[1.75rem] leading-[1.2] sm:text-[2.125rem]">
                Un repère visuel pour chacun des 45 savoir-faire
              </h2>
              <p className="mt-5 text-[1rem] leading-[1.75] text-mr-ink/70">
                Certaines photographies montrent l’état reçu, d’autres le geste ou le résultat.
                Elles aident à nommer le travail ; l’intervention exacte reste déterminée après
                examen du livre.
              </p>
              <p className="mt-3 text-sm leading-6 text-mr-ink/60">
                Réalisations et photographies :{" "}
                <a className="underline decoration-mr-bordeaux/70 underline-offset-4" href={FERRIERE_SERVICE_PHOTO_SOURCE}>
                  {FERRIERE_SERVICE_PHOTO_CREDIT}
                </a>
                , reproduites avec son autorisation.
              </p>
            </div>

            <div className="mt-10 space-y-4">
              {WORK_FAMILIES.map((family, familyIndex) => {
                const items = workItemsByFamily(family.key);
                return (
                  <details key={family.key} open={familyIndex === 0} className="group border border-mr-ink/12 bg-mr-paper">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 font-serif text-[1.2rem] marker:content-none sm:px-6">
                      <span>{family.label}</span>
                      <span aria-hidden="true" className="font-sans text-sm text-mr-muted transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <ul className="grid gap-px border-t border-mr-ink/10 bg-mr-ink/10 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((item) => {
                        const key = item.key as IllustratedServiceKey;
                        const photo = ferriereServicePhoto(key);
                        const photoNumber = FERRIERE_SERVICE_PHOTO_NUMBERS[key];
                        return (
                          <li key={item.key} className="bg-mr-paper">
                            <figure>
                              <img
                                src={photo.src}
                                srcSet={photo.srcSet}
                                sizes="(min-width: 1024px) 390px, (min-width: 640px) 50vw, 100vw"
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="aspect-[4/3] w-full bg-mr-ink/5 object-cover"
                              />
                              <figcaption className="px-4 py-4 sm:px-5">
                                <h3 className="font-serif text-[1.08rem] leading-snug">{item.label}</h3>
                                {item.hint && <p className="mt-1.5 text-sm leading-6 text-mr-ink/65">{item.hint}</p>}
                                <a
                                  href={ferriereSourcePhotoUrl(key)}
                                  className="mt-3 inline-block text-[0.68rem] uppercase tracking-[0.11em] text-mr-muted underline decoration-mr-bordeaux/60 underline-offset-4"
                                >
                                  {FERRIERE_SERVICE_PHOTO_CREDIT} · photo n°{photoNumber}
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

        {/* Ce que le prix recouvre. Pas une liste d'arguments : les quatre
            points qui font qu'un prix Ma Reliure n'est pas comparable à un
            devis d'atelier, et qu'un visiteur a le droit de connaître avant
            de s'engager. */}
        <section className="border-t border-mr-ink/10 py-16 sm:py-20">
          <div className={SHELL}>
            <h2 className="font-serif text-[1.75rem] leading-[1.2] sm:text-[2.125rem]">
              Ce que comprend le prix que nous annonçons
            </h2>
            <ul className="mt-8 space-y-5 text-[1rem] leading-[1.75] text-mr-ink/75">
              <li className="border-l border-mr-bordeaux/60 pl-5">
                Le travail de l’atelier, en entier. Un seul prix, arrêté avant que le livre parte.
              </li>
              <li className="border-l border-mr-bordeaux/60 pl-5">
                Le choix de l’artisan dont le savoir-faire correspond à votre ouvrage.
              </li>
              <li className="border-l border-mr-bordeaux/60 pl-5">
                Un interlocuteur unique du début à la fin : vous ne négociez pas avec l’atelier.
              </li>
              <li className="border-l border-mr-bordeaux/60 pl-5">
                Un prix ferme. S’il devait évoluer parce que le livre révèle autre chose une fois
                ouvert, nous vous le disons avant d’engager quoi que ce soit.
              </li>
            </ul>
          </div>
        </section>

        <section className="border-t border-mr-ink/10 py-16 sm:py-20">
          <div className={SHELL}>
            <h2 className="font-serif text-[1.75rem] leading-[1.2] sm:text-[2.125rem]">
              Obtenir l’estimation de votre projet
            </h2>
            <p className="mt-5 max-w-[36rem] text-[1.0625rem] leading-[1.7] text-mr-ink/75">
              Quelques questions et deux photographies suffisent à décrire un livre. Nous vous
              répondons avec le travail que nous proposons et son prix.
            </p>
            <div className="mt-8">
              <IntakeCta />
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
