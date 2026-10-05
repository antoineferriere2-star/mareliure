import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  refreshMyWorkshopConnect,
  startMyWorkshopConnect,
} from "@/marketplace/services/workshopOnlinePayment.data.functions";
import { CARD, ErrorNote, PRIMARY_BUTTON } from "./quotes/quoteUi";
export function WorkshopConnectPanel({ open, isOwner }: { open: boolean; isOwner: boolean }) {
  const [accepted, setAccepted] = useState(false);
  const start = useServerFn(startMyWorkshopConnect);
  const refresh = useServerFn(refreshMyWorkshopConnect);
  const onboarding = useMutation({
    mutationFn: () => start({ data: { accepted: true } }),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const status = useMutation({ mutationFn: () => refresh() });
  return (
    <section className={CARD}>
      <h2 className="font-serif text-xl">Paiements de vos clients</h2>
      <p className="mt-3">
        Vous restez le vendeur et émettez la facture. Frais Oppe : 3 % du TTC encaissé en ligne. Les
        frais Stripe sont distincts et à votre charge. Les règlements directs restent gratuits.
      </p>
      {!open ? (
        <p className="mt-4">Le paiement en ligne n’est pas encore ouvert.</p>
      ) : (
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
                , les frais de 3 % et les frais Stripe distincts, et je configure le compte Stripe
                de mon atelier.
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
              onClick={() => status.mutate()}
            >
              Vérifier la configuration
            </button>
            {status.data && (
              <p role="status">
                {status.data.onboarded
                  ? "Compte prêt pour les paiements de vos clients."
                  : "La configuration Stripe reste à compléter ou le type de compte doit être adapté."}
              </p>
            )}
            {(status.isError || onboarding.isError) && (
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
