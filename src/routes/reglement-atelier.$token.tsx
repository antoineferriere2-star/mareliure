import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getWorkshopPublicPayment,
  createPublicWorkshopCheckout,
} from "@/marketplace/services/workshopOnlinePayment.data.functions";
export const Route = createFileRoute("/reglement-atelier/$token")({
  head: () => ({
    meta: [
      { title: "Règlement de votre facture atelier" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: Payment,
});
function Payment() {
  const { token } = Route.useParams();
  const load = useServerFn(getWorkshopPublicPayment);
  const checkout = useServerFn(createPublicWorkshopCheckout);
  const query = useQuery({
    queryKey: ["workshop-payment", token],
    queryFn: () => load({ data: { token } }),
    retry: false,
    refetchInterval: 15000,
  });
  const action = useMutation({
    mutationFn: () => checkout({ data: { token } }),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const p = query.data;
  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <h1 className="font-serif text-3xl">Règlement de votre facture</h1>
      {query.isPending ? (
        <p className="mt-6">Chargement…</p>
      ) : !p ? (
        <p className="mt-6">Ce lien est indisponible ou expiré. Contactez votre atelier.</p>
      ) : (
        <section className="mt-8 space-y-5">
          <p>
            {p.seller} · Facture {p.number}
          </p>
          <p className="text-2xl">
            {(p.amountCents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}{" "}
            TTC
          </p>
          <p>
            L’atelier est le vendeur de la prestation et émet votre facture. Le paiement est traité
            par Stripe pour son compte.
          </p>
          {p.status === "paid" || p.status === "refunded" ? (
            <p role="status">
              Paiement confirmé.
              {p.refundedCents > 0 && ` Remboursement : ${(p.refundedCents / 100).toFixed(2)} €.`}
            </p>
          ) : p.status === "processing" ? (
            <p role="status">Paiement en cours de confirmation.</p>
          ) : (
            <button
              className="rounded bg-stone-900 px-5 py-3 text-white"
              disabled={action.isPending}
              onClick={() => action.mutate()}
            >
              Payer avec Stripe
            </button>
          )}
          {action.isError && (
            <p role="alert">
              Le paiement n’a pas pu être ouvert. Réessayez ou contactez votre atelier.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
