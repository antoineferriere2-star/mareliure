/**
 * L'espace client, aux couleurs de Ma Reliure.
 *
 * Moins éditorial que la page d'accueil, plus fonctionnel — mais pas un
 * tableau de bord générique : le papier, l'encre, la serif pour les titres,
 * des filets plutôt que des cartes.
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BOOKBINDING_PUBLIC_TOKEN } from "@/build/constants";

export function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mr-site min-h-screen bg-mr-paper text-mr-graphite">
      <header className="border-b border-mr-rule bg-mr-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/mes-livres" className="mr-title text-[1.35rem] text-mr-ink">
            Ma Reliure
          </Link>
          <Link
            to="/m/$publicToken"
            params={{ publicToken: BOOKBINDING_PUBLIC_TOKEN }}
            className="mr-tap mr-small text-mr-graphite underline-offset-4 hover:text-mr-ink hover:underline"
          >
            Confier un autre livre
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">{children}</main>
    </div>
  );
}
