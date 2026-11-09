/**
 * Vérifier avant l'envoi : le dossier tel que chaque atelier sélectionné le lira, avec SA
 * rémunération et la prestation saisie. L'envoi ne part que depuis cette fenêtre, après relecture.
 * Les écrans viennent de la page atelier elle-même (`CaseBriefPanel`, `WorkshopOfferCard`) : ce qui
 * est vérifié ici est ce qui sera lu là-bas.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CaseBriefPanel } from "@/marketplace/pages/CaseBriefPanel";
import { WorkshopOfferCard } from "@/marketplace/pages/binder/WorkshopOfferCard";
import { previewCaseForBinders } from "@/marketplace/services/marketplace.data.functions";

/** Ce que l'admin confirme : le montant affiché de chaque atelier, tel quel. */
export function confirmedPayoutsOf(workshops: ReadonlyArray<{ binderId: string; payoutCents: number | null }>): Record<string, number> {
  return Object.fromEntries(workshops.filter((w) => w.payoutCents).map((w) => [w.binderId, w.payoutCents as number]));
}

export function WorkshopSendPreview({
  open,
  onOpenChange,
  caseId,
  binderIds,
  serviceDescription,
  brandName,
  sending,
  problem,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  binderIds: string[];
  serviceDescription: string;
  brandName: string;
  sending: boolean;
  problem: string | null;
  /** Reçoit la rémunération affichée, par atelier : le serveur refuse l'envoi si elle a changé. */
  onConfirm: (confirmedPayouts: Record<string, number>) => void;
}) {
  const preview = useServerFn(previewCaseForBinders);
  const { data, isPending, isFetching, error } = useQuery({
    queryKey: ["marketplace", "case", caseId, "workshop-preview", [...binderIds].sort().join(",")],
    queryFn: () => preview({ data: { caseId, binderIds } }),
    enabled: open && binderIds.length > 0,
    // Relu à chaque ouverture, jamais servi depuis le cache : on ne confirme pas un ancien montant.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const [tab, setTab] = useState(0);
  const workshops = data?.workshops ?? [];
  const current = workshops[Math.min(tab, Math.max(workshops.length - 1, 0))];
  const view = current ? data?.views[current.disclosure] : undefined;
  const blocked = workshops.some((w) => w.manualRequired || !w.payoutCents);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(96vw,1200px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ce que recevra l'atelier</DialogTitle>
          <DialogDescription>
            Relisez le dossier tel que l'atelier le verra dans son espace, puis confirmez. Rien n'est envoyé avant
            votre confirmation.
          </DialogDescription>
        </DialogHeader>

        {isPending && <p className="text-sm text-muted-foreground">Préparation de l'aperçu…</p>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

        {data && (
          <>
            {workshops.length > 1 && (
              <div role="tablist" aria-label="Ateliers sélectionnés" className="flex flex-wrap gap-2">
                {workshops.map((w, index) => (
                  <Button
                    key={w.binderId}
                    role="tab"
                    aria-selected={index === tab}
                    size="sm"
                    variant={index === tab ? "default" : "outline"}
                    onClick={() => setTab(index)}
                  >
                    {w.name}
                  </Button>
                ))}
              </div>
            )}
            {current && (
              <p className="text-sm text-muted-foreground">
                Aperçu pour <span className="font-medium text-foreground">{current.name}</span>
                {current.manualRequired && (
                  <span className="ml-2 text-destructive">
                    — condition « rémunération manuelle » : l'envoi sera refusé tant que son montant n'est pas fixé.
                  </span>
                )}
              </p>
            )}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
              {view ? <CaseBriefPanel view={view} /> : <div />}
              <aside className="space-y-4">
                {current && (
                  <WorkshopOfferCard
                    payoutCents={current.payoutCents}
                    serviceDescription={serviceDescription.trim() || null}
                    brandName={brandName}
                  />
                )}
                <p className="text-xs leading-5 text-muted-foreground">
                  L'atelier répond depuis cette page : il accepte avec son délai ou refuse avec un motif. Il ne voit ni le
                  prix client, ni le budget annoncé, ni les coordonnées du client tant qu'il n'est pas retenu.
                </p>
              </aside>
            </div>
          </>
        )}

        {problem && <p className="text-sm text-destructive">{problem}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Corriger
          </Button>
          <Button
            onClick={() => data && onConfirm(confirmedPayoutsOf(workshops))}
            disabled={!data || blocked || sending || isFetching}
          >
            {sending
              ? "Envoi…"
              : workshops.length > 1
                ? `Confirmer l'envoi aux ${workshops.length} ateliers`
                : "Confirmer l'envoi à l'atelier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
