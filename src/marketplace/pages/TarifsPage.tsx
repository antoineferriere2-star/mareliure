/**
 * La page tarifs de Ma Reliure : un seul abonnement (19,90 € HT par mois), essai gratuit de
 * 14 jours sans carte bancaire, sans engagement (brief du 25 novembre 2026). Pas de palier
 * lié au nombre de personnes dans l'atelier. L'ancienne page
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
        <ul className="mr-body mt-8 max-w-[40rem] space-y-2">
          {RELIEUR_PRICING.included.map((item) => <li key={item} className="flex gap-3"><span aria-hidden="true" className="text-mr-bordeaux">—</span>{item}</li>)}
        </ul>
        <div className="mt-10">
          <ActionLink href={WORKSHOP_SIGNUP_HREF}>{WORKSHOP_SIGNUP_LABEL}</ActionLink>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
