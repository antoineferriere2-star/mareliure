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


export type PreviewState = "loading" | "error" | "refreshing" | "current";

/** Où en est l'aperçu. Une erreur l'emporte sur des données restées en cache. */
export function previewState(input: { hasData: boolean; isFetching: boolean; hasError: boolean }): PreviewState {
  if (input.hasError) return "error";
  if (!input.hasData) return "loading";
  return input.isFetching ? "refreshing" : "current";
}

/** On ne confirme qu'un aperçu à jour, sans atelier bloqué, et pas deux fois. */
export function canConfirmPreview(input: { state: PreviewState; blocked: boolean; sending: boolean }): boolean {
  return input.state === "current" && !input.blocked && !input.sending;
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
  const { data: lastData, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ["marketplace", "case", caseId, "workshop-preview", [...binderIds].sort().join(",")],
    queryFn: () => preview({ data: { caseId, binderIds } }),
    enabled: open && binderIds.length > 0,
    // Relu à chaque ouverture, jamais servi depuis le cache : on ne confirme pas un ancien montant.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  // Une relecture échouée laisse en cache l'ancien aperçu (contre-revue Codex de #192) : il n'est
  // alors plus montré du tout, et rien ne se confirme sur la base d'un aperçu qui n'est pas à jour.
  const state = previewState({ hasData: Boolean(lastData), isFetching, hasError: Boolean(error) });
  const data = state === "error" ? undefined : lastData;
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
        {state === "error" && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              L'aperçu n'a pas pu être relu : {(error as Error).message} Rien ne peut être envoyé tant qu'il n'est pas
              à jour.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              Relire l'aperçu
            </Button>
          </div>
        )}
        {state === "refreshing" && <p className="text-sm text-muted-foreground">Mise à jour de l'aperçu…</p>}

        {data && (
          <div className={state === "refreshing" ? "pointer-events-none space-y-4 opacity-50" : "space-y-4"} aria-busy={state === "refreshing"}>
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
          </div>
        )}

        {problem && <p className="text-sm text-destructive">{problem}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Corriger
          </Button>
          <Button
            onClick={() => data && onConfirm(confirmedPayoutsOf(workshops))}
            disabled={!canConfirmPreview({ state, blocked, sending })}
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
