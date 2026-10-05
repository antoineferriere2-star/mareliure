/**
 * La facturation d'une commande Oppe, côté administration : facture et avoirs, marge brute et
 * marge après frais Stripe, remboursements (avec avoir automatique) et litiges.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuros } from "@/marketplace/pricing/money";
import { downloadOppeDocument, getOppeBilling, refundOppeOrder } from "@/marketplace/services/oppeBilling.data.functions";
import { savePdf } from "@/marketplace/pages/customer/savePdf";

const REFUND_STATUS: Record<string, string> = {
  requested: "Demandé", pending: "En cours", succeeded: "Effectué", failed: "Échoué", canceled: "Annulé",
};

export function OppeBillingPanel({ caseId }: { caseId: string }) {
  const fetchBilling = useServerFn(getOppeBilling);
  const download = useServerFn(downloadOppeDocument);
  const refund = useServerFn(refundOppeOrder);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "case", caseId, "oppe-billing"] as const;
  const { data } = useQuery({ queryKey, queryFn: () => fetchBilling({ data: { caseId } }) });
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const downloading = useMutation({
    mutationFn: (documentId: string) => download({ data: { caseId, documentId } }),
    onSuccess: (file) => savePdf(file.fileName, file.base64),
  });
  const refunding = useMutation({
    mutationFn: () => refund({ data: { caseId, amountCents: Math.round(Number.parseFloat(amount.replace(",", ".")) * 100), reason, requestKey } }),
    onSuccess: () => {
      setAmount("");
      setReason("");
      setRequestKey(crypto.randomUUID());
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  if (!data) return null;
  const remaining = data.invoice.totalTtcCents - data.creditedTtcCents;
  const e = data.economics;
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Facturation Oppe</h2>
      <ul className="mt-3 space-y-1 text-sm">
        <li className="flex items-center justify-between gap-3">
          <span>Facture {data.invoice.number} · {formatEuros(data.invoice.totalTtcCents)} TTC</span>
          <Button size="sm" variant="ghost" onClick={() => downloading.mutate(data.invoice.id)}>PDF</Button>
        </li>
        {data.creditNotes.map((note) => (
          <li key={note.id} className="flex items-center justify-between gap-3">
            <span>Avoir {note.number} · −{formatEuros(note.totalTtcCents)} · {note.reason}</span>
            <Button size="sm" variant="ghost" onClick={() => downloading.mutate(note.id)}>PDF</Button>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Prix de vente HT (prestation)</span><span className="text-right tabular-nums">{e.servicePriceHtCents !== null ? formatEuros(e.servicePriceHtCents) : "—"}</span>
        <span className="text-muted-foreground">Coût atelier HT</span><span className="text-right tabular-nums">{formatEuros(e.workshopCostHtCents)}</span>
        <span className="text-muted-foreground">Marge brute</span><span className="text-right tabular-nums">{formatEuros(e.grossMarginCents)}</span>
        <span className="text-muted-foreground">Frais Stripe réels</span><span className="text-right tabular-nums">{e.stripeFeeCents !== null ? formatEuros(e.stripeFeeCents) : "non relevés"}</span>
        <span className="text-muted-foreground">Marge après frais</span><span className="text-right tabular-nums">{e.marginAfterFeesCents !== null ? formatEuros(e.marginAfterFeesCents) : "—"}</span>
      </div>

      {data.refunds.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {data.refunds.map((r) => (
            <li key={r.id}>Remboursement {formatEuros(r.amount_cents)} · {REFUND_STATUS[r.status] ?? r.status} · {r.reason}</li>
          ))}
        </ul>
      )}
      {data.disputes.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-destructive">
          {data.disputes.map((d) => (
            <li key={d.stripe_dispute_id}>
              Litige {d.status} · {d.amount_cents !== null ? formatEuros(d.amount_cents) : ""} · {d.reason ?? ""}
              {d.evidence_due_by ? ` · réponse avant le ${new Date(d.evidence_due_by).toLocaleDateString("fr-FR")}` : ""}
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-sm font-medium">Rembourser (reste {formatEuros(remaining)})</p>
          <p className="mt-1 text-xs text-muted-foreground">Le remboursement Stripe est suivi d'un avoir, ventilé sur les lignes et les taux de la facture. Les frais Stripe initiaux ne sont pas restitués par Stripe.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[8rem_1fr]">
            <div>
              <Label htmlFor="refund-amount">Montant TTC (€)</Label>
              <Input id="refund-amount" className="mt-1" inputMode="decimal" value={amount} onChange={(ev) => setAmount(ev.target.value)} />
            </div>
            <div>
              <Label htmlFor="refund-reason">Motif</Label>
              <Input id="refund-reason" className="mt-1" value={reason} onChange={(ev) => setReason(ev.target.value)} />
            </div>
          </div>
          <Button
            size="sm"
            variant="destructive"
            className="mt-2"
            disabled={refunding.isPending || reason.trim().length < 5 || !(Number.parseFloat(amount.replace(",", ".")) > 0)}
            onClick={() => refunding.mutate()}
          >
            Rembourser et émettre l'avoir
          </Button>
          {refunding.error && <p className="mt-2 text-sm text-destructive">{(refunding.error as Error).message}</p>}
        </div>
      )}
    </section>
  );
}
