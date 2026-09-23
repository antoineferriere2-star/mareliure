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
  account,
}: {
  brand: MarketplaceBrand | null;
  children: ReactNode;
  /**
   * Le compte ouvert et la sortie (voir SignOutButton) — donnés par la route,
   * qui seule connaît la session. Le cadre ne fait que lui réserver la place,
   * ce qui le garde rendable sans routeur ni session.
   */
  account?: ReactNode;
}) {
  const copy = customerCopy(customerLocaleForBrand(brand));
  const fineBindery = brand === "FINE_BINDERY";
  return (
    <div className={`${fineBindery ? "fb-site bg-[#f8f6f0] text-[#14201d]" : "bg-[#f7f2e8] text-[#241a12]"} mr-site min-h-screen`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-[#241a12] focus:px-3 focus:py-2 focus:text-sm focus:text-[#fdfaf3]"
      >
        {copy.skipToContent}
      </a>
      <header className={`border-b ${fineBindery ? "border-[#14201d]/15 bg-[#f8f6f0]" : "border-[#3b2a1d]/10"}`}>
        <div className={`mx-auto flex items-center justify-between gap-4 px-5 ${fineBindery ? "max-w-5xl py-5" : "max-w-4xl py-3"}`}>
          <a
            href="/"
            aria-label={`${copy.brandHome} — ${copy.home}`}
            className={`min-h-11 py-2 font-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${fineBindery ? "text-xl tracking-[-0.01em] focus-visible:ring-[#8b6329]" : "rounded-md text-lg focus-visible:ring-[#3b2a1d]/60"}`}
          >
            {copy.brandHome}
          </a>
          <div className="flex items-center gap-2 sm:gap-4">
            <nav aria-label={copy.myBooks}>
              <Link
                to="/mes-livres"
                className="inline-flex min-h-11 items-center rounded-md px-2 text-sm text-[#4b3a2c] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b2a1d]/60"
                activeProps={{ className: "font-semibold text-[#241a12] underline" }}
              >
                {copy.myBooks}
              </Link>
            </nav>
            {account}
          </div>
        </div>
      </header>
      <main id="main" className={`mx-auto px-5 ${fineBindery ? "max-w-5xl py-10 sm:py-14" : "max-w-4xl py-6 sm:py-8"}`}>
        {fineBindery && <div className="mb-10 border-y border-[#14201d]/15 py-4 text-sm leading-6 text-[#4f5b57]"><strong className="mr-2 font-semibold text-[#14201d]">Your Fine Bindery concierge</strong> coordinates the workshop, decisions and next step for every book in this space.</div>}
        {children}
      </main>
    </div>
  );
}
