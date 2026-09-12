/**
 * L'entête, le pied de page et le bouton d'entrée dans le Project Intake.
 *
 * Ces trois éléments reviennent à plusieurs endroits de la page ; les isoler
 * évite qu'un lien change à un endroit et pas à l'autre — le genre d'écart qui
 * ne se voit qu'en production.
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BOOKBINDING_PUBLIC_TOKEN } from "@/build/constants";
import { MARELIURE_BRAND } from "@/marketplace/config";
import { isMaReliure } from "@/brand";
import { ANCHORS } from "./content";
import { MARELIURE_CONTACT_EMAIL } from "@/marketplace/legal/legalEntity";

/**
 * Un seul conteneur pour toutes les pages éditoriales. Les variations se
 * font en colonnes — jamais une seconde largeur ailleurs dans le produit.
 */
export const SHELL = "mx-auto w-full max-w-[80rem] px-5 sm:px-8";

/**
 * L'ouverture d'une section : surtitre, titre, chapô.
 *
 * Alignée à gauche partout. Centrer un titre est le réflexe qui fait ressembler
 * une page à un gabarit — le lecteur perd le bord sur lequel son œil revient.
 * Partagée entre la landing et toute autre page éditoriale (partenaires
 * relieurs) : une seconde définition aurait fini par diverger silencieusement.
 */
export function SectionHead({
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
      <p className="mr-eyebrow">{eyebrow}</p>
      <h2 className={`mr-title mt-4 ${tone === "paper" ? "text-mr-paper" : "text-mr-ink"}`}>
        {title}
      </h2>
      {lead && <p className="mr-lead mt-5">{lead}</p>}
    </div>
  );
}

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

/**
 * Où vit la landing sur ce déploiement.
 *
 * Sur Ma Reliure c'est la racine ; sur Métré Build la landing reliure est une
 * page parmi d'autres. La distinction compte dès qu'une seconde page publique
 * existe : depuis `/tarifs`, une ancre nue comme `#savoir-faire` ne désigne
 * rien et le lien ne fait rien. Préfixée par la landing, elle y ramène.
 *
 * `isMaReliure` est une constante de compilation : la branche non retenue est
 * retirée du bundle.
 */
const LANDING_PATH = isMaReliure ? "/" : "/reliure";

/**
 * Les ancres sont absolues plutôt que relatives. Sur la landing elles se
 * comportent exactement comme avant ; ailleurs elles y reviennent au lieu de
 * rester inertes.
 */
const NAV = [
  { href: `${LANDING_PATH}#${ANCHORS.howItWorks}`, label: "Comment ça marche" },
  { href: `${LANDING_PATH}#${ANCHORS.crafts}`, label: "Les savoir-faire" },
  { href: "/tarifs", label: "Tarifs" },
  // Vers la page de recrutement, pas l'ancre de la landing : ce lien vise un
  // relieur, pas un propriétaire de livre — les deux publics ne lisent jamais
  // la même page d'atterrissage.
  { href: "/partenaires-relieurs", label: "Pour les relieurs" },
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
        {/* Absolu pour la même raison que les ancres : depuis /tarifs, `#top`
            ne ramènerait pas à l'accueil, il ne ferait rien. */}
        <a
          href={`${LANDING_PATH}#top`}
          className="shrink-0"
          aria-label={`${MARELIURE_BRAND} — accueil`}
        >
          <Wordmark />
        </a>

        <nav aria-label="Navigation principale" className="hidden lg:block">
          <ul className="flex items-center gap-9">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="mr-tap mr-small text-mr-graphite underline-offset-[6px] transition-colors hover:text-mr-ink hover:underline"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-4 sm:gap-5">
          {/* Hors du <nav> repliable : contrairement aux ancres de la
              landing, retrouver son espace doit rester possible même sur
              mobile — c'est le seul chemin vers /auth depuis le site public.
              `<a href>`, pas `<Link to>`, comme le reste de la navigation
              secondaire de ce fichier (NAV, SERVICE_LINKS) : landingHonesty.test.ts
              garde `/m/$publicToken` comme seule porte *typée* de la landing —
              une page d'accès au compte n'est pas une seconde Mission. */}
          <a
            href="/auth"
            className="mr-tap mr-small shrink-0 text-mr-graphite underline-offset-[6px] transition-colors hover:text-mr-ink hover:underline"
          >
            Se connecter
          </a>
          <IntakeCta variant="outline" size="compact" />
        </div>
      </div>
    </header>
  );
}

/**
 * Le pied de page.
 *
 * Institutionnel plutôt que « designer » : quelqu'un qui envisage de confier
 * un livre auquel il tient y cherche des preuves d'existence, pas une
 * signature graphique. D'où quatre colonnes nommées, un texte à 15 px et non
 * à 12, et aucune ligne sous le seuil de contraste — l'ancien pied de page
 * tombait à 2,6:1, ce qui revenait à écrire les mentions légales à l'encre
 * sympathique.
 *
 * Les entrées non liées sont annoncées, pas cliquables. Un lien mort ou un
 * renvoi vers une page Métré Build en anglais coûterait plus cher que l'aveu.
 */
const SERVICE_LINKS = [
  { href: `${LANDING_PATH}#${ANCHORS.howItWorks}`, label: "Comment ça marche" },
  { href: `${LANDING_PATH}#${ANCHORS.crafts}`, label: "Les savoir-faire" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/partenaires-relieurs", label: "Pour les relieurs" },
] as const;

const PRESTATIONS = [
  "Réparation",
  "Restauration",
  "Reliure",
  "Dorure",
  "Protection sur mesure",
] as const;

/**
 * Les pages légales, désormais publiées. Seules les conditions générales de
 * vente restent annoncées : elles encadreront la commande et le paiement, qui
 * n'existent pas encore, et les publier aujourd'hui serait décrire un service
 * que personne ne peut acheter.
 */
const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/conditions", label: "Conditions d'utilisation" },
  { href: `mailto:${MARELIURE_CONTACT_EMAIL}`, label: "Contact" },
] as const;

export function LandingFooter() {
  return (
    <footer className="border-t border-mr-rule bg-mr-paper-warm">
      <div className="mx-auto max-w-[80rem] px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mr-small mt-6 max-w-[20rem] text-mr-graphite">
              Reliure, restauration et création, confiées à des ateliers indépendants installés en
              France.
            </p>
          </div>

          <div>
            <h2 className="mr-eyebrow text-mr-graphite">Prestations</h2>
            <ul className="mr-small mt-5 space-y-3 text-mr-graphite">
              {PRESTATIONS.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>

          <nav aria-label="Le service">
            <h2 className="mr-eyebrow text-mr-graphite">Le service</h2>
            <ul className="mr-small mt-5 space-y-3">
              {SERVICE_LINKS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="mr-tap text-mr-graphite underline-offset-4 hover:text-mr-ink hover:underline"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="mr-eyebrow text-mr-graphite">Informations</h2>
            <ul className="mr-small mt-5 space-y-3 text-mr-graphite">
              {LEGAL_LINKS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="mr-tap text-mr-graphite underline-offset-4 hover:text-mr-ink hover:underline"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                Conditions générales de vente{" "}
                <span className="text-mr-muted">— publiées avant l'ouverture du paiement</span>
              </li>
            </ul>
          </div>
        </div>

        <p className="mr-small mt-14 border-t border-mr-rule pt-8 text-mr-graphite">
          {MARELIURE_BRAND} — reliure et restauration de livres, par des artisans indépendants.
        </p>
      </div>
    </footer>
  );
}
