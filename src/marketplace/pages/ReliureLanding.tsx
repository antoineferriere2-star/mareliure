/**
 * Le visage public de Ma Reliure.
 *
 * Son seul travail est d'amener quelqu'un à presser « Présenter mon livre »,
 * qui ouvre la Mission Métré sur /m/:publicToken — le même runtime que toutes
 * les autres Missions. Rien de la qualification ne vit ici.
 *
 * La page a été recomposée le 9 septembre 2026 autour de trois constats.
 *
 * **Cinq des quatorze photographies étaient générées**, dont le hero et quatre
 * des six univers. Elles ont été retirées. Ce qui reste est vrai, et la page
 * compose avec : les images ne servent plus à illustrer, elles servent à
 * prouver. D'où leur concentration sur l'avant/après et l'atelier, et leur
 * absence complète des six besoins.
 *
 * **La serif était la voix, pas un signe.** Elle ne sort plus que pour les
 * grands titres et le nom de la marque ; tout ce qui s'utilise est en
 * sans-serif, à une taille qui se lit.
 *
 * **Huit écrans de image → titre → texte.** Les sections ont maintenant des
 * structures différentes parce qu'elles disent des choses différentes : une
 * liste pour les besoins, une galerie pour les preuves, une colonne large pour
 * l'atelier, un tableau pour les engagements.
 *
 * Aucun chiffre de cette page n'est inventé. Ni note, ni compteur de projets,
 * ni nombre d'artisans, parce qu'aucun n'est réel.
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
  PRICE_FACTORS,
  PROOFS,
  SHOW_UNFILLED_SECTIONS,
  STEPS,
} from "./landing/content";
import { PHOTOS, PHOTO_SIZES } from "./landing/photos";
import { MARELIURE_CONTACT_EMAIL } from "@/marketplace/legal/legalEntity";

/** Un seul conteneur pour toute la page. Les variations se font en colonnes. */
const SHELL = "mx-auto w-full max-w-[80rem] px-5 sm:px-8";

/**
 * L'ouverture d'une section : surtitre, titre, chapô.
 *
 * Alignée à gauche partout. Centrer un titre est le réflexe qui fait ressembler
 * une page à un gabarit — le lecteur perd le bord sur lequel son œil revient.
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
  lead?: ReactNode;
  tone?: "ink" | "paper";
  className?: string;
}) {
  return (
    <div className={`max-w-[46rem] ${className}`}>
      {/* Le surtitre et le chapô prennent la couleur de la section : rien à
          régler ici. Seul le titre remonte au contraste plein, parce qu'un
          titre atténué n'ouvre pas une section, il la referme. */}
      <p className="mr-eyebrow">{eyebrow}</p>
      <h2 className={`mr-title mt-4 ${tone === "paper" ? "text-mr-paper" : "text-mr-ink"}`}>
        {title}
      </h2>
      {lead && <p className="mr-lead mt-5">{lead}</p>}
    </div>
  );
}

/**
 * Le premier écran.
 *
 * Il doit répondre à trois questions en cinq secondes : ce que nous faisons,
 * pour qui, et comment on commence. Le texte occupe sept colonnes sur douze —
 * assez pour que le titre respire sans que l'image devienne un décor de fond.
 *
 * L'image est la reliure de création de l'atelier Ferrière sur Le Spleen de
 * Paris : c'est un objet réel, contemporain, et il dit à lui seul que la
 * reliure n'est pas un métier de musée. C'est précisément ce qu'une photo
 * d'établi brun ne disait pas.
 */
function Hero() {
  return (
    <section className={`${SHELL} pt-14 pb-16 sm:pt-20 sm:pb-20 lg:pt-24 lg:pb-28`}>
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
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
          {/* Une ligne, pas trois badges. Trois cartes de réassurance sous un
              CTA sont le signe le plus sûr d'un gabarit. */}
          <p className="mr-small mt-8 max-w-[34rem]">
            Prix communiqué avant engagement <span aria-hidden="true">·</span> Artisans indépendants{" "}
            <span aria-hidden="true">·</span> Prise en charge partout en France
          </p>
        </div>
        <div className="lg:col-span-5">
          <Photograph
            photo={PHOTOS.ferriereBaudelaire}
            sizes={PHOTO_SIZES.hero}
            ratio="landscape"
            priority
            alt="Une reliure contemporaine en mosaïque de cuir gris et aubergine, titrée à l’or et à l’argent, sur Le Spleen de Paris de Baudelaire"
          />
          <p className="mr-meta mt-3">
            Le Spleen de Paris, reliure de création — Atelier Reliure Dorure Ferrière, Orléans
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * La promesse, puis les trois étapes.
 *
 * Fond pierre : c'est la première rupture de la page, et elle arrive tôt pour
 * signaler que le site est un service et pas un portfolio. Les étapes sont
 * horizontales, numérotées, séparées par des filets — jamais des cartes.
 */
function HowItWorks() {
  return (
    <section id={ANCHORS.howItWorks} className="scroll-mt-24 bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead
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
            <li key={step.index} className="border-t border-mr-rule-strong pt-5">
              <span className="mr-meta tabular-nums">{step.index}</span>
              <h3 className="mr-heading mt-3 text-mr-ink">{step.title}</h3>
              <p className="mr-body mt-2 max-w-[24rem]">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * Les six besoins.
 *
 * Sans photographie. Quatre des six étaient illustrés par des images générées ;
 * les retirer aurait laissé une grille à deux images et quatre trous, et
 * remplir ces trous aurait été exactement la faute qu'on vient de corriger.
 *
 * La liste éditoriale fait mieux que la grille de photos qu'elle remplace : un
 * visiteur qui cherche « on peut réparer mon livre ? » balaye six titres et
 * trouve sa réponse, là où six images l'obligeaient à interpréter. Le
 * `detail` nomme les travaux réels — c'est le vocabulaire du catalogue, donc
 * celui qu'il retrouvera dans le tunnel.
 */
function Crafts() {
  return (
    <section id={ANCHORS.crafts} className={`${SHELL} scroll-mt-24 py-section-sm sm:py-section`}>
      <SectionHead
        eyebrow="Les savoir-faire"
        title="Que voulez-vous faire de votre livre ?"
        lead="Six façons d’intervenir. La bonne dépend de son état, de son histoire et de ce que vous en attendez — et c’est la première question que nous vous poserons."
      />
      <dl className="mt-12 grid gap-x-14 gap-y-0 sm:grid-cols-2 lg:mt-16">
        {CRAFTS.map((craft) => (
          <div key={craft.title} className="border-t border-mr-rule py-7">
            <dt className="font-editorial text-[1.5rem] leading-tight text-mr-ink">
              {craft.title}
            </dt>
            <dd>
              <p className="mr-body mt-2">{craft.body}</p>
              <p className="mr-meta mt-3">{craft.detail}</p>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Les réalisations.
 *
 * La seule section qui prouve quelque chose, et la seule dont les images ont
 * une raison d'être grandes. Deux restaurations réelles, avant et après, sur
 * des ouvrages nommés, par un atelier nommé.
 *
 * Le crédit n'est pas une politesse : ces livres ne sont pas passés par Ma
 * Reliure. Le taire laisserait croire le contraire.
 */
function Realisations() {
  return (
    <section className="bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead
          eyebrow="Réalisations"
          title="Le même ouvrage, à son arrivée et à son retour."
          lead="Deux restaurations conduites par l’atelier Reliure Dorure Ferrière, à Orléans."
        />
        <div className="mt-12 grid gap-14 lg:mt-16 lg:grid-cols-2 lg:gap-12">
          {BEFORE_AFTER.map((item) => (
            <figure key={item.title}>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="mr-eyebrow mb-2">Avant</p>
                  <Photograph
                    photo={item.before}
                    sizes={PHOTO_SIZES.beforeAfter}
                    ratio="landscape"
                    alt={item.beforeAlt}
                  />
                </div>
                <div>
                  <p className="mr-eyebrow mb-2">Après</p>
                  <Photograph
                    photo={item.after}
                    sizes={PHOTO_SIZES.beforeAfter}
                    ratio="landscape"
                    alt={item.afterAlt}
                  />
                </div>
              </div>
              <figcaption className="mt-6">
                <h3 className="font-editorial text-[1.375rem] leading-snug text-mr-ink">
                  {item.title}
                </h3>
                <p className="mr-body mt-2">{item.body}</p>
                <p className="mr-meta mt-3">Restauration et photographies : {item.credit}</p>
              </figcaption>
            </figure>
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
 *
 * L'appel à l'action le dit : on découvre comment nous choisissons, on ne
 * sélectionne pas un artisan.
 */
function Artisans() {
  if (!SHOW_UNFILLED_SECTIONS && ARTISANS.length === 0) return null;
  return (
    <section className={`${SHELL} py-section-sm sm:py-section`}>
      <SectionHead
        eyebrow="Les ateliers"
        title="Derrière chaque projet, un artisan."
        lead="Ma Reliure travaille avec des ateliers indépendants installés en France, choisis pour leurs savoir-faire et le type de travail qu’ils souhaitent recevoir."
      />
      <div className="mt-12 lg:mt-16">
        {ARTISANS.map((artisan) => (
          <ArtisanCard key={artisan.id} artisan={artisan} />
        ))}
      </div>
      <p id={ANCHORS.binders} className="mr-body mt-12 max-w-[38rem] scroll-mt-24">
        Vous tenez un atelier de reliure ?{" "}
        <a href={`mailto:${MARELIURE_CONTACT_EMAIL}`} className="mr-link">
          Écrivez-nous
        </a>{" "}
        — nous cherchons des relieurs installés en France, quel que soit leur savoir-faire dominant.
      </p>
    </section>
  );
}

/**
 * Les engagements, sur fond d'encre.
 *
 * La seule rupture sombre de la page, et elle tombe au moment où le visiteur
 * se demande s'il peut confier un objet auquel il tient. Numérotés, sans
 * icône : une icône devant chaque phrase les ferait lire comme des arguments,
 * un numéro les fait lire comme des conditions.
 */
function Commitments() {
  return (
    <section className="bg-mr-ink text-mr-paper">
      <div className={`${SHELL} py-section sm:py-section-lg`}>
        <SectionHead
          eyebrow="Nos engagements"
          title="Vous confiez plus qu’un objet."
          lead="Un livre part de chez vous, passe des semaines dans un atelier, et revient. Voici ce que nous garantissons sur ce trajet."
          tone="paper"
        />
        <ol className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {COMMITMENTS.map((commitment, index) => (
            <li key={commitment.title} className="border-t border-mr-paper/25 pt-5">
              <span className="mr-meta tabular-nums">{String(index + 1).padStart(2, "0")}</span>
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
 * Pédagogique, jamais tabulaire. Une grille à trois colonnes — Basic, Pro,
 * Premium — dirait que le travail est standardisé, ce qu'il n'est pas, et
 * afficherait des montants que nous n'avons pas relevés.
 *
 * La composition en 5/7 met la promesse à gauche et les facteurs à droite :
 * on lit d'abord pourquoi il n'y a pas de grille, ensuite ce qui fait varier.
 */
function Pricing() {
  return (
    <section className={`${SHELL} py-section-sm sm:py-section`}>
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <SectionHead eyebrow="Tarifs" title="Un travail artisanal, un prix expliqué." />
          <p className="mr-body mt-6">
            Chaque livre est différent. Nous ne publions pas de grille tarifaire, parce qu’une
            grille donnerait un chiffre faux à la plupart des projets. Nous regardons le travail à
            faire, puis nous annonçons un prix ferme.
          </p>
          <div className="mt-8">
            <IntakeCta size="compact" />
          </div>
        </div>
        <dl className="lg:col-span-7">
          {PRICE_FACTORS.map((factor) => (
            <div key={factor.title} className="border-t border-mr-rule py-6">
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
 * L'argument national.
 *
 * Il lève la contrainte qui fait abandonner : le métier est traditionnellement
 * local, et quelqu'un qui n'a pas de relieur dans sa ville renonce. Traité en
 * typographie et en filets, jamais en carte de France ni en illustration
 * isométrique — nous n'avons pas d'ateliers à y placer.
 *
 * Le trajet est écrit au futur là où il l'est réellement : l'expédition n'est
 * pas construite.
 */
function Reach() {
  return (
    <section className="bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-6">
            <p className="mr-eyebrow">Partout en France</p>
            <h2 className="mr-title mt-4 text-mr-ink">
              Le bon artisan n’est pas forcément le plus proche.
            </h2>
          </div>
          <div className="lg:col-span-6 lg:pt-14">
            <p className="mr-lead">
              Un relieur peut exceller en dorure et ne jamais toucher à une reliure ancienne. Ma
              Reliure choisit l’atelier pour ce que votre livre demande, et organise son
              acheminement — vous n’avez pas à trouver, ni à négocier, ni à convoyer.
            </p>
            <p className="mr-small mt-6">
              L’organisation de l’envoi et du retour est en cours de mise en place. D’ici là, nous
              convenons du transport avec vous, projet par projet.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * L'appel final.
 *
 * Texte seul, beaucoup d'air. Une image ici ne dirait rien de plus que celles
 * déjà vues, et un grand bloc décoratif affaiblirait la seule chose qui compte
 * à cet endroit : le bouton.
 */
function FinalCta() {
  return (
    <section className={`${SHELL} py-section sm:py-section-lg`}>
      <div className="max-w-[34rem]">
        <h2 className="mr-title text-mr-ink">
          Il a déjà une histoire.
          <br /> Confiez-nous la suite.
        </h2>
        <p className="mr-lead mt-6">Présentez-nous votre livre en quelques minutes.</p>
        <div className="mt-9">
          <IntakeCta />
        </div>
      </div>
    </section>
  );
}

export function ReliureLanding() {
  return (
    <div id="top" className="mr-site min-h-screen bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main>
        <Hero />
        {/* Les quatre preuves, en filet sous le premier écran. Elles répondent
            à « pourquoi passer par vous » avant que la page explique comment. */}
        <section className={`${SHELL} border-t border-mr-rule py-12 sm:py-14`}>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
            {PROOFS.map((proof) => (
              <div key={proof.title}>
                <h2 className="mr-heading text-mr-ink">{proof.title}</h2>
                <p className="mr-small mt-2">{proof.body}</p>
              </div>
            ))}
          </div>
        </section>
        <HowItWorks />
        <Crafts />
        <Realisations />
        <Artisans />
        <Commitments />
        <Pricing />
        <Reach />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
