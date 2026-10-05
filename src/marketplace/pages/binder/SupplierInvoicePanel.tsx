/**
 * L'atelier facture Oppe, une fois le travail terminé : depuis l'outil (PDF généré à son nom) ou en
 * déposant sa propre facture. Le montant HT est la rémunération acceptée ; il n'est pas modifiable.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuros } from "@/marketplace/pricing/money";
import {
  createSupplierInvoiceFromTool,
  getMySupplierInvoice,
  getSupplierInvoiceLink,
  uploadExternalSupplierInvoice,
} from "@/marketplace/services/supplierInvoices.data.functions";

export const SUPPLIER_STATUS_LABELS: Record<string, string> = {
  submitted: "Déposée, en cours de contrôle",
  accepted: "Acceptée, en attente de virement",
  rejected: "Refusée",
  paid: "Payée",
};

const today = () => new Date().toISOString().slice(0, 10);

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function SupplierInvoicePanel({ caseId, payoutCents }: { caseId: string; payoutCents: number }) {
  const fetchInvoices = useServerFn(getMySupplierInvoice);
  const fromTool = useServerFn(createSupplierInvoiceFromTool);
  const upload = useServerFn(uploadExternalSupplierInvoice);
  const link = useServerFn(getSupplierInvoiceLink);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "binder", "supplier-invoice", caseId] as const;
  const { data: invoices } = useQuery({ queryKey, queryFn: () => fetchInvoices({ data: { caseId } }) });
  const [mode, setMode] = useState<"tool" | "external">("tool");
  const [issueDate, setIssueDate] = useState(today());
  const [regime, setRegime] = useState<"VAT_LIABLE" | "FRANCHISE">("VAT_LIABLE");
  const [rate, setRate] = useState("20");
  const [mention, setMention] = useState("TVA non applicable, art. 293 B du CGI");
  const [number, setNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const vat = { vatRegime: regime, vatRateBps: regime === "FRANCHISE" ? null : Math.round(Number.parseFloat(rate.replace(",", ".")) * 100), vatMention: regime === "FRANCHISE" ? mention : null };
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const create = useMutation({ mutationFn: () => fromTool({ data: { caseId, issueDate, ...vat } }), onSuccess: refresh });
  const deposit = useMutation({
    mutationFn: async () => upload({ data: { caseId, number, issueDate, pdfBase64: await fileToBase64(file!), ...vat } }),
    onSuccess: refresh,
  });
  const open = useMutation({ mutationFn: (invoiceId: string) => link({ data: { invoiceId, asAdmin: false } }), onSuccess: ({ url }) => window.open(url, "_blank", "noopener") });
  if (!invoices) return null;
  const live = invoices.find((i) => i.status !== "rejected");
  const vatOk = regime === "FRANCHISE" ? mention.trim().length > 0 : Number.isFinite(vat.vatRateBps ?? Number.NaN);
  const error = create.error ?? deposit.error ?? open.error;

  return (
    <section className="rounded-lg border border-border bg-card p-5 text-sm">
      <h2 className="font-serif text-lg">Facture à Oppe</h2>
      {live ? (
        <div className="mt-2 space-y-1">
          <p>{live.invoice_number} · {formatEuros(live.amount_ttc_cents)} TTC ({formatEuros(live.amount_ht_cents)} HT)</p>
          <p className="text-muted-foreground">{SUPPLIER_STATUS_LABELS[live.status] ?? live.status} · échéance {new Date(live.due_date).toLocaleDateString("fr-FR")}</p>
          {live.paidCents > 0 && <p className="text-muted-foreground">Reçu : {formatEuros(live.paidCents)} sur {formatEuros(live.amount_ttc_cents)}</p>}
          {live.payments.map((p) => <p key={p.id} className="text-xs text-muted-foreground">Virement du {new Date(p.paid_on).toLocaleDateString("fr-FR")} · {formatEuros(p.amount_cents)} · réf. {p.reference}</p>)}
          <Button size="sm" variant="outline" disabled={open.isPending} onClick={() => open.mutate(live.id)}>Voir le PDF</Button>
        </div>
      ) : (
        <>
          {invoices.some((i) => i.status === "rejected") && (
            <p className="mt-2 text-destructive">Votre précédente facture a été refusée : {invoices.find((i) => i.status === "rejected")?.review_reason}</p>
          )}
          <p className="mt-2 text-muted-foreground">
            Vous facturez Oppe la rémunération acceptée, <strong>{formatEuros(payoutCents)} HT</strong>, sans supplément. Paiement par virement sous 30 jours à compter de l'émission d'une facture conforme.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant={mode === "tool" ? "default" : "outline"} onClick={() => setMode("tool")}>Générer depuis l'outil</Button>
            <Button size="sm" variant={mode === "external" ? "default" : "outline"} onClick={() => setMode("external")}>Déposer ma facture (PDF)</Button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="supplier-date">Date de la facture</Label>
              <Input id="supplier-date" type="date" className="mt-1" value={issueDate} max={today()} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            {mode === "external" && (
              <div>
                <Label htmlFor="supplier-number">Numéro de votre facture</Label>
                <Input id="supplier-number" className="mt-1" value={number} onChange={(e) => setNumber(e.target.value)} />
              </div>
            )}
            <div>
              <Label htmlFor="supplier-regime">Régime de TVA de la facture</Label>
              <select id="supplier-regime" className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2" value={regime} onChange={(e) => setRegime(e.target.value as typeof regime)}>
                <option value="VAT_LIABLE">Assujetti à la TVA</option>
                <option value="FRANCHISE">Franchise en base</option>
              </select>
            </div>
            {regime === "VAT_LIABLE" ? (
              <div>
                <Label htmlFor="supplier-rate">Taux de TVA (%)</Label>
                <Input id="supplier-rate" className="mt-1" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
            ) : (
              <div>
                <Label htmlFor="supplier-mention">Mention de TVA</Label>
                <Input id="supplier-mention" className="mt-1" value={mention} onChange={(e) => setMention(e.target.value)} />
              </div>
            )}
            {mode === "external" && (
              <div className="sm:col-span-2">
                <Label htmlFor="supplier-file">Votre facture (PDF, 3,5 Mo maximum)</Label>
                <input id="supplier-file" type="file" accept="application/pdf" className="mt-1 block text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            )}
          </div>
          <Button
            className="mt-3"
            disabled={!vatOk || !issueDate || create.isPending || deposit.isPending || (mode === "external" && (!file || number.trim() === ""))}
            onClick={() => (mode === "tool" ? create.mutate() : deposit.mutate())}
          >
            {mode === "tool" ? "Générer et envoyer la facture à Oppe" : "Déposer la facture"}
          </Button>
        </>
      )}
      {error && <p className="mt-2 text-destructive">{(error as Error).message}</p>}
    </section>
  );
}
