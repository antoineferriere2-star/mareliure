import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  refreshMyWorkshopConnect,
  startMyWorkshopConnect,
  resumeMyWorkshopConnect,
} from "@/marketplace/services/workshopOnlinePayment.data.functions";
import { CARD, ErrorNote, PRIMARY_BUTTON } from "./quotes/quoteUi";
export function WorkshopConnectPanel({ open, onboardingOpen, isOwner }: { open: boolean; onboardingOpen: boolean; isOwner: boolean }) {
  const canConfigure = open || onboardingOpen;
  const [accepted, setAccepted] = useState(false);
  const start = useServerFn(startMyWorkshopConnect);
  const refresh = useServerFn(refreshMyWorkshopConnect);
  const resume = useServerFn(resumeMyWorkshopConnect);
  const onboarding = useMutation({
    mutationFn: () => start({ data: { accepted: true } }),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const status = useQuery({
    queryKey: ["workshop", "connect"],
    queryFn: () => refresh(),
    enabled: canConfigure && isOwner,
    refetchInterval: canConfigure ? 30_000 : false,
  });
  const restart = useMutation({
    mutationFn: () => resume(),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  useEffect(() => {
    if (
      canConfigure &&
      isOwner &&
      new URLSearchParams(window.location.search).get("connect") === "refresh"
    ) {
      // Consume the refresh marker once; all authentication/consent checks run on the server.
      window.history.replaceState(null, "", window.location.pathname);
      restart.mutate();
    }
  }, [canConfigure, isOwner]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className={CARD}>
      <h2 className="font-serif text-xl">Paiements de vos clients</h2>
      <p className="mt-3">
        Vous restez le vendeur et émettez la facture. Frais Oppe : 3 % du montant encaissé, TVA comprise, hors frais Stripe. Les
        frais Stripe sont distincts et à votre charge. Les règlements directs restent gratuits.
      </p>
      {!open && <p className="mt-4">Le paiement en ligne n’est pas encore ouvert. La configuration Stripe ne permet pas encore d’encaisser.</p>}
      {canConfigure && (
        isOwner && (
          <div className="mt-5 space-y-4">
            <label className="flex gap-3">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <span>
                J’accepte les{" "}
                <a href="/conditions-ateliers" className="underline">
                  conditions ateliers
                </a>
                , les frais de 3 % du montant encaissé, TVA comprise, hors frais Stripe.
                Je confirme agir pour mon activité professionnelle établie en France métropolitaine
                à l’adresse de mon profil de facturation et je configure le compte Stripe de mon atelier.
              </span>
            </label>
            <button
              className={PRIMARY_BUTTON}
              disabled={!accepted || onboarding.isPending}
              onClick={() => onboarding.mutate()}
            >
              Configurer mon compte Stripe
            </button>
            <button
              className={`${PRIMARY_BUTTON} ml-3`}
              disabled={status.isPending}
              onClick={() => void status.refetch()}
            >
              Vérifier la configuration
            </button>
            {status.data && (
              <div role="status">
                <p>
                  {status.data.onboarded
                    ? open ? "Compte prêt pour les paiements de vos clients." : "Compte Stripe configuré ; les encaissements restent fermés jusqu’à l’ouverture du service."
                    : "La configuration Stripe reste à compléter ou le type de compte doit être adapté."}
                </p>
                {status.data.requirements.length > 0 && (
                  <p className="mt-3">
                    Stripe demande des informations complémentaires. Complétez-les dans le parcours
                    sécurisé Stripe.
                  </p>
                )}
                {status.data.stripeAccountId && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {!status.data.onboarded && (
                      <button
                        className={PRIMARY_BUTTON}
                        disabled={restart.isPending}
                        onClick={() => restart.mutate()}
                      >
                        Reprendre la configuration
                      </button>
                    )}
                    <a
                      className="underline"
                      href="https://dashboard.stripe.com/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ouvrir mon espace Stripe
                    </a>
                  </div>
                )}
              </div>
            )}
            {(status.isError || onboarding.isError || restart.isError) && (
              <ErrorNote>
                La configuration Stripe n’a pas abouti. Réessayez ou contactez Oppe.
              </ErrorNote>
            )}
          </div>
        )
      )}
    </section>
  );
}
