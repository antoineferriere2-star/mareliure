import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
import { ensureMyCaseWork } from "@/marketplace/services/binderCaseWorkspace.data.functions";
import { getMyWork, getMyWorks } from "@/marketplace/services/binderWorks.data.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BinderPageHeader } from "./BinderPageUi";
import { sourceLabel } from "@/marketplace/binders/fineBinderyProfile";

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
  const navigate = useNavigate();
  const fetchWorks = useServerFn(getMyWorks);
  const fetchWork = useServerFn(getMyWork);
  const ensureWork = useServerFn(ensureMyCaseWork);
  const works = useQuery({ queryKey: ["binder", "works"], queryFn: () => fetchWorks({ data: {} }) });
  const linked = works.data?.find((work) => work.caseId === caseId);
  const linkedWork = useQuery({ queryKey: ["binder", "work", linked?.id], queryFn: () => fetchWork({ data: { id: linked!.id } }), enabled: Boolean(linked) });
  const createFromCase = useMutation({
    mutationFn: () => ensureWork({ data: { caseId } }),
    onSuccess: ({ workId }) => {
      void queryClient.invalidateQueries({ queryKey: ["binder", "works"] });
      void navigate({ to: "/atelier/devis/nouveau", search: { workId } });
    },
    onError: (err: Error) => setProblem(err.message),
  });
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
  const offerLabel = offer?.state === "offered" || offer?.state === "invited" ? "À examiner" : offer?.state === "accepted" ? "Disponibilité confirmée" : offer?.state === "selected" ? "Atelier retenu" : offer?.state === "declined" ? "Refusé" : offer?.state === "cancelled" ? "Clôturé" : "En attente";
  const nextAction = data.canRespond ? "Accepter ou refuser la proposition" : isSelected ? "Créer ou poursuivre le devis" : offer?.state === "accepted" ? "Attendre la décision de Ma Reliure" : "Consulter le dossier";
  return (
    <div className="space-y-8">
    <Link to="/atelier/leads" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#5f1b27] underline underline-offset-4">← Tous les leads</Link>
    <BinderPageHeader eyebrow={`${data.view.reference} · ${sourceLabel(data.acquisitionOrigin)}${data.preferredLanguage ? ` · ${data.preferredLanguage.toUpperCase()}` : ""}`} title={data.view.title} description="Le contexte du projet, la décision attendue et les échanges au même endroit." action={isSelected ? <button type="button" className="min-h-11 rounded-sm bg-[#241a12] px-5 text-sm font-semibold text-white disabled:opacity-50" disabled={createFromCase.isPending || works.isPending} onClick={() => createFromCase.mutate()}>{createFromCase.isPending ? "Ouverture du devis…" : "Créer un devis"}</button> : undefined} />
    <section aria-label="Synthèse du dossier" className="grid divide-y divide-[#d8d0c4] border-y border-[#cfc5b6] bg-[#fffdf8] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
      <div className="px-4 py-4"><p className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[#8b8175]">Qui</p><p className="mt-1 text-sm font-semibold">{data.view.contact?.name ?? "Client transmis par Ma Reliure"}</p></div>
      <div className="px-4 py-4"><p className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[#8b8175]">Quoi</p><p className="mt-1 text-sm font-semibold">{data.view.title}</p></div>
      <div className="px-4 py-4"><p className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[#8b8175]">Statut</p><p className="mt-1 text-sm font-semibold text-[#7a2230]">{offerLabel}</p></div>
      <div className="px-4 py-4"><p className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[#8b8175]">Prochaine action</p><p className="mt-1 text-sm font-semibold">{nextAction}</p></div>
    </section>
    <nav aria-label="Sections du dossier" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      <a href="#apercu" className="underline">Aperçu</a>
      {isSelected && <><a href="#ouvrage" className="underline">Ouvrage</a><a href="#devis" className="underline">Devis</a><a href="#messages" className="underline">Messages</a></>}
    </nav>
    <div id="apercu" className="scroll-mt-6">
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
    </div>
    {isSelected && (
      <>
        <section id="ouvrage" className="scroll-mt-6 rounded-lg border border-border bg-card p-5">
          <h2 className="font-serif text-lg">Ouvrage</h2>
          {linked ? <Link to="/atelier/ouvrages/$workId" params={{ workId: linked.id }} className="mt-2 inline-flex min-h-11 items-center underline">{linked.title} · {linked.reference}</Link> : <p className="mt-2 text-sm text-muted-foreground">La fiche ouvrage sera créée lors du premier devis.</p>}
        </section>
        <section id="devis" className="scroll-mt-6 rounded-lg border border-border bg-card p-5">
          <h2 className="font-serif text-lg">Devis</h2>
          {linkedWork.data?.quotes.length ? <ul className="mt-2 space-y-2">{linkedWork.data.quotes.map((quote) => <li key={quote.id}><Link to="/atelier/devis/$quoteId" params={{ quoteId: quote.id }} className="inline-flex min-h-11 items-center underline">{quote.number} · {quote.status}</Link></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Aucun devis lié à ce dossier.</p>}
        </section>
        <DecisionsPanel caseId={caseId} role="binder" />
        <ConversationPanel caseId={caseId} viewerRole="binder" />
      </>
    )}
    </div>
  );
}
