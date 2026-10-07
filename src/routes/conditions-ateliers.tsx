import { createFileRoute } from "@tanstack/react-router";
import { MARELIURE_CONTACT_EMAIL, MARELIURE_PUBLISHER } from "@/marketplace/legal/legalEntity";
import { WORKSHOP_OFFER } from "@/marketplace/offer/workshopOffer";
export const Route = createFileRoute("/conditions-ateliers")({
  head: () => ({ meta: [{ title: "Conditions ateliers — Oppe" }] }),
  component: Terms,
});
function Terms() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-14">
      <h1 className="font-serif text-3xl">Conditions ateliers</h1>
      <p>
        Version du 7 octobre 2026 · {MARELIURE_PUBLISHER.name} · {MARELIURE_PUBLISHER.address} ·
        SIREN {MARELIURE_PUBLISHER.siren}
      </p>
      <p>
        Ces conditions décrivent les activités distinctes proposées aux ateliers de Ma Reliure et
        Fine Bindery. {WORKSHOP_OFFER.subscriptionOpen ? "L’abonnement B est ouvert aux ateliers professionnels établis en France métropolitaine." : "L’abonnement B n’est pas encore ouvert."}{" "}
        {WORKSHOP_OFFER.onlinePaymentOpen ? "Le paiement intégré C est ouvert aux ateliers dont le compte Stripe est opérationnel." : "Le paiement intégré C n’est pas encore ouvert ; la configuration Stripe de l’atelier peut être préparée."}
      </p>
      <h2 className="font-serif text-xl">A — Prestations confiées par Oppe</h2>
      <p>
        Oppe vend au client final. L’atelier accepte expressément la prestation, sa rémunération HT
        et son délai avant l’engagement. Il facture Oppe, avec sa fiscalité propre, sur la base de
        cet accord. Le règlement intervient sous 30 jours à compter de l’émission d’une facture
        conforme et contrôlée. Une annulation ou une réattribution doit être motivée ; les documents
        émis et l’historique restent conservés.
      </p>
      <h2 className="font-serif text-xl">B — Outil atelier et vitrine</h2>
      <p>
        Pour un atelier professionnel établi en France métropolitaine, l’abonnement est de 15 € HT
        par mois, plus 3 € de TVA à 20 %, soit 18 € TTC par mois, vitrine incluse. OPPE collecte
        cette TVA même si l’atelier bénéficie de la franchise en base. Le pays d’établissement et
        les informations professionnelles sont à renseigner avant souscription ; les autres
        territoires nécessitent une qualification individuelle et aucun taux ne leur est appliqué
        automatiquement. Les quatre ateliers historiques restent gratuits jusqu’à leur
        acceptation expresse de la transition payante. Le renouvellement est mensuel. La résiliation
        s’effectue dans le portail Stripe pour la fin de la période en cours. À son terme, la
        création de devis et de factures et la publication de la vitrine sont suspendues. La
        consultation et le téléchargement des documents historiques restent accessibles aux membres
        autorisés. Aucun volume de commandes n’est garanti.
      </p>
      <h2 className="font-serif text-xl">Publication</h2>
      <p>
        L’atelier vérifie les coordonnées, les descriptions et les droits des images avant
        publication explicite. Les ouvrages et contacts privés ne sont jamais publiés
        automatiquement. Une réalisation exige le consentement prévu dans l’outil et une
        photographie autorisée. L’atelier peut retirer sa vitrine.
      </p>
      <h2 className="font-serif text-xl">C — Paiements des clients propres</h2>
      <p>
        L’atelier reste vendeur, responsable du devis, de l’accord client, de la facture et des
        taxes applicables. Oppe fournit l’outil et l’intégration Stripe Connect ; aucun mandat de
        facturation n’est conféré à Oppe. Les frais Oppe sont de 3 % du montant encaissé, TVA
        comprise, hors frais Stripe. Pour un atelier établi en France métropolitaine, 100 € encaissés
        donnent 3 € de frais TTC, soit 2,50 € HT et 0,50 € de TVA à 20 %. La facture de frais
        d’OPPE à l’atelier constate la retenue Stripe déjà effectuée : aucun second paiement.
        Les frais Stripe sont distincts et à la charge de l’atelier selon son
        contrat Stripe. Un règlement direct déclaré dans l’outil n’entraîne pas ces frais. Les
        remboursements passent par un avoir et sont rapprochés du paiement ; la part des frais
        d’application effectivement remboursée donne lieu à un avoir Oppe. Une convention
        antérieure prévoyant expressément des frais HT doit être identifiée avant toute transition
        et ne peut être modifiée silencieusement. Le traitement des frais Stripe suit les
        conditions Stripe.
      </p>
      <h2 className="font-serif text-xl">Transport et international</h2>
      <p>
        Le payeur du transport, le prix et les conditions du transporteur doivent être identifiés
        pour chaque commande. Le forfait Oppe à 15 € TTC est réservé au périmètre français et aux
        colis admissibles ; il ne s’étend pas aux clients propres, aux autres colis ou aux autres
        pays. Aucune assurance supplémentaire n’est promise. Une offre internationale doit être
        chiffrée et acceptée séparément avant tout achat.
      </p>
      <h2 className="font-serif text-xl">Responsabilité, assistance et litiges</h2>
      <p>
        L’abonnement et le paiement intégré sont destinés aux ateliers professionnels pour leur
        activité. L’atelier répond de ses prestations et des engagements pris avec ses clients ;
        OPPE répond des services de l’outil qu’elle fournit. Les droits et garanties impératifs
        applicables restent réservés, notamment lorsque l’abonné n’agit pas exclusivement pour son
        activité professionnelle ; cette situation nécessite un examen individuel avant souscription.
        Une interruption ou une suspension de l’outil n’efface pas les documents émis : les membres
        autorisés conservent leur consultation et leur téléchargement. En cas de difficulté,
        contactez OPPE pour obtenir assistance et rechercher une résolution. Un litige de paiement
        est suivi auprès de Stripe et rapproché de la commande et des pièces de l’atelier. Pour toute
        question :{" "}
        <a className="underline" href={`mailto:${MARELIURE_CONTACT_EMAIL}`}>
          {MARELIURE_CONTACT_EMAIL}
        </a>
        .
      </p>
    </main>
  );
}
