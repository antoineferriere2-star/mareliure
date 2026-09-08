/**
 * L'entête, le pied de page et le bouton d'entrée dans le Project Intake.
 *
 * Ces trois éléments reviennent à plusieurs endroits de la page ; les isoler
 * évite qu'un lien change à un endroit et pas à l'autre — le genre d'écart qui
 * ne se voit qu'en production.
 */
import { Link } from "@tanstack/react-router";
import { BOOKBINDING_PUBLIC_TOKEN } from "@/build/constants";
import { MARELIURE_BRAND } from "@/marketplace/config";
import { ANCHORS } from "./content";

/**
 * La Mission Métré, atteinte par sa route typée — le même `/m/:publicToken`
 * que toutes les autres Missions. Il n'existe pas de runtime spécifique à la
 * reliure, et il ne doit jamais en exister un.
 */
const INTAKE_PARAMS = { publicToken: BOOKBINDING_PUBLIC_TOKEN } as const;

export const INTAKE_LABEL = "Présenter mon livre";

/**
 * Le bouton unique de la page.
 *
 * Angles nets plutôt que pilule : la pilule est le bouton par défaut de toutes
 * les landings SaaS, et c'est précisément ce dont cette page doit se
 * distinguer. La sans-serif reste, elle — un bouton n'est pas un titre.
 */
export function IntakeCta({
  variant = "solid",
  size = "default",
}: {
  variant?: "solid" | "outline";
  /** `compact` pour l'entête, où le bouton accompagne la lecture au lieu de l'ouvrir. */
  size?: "default" | "compact";
}) {
  const base =
    "inline-flex items-center justify-center rounded-[2px] font-semibold tracking-[0.01em] transition-colors duration-200";
  // Une seule classe de taille par variante, jamais deux qu'il faudrait
  // départager : entre `px-7` et `px-4` c'est l'ordre dans la feuille de style
  // compilée qui tranche, pas l'ordre dans l'attribut — donc un résultat qu'on
  // ne peut pas lire dans le code.
  const sizes = {
    default: "px-7 py-4 text-[0.9375rem]",
    compact: "px-4 py-2.5 text-[0.8125rem] sm:px-5 sm:py-3",
  } as const;
  const skins = {
    solid: "bg-mr-ink text-mr-paper hover:bg-mr-walnut",
    outline: "border border-mr-ink/25 text-mr-ink hover:border-mr-ink hover:bg-mr-ink/[0.04]",
  } as const;
  return (
    <Link
      to="/m/$publicToken"
      params={INTAKE_PARAMS}
      className={`${base} ${sizes[size]} ${skins[variant]}`}
    >
      {INTAKE_LABEL}
    </Link>
  );
}

const NAV = [
  { href: `#${ANCHORS.howItWorks}`, label: "Comment ça marche" },
  { href: `#${ANCHORS.crafts}`, label: "Les savoir-faire" },
  { href: `#${ANCHORS.binders}`, label: "Pour les relieurs" },
] as const;

/**
 * Le nom, en serif, avec le filet laiton qui sert de signature à la marque.
 * C'est la seule dorure de l'entête : l'accent doit rester rare pour rester
 * un accent.
 */
function Wordmark({ tone = "ink" }: { tone?: "ink" | "paper" }) {
  return (
    <span className="inline-flex flex-col leading-none">
      <span
        className={`mr-title text-[1.35rem] sm:text-[1.5rem] ${
          tone === "paper" ? "text-mr-paper" : "text-mr-ink"
        }`}
      >
        {MARELIURE_BRAND}
      </span>
      <span aria-hidden="true" className="mt-1.5 h-px w-8 bg-mr-brass" />
    </span>
  );
}

/**
 * Entête légèrement collante : elle suit la lecture pour que le bouton reste
 * atteignable, sans se transformer en barre translucide. Fond plein, un filet
 * en dessous, rien d'autre.
 *
 * Sur mobile la navigation disparaît au profit du seul bouton. Un menu
 * hamburger pour trois ancres coûterait un panneau à ouvrir là où le pied de
 * page les propose déjà, et volerait la place de ce que la personne est venue
 * faire.
 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-mr-rule/70 bg-mr-paper">
      <div className="mx-auto flex max-w-[78rem] items-center justify-between gap-6 px-5 py-4 sm:px-8 sm:py-5">
        <a href="#top" className="shrink-0" aria-label={`${MARELIURE_BRAND} — accueil`}>
          <Wordmark />
        </a>

        <nav aria-label="Navigation principale" className="hidden lg:block">
          <ul className="flex items-center gap-9">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="text-sm text-mr-muted underline-offset-[6px] transition-colors hover:text-mr-ink hover:underline"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <IntakeCta variant="outline" size="compact" />
      </div>
    </header>
  );
}

/**
 * Les pages légales n'existent pas encore. Elles sont annoncées, pas liées :
 * un lien vers la page Contact actuelle enverrait une lectrice française sur
 * une page Métré Build en anglais, et un lien mort serait pire que l'aveu.
 */
const LEGAL_PENDING = ["Mentions légales", "Confidentialité", "CGU / CGV", "Contact"] as const;

export function LandingFooter() {
  return (
    <footer className="border-t border-mr-rule bg-mr-paper-deep">
      <div className="mx-auto max-w-[78rem] px-5 py-14 sm:px-8 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-5 max-w-xs text-sm leading-6 text-mr-muted">
              Reliure, restauration et création, confiées à des ateliers sélectionnés.
            </p>
          </div>

          <nav aria-label="Pied de page">
            <h2 className="mr-eyebrow">Le service</h2>
            <ul className="mt-4 space-y-3">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-sm text-mr-walnut underline-offset-4 hover:underline"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="mr-eyebrow">Informations</h2>
            <ul className="mt-4 space-y-3">
              {LEGAL_PENDING.map((label) => (
                <li key={label} className="text-sm text-mr-muted">
                  {label}
                  <span className="ml-2 text-xs text-mr-muted/70">en préparation</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-12 border-t border-mr-rule pt-6 text-xs text-mr-muted">
          {MARELIURE_BRAND} — reliure et restauration de livres, par des artisans sélectionnés.
        </p>
      </div>
    </footer>
  );
}
