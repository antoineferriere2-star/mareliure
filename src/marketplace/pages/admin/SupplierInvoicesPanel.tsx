/**
 * Les factures de l'atelier à Oppe : contrôle de conformité, puis règlement par virement manuel
 * (référence unique, montant rapproché du solde).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuros } from "@/marketplace/pricing/money";
import { SUPPLIER_STATUS_LABELS } from "@/marketplace/pages/binder/SupplierInvoicePanel";
import {
  getSupplierInvoiceLink,
  getSupplierInvoices,
  recordSupplierPayment,
  reviewSupplierInvoice,
} from "@/marketplace/services/supplierInvoices.data.functions";

const today = () => new Date().toISOString().slice(0, 10);

export function SupplierInvoicesPanel({ caseId }: { caseId: string }) {
  const fetchInvoices = useServerFn(getSupplierInvoices);
  const review = useServerFn(reviewSupplierInvoice);
  const pay = useServerFn(recordSupplierPayment);
  const link = useServerFn(getSupplierInvoiceLink);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "case", caseId, "supplier-invoices"] as const;
  const { data: invoices } = useQuery({ queryKey, queryFn: () => fetchInvoices({ data: { caseId } }) });
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(today());
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const reviewing = useMutation({
    mutationFn: (v: { invoiceId: string; decision: "accepted" | "rejected" }) => review({ data: { ...v, reason: v.decision === "rejected" ? reason : null } }),
    onSuccess: () => { setReason(""); void refresh(); },
  });
  const paying = useMutation({
    mutationFn: (invoiceId: string) => pay({ data: { invoiceId, paidOn, amountCents: Math.round(Number.parseFloat(amount.replace(",", ".")) * 100), reference } }),
    onSuccess: () => { setAmount(""); setReference(""); void refresh(); },
  });
  const open = useMutation({ mutationFn: (invoiceId: string) => link({ data: { invoiceId, asAdmin: true } }), onSuccess: ({ url }) => window.open(url, "_blank", "noopener") });
  if (!invoices || invoices.length === 0) return null;
  const error = reviewing.error ?? paying.error ?? open.error;
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Factures de l'atelier</h2>
      <ul className="mt-3 space-y-4 text-sm">
        {invoices.map((inv) => {
          const left = inv.amount_ttc_cents - inv.paidCents;
          const late = inv.status === "accepted" && new Date(inv.due_date) < new Date();
          return (
            <li key={inv.id} className="rounded-md border border-border p-3">
              <p>
                {inv.invoice_number} · {formatEuros(inv.amount_ttc_cents)} TTC ({formatEuros(inv.amount_ht_cents)} HT + TVA d'achat {formatEuros(inv.vat_cents)})
                {inv.source === "tool" ? " · générée par l'outil" : " · facture externe"}
              </p>
              <p className="text-xs text-muted-foreground">
                {SUPPLIER_STATUS_LABELS[inv.status]} · échéance {new Date(inv.due_date).toLocaleDateString("fr-FR")}{late ? " (dépassée)" : ""}
                {inv.vat_regime === "FRANCHISE" ? " · franchise en base" : inv.vat_rate_bps !== null ? ` · TVA ${(inv.vat_rate_bps / 100).toFixed(1)} %` : ""}
              </p>
              {inv.review_reason && <p className="text-xs text-destructive">Motif : {inv.review_reason}</p>}
              {inv.payments.map((p) => <p key={p.id} className="text-xs text-muted-foreground">Virement {new Date(p.paid_on).toLocaleDateString("fr-FR")} · {formatEuros(p.amount_cents)} · réf. {p.reference}</p>)}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => open.mutate(inv.id)}>Voir le PDF</Button>
                {inv.status === "submitted" && (
                  <Button size="sm" disabled={reviewing.isPending} onClick={() => reviewing.mutate({ invoiceId: inv.id, decision: "accepted" })}>Facture conforme</Button>
                )}
              </div>
              {inv.status === "submitted" && (
                <div className="mt-2">
                  <Label htmlFor={`reject-${inv.id}`} className="text-xs">Refuser (motif)</Label>
                  <div className="mt-1 flex gap-2">
                    <Input id={`reject-${inv.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
                    <Button size="sm" variant="destructive" disabled={reason.trim().length < 5 || reviewing.isPending} onClick={() => reviewing.mutate({ invoiceId: inv.id, decision: "rejected" })}>Refuser</Button>
                  </div>
                </div>
              )}
              {inv.status === "accepted" && left > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div><Label htmlFor={`paid-on-${inv.id}`} className="text-xs">Date du virement</Label><Input id={`paid-on-${inv.id}`} type="date" max={today()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></div>
                  <div><Label htmlFor={`paid-amount-${inv.id}`} className="text-xs">Montant (€) · reste {formatEuros(left)}</Label><Input id={`paid-amount-${inv.id}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                  <div><Label htmlFor={`paid-ref-${inv.id}`} className="text-xs">Référence du virement</Label><Input id={`paid-ref-${inv.id}`} value={reference} onChange={(e) => setReference(e.target.value)} /></div>
                  <Button size="sm" className="sm:col-span-3" disabled={paying.isPending || reference.trim().length < 3 || !(Number.parseFloat(amount.replace(",", ".")) > 0)} onClick={() => paying.mutate(inv.id)}>Enregistrer le règlement</Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-3 text-sm text-destructive">{(error as Error).message}</p>}
    </section>
  );
}
