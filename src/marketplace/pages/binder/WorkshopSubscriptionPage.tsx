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
            : canCreate
              ? "Votre abonnement est actif."
              : "Votre accès conserve la consultation et le téléchargement des documents historiques. La création de documents et la publication de la vitrine nécessitent un abonnement actif."}
        </p>
        {s.cancel_at_period_end && s.current_period_end && (
          <p className="mt-3">
            Résiliation prévue le {new Date(s.current_period_end).toLocaleDateString("fr-FR")}.
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
      <WorkshopConnectPanel open={settings.online_payment_open} isOwner={isOwner} />
    </div>
  );
}
