/**
 * Le cadre de l'espace client : où je suis, comment revenir à mes livres,
 * comment revenir à l'accueil. Le même cadre sur la liste et sur chaque
 * projet — un client arrivé par le lien d'un e-mail n'a jamais besoin de
 * l'historique de son navigateur pour se retrouver.
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  customerCopy,
  customerLocaleForBrand,
} from "@/marketplace/customer/customerPresentation";
import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";

export function CustomerPortalShell({
  brand,
  children,
}: {
  brand: MarketplaceBrand | null;
  children: ReactNode;
}) {
  const copy = customerCopy(customerLocaleForBrand(brand));
  return (
    <div className="min-h-screen bg-[#f7f2e8] text-[#241a12]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-[#241a12] focus:px-3 focus:py-2 focus:text-sm focus:text-[#fdfaf3]"
      >
        {copy.skipToContent}
      </a>
      <header className="border-b border-[#3b2a1d]/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-3">
          <a
            href="/"
            aria-label={`${copy.brandHome} — ${copy.home}`}
            className="min-h-11 rounded-md py-2 font-serif text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b2a1d]/60 focus-visible:ring-offset-2"
          >
            {copy.brandHome}
          </a>
          <nav aria-label={copy.myBooks}>
            <Link
              to="/mes-livres"
              className="inline-flex min-h-11 items-center rounded-md px-2 text-sm text-[#4b3a2c] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b2a1d]/60"
              activeProps={{ className: "font-semibold text-[#241a12] underline" }}
            >
              {copy.myBooks}
            </Link>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-4xl px-5 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
