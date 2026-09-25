import { ArrowRight } from "lucide-react";
import { SHELL } from "./LandingChrome";
export function WorkshopProductInvite() {
  return (
    <section
      className="border-y border-mr-rule bg-mr-paper-warm"
      aria-labelledby="workshop-product-heading"
    >
      <div
        className={`${SHELL} grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.15fr_0.85fr]`}
      >
        <div>
          <p className="mr-eyebrow">Vous êtes relieur ou restaurateur ?</p>
          <h2 id="workshop-product-heading" className="mr-title mt-4 text-mr-ink">
            Un outil métier conçu pour votre atelier.
          </h2>
          <p className="mr-body mt-5 max-w-xl">
            Créez vos devis, personnalisez vos tarifs, suivez vos ouvrages et vos clients depuis un
            seul espace.
          </p>
          <p className="mt-5 font-semibold text-mr-bordeaux">Gratuit, sans abonnement.</p>
          <a
            href="/partenaires-relieurs"
            className="mt-7 inline-flex items-center gap-3 rounded-sm bg-mr-bordeaux px-6 py-4 font-semibold text-white hover:bg-mr-ink"
          >
            Découvrir l’espace relieur <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </a>
        </div>
        <a
          href="/partenaires-relieurs#outil-devis"
          aria-label="Découvrir l’outil de devis"
          className="block overflow-hidden rounded-sm border border-mr-rule-strong bg-white shadow-lg"
        >
          <img
            src="/product/workbench.webp"
            alt="L’outil de devis Ma Reliure : prestations, formats et récapitulatif"
            width={1240}
            height={1430}
            loading="lazy"
            className="h-auto w-full"
          />
        </a>
      </div>
    </section>
  );
}
