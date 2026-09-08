/**
 * Le visage public de la marketplace.
 *
 * Son seul travail est d'amener quelqu'un à presser « Présenter mon livre »,
 * qui ouvre la Mission Métré sur /m/:publicToken — le même runtime que la
 * démo Deck, pas un second. Rien de la qualification ne vit ici.
 *
 * La page est écrite comme un magazine et non comme une application : une
 * serif qui a du caractère pour les titres, la pile système pour tout ce qui
 * s'utilise, des filets plutôt que des cartes, et de la photographie partout
 * où quelqu'un doit sentir une matière. Les emplacements de photo sont
 * assumés tant que les vraies images n'existent pas — voir `Photograph`.
 *
 * Aucun chiffre de cette page n'est inventé. Ni note, ni compteur de projets,
 * ni nombre d'artisans, parce qu'aucun de ces nombres n'est réel (§59). Le
 * jour où ils le seront, leur place est ici ; d'ici là, leur absence est le
 * design honnête.
 */
import type { ReactNode } from "react";
import { IntakeCta, LandingFooter, LandingHeader } from "./landing/LandingChrome";
import { Photograph } from "./landing/Photograph";
import { ArtisanCard } from "./landing/ArtisanCard";
import {
  ANCHORS,
  ARTISANS,
  BEFORE_AFTER,
  COMMITMENTS,
  CRAFTS,
  SHOW_UNFILLED_SECTIONS,
  STEPS,
} from "./landing/content";
import { PHOTOS, PHOTO_SIZES } from "./landing/photos";

const SHELL = "mx-auto w-full max-w-[78rem] px-5 sm:px-8";

/**
 * Le surtitre, le titre et le chapô d'une section.
 *
 * Toutes les sections ouvrent de la même façon ; c'est ce qui donne à la page
 * son rythme de magazine. La variante `tone` sert l'unique section sombre.
 */
function SectionHead({
  eyebrow,
  title,
  lead,
  tone = "ink",
  className = "",
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: string;
  tone?: "ink" | "paper";
  className?: string;
}) {
  return (
    <div className={`max-w-[46rem] ${className}`}>
      <p className={`mr-eyebrow ${tone === "paper" ? "text-mr-brass" : ""}`}>{eyebrow}</p>
      <h2
        className={`mr-display mt-5 text-[2.125rem] sm:text-[2.75rem] lg:text-[3.25rem] ${
          tone === "paper" ? "text-mr-paper" : "text-mr-ink"
        }`}
      >
        {title}
      </h2>
      {lead && (
        <p
          className={`mt-6 text-[1.0625rem] leading-[1.75] ${
            tone === "paper" ? "text-mr-paper/75" : "text-mr-walnut"
          }`}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

/**
 * Le premier écran. Moitié texte, moitié photographie sur grand écran ;
 * texte puis photographie sur téléphone, dans cet ordre — on ne fait pas
 * attendre une phrase derrière une image qui charge.
 */
function Hero() {
  return (
    <section className={`${SHELL} pb-16 pt-10 sm:pb-24 sm:pt-16 lg:pb-28 lg:pt-20`}>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="mr-eyebrow">Reliure · Restauration · Création</p>

          <h1 className="mr-display mt-6 text-[2.625rem] sm:text-[3.5rem] lg:text-[4.25rem]">
            Donnez une nouvelle vie aux livres auxquels vous tenez.
          </h1>

          <p className="mt-7 max-w-[34rem] text-[1.0625rem] leading-[1.75] text-mr-walnut sm:text-[1.1875rem] sm:leading-[1.7]">
            Photographiez votre livre, racontez-nous ce que vous souhaitez. Nous sélectionnons les
            relieurs dont le savoir-faire correspond à votre projet.
          </p>

          <div className="mt-9 flex flex-col items-start gap-4">
            <IntakeCta />
            <p className="text-[0.8125rem] text-mr-muted">
              Gratuit · Sans engagement · Jusqu'à 3 ateliers sélectionnés
            </p>
          </div>
        </div>

        {/* Le filet laiton décalé derrière l'image : une reliure a une tranche,
            une page de magazine a une marge. C'est tout l'accent que s'autorise
            le premier écran. */}
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute -bottom-3 -left-3 hidden h-full w-full border border-mr-brass/35 sm:block"
          />
          <Photograph
            priority
            ratio="tall"
            photo={PHOTOS.hero}
            sizes={PHOTO_SIZES.half}
            alt="Les mains d'un relieur posant la feuille d'or sur le dos à nerfs d'un ouvrage en cuir"
            className="relative"
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Trois étapes, très espacées. Le chiffre est traité comme un folio de
 * magazine — grand, en serif, très clair — plutôt que comme une pastille
 * numérotée : une pastille numérotée ressemble à une démarche administrative,
 * ce que la personne redoute justement en confiant un livre.
 */
function Steps() {
  return (
    <section
      id={ANCHORS.howItWorks}
      className="mr-grain scroll-mt-24 border-y border-mr-rule bg-mr-paper-deep"
    >
      <div className={`${SHELL} relative py-20 sm:py-24 lg:py-28`}>
        <SectionHead
          eyebrow="Comment ça marche"
          title="Trois étapes, et votre livre est entre de bonnes mains."
        />

        <ol className="mt-14 grid gap-12 sm:gap-14 lg:mt-20 lg:grid-cols-3 lg:gap-12">
          {STEPS.map((step) => (
            <li key={step.index} className="border-t border-mr-ink/15 pt-7">
              <span className="mr-display block text-[3.25rem] leading-none text-mr-ink/25">
                {step.index}
              </span>
              <h3 className="mr-title mt-6 text-[1.75rem]">{step.title}</h3>
              <p className="mt-3 max-w-[26rem] text-[1.0625rem] leading-[1.7] text-mr-walnut">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * Une composition, pas quatre rectangles.
 *
 * Les colonnes alternent large/étroit puis étroit/large, et les deux blocs de
 * droite descendent d'un cran : l'œil suit une diagonale au lieu de balayer
 * une grille. Sur téléphone la composition se déplie en une colonne — mais
 * chaque entrée reste une photographie suivie d'un titre en serif, sans
 * cadre ni fond, donc une page de magazine plutôt qu'une pile de cartes.
 */
const CRAFT_LAYOUT = [
  { span: "lg:col-span-7", ratio: "landscape", lift: "", sizes: PHOTO_SIZES.sevenOfTwelve },
  { span: "lg:col-span-5", ratio: "portrait", lift: "lg:mt-24", sizes: PHOTO_SIZES.fiveOfTwelve },
  { span: "lg:col-span-5", ratio: "portrait", lift: "", sizes: PHOTO_SIZES.fiveOfTwelve },
  { span: "lg:col-span-7", ratio: "landscape", lift: "lg:mt-24", sizes: PHOTO_SIZES.sevenOfTwelve },
] as const;

function Crafts() {
  return (
    <section id={ANCHORS.crafts} className={`${SHELL} scroll-mt-24 py-20 sm:py-24 lg:py-32`}>
      <SectionHead
        eyebrow="Les savoir-faire"
        title="Ce qu'un relieur peut faire"
        lead="Quatre façons d'intervenir sur un livre. La bonne dépend de son état, de son histoire et de ce que vous en attendez."
      />

      <div className="mt-14 grid gap-14 sm:gap-16 lg:mt-20 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-4">
        {CRAFTS.map((craft, i) => {
          const layout = CRAFT_LAYOUT[i];
          return (
            <article key={craft.title} className={`${layout.span} ${layout.lift} self-start`}>
              <Photograph
                ratio={layout.ratio}
                photo={craft.photo}
                sizes={layout.sizes}
                alt={craft.alt}
              />
              <h3 className="mr-title mt-7 text-[1.875rem] sm:text-[2rem]">{craft.title}</h3>
              <p className="mt-3 max-w-[34rem] text-[1.0625rem] leading-[1.7] text-mr-walnut">
                {craft.body}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Un avertissement d'emplacement.
 *
 * Il s'adresse à nous, pas au visiteur — d'où le filet bordeaux et la casse
 * technique : impossible de le confondre avec du contenu, impossible de le
 * laisser passer en production sans le voir.
 */
function PlaceholderNotice({ children }: { children: ReactNode }) {
  return (
    <p className="mt-8 border-l-2 border-mr-bordeaux/60 py-1 pl-4 font-mono text-[0.6875rem] uppercase leading-5 tracking-[0.14em] text-mr-bordeaux/80">
      {children}
    </p>
  );
}

/**
 * Avant / après.
 *
 * Deux restaurations réelles, sur des ouvrages nommés et datés, photographiées
 * par l'atelier qui les a faites. Le crédit sous chaque cas n'est pas une
 * politesse : ces livres ne sont pas passés par Ma Reliure, et l'omettre
 * transformerait deux vrais chantiers en deux fausses références (§59).
 */
function BeforeAfterSection() {
  if (BEFORE_AFTER.length === 0) return null;

  return (
    <section className="border-t border-mr-rule">
      <div className={`${SHELL} py-20 sm:py-24 lg:py-28`}>
        <SectionHead
          eyebrow="Transformations"
          title="Quelques livres méritent une seconde histoire."
          lead="Le même ouvrage, à son arrivée à l'atelier puis à son retour."
        />

        <div className="mt-12 grid gap-16 lg:mt-16 lg:grid-cols-2 lg:gap-12">
          {BEFORE_AFTER.map((entry) => (
            <article key={entry.title}>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="mr-eyebrow mb-3">Avant</p>
                  <Photograph
                    photo={entry.before}
                    sizes={PHOTO_SIZES.beforeAfter}
                    ratio="wide"
                    alt={entry.beforeAlt}
                  />
                </div>
                <div>
                  <p className="mr-eyebrow mb-3">Après</p>
                  <Photograph
                    photo={entry.after}
                    sizes={PHOTO_SIZES.beforeAfter}
                    ratio="wide"
                    alt={entry.afterAlt}
                  />
                </div>
              </div>
              <h3 className="mr-title mt-7 text-[1.625rem]">{entry.title}</h3>
              <p className="mt-3 text-[1.0625rem] leading-[1.7] text-mr-walnut">{entry.body}</p>
              <p className="mt-4 text-[0.8125rem] text-mr-muted">
                Restauration et photographies : {entry.credit}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Les ateliers.
 *
 * `ARTISANS` est vide : aucun relieur n'a encore rejoint la plateforme, et
 * afficher un faux atelier serait le mensonge le plus coûteux de la page. La
 * section garde son texte, qui décrit une méthode de sélection bien réelle,
 * et montre les emplacements des vitrines à venir.
 */
function Artisans() {
  const hasArtisans = ARTISANS.length > 0;
  if (!hasArtisans && !SHOW_UNFILLED_SECTIONS) return null;

  return (
    <section className="border-t border-mr-rule bg-mr-paper-deep">
      <div className={`${SHELL} py-20 sm:py-24 lg:py-28`}>
        <SectionHead
          eyebrow="Les ateliers"
          title="Le bon livre, entre les bonnes mains."
          lead="Chaque atelier est sélectionné pour son savoir-faire, ses techniques et le type de projets qu'il souhaite recevoir."
        />

        {!hasArtisans && (
          <PlaceholderNotice>
            Aucun atelier n'est affiché tant qu'un relieur réel n'a pas rejoint Ma Reliure.
          </PlaceholderNotice>
        )}

        {hasArtisans && (
          // Un seul atelier référencé : trois colonnes laisseraient deux vides,
          // ce qui se lit comme un manque plutôt que comme un début. On lui
          // donne alors la largeur d'une vitrine, pas d'une vignette.
          <div
            className={
              ARTISANS.length === 1
                ? "mt-12 max-w-xl lg:mt-16"
                : "mt-12 grid gap-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-12"
            }
          >
            {ARTISANS.map((artisan) => (
              <ArtisanCard key={artisan.id} artisan={artisan} />
            ))}
          </div>
        )}

        <div
          id={ANCHORS.binders}
          className="mt-20 max-w-[46rem] scroll-mt-24 border-t border-mr-ink/15 pt-10"
        >
          <h3 className="mr-title text-[1.75rem]">Vous êtes relieur ?</h3>
          <p className="mt-4 text-[1.0625rem] leading-[1.75] text-mr-walnut">
            Ma Reliure vous adresse des projets décrits, photographiés et déjà cadrés, et jamais
            plus de trois ateliers par livre. La sélection se fait pour l'instant atelier par
            atelier, sans candidature en ligne.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Le seul moment sombre de la page.
 *
 * L'ancienne version couvrait la section d'un brun profond et y serrait quatre
 * colonnes : sombre et dense, donc lourde. Ici le fond reste sombre — un
 * contraste au milieu d'une page ivoire se lit comme une pause, pas comme un
 * bloc — mais il respire deux fois plus, et le laiton n'y apparaît qu'en
 * filet au-dessus de chaque engagement.
 */
function Commitments() {
  return (
    <section className="bg-mr-ink">
      <div className={`${SHELL} py-24 sm:py-28 lg:py-36`}>
        <SectionHead
          tone="paper"
          eyebrow="Nos engagements"
          title="Vous confiez plus qu'un objet."
          lead="Un livre part de chez vous, passe des semaines dans un atelier, et revient. Voici ce que nous garantissons sur ce trajet."
        />

        <div className="mt-16 grid gap-x-12 gap-y-14 sm:grid-cols-2 lg:mt-24 lg:grid-cols-4">
          {COMMITMENTS.map((item) => (
            <div key={item.title}>
              <span aria-hidden="true" className="block h-px w-10 bg-mr-brass" />
              <h3 className="mt-6 text-[1.0625rem] font-semibold text-mr-paper">{item.title}</h3>
              <p className="mt-3 text-[0.9375rem] leading-[1.7] text-mr-paper/70">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Le prix.
 *
 * Aucun tarif n'est affiché parce qu'aucun n'est connu : les fourchettes
 * réelles viendront des devis, quand il y en aura assez pour qu'une fourchette
 * veuille dire quelque chose. Dire pourquoi le prix varie vaut mieux que
 * d'annoncer un « à partir de » que le premier devis démentira.
 */
function Pricing() {
  return (
    <section className={`${SHELL} py-20 sm:py-24`}>
      <div className="grid gap-8 border-t border-mr-rule pt-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <h2 className="mr-title text-[1.875rem] sm:text-[2.25rem]">
          Un travail artisanal, un prix expliqué.
        </h2>
        <p className="max-w-[38rem] text-[1.0625rem] leading-[1.75] text-mr-walnut">
          Chaque projet est unique. La technique, les matériaux, l'état du livre et le temps de
          travail déterminent le prix. Chaque atelier le détaille dans sa proposition, avant que
          vous ne vous engagiez.
        </p>
      </div>
    </section>
  );
}

/**
 * La fin de page.
 *
 * Le seul endroit où le bordeaux prend une phrase entière. Il est resté rare
 * pendant toute la page pour pouvoir servir exactement ici, sur la ligne qui
 * demande de confier le livre.
 */
function FinalCta() {
  return (
    <section className="border-t border-mr-rule">
      <div className={`${SHELL} py-20 sm:py-24 lg:py-28`}>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_0.85fr] lg:gap-20">
          <div className="lg:order-last">
            <h2 className="mr-display text-[2.375rem] sm:text-[3rem] lg:text-[3.5rem]">
              Il a déjà une histoire.
              <br />
              <span className="text-mr-bordeaux">Confiez la suite à un artisan.</span>
            </h2>
            <p className="mt-7 max-w-[34rem] text-[1.0625rem] leading-[1.75] text-mr-walnut">
              Présentez-nous votre livre en quelques minutes.
            </p>
            <div className="mt-9">
              <IntakeCta />
            </div>
          </div>

          <Photograph
            ratio="square"
            photo={PHOTOS.closing}
            sizes={PHOTO_SIZES.closing}
            alt="Une pile de reliures en cuir à dos dorés, sur l'établi d'un atelier"
            className="lg:order-first"
          />
        </div>
      </div>
    </section>
  );
}

export function ReliureLanding() {
  return (
    <div id="top" className="min-h-screen bg-mr-paper text-mr-ink antialiased">
      <LandingHeader />
      <main>
        <Hero />
        <Steps />
        <Crafts />
        <BeforeAfterSection />
        <Artisans />
        <Commitments />
        <Pricing />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
