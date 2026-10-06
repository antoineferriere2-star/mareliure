import { WorkshopConnectPanel } from "./WorkshopConnectPanel";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createMyWorkshopBillingPortal,
  createMyWorkshopCheckout,
  getMyWorkshopSubscription,
} from "@/marketplace/services/workshopSubscription.data.functions";
import { BinderPageHeader, BinderLoading } from "./BinderPageUi";
import { CARD, ErrorNote, PRIMARY_BUTTON } from "./quotes/quoteUi";
import { SUBSCRIPTION_LABEL } from "@/marketplace/offer/workshopOffer";

export function WorkshopSubscriptionPage() {
  const load = useServerFn(getMyWorkshopSubscription);
  const checkout = useServerFn(createMyWorkshopCheckout);
  const portal = useServerFn(createMyWorkshopBillingPortal);
  const query = useQuery({
    queryKey: ["workshop", "subscription"],
    queryFn: () => load(),
    refetchInterval: 30_000,
  });
  const [accepted, setAccepted] = useState(false);
  const action = useMutation({
    mutationFn: (kind: "checkout" | "portal") =>
      kind === "checkout" ? checkout({ data: { accepted: true } }) : portal(),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  if (query.isPending) return <BinderLoading label="Chargement de votre abonnement…" />;
  if (!query.data) return <ErrorNote>L’abonnement n’a pas pu être chargé.</ErrorNote>;
  const { subscription: s, settings, canCreate, isOwner } = query.data;
  return (
    <div className="space-y-6">
      <BinderPageHeader
        eyebrow="Votre atelier"
        title="Abonnement"
        description="Devis, factures et vitrine professionnelle."
      />
      <section className={CARD}>
        <h2 className="font-serif text-xl">{SUBSCRIPTION_LABEL}</h2>
        <p className="mt-3">
          {s.legacy_free
            ? "Votre atelier bénéficie de la gratuité. Aucun prélèvement sans votre accord explicite."
            : !settings.subscription_open
              ? "Votre accès est disponible pendant la préparation de l’offre payante. Aucun prélèvement sans votre accord."
              : canCreate
                ? "Votre abonnement est actif."
                : "Votre accès conserve la consultation et le téléchargement des documents historiques. La création de documents et la publication de la vitrine nécessitent un abonnement actif."}
        </p>
        {s.cancel_at_period_end && s.current_period_end && (
          <p className="mt-3">
            {s.status === "canceled" ? "Abonnement terminé le " : "Résiliation prévue le "}
            {new Date(s.current_period_end).toLocaleDateString("fr-FR")}.
          </p>
        )}
        {!settings.subscription_open && (
          <p className="mt-3">L’abonnement payant n’est pas encore ouvert.</p>
        )}
        {isOwner &&
          settings.subscription_open &&
          (!s.stripe_subscription_id || ["canceled", "incomplete_expired"].includes(s.status)) && (
            <div className="mt-5 space-y-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                />
                <span>
                  J’accepte de souscrire à {SUBSCRIPTION_LABEL}, hors taxes applicables, avec
                  renouvellement mensuel et résiliation pour la fin de la période en cours.
                  J’accepte les{" "}
                  <a
                    className="underline"
                    href="/conditions-ateliers"
                    target="_blank"
                    rel="noreferrer"
                  >
                    conditions ateliers
                  </a>
                  .{" "}
                  {s.legacy_free &&
                    "Je demande explicitement la transition de mon accès gratuit vers cet abonnement payant."}
                </span>
              </label>
              <button
                className={PRIMARY_BUTTON}
                disabled={!accepted || action.isPending}
                onClick={() => action.mutate("checkout")}
              >
                Souscrire avec Stripe
              </button>
            </div>
          )}
        {isOwner && s.stripe_customer_id && (
          <button
            className={`${PRIMARY_BUTTON} mt-5`}
            disabled={action.isPending}
            onClick={() => action.mutate("portal")}
          >
            Factures, moyen de paiement et résiliation
          </button>
        )}
        {action.isError && (
          <ErrorNote>
            L’action n’a pas abouti. L’abonnement et la configuration Stripe doivent être
            disponibles.
          </ErrorNote>
        )}
      </section>
      {query.data.documents.length > 0 && (
        <section className={CARD}>
          <h2 className="font-serif text-xl">Factures d’abonnement</h2>
          <ul className="mt-4 space-y-3">
            {query.data.documents.map((document) => (
              <li key={document.stripe_invoice_id}>
                <span>
                  {document.number ?? "Facture Stripe"} ·{" "}
                  {new Date(document.issued_at).toLocaleDateString("fr-FR")} ·{" "}
                  {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: document.currency.toUpperCase(),
                  }).format(document.total_cents / 100)}{" "}
                  · {document.status === "paid" ? "Payée" : "À vérifier"}
                </span>
                {document.invoice_url && (
                  <a
                    className="ml-3 underline"
                    href={document.invoice_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Consulter
                  </a>
                )}
                {document.pdf_url && (
                  <a
                    className="ml-3 underline"
                    href={document.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Télécharger le PDF
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {query.data.notices.length > 0 && (
        <section className={CARD}>
          <h2 className="font-serif text-xl">Notifications de votre atelier</h2>
          <ul className="mt-4 space-y-4">
            {query.data.notices.map((notice) => (
              <li key={notice.id}>
                <p className="font-medium">{notice.heading}</p>
                <p>{notice.intro}</p>
                {notice.captured_at && (
                  <p className="text-sm">Recette : e-mail capturé, aucun envoi au destinataire.</p>
                )}
                {!notice.sent_at && !notice.captured_at && (
                  <p className="text-sm">
                    Notification enregistrée · envoi de l’e-mail à reprendre.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <WorkshopConnectPanel open={settings.online_payment_open} isOwner={isOwner} />
    </div>
  );
}
