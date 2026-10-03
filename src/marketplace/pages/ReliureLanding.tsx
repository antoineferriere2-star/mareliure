/**
 * Le visage public de Ma Reliure.
 *
 * Son seul travail est d'amener quelqu'un à presser « Présenter mon livre »,
 * qui ouvre la Mission Métré sur /m/:publicToken — le même runtime que toutes
 * les autres Missions. Rien de la qualification ne vit ici.
 *
 * Direction « La table d'atelier » (octobre 2026, docs/design/premium-art-direction.md) :
 * les photographies deviennent des planches — posées entières, numérotées,
 * légendées —, chaque chapitre s'ouvre sur le double filet du doreur, et les
 * sections ont des structures différentes parce qu'elles disent des choses
 * différentes : une table des matières pour les besoins, de grandes planches
 * pour les preuves, un tableau pour les engagements.
 *
 * Aucun chiffre de cette page n'est inventé. Ni note, ni compteur de projets,
 * ni nombre d'artisans, parce qu'aucun n'est réel. Toutes les photographies
 * viennent de l'atelier Reliure Dorure Ferrière et sont créditées.
 */
import { IntakeCta, LandingFooter, LandingHeader, SectionHead, SectionRule, SHELL } from "./landing/LandingChrome";
import { Plate } from "./landing/Plate";
import { ArtisanCard } from "./landing/ArtisanCard";
import { ActionLink } from "./landing/actions";
import { ProductShot } from "./landing/ProductShot";
import {
  ANCHORS,
  ARTISANS,
  BEFORE_AFTER,
  COMMITMENTS,
  CRAFTS,
  PRICE_FACTORS,
  PROOFS,
  SHOW_UNFILLED_SECTIONS,
  STEPS,
} from "./landing/content";
import { PHOTOS } from "./landing/photos";
import {
  FERRIERE_EDITORIAL_CRAFT_KEYS,
  FERRIERE_SERVICE_PHOTO_CREDIT,
  FERRIERE_SERVICE_PHOTO_SOURCE,
  ferriereServicePhoto,
} from "./pricing/ferriereServiceIllustrations";

const ROMAN = ["I", "II", "III", "IV", "V", "VI"] as const;

/**
 * Le premier écran.
 *
 * Trois questions en cinq secondes : ce que nous faisons, pour qui, comment
 * on commence. Le texte et la planche se partagent la largeur à parts égales :
 * l'image n'est plus une vignette à côté d'un titre, c'est une pièce posée sur
 * la table, avec sa notice.
 *
 * La pièce est la reliure de création de l'atelier Ferrière sur Le Spleen de
 * Paris : un objet réel, contemporain, qui dit que la reliure n'est pas un
 * métier de musée.
 */
function Hero() {
  return (
    <section className={`${SHELL} pt-10 pb-14 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24`}>
      <div className="grid items-end gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-6 lg:pb-10">
          <p className="mr-eyebrow">Reliure · Restauration · Création</p>
          <h1 className="mr-display mt-6 text-mr-ink">
            Donnez une nouvelle vie aux livres auxquels vous tenez.
          </h1>
          <p className="mr-lead mt-7 max-w-[34rem]">
            Réparation, restauration, nouvelle reliure ou création : présentez votre livre en
            quelques minutes. Ma Reliure évalue votre projet et le confie à l’artisan adapté.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
            <IntakeCta />
            <a href={`#${ANCHORS.crafts}`} className="mr-link mr-tap text-[1.0625rem]">
              Découvrir les possibilités
            </a>
          </div>
        </div>
        <Plate
          className="lg:col-span-6"
          photo={PHOTOS.ferriereBaudelaire}
          sizes="(min-width: 1024px) 560px, 100vw"
          ratio="landscape"
          priority
          number={1}
          alt="Une reliure contemporaine en mosaïque de cuir gris et aubergine, titrée à l’or et à l’argent, sur Le Spleen de Paris de Baudelaire"
          caption="Le Spleen de Paris, reliure de création"
          credit="Atelier Reliure Dorure Ferrière, Orléans"
        />
      </div>
    </section>
  );
}

/**
 * Les quatre preuves, en colophon sous le premier écran : elles répondent à
 * « pourquoi passer par vous » avant que la page explique comment.
 */
function Proofs() {
  return (
    <section aria-label="Ce que Ma Reliure garantit" className={`${SHELL} pb-14 sm:pb-16`}>
      <span aria-hidden="true" className="mr-filet text-mr-ink" />
      <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
        {PROOFS.map((proof) => (
          <div key={proof.title}>
            <h2 className="mr-heading text-mr-ink">{proof.title}</h2>
            <p className="mr-small mt-2">{proof.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * La promesse, puis les trois étapes. Fond pierre : la première rupture de la
 * page, tôt, pour dire que le site est un service et pas un portfolio.
 */
function HowItWorks() {
  return (
    <section id={ANCHORS.howItWorks} className="scroll-mt-36 lg:scroll-mt-28 bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead
          folio="I"
          eyebrow="Comment ça marche"
          title={
            <>
              Vous présentez le livre.
              <br className="hidden sm:block" /> Nous organisons la suite.
            </>
          }
        />
        <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8 lg:mt-16 lg:gap-12">
          {STEPS.map((step) => (
            <li key={step.index}>
              <p className="flex items-baseline gap-3">
                <span className="mr-display text-[2.75rem] leading-none text-mr-bordeaux sm:text-[3.25rem]">
                  {Number(step.index)}
                </span>
                <span className="text-[0.8125rem] font-semibold text-mr-bordeaux">{step.when}</span>
              </p>
              <h3 className="mr-title mt-5 text-[1.5rem] text-mr-ink sm:text-[1.625rem]">{step.title}</h3>
              <p className="mr-body mt-3 max-w-[24rem]">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * Les six besoins, en table des matières.
 *
 * Une grille de six images 4:3 recadrait des photographies documentaires et
 * leur donnait le premier rôle. Ici le mot mène : chiffre romain, besoin,
 * phrase, travaux concrets ; la photographie réelle de l'atelier Ferrière
 * suit en vignette posée entière, comme un repère.
 */
function Crafts() {
  return (
    <section id={ANCHORS.crafts} className={`${SHELL} scroll-mt-36 lg:scroll-mt-28 py-section-sm sm:py-section`}>
      <SectionHead
        folio="II"
        eyebrow="Les savoir-faire"
        title="Que voulez-vous faire de votre livre ?"
        lead="Six façons d’intervenir. La bonne dépend de son état, de son histoire et de ce que vous en attendez — et c’est la première question que nous vous poserons."
      />
      <ol className="mt-12 border-b border-mr-rule lg:mt-16">
        {CRAFTS.map((craft, index) => {
          const photo = ferriereServicePhoto(FERRIERE_EDITORIAL_CRAFT_KEYS[index]);
          return (
            <li
              key={craft.title}
              className="grid grid-cols-[1fr_7.5rem] gap-x-5 gap-y-3 border-t border-mr-rule py-6 sm:grid-cols-[3rem_1fr_11rem] sm:gap-x-8 lg:grid-cols-[4rem_minmax(0,5fr)_minmax(0,4fr)_13rem] lg:items-center lg:py-6"
            >
              <span aria-hidden="true" className="mr-folio hidden text-[1.25rem] text-mr-bordeaux sm:block">
                {ROMAN[index]}
              </span>
              <div>
                <h3 className="font-editorial text-[1.75rem] leading-tight text-mr-ink [font-variation-settings:'opsz'_72] sm:text-[2rem]">
                  {craft.title}
                </h3>
                <p className="mr-body mt-2">{craft.body}</p>
              </div>
              <p className="mr-small col-span-2 text-mr-muted sm:col-span-1 sm:col-start-2 sm:row-start-2 lg:col-start-auto lg:row-start-auto">
                {craft.detail}
              </p>
              <Plate
                className="col-start-2 row-start-1 sm:col-start-3 sm:row-span-2 lg:col-start-auto lg:row-span-1"
                photo={photo}
                sizes="(min-width: 1024px) 208px, (min-width: 640px) 176px, 120px"
                ratio="wide"
                tight
                alt=""
              />
            </li>
          );
        })}
      </ol>
      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-x-10 gap-y-4">
        <a href="/tarifs" className="mr-link mr-tap text-[1.0625rem]">
          Voir les 45 prestations en images, et ce qui fait leur prix
        </a>
        <p className="mr-meta">
          Photographies :{" "}
          <a className="mr-link" href={FERRIERE_SERVICE_PHOTO_SOURCE}>
            {FERRIERE_SERVICE_PHOTO_CREDIT}
          </a>
          , reproduites avec son autorisation.
        </p>
      </div>
    </section>
  );
}

/**
 * Les réalisations.
 *
 * La seule section qui prouve quelque chose, et la seule dont les images ont
 * une raison d'être grandes : deux restaurations réelles, avant et après, sur
 * des ouvrages nommés, par un atelier nommé. Chaque paire occupe toute la
 * largeur, en planches numérotées.
 *
 * Le crédit n'est pas une politesse : ces livres ne sont pas passés par Ma
 * Reliure. Le taire laisserait croire le contraire.
 */
function Realisations() {
  return (
    <section className="bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead
          folio="III"
          eyebrow="Réalisations"
          title="Le même ouvrage, à son arrivée et à son retour."
          lead="Deux restaurations conduites par l’atelier Reliure Dorure Ferrière, à Orléans. Ces livres ne sont pas passés par Ma Reliure."
        />
        <div className="mt-12 space-y-16 lg:mt-16 lg:space-y-20">
          {BEFORE_AFTER.map((item, index) => (
            <article key={item.title} className="grid gap-8 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-4 lg:pt-2">
                <h3 className="font-editorial text-[1.625rem] leading-snug text-mr-ink [font-variation-settings:'opsz'_72]">
                  {item.title}
                </h3>
                <p className="mr-body mt-4">{item.body}</p>
                <p className="mr-meta mt-5 border-t border-mr-rule-strong pt-4">
                  Restauration et photographies : {item.credit}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:col-span-8">
                <Plate
                  photo={item.before}
                  sizes="(min-width: 1024px) 400px, 50vw"
                  number={2 + index * 2}
                  caption="Avant"
                  alt={item.beforeAlt}
                />
                <Plate
                  photo={item.after}
                  sizes="(min-width: 1024px) 400px, 50vw"
                  number={3 + index * 2}
                  caption="Après"
                  alt={item.afterAlt}
                />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * L'atelier.
 *
 * Une preuve humaine, pas un catalogue. Un seul atelier est référencé et il est
 * réel ; en afficher une grille suggérerait un réseau qui n'existe pas encore,
 * et inviterait à choisir — ce que le client ne fait pas dans ce modèle.
 */
function Artisans() {
  if (!SHOW_UNFILLED_SECTIONS && ARTISANS.length === 0) return null;
  return (
    <section className={`${SHELL} py-section-sm sm:py-section`}>
      <SectionHead
        folio="IV"
        eyebrow="Les ateliers"
        title="Derrière chaque projet, un artisan."
        lead="Ma Reliure travaille avec des ateliers indépendants installés en France, choisis pour leurs savoir-faire et le type de travail qu’ils souhaitent recevoir."
      />
      <div className="mt-12 lg:mt-16">
        {ARTISANS.map((artisan) => (
          <ArtisanCard key={artisan.id} artisan={artisan} firstPlate={6} />
        ))}
      </div>
    </section>
  );
}

/**
 * Les engagements, sur fond d'encre.
 *
 * La seule rupture sombre de la page, au moment où le visiteur se demande s'il
 * peut confier un objet auquel il tient. Numérotés, sans icône : un numéro les
 * fait lire comme des conditions, pas comme des arguments.
 */
function Commitments() {
  return (
    <section className="bg-mr-ink text-mr-paper">
      <div className={`${SHELL} py-section sm:py-section-lg`}>
        <SectionHead
          folio="V"
          eyebrow="Nos engagements"
          title="Vous confiez plus qu’un objet."
          lead="Un livre part de chez vous, passe des semaines dans un atelier, et revient. Voici ce que nous garantissons sur ce trajet."
          tone="paper"
        />
        <ol className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {COMMITMENTS.map((commitment, index) => (
            <li key={commitment.title} className="border-t border-mr-paper/25 pt-5">
              <span className="mr-folio text-mr-paper/80">{ROMAN[index]}</span>
              <h3 className="mr-heading mt-3 text-mr-paper">{commitment.title}</h3>
              <p className="mr-body mt-2">{commitment.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * Le prix.
 *
 * Pédagogique, jamais tabulaire. Une grille Basic / Pro / Premium dirait que le
 * travail est standardisé, ce qu'il n'est pas, et afficherait des montants que
 * nous n'avons pas relevés. La promesse à gauche, les facteurs à droite.
 */
function Pricing() {
  return (
    <section className={`${SHELL} py-section-sm sm:py-section`}>
      <SectionRule folio="VI" />
      <div className="mt-8 grid gap-12 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <SectionHead eyebrow="Tarifs" title="Un travail artisanal, un prix expliqué." />
          <p className="mr-body mt-6">
            Chaque livre est différent. Nous ne publions pas de grille tarifaire, parce qu’une
            grille donnerait un chiffre faux à la plupart des projets. Nous regardons le travail à
            faire, puis nous annonçons un prix ferme.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
            <IntakeCta size="compact" />
            <a href="/tarifs" className="mr-link mr-tap text-[1.0625rem]">
              Comprendre nos tarifs
            </a>
          </div>
        </div>
        <dl className="lg:col-span-7">
          {PRICE_FACTORS.map((factor) => (
            <div key={factor.title} className="border-t border-mr-rule py-6 first:border-t-0 first:pt-0">
              <dt className="mr-heading text-mr-ink">{factor.title}</dt>
              <dd className="mr-body mt-2">{factor.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/**
 * L'appel final, pour le propriétaire du livre. Texte seul, beaucoup d'air,
 * fermé par le double filet comme une fin de chapitre.
 */
function FinalCta() {
  return (
    <section className="bg-mr-paper-warm">
      <div className={`${SHELL} py-section sm:py-section-lg`}>
        <div className="mx-auto max-w-[40rem] text-center">
          <h2 className="mr-title text-mr-ink">
            Il a déjà une histoire.
            <br /> Confiez-nous la suite.
          </h2>
          <p className="mr-lead mx-auto mt-6 max-w-[32rem]">
            Présentez-nous votre livre en quelques minutes. Vous connaîtrez le prix avant de vous engager.
          </p>
          <div className="mt-9">
            <IntakeCta />
          </div>
          <span aria-hidden="true" className="mr-filet mx-auto mt-14 w-16 text-mr-bordeaux" />
        </div>
      </div>
    </section>
  );
}

/**
 * Le second public : les relieurs et restaurateurs. Après l'appel final du
 * propriétaire, jamais avant. Le bloc montre l'outil réel (capture de l'écran
 * Aujourd'hui, données d'exemple) plutôt qu'une promesse de réseau.
 */
function ForWorkshops() {
  return (
    <section aria-labelledby="pour-les-ateliers" className={`${SHELL} py-section-sm sm:py-section`}>
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <p className="mr-eyebrow">Vous êtes relieur ou restaurateur ?</p>
          <h2 id="pour-les-ateliers" className="mr-title mt-4 text-mr-ink">
            Un outil métier conçu pour votre atelier.
          </h2>
          <p className="mr-lead mt-6">
            Créez vos devis, personnalisez vos tarifs, suivez vos ouvrages et vos clients depuis un
            seul espace.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <ActionLink href="/partenaires-relieurs">Découvrir l’espace relieur</ActionLink>
            <ActionLink href="/auth?space=atelier" variant="secondary">
              Créer mon espace atelier
            </ActionLink>
          </div>
        </div>
        <ProductShot shot="aujourdhui" className="lg:col-span-7" sizes="(min-width: 1024px) 700px, 100vw" />
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
        <Proofs />
        <HowItWorks />
        <Crafts />
        <Realisations />
        <Artisans />
        <Commitments />
        <Pricing />
        <FinalCta />
        <ForWorkshops />
      </main>
      <LandingFooter />
    </div>
  );
}
