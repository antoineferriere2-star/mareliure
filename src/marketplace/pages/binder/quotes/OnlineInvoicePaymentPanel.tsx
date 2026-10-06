import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createMyInvoicePaymentLink,
  getMyInvoiceOnlinePayment,
  refundMyWorkshopOnlinePayment,
} from "@/marketplace/services/workshopOnlinePayment.data.functions";
import { CARD, ErrorNote, PRIMARY_BUTTON } from "./quoteUi";
import type { DocumentView } from "@/marketplace/quotes/quoteViews";
import { euros } from "@/marketplace/quotes/quoteFormat";
export function OnlineInvoicePaymentPanel({ doc }: { doc: DocumentView }) {
  const load = useServerFn(getMyInvoiceOnlinePayment);
  const link = useServerFn(createMyInvoicePaymentLink);
  const refund = useServerFn(refundMyWorkshopOnlinePayment);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["invoice-online-payment", doc.id],
    queryFn: () => load({ data: { invoiceId: doc.id } }),
    refetchInterval: 15000,
  });
  const [url, setUrl] = useState("");
  const create = useMutation({
    mutationFn: () => link({ data: { invoiceId: doc.id } }),
    onSuccess: async ({ url }) => {
      setUrl(url);
      await client.invalidateQueries({ queryKey: ["invoice-online-payment", doc.id] });
    },
  });
  const repayment = useMutation({
    mutationFn: (creditId: string) =>
      refund({ data: { paymentId: query.data!.payment!.id, creditId } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["invoice-online-payment", doc.id] }),
  });
  const p = query.data?.payment;
  return (
    <section className={CARD}>
      <h2 className="font-serif text-lg">Paiement traité par Stripe</h2>
      <p className="mt-2 text-sm">
        Pour vos clients propres, avec votre compte Stripe configuré. Ce circuit reste distinct d’un
        règlement déclaré. Le lien peut être retrouvé et partagé à nouveau sans changer le paiement
        ni créer une autre facture.
      </p>
      {p ? (
        <div className="mt-3 space-y-2">
          <p>
            {p.paid_at
              ? "Encaissement confirmé"
              : p.status === "processing"
                ? "Paiement en cours"
                : "Paiement à recevoir"}{" "}
            · {euros(p.amount_cents)}
          </p>
          <p className="text-sm">
            Frais Oppe : {euros(p.fee_cents)} · Frais Stripe :{" "}
            {p.stripe_fee_cents === null ? "en cours de rapprochement" : euros(p.stripe_fee_cents)}{" "}
            · Remboursé : {euros(p.refunded_cents)}
          </p>
          {p.fee_refunded_cents !== null && p.fee_refunded_cents > 0 && (
            <p className="text-sm">
              Frais Oppe remboursés : {euros(p.fee_refunded_cents)} · frais Oppe conservés :{" "}
              {euros(p.fee_cents - p.fee_refunded_cents)}
            </p>
          )}
          {p.disputed && <p role="alert">Un litige est signalé dans Stripe.</p>}
          {p.reconciliation_required && (
            <p role="alert">
              Un remboursement Stripe doit être rapproché d’un avoir avant toute nouvelle opération.
            </p>
          )}
          {p.paid_at &&
            !p.disputed &&
            !p.reconciliation_required &&
            doc.creditNotes?.map((note) => (
              <button
                key={note.id}
                className={PRIMARY_BUTTON}
                disabled={
                  repayment.isPending ||
                  query.data?.refunds.some(
                    (r) =>
                      r.credit_note_id === note.id && !["failed", "canceled"].includes(r.status),
                  )
                }
                onClick={() => repayment.mutate(note.id)}
              >
                {query.data?.refunds.some(
                  (r) => r.credit_note_id === note.id && r.status === "succeeded",
                )
                  ? "Remboursement confirmé pour"
                  : query.data?.refunds.some(
                        (r) =>
                          r.credit_note_id === note.id &&
                          ["reserved", "pending", "requires_action"].includes(r.status),
                      )
                    ? "Remboursement en cours pour"
                    : "Rembourser"}{" "}
                l’avoir {note.number} ({euros(note.totalTtcCents)})
              </button>
            ))}
        </div>
      ) : null}
      {query.data && !query.data.open && (
        <p className="mt-3">Le paiement en ligne n’est pas encore ouvert.</p>
      )}
      {(p || query.data?.open) && (
        <button
          className={`${PRIMARY_BUTTON} mt-4`}
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          {p ? "Retrouver le lien client et les documents" : "Générer le lien de paiement client"}
        </button>
      )}
      {url && (
        <div className="mt-3">
          <label className="block text-sm" htmlFor="workshop-payment-link">
            Lien à transmettre à votre client
          </label>
          <input
            id="workshop-payment-link"
            readOnly
            value={url}
            className="w-full border p-2"
            onFocus={(event) => event.target.select()}
          />
        </div>
      )}
      {(create.isError || repayment.isError || query.isError) && (
        <ErrorNote>
          Opération refusée : vérifiez l’ouverture du paiement en ligne, le compte Stripe, la
          provenance de la facture et les règlements déjà enregistrés.
        </ErrorNote>
      )}
    </section>
  );
}
