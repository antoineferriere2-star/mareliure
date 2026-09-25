/**
 * La page introuvable et la page d'erreur de Ma Reliure.
 *
 * Les pages par défaut du gabarit étaient en anglais (« Page not found »,
 * « Go home »), sans la marque, au milieu d'un site entièrement en français :
 * la personne qui suivait un lien ancien se croyait sortie du site. Ici elle
 * reste chez Ma Reliure, avec les trois sorties qu'elle cherche le plus
 * souvent : l'accueil, présenter son livre, les tarifs.
 */
import type { ReactNode } from "react";
import { IntakeCta, LandingFooter, LandingHeader, SHELL } from "./LandingChrome";

function FallbackShell({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead: string; children: ReactNode }) {
  return (
    <div id="top" className="mr-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main className={`${SHELL} flex-1 py-20 sm:py-28`}>
        <div className="max-w-[40rem]">
          <p className="mr-eyebrow">{eyebrow}</p>
          <h1 className="mr-title mt-4 text-mr-ink">{title}</h1>
          <p className="mr-lead mt-5">{lead}</p>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">{children}</div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}

const QUIET_LINK = "mr-tap mr-body text-mr-ink underline decoration-mr-rule underline-offset-[6px] hover:decoration-mr-ink";

export function MaReliureNotFound() {
  return (
    <FallbackShell
      eyebrow="Page introuvable"
      title="Cette page n'existe pas, ou plus."
      lead="Le lien que vous avez suivi est peut-être ancien. Tout le reste est à sa place : vous pouvez présenter votre livre, ou consulter les tarifs avant de vous décider."
    >
      <IntakeCta />
      <a href="/tarifs" className={QUIET_LINK}>Voir les tarifs</a>
      <a href="/" className={QUIET_LINK}>Retour à l'accueil</a>
    </FallbackShell>
  );
}

export function MaReliureError({ onRetry }: { onRetry: () => void }) {
  return (
    <FallbackShell
      eyebrow="Un incident"
      title="Cette page n'a pas pu s'afficher."
      lead="L'erreur vient de notre côté, pas du vôtre. Réessayez dans un instant ; si vous étiez en train de présenter un livre, vos réponses déjà enregistrées vous attendent."
    >
      <button type="button" onClick={onRetry} className="inline-flex items-center justify-center rounded-[2px] bg-mr-ink px-7 py-4 text-[0.9375rem] font-semibold tracking-[0.01em] text-mr-paper transition-colors duration-200 hover:bg-mr-graphite">
        Réessayer
      </button>
      <a href="/" className={QUIET_LINK}>Retour à l'accueil</a>
    </FallbackShell>
  );
}
