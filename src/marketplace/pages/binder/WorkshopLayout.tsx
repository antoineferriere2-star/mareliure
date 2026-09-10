/**
 * L'espace atelier : un outil de production. Même papier et même encre que Ma
 * Reliure, une densité de poste de travail. Le layout est un décor, jamais une
 * permission — chaque server function vérifie l'atelier et le dossier.
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function WorkshopLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mr-site min-h-screen bg-mr-paper text-mr-graphite">
      <header className="border-b border-mr-rule bg-mr-paper">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-3.5 sm:px-8">
          <Link to="/atelier" className="mr-title text-[1.25rem] text-mr-ink">
            Ma Reliure <span className="mr-small align-middle text-mr-muted">· atelier</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
