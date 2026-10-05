import { createFileRoute } from "@tanstack/react-router";
import { MARELIURE_CONTACT_EMAIL, MARELIURE_PUBLISHER } from "@/marketplace/legal/legalEntity";
export const Route = createFileRoute("/conditions-ateliers")({
  head: () => ({ meta: [{ title: "Conditions ateliers — Oppe" }] }),
  component: Terms,
});
function Terms() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-14">
      <h1 className="font-serif text-3xl">Conditions ateliers</h1>
      <p>
        Version du 5 octobre 2026 · {MARELIURE_PUBLISHER.name} · {MARELIURE_PUBLISHER.address} ·
        SIREN {MARELIURE_PUBLISHER.siren}
      </p>
      <p>
        Ces conditions décrivent les activités distinctes proposées aux ateliers de Ma Reliure et
        Fine Bindery. Les services payants restent fermés jusqu’à leur ouverture annoncée.
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
        L’abonnement est de 15 € HT par mois, augmenté des taxes applicables déterminées à la
        facturation. Les ateliers inscrits avant l’ouverture restent gratuits jusqu’à leur
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
        facturation n’est conféré à Oppe. Sur un paiement traité en ligne, les frais Oppe sont de 3
        % du TTC encaissé. Les frais Stripe sont distincts et à la charge de l’atelier selon son
        contrat Stripe. Un règlement direct déclaré dans l’outil n’entraîne pas ces frais. Les
        remboursements passent par un avoir et sont rapprochés du paiement ; la part des frais
        d’application correspondante est remboursée. Le traitement des frais Stripe suit les
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
      <h2 className="font-serif text-xl">Responsabilité et litiges — revue juridique requise</h2>
      <p>
        Les clauses de responsabilité, garanties, suspension, rétractation éventuellement applicable
        et règlement des litiges doivent être relues par un conseil juridique avant ouverture
        contractuelle des services payants. Cette revue n’est pas obtenue. Un litige de paiement est
        suivi auprès de Stripe et rapproché de la commande et des pièces de l’atelier. Pour toute
        question :{" "}
        <a className="underline" href={`mailto:${MARELIURE_CONTACT_EMAIL}`}>
          {MARELIURE_CONTACT_EMAIL}
        </a>
        .
      </p>
    </main>
  );
}
