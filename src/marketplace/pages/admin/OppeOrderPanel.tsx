/**
 * La commande Oppe après paiement : son état, l'historique des ateliers, l'annulation motivée et
 * la réattribution (nouvel atelier, nouveau coût validé, prix client inchangé).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuros } from "@/marketplace/pricing/money";
import { ORDER_STATUS_LABELS } from "@/marketplace/orders/orderStatus";
import {
  advanceOppeOrderAsAdmin,
  getOppeOrder,
  offerOppeOrderToWorkshop,
  reassignOppeOrder,
} from "@/marketplace/services/oppeOrders.data.functions";


function toCents(euros: string): number {
  return Math.round(Number.parseFloat(euros.replace(",", ".")) * 100);
}

export function OppeOrderPanel({
  caseId,
  candidates,
}: {
  caseId: string;
  candidates: { id: string; name: string }[];
}) {
  const fetchOrder = useServerFn(getOppeOrder);
  const advance = useServerFn(advanceOppeOrderAsAdmin);
  const offer = useServerFn(offerOppeOrderToWorkshop);
  const reassign = useServerFn(reassignOppeOrder);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "case", caseId, "oppe-order"] as const;
  const { data: order } = useQuery({ queryKey, queryFn: () => fetchOrder({ data: { caseId } }) });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ["marketplace", "case", caseId] });
  };

  const [cancelReason, setCancelReason] = useState("");
  const [binderId, setBinderId] = useState("");
  const [payout, setPayout] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");

  const advancing = useMutation({
    mutationFn: (status: "in_production" | "completed" | "cancelled") =>
      advance({ data: { caseId, status, reason: status === "cancelled" ? cancelReason : null } }),
    onSuccess: refresh,
  });
  const offering = useMutation({
    mutationFn: () => offer({ data: { caseId, binderId, payoutCents: toCents(payout), serviceDescription: description } }),
    onSuccess: refresh,
  });
  const reassigning = useMutation({
    mutationFn: () => reassign({ data: { caseId, binderId, reason } }),
    onSuccess: refresh,
  });

  if (!order) return null;
  const active = order.assignments.find((a) => a.endedAt === null);
  const open = order.status === "paid" || order.status === "in_production";
  const error = advancing.error ?? offering.error ?? reassigning.error;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Commande</h2>
        <span className="text-sm font-medium">{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Payée le {new Date(order.paidAt).toLocaleDateString("fr-FR")}
        {order.acceptance
          ? ` · devis accepté par le client le ${new Date(order.acceptance.acceptedAt).toLocaleString("fr-FR")} (conditions ${order.acceptance.termsVersion})`
          : ""}
      </p>
      {order.cancelReason && <p className="mt-1 text-xs text-destructive">Annulation : {order.cancelReason}</p>}

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Ateliers</h3>
      <ul className="mt-1 space-y-1 text-sm">
        {order.assignments.map((a) => (
          <li key={a.startedAt}>
            {a.workshopName ?? a.binderId} · {formatEuros(a.payoutCents)} HT
            {a.leadTimeDays ? ` · ${a.leadTimeDays} j` : ""}
            {a.endedAt ? ` · remplacé le ${new Date(a.endedAt).toLocaleDateString("fr-FR")} (${a.endReason})` : " · actif"}
          </li>
        ))}
      </ul>

      {open && (
        <div className="mt-4 flex flex-wrap gap-2">
          {order.status === "paid" && (
            <Button size="sm" variant="outline" disabled={advancing.isPending} onClick={() => advancing.mutate("in_production")}>
              Marquer en réalisation
            </Button>
          )}
          {order.status === "in_production" && (
            <Button size="sm" variant="outline" disabled={advancing.isPending} onClick={() => advancing.mutate("completed")}>
              Marquer terminée
            </Button>
          )}
        </div>
      )}

      {open && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-sm font-medium">Réattribuer à un autre atelier</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Le prix payé par le client ne change pas. Le nouvel atelier accepte la prestation, la rémunération que vous
            validez et son délai ; vous basculez ensuite la commande, avec un motif.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="reassign-binder">Atelier</Label>
              <select
                id="reassign-binder"
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={binderId}
                onChange={(event) => setBinderId(event.target.value)}
              >
                <option value="">Choisir…</option>
                {candidates.filter((c) => c.id !== active?.binderId).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="reassign-payout">Nouvelle rémunération (€ HT)</Label>
              <Input id="reassign-payout" className="mt-1" inputMode="decimal" value={payout} onChange={(e) => setPayout(e.target.value)} />
            </div>
          </div>
          <Label htmlFor="reassign-description" className="mt-3 block">Prestation</Label>
          <Input id="reassign-description" className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!binderId || !(toCents(payout) > 0) || description.trim().length < 10 || offering.isPending}
              onClick={() => offering.mutate()}
            >
              Proposer le travail à cet atelier
            </Button>
          </div>
          <Label htmlFor="reassign-reason" className="mt-3 block">Motif de la réattribution</Label>
          <Input id="reassign-reason" className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button
            size="sm"
            className="mt-2"
            disabled={!binderId || reason.trim().length < 12 || reassigning.isPending}
            onClick={() => reassigning.mutate()}
          >
            Basculer la commande vers cet atelier
          </Button>
        </div>
      )}

      {open && (
        <div className="mt-5 border-t border-border pt-4">
          <Label htmlFor="cancel-reason">Annuler la commande (motif obligatoire)</Label>
          <Input id="cancel-reason" className="mt-1" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          <Button
            size="sm"
            variant="destructive"
            className="mt-2"
            disabled={cancelReason.trim().length < 12 || advancing.isPending}
            onClick={() => advancing.mutate("cancelled")}
          >
            Annuler la commande
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">L'annulation ne rembourse pas : le remboursement se fait depuis la facturation.</p>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{(error as Error).message}</p>}
    </section>
  );
}
