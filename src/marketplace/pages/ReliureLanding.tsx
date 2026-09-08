/**
 * The marketplace's public face.
 *
 * Its only job is to get someone to press "Présenter mon livre", which opens
 * the Métré Mission at /m/:publicToken — the same runtime the Deck demo uses,
 * not a second one. Nothing about the qualification lives here.
 *
 * No figure on this page is invented. There is no rating, no project counter
 * and no artisan count, because none of those numbers are real yet (§59). When
 * they are, they belong here; until then their absence is the honest design.
 */
import { Link } from "@tanstack/react-router";
import { BOOKBINDING_PUBLIC_TOKEN } from "@/build/constants";

/**
 * The Mission runtime, reached by its own typed route — the same
 * `/m/:publicToken` every other Métré Mission uses. There is no
 * bookbinding-specific runtime, and there must never be one.
 */
const INTAKE_PARAMS = { publicToken: BOOKBINDING_PUBLIC_TOKEN } as const;

const STEPS = [
  { n: "1", label: "Photographiez votre livre" },
  { n: "2", label: "Décrivez votre projet" },
  { n: "3", label: "Nous sélectionnons les artisans adaptés" },
  { n: "4", label: "Recevez leurs propositions" },
  { n: "5", label: "Choisissez votre relieur" },
  { n: "6", label: "Suivez sa transformation" },
];

const PROJECTS = [
  {
    title: "Réparer",
    body: "Un dos fendu, des pages qui se détachent, une couverture qui ne tient plus. Le livre redevient un livre qu'on ouvre.",
  },
  {
    title: "Restaurer",
    body: "Un ouvrage ancien qu'on veut conserver au plus près de son état d'origine, sans le transformer.",
  },
  {
    title: "Transformer",
    body: "Une reliure neuve sur un livre courant : toile, papier décoré, demi-cuir. Il change d'allure et de durée de vie.",
  },
  {
    title: "Créer une édition collector",
    body: "Une pièce unique : matières choisies, nerfs, dorure, étui. Quelques semaines d'atelier pour un objet qui traverse le siècle.",
  },
];

const TRUST = [
  {
    title: "Artisans sélectionnés",
    body: "Chaque atelier est examiné avant d'entrer sur la plateforme.",
  },
  {
    title: "Trois propositions au maximum",
    body: "Jamais quinze devis : trois artisans choisis pour votre projet.",
  },
  {
    title: "Paiement sécurisé",
    body: "Le paiement passe par la plateforme, jamais de la main à la main.",
  },
  {
    title: "Photos avant / après",
    body: "L'état du livre est constaté et photographié à chaque étape.",
  },
];

function Cta({ variant = "solid" }: { variant?: "solid" | "outline" }) {
  const base =
    "inline-flex items-center justify-center rounded-full px-8 py-4 text-base font-semibold transition";
  return (
    <Link
      to="/m/$publicToken"
      params={INTAKE_PARAMS}
      className={
        variant === "solid"
          ? `${base} bg-[#3b2a1d] text-[#f7f2e8] hover:bg-[#25190f]`
          : `${base} border border-[#3b2a1d]/30 text-[#3b2a1d] hover:border-[#3b2a1d] hover:bg-[#3b2a1d]/5`
      }
    >
      Présenter mon livre
    </Link>
  );
}

export function ReliureLanding() {
  return (
    <div className="min-h-screen bg-[#f7f2e8] text-[#241a12]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <span className="font-serif text-xl tracking-tight">Reliure</span>
        <Link
          to="/m/$publicToken"
          params={INTAKE_PARAMS}
          className="hidden rounded-full border border-[#3b2a1d]/25 px-5 py-2 text-sm font-semibold hover:border-[#3b2a1d] sm:inline-flex"
        >
          Présenter mon livre
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-16">
        <h1 className="max-w-3xl font-serif text-4xl leading-[1.1] sm:text-6xl">
          Donnez une nouvelle vie aux livres auxquels vous tenez.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#4b3a2c] sm:text-xl">
          Photographiez votre livre, décrivez ce que vous souhaitez et recevez les propositions de
          relieurs sélectionnés.
        </p>
        <div className="mt-10">
          <Cta />
        </div>
        <p className="mt-4 text-sm text-[#6b5847]">
          Cinq minutes, sans engagement. Vos coordonnées ne sont transmises qu'au relieur que vous
          choisissez.
        </p>
      </section>

      {/* How it works */}
      <section className="border-y border-[#3b2a1d]/10 bg-[#f2ebdd]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="font-serif text-3xl">Comment ça marche</h2>
          <ol className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n} className="flex gap-4">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#3b2a1d]/25 font-serif text-base">
                  {step.n}
                </span>
                <span className="pt-1.5 text-lg leading-7">{step.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Project types */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <h2 className="font-serif text-3xl">Ce qu'un relieur peut faire</h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[#3b2a1d]/15 bg-[#3b2a1d]/15 sm:grid-cols-2">
          {PROJECTS.map((project) => (
            <article key={project.title} className="bg-[#f7f2e8] p-8">
              <h3 className="font-serif text-2xl">{project.title}</h3>
              <p className="mt-3 leading-7 text-[#4b3a2c]">{project.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-[#3b2a1d]/10 bg-[#241a12] text-[#f7f2e8]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="font-serif text-3xl">Ce que nous garantissons</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((item) => (
              <div key={item.title}>
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#c9b8a4]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8 sm:py-28">
        <h2 className="font-serif text-3xl sm:text-4xl">Votre livre mérite mieux qu'un carton.</h2>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-[#4b3a2c]">
          Décrivez-le en quelques minutes. Nous nous chargeons de trouver l'atelier qui saura le
          reprendre.
        </p>
        <div className="mt-10">
          <Cta variant="outline" />
        </div>
      </section>

      <footer className="border-t border-[#3b2a1d]/10 px-5 py-10 text-center text-sm text-[#6b5847] sm:px-8">
        Reliure — une marketplace d'artisans relieurs.
      </footer>
    </div>
  );
}
