/**
 * La page tarifs de Ma Reliure — un emplacement, depuis le pivot du 22 novembre 2026.
 *
 * Ma Reliure devient un abonnement pour les relieurs. Aucun montant n'est publié
 * tant que le consentement à payer n'est pas validé avec le premier cercle
 * d'ateliers : ni palier, ni « à partir de », ni fourchette. L'ancienne page
 * (45 prestations et facteurs de prix d'un ouvrage) décrivait un prix pour le
 * propriétaire du livre, qui n'est plus le public du site.
 */
import { LandingFooter, LandingHeader, SectionHead, SHELL, WORKSHOP_SIGNUP_HREF, WORKSHOP_SIGNUP_LABEL } from "./landing/LandingChrome";
import { ActionLink } from "./landing/actions";
import { RELIEUR_PRICING } from "./landing/relieurContent";

export function TarifsPage() {
  return (
    <div id="top" className="mr-site min-h-screen bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main id="contenu" className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead eyebrow={RELIEUR_PRICING.eyebrow} title={RELIEUR_PRICING.title} lead={RELIEUR_PRICING.body} />
        <div className="mt-10">
          <ActionLink href={WORKSHOP_SIGNUP_HREF}>{WORKSHOP_SIGNUP_LABEL}</ActionLink>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
