/**
 * L'atelier affecté à une commande Oppe déclare le début puis la fin du travail. Il voit sa
 * propre rémunération et son délai, jamais le prix payé par le client.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { formatEuros } from "@/marketplace/pricing/money";
import { ORDER_STATUS_LABELS } from "@/marketplace/orders/orderStatus";
import { SupplierInvoicePanel } from "./SupplierInvoicePanel";
import { advanceMyOppeOrder, getMyOppeOrder } from "@/marketplace/services/oppeOrders.data.functions";

export function WorkshopOrderProgress({ caseId }: { caseId: string }) {
  const fetchOrder = useServerFn(getMyOppeOrder);
  const advance = useServerFn(advanceMyOppeOrder);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "binder", "oppe-order", caseId] as const;
  const { data: order } = useQuery({ queryKey, queryFn: () => fetchOrder({ data: { caseId } }) });
  const advancing = useMutation({
    mutationFn: (status: "in_production" | "completed") => advance({ data: { caseId, status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  if (!order) return null;
  return (
    <>
    <section className="rounded-lg border border-border bg-card p-5 text-sm">
      <h2 className="font-serif text-lg">Commande</h2>
      <p className="mt-2">
        {ORDER_STATUS_LABELS[order.status] ?? order.status} · payée par le client le {new Date(order.paidAt).toLocaleDateString("fr-FR")}
      </p>
      <p className="mt-1 text-muted-foreground">
        Votre rémunération : {formatEuros(order.payoutCents)} HT{order.leadTimeDays ? ` · délai ${order.leadTimeDays} jours` : ""}
      </p>
      {order.status === "paid" && (
        <Button className="mt-3 w-full" disabled={advancing.isPending} onClick={() => advancing.mutate("in_production")}>
          J'ai commencé le travail
        </Button>
      )}
      {order.status === "in_production" && (
        <Button className="mt-3 w-full" disabled={advancing.isPending} onClick={() => advancing.mutate("completed")}>
          Le travail est terminé
        </Button>
      )}
      {advancing.error && <p className="mt-2 text-destructive">{(advancing.error as Error).message}</p>}
    </section>
    {order.status === "completed" && <SupplierInvoicePanel caseId={caseId} payoutCents={order.payoutCents} />}
    </>
  );
}
