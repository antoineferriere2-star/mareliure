import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getBinderCase,
  respondToBinderOffer,
} from "@/marketplace/services/marketplace.data.functions";
import { CaseBriefPanel } from "@/marketplace/pages/CaseBriefPanel";
import { ConversationPanel } from "@/marketplace/pages/ConversationPanel";
import { DecisionsPanel } from "@/marketplace/pages/DecisionsPanel";
import { formatEuros } from "@/marketplace/pricing/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const DECLINE_REASONS = [
  ["payout_insufficient", "Rémunération insuffisante"],
  ["deadline_impossible", "Délai impossible"],
  ["outside_specialty", "Hors de ma spécialité"],
  ["no_capacity", "Capacité indisponible"],
  ["other", "Autre"],
] as const;

export function BinderCasePage({ caseId }: { caseId: string }) {
  const fetchCase = useServerFn(getBinderCase);
  const respond = useServerFn(respondToBinderOffer);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "binder", "case", caseId] as const;
  const [reasonCode, setReasonCode] = useState<(typeof DECLINE_REASONS)[number][0]>("no_capacity");
  const [reasonDetail, setReasonDetail] = useState("");
  const [minimumPayout, setMinimumPayout] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const { data, isPending, error } = useQuery({
    queryKey,
    queryFn: () => fetchCase({ data: { caseId } }),
  });
  const floorCents = Math.round(Number.parseFloat(minimumPayout.replace(",", ".")) * 100);
  const answer = useMutation({
    mutationFn: (accept: boolean) =>
      respond({
        data: {
          caseId,
          accept,
          reasonCode: accept ? null : reasonCode,
          reasonDetail: accept ? null : reasonDetail,
          minimumRequiredPayoutCents:
            !accept && reasonCode === "payout_insufficient" && Number.isFinite(floorCents)
              ? floorCents
              : null,
        },
      }),
    onSuccess: async () => {
      setProblem(null);
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["marketplace", "binder", "cases"] });
    },
    onError: (err: Error) => setProblem(err.message),
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const offer = data.offer;
  // Un atelier n'a de conversation et de décisions qu'une fois retenu — pas
  // seulement sollicité. Avant ça, il n'y a rien à demander ni à discuter, et
  // canAccessConversation (côté serveur) refuserait de toute façon.
  const isSelected = offer?.state === "selected";
  return (
    <div className="space-y-8">
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <CaseBriefPanel view={data.view} />
      <aside className="space-y-6">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-serif text-lg">Proposition de projet</h2>
          {offer?.binder_payout_cents ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">Votre rémunération fixe</p>
              <p className="mt-1 text-3xl font-medium">{formatEuros(offer.binder_payout_cents)}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Cette rémunération couvre le périmètre décrit dans le Project Brief. Aucun prix
                n’est demandé à l’atelier.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Cette sollicitation historique ne contient pas de rémunération validée. Ma Reliure
              doit la reprendre avant toute réponse.
            </p>
          )}
        </section>

        {data.canRespond && offer?.binder_payout_cents ? (
          <section className="space-y-4 rounded-lg border border-border bg-card p-5">
            <h2 className="font-serif text-lg">Votre disponibilité</h2>
            <Button
              className="w-full"
              disabled={answer.isPending}
              onClick={() => answer.mutate(true)}
            >
              Accepter cette offre
            </Button>
            <div className="border-t border-border pt-4">
              <Label htmlFor="decline-reason">Motif de refus</Label>
              <select
                id="decline-reason"
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value as typeof reasonCode)}
              >
                {DECLINE_REASONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {/* Demandé seulement après « rémunération insuffisante », et
                  facultatif. C'est la donnée la plus honnête du référentiel :
                  révélée par une décision réelle plutôt que déclarée dans un
                  entretien. Elle n'a aucun effet sur l'issue de cette offre —
                  répondre ne rouvre pas la négociation. */}
              {reasonCode === "payout_insufficient" && (
                <div className="mt-3">
                  <Label htmlFor="minimum-payout">
                    À quelle rémunération auriez-vous accepté ? (facultatif)
                  </Label>
                  <Input
                    id="minimum-payout"
                    className="mt-1"
                    inputMode="decimal"
                    value={minimumPayout}
                    onChange={(event) => setMinimumPayout(event.target.value)}
                    placeholder="en euros"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cela ne rouvre pas cette proposition. Nous nous en servons pour ajuster nos
                    prix.
                  </p>
                </div>
              )}
              <Textarea
                className="mt-3"
                rows={3}
                value={reasonDetail}
                onChange={(event) => setReasonDetail(event.target.value)}
                placeholder="Précision facultative"
              />
              <Button
                variant="outline"
                className="mt-3 w-full"
                disabled={answer.isPending}
                onClick={() => answer.mutate(false)}
              >
                Refuser cette offre
              </Button>
            </div>
            {problem && <p className="text-sm text-destructive">{problem}</p>}
          </section>
        ) : (
          <section className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
            {offer?.state === "accepted" &&
              "Offre acceptée. Ma Reliure vous confirmera si l’atelier est retenu."}
            {offer?.state === "selected" && "Votre atelier est retenu pour ce projet."}
            {offer?.state === "declined" && "Vous avez refusé cette offre."}
            {offer?.state === "cancelled" && "Cette offre a été clôturée."}
            {!offer && "Aucune offre active pour ce projet."}
          </section>
        )}
      </aside>
    </div>
    {isSelected && (
      <>
        <DecisionsPanel caseId={caseId} role="binder" />
        <ConversationPanel caseId={caseId} viewerRole="binder" />
      </>
    )}
    </div>
  );
}
