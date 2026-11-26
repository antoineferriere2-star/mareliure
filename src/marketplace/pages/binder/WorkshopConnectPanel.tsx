import { CARD } from "./quotes/quoteUi";

/**
 * Ex-panneau « Paiements de vos clients » (Stripe Connect, frais de 3 %). Depuis le pivot du
 * 22 novembre 2026, Oppe n'encaisse plus pour l'atelier : le relieur facture et se fait régler
 * lui-même. La configuration Stripe n'est plus proposée ; les liens de paiement déjà ouverts se
 * terminent aux conditions d'origine, depuis la facture concernée.
 */
export function WorkshopConnectPanel() {
  return (
    <section className={CARD}>
      <h2 className="font-serif text-xl">Paiements de vos clients</h2>
      <p className="mt-3">
        Vous restez le vendeur : vous émettez la facture et vous êtes réglé directement par votre
        client, par le moyen de votre choix. Oppe ne perçoit aucun frais sur ces règlements.
      </p>
      <p className="mt-3">
        Les paiements en ligne déjà ouverts avant le 22 novembre 2026 se terminent aux conditions
        d’origine ; leur suivi reste disponible sur la facture concernée.
      </p>
    </section>
  );
}
