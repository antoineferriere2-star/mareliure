/**
 * La fiche d'un projet pour l'atelier.
 *
 * Tant que l'atelier n'est pas retenu, c'est une proposition : le projet, sa
 * rémunération fixe, accepter ou refuser. Une fois retenu, c'est un poste de
 * travail : les gestes d'avancement en tête, la conversation avec le client,
 * les décisions à demander, les imprévus à signaler, le travail commandé tel
 * qu'il a été figé, et la rémunération. Jamais le prix client.
 *
 * Pas de rubrique « Livraison » : l'expédition n'existe pas encore, et une
 * rubrique vide ferait croire qu'elle existe.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getBinderCase,
  respondToBinderOffer,
} from "@/marketplace/services/marketplace.data.functions";
import { CaseBriefPanel } from "@/marketplace/pages/CaseBriefPanel";
import { visibleJourney } from "@/marketplace/cases/journey";
import { CASE_STATUS_LABELS, isCaseStatus } from "@/marketplace/cases/state";
import { formatEuros } from "@/marketplace/pricing/money";
import { DecisionRequestForm } from "../project/DecisionRequestForm";
import { DecisionHistory, PendingDecisionList } from "../project/ProjectDecisions";
import {
  JourneyTimeline,
  ProgressActions,
  type ProgressStepView,
} from "../project/ProjectProgress";
import { ProjectThread } from "../project/ProjectThread";
import { ScopeIssueForm, ScopeIssueList } from "../project/ScopeIssues";
import { useProjectThread } from "../project/useProjectThread";

type WorkshopCase = Awaited<ReturnType<typeof getBinderCase>>;

export function WorkshopCasePage({ caseId }: { caseId: string }) {
  const fetchCase = useServerFn(getBinderCase);
  const queryKey = ["marketplace", "binder", "case", caseId] as const;
  const { data, isPending, error } = useQuery({
    queryKey,
    queryFn: () => fetchCase({ data: { caseId } }),
  });

  if (isPending) return <p className="mr-small text-mr-muted">Chargement…</p>;
  if (error) return <p className="mr-small text-mr-bordeaux">{(error as Error).message}</p>;
  if (!data) return null;

  return data.selected ? (
    <Workstation caseId={caseId} data={data} />
  ) : (
    <OfferView caseId={caseId} data={data} />
  );
}

// ---------------------------------------------------------------------------
// Poste de travail
// ---------------------------------------------------------------------------

export const WORKSHOP_THREAD_NOTICE =
  "Échanges tenus dans le cadre de Ma Reliure, qui peut les consulter. Coordonnées, paiement et prix n'y passent pas : un changement de travail se signale comme imprévu.";

function Workstation({ caseId, data }: { caseId: string; data: WorkshopCase }) {
  const queryClient = useQueryClient();
  const { thread, refresh } = useProjectThread(caseId, data.threadAccess !== "none");
  const onChange = async () => {
    await refresh();
    await queryClient.invalidateQueries({ queryKey: ["marketplace", "binder", "case", caseId] });
  };
  const decisions = thread.data?.decisions ?? [];
  const open = decisions.filter((decision) => decision.status === "OPEN");
  const writable = data.threadAccess === "write";
  const status = isCaseStatus(data.caseStatus)
    ? CASE_STATUS_LABELS[data.caseStatus]
    : data.caseStatus;

  return (
    <div className="space-y-8">
      <header className="border-b border-mr-rule pb-5">
        <p className="mr-meta">{data.view.reference}</p>
        <h1 className="mr-title text-mr-ink">{data.view.title}</h1>
        <p className="mr-body mt-1 text-mr-ink">
          <span className="font-semibold">{status}</span>
          {data.nextAction &&
            ` — ${open.length > 0 ? `en attente du client : ${open[0].question}` : data.nextAction}`}
        </p>
        <nav
          aria-label="Actions du projet"
          className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          <ProgressActions
            caseId={caseId}
            steps={data.progressSteps as ProgressStepView[]}
            onDone={onChange}
          />
          {writable && (
            <>
              <a href="#conversation" className="mr-link mr-small">
                Envoyer un message
              </a>
              <a href="#decisions" className="mr-link mr-small">
                Demander une décision
              </a>
              <a href="#imprevus" className="mr-link mr-small">
                Signaler un imprévu
              </a>
            </>
          )}
        </nav>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <div id="conversation" className="scroll-mt-6">
            {thread.data ? (
              <ProjectThread
                caseId={caseId}
                thread={thread.data}
                title="Conversation avec le client"
                notice={WORKSHOP_THREAD_NOTICE}
                onChange={onChange}
              />
            ) : (
              <p className="mr-small text-mr-muted">
                {thread.error ? (thread.error as Error).message : "Chargement de la conversation…"}
              </p>
            )}
          </div>

          <section id="decisions" className="scroll-mt-6 space-y-4">
            <h2 className="mr-heading text-mr-ink">Décisions</h2>
            <div>
              <h3 className="mr-eyebrow text-mr-ink">En attente du client</h3>
              <div className="mt-2">
                <PendingDecisionList
                  decisions={decisions}
                  canCancel={writable}
                  onChange={onChange}
                />
              </div>
            </div>
            <div>
              <h3 className="mr-eyebrow text-mr-ink">Choix confirmés</h3>
              <div className="mt-2">
                <DecisionHistory decisions={decisions} audience="team" />
              </div>
            </div>
            {writable && (
              <details>
                <summary className="mr-small cursor-pointer font-semibold text-mr-ink">
                  Demander une décision au client
                </summary>
                <div className="mt-3">
                  <DecisionRequestForm caseId={caseId} onCreated={onChange} />
                </div>
              </details>
            )}
          </section>

          <section id="imprevus" className="scroll-mt-6 space-y-3">
            <h2 className="mr-heading text-mr-ink">Imprévus</h2>
            <ScopeIssueList
              issues={thread.data?.scopeIssues ?? []}
              canManage={false}
              onChange={onChange}
            />
            {writable && (
              <details>
                <summary className="mr-small cursor-pointer font-semibold text-mr-ink">
                  Signaler un imprévu à Ma Reliure
                </summary>
                <div className="mt-3">
                  <ScopeIssueForm caseId={caseId} onReported={onChange} />
                </div>
              </details>
            )}
          </section>

          <details>
            <summary className="mr-heading cursor-pointer text-mr-ink">Résumé du projet</summary>
            <div className="mt-4">
              <CaseBriefPanel view={data.view} />
            </div>
          </details>
        </div>

        <aside className="space-y-8 lg:border-l lg:border-mr-rule lg:pl-8">
          <section>
            <h2 className="mr-eyebrow text-mr-ink">Travail commandé</h2>
            {data.work.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {data.work.map((line, index) => (
                  <li key={`${line.label}-${index}`} className="mr-body text-mr-ink">
                    {line.label}
                    {line.quantity > 1 && (
                      <span className="text-mr-graphite"> × {line.quantity}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mr-small mt-2 text-mr-muted">Le détail sera précisé par Ma Reliure.</p>
            )}
            <p className="mr-meta mt-2">
              Périmètre validé par Ma Reliure. Un changement se signale comme imprévu.
            </p>
          </section>

          <section>
            <h2 className="mr-eyebrow text-mr-ink">Rémunération atelier</h2>
            <p className="mr-title mt-2 tabular-nums text-mr-ink">
              {data.offer?.binder_payout_cents ? formatEuros(data.offer.binder_payout_cents) : "—"}
            </p>
          </section>

          <section>
            <h2 className="mr-eyebrow text-mr-ink">Avancement</h2>
            <div className="mt-3">
              <JourneyTimeline stages={visibleJourney(data.caseStatus)} />
            </div>
          </section>

          <section>
            <h2 className="mr-eyebrow text-mr-ink">Photos du livre</h2>
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {data.view.photos.map((photo, index) =>
                photo.url ? (
                  <li key={index}>
                    <a href={photo.url} target="_blank" rel="noreferrer">
                      <img
                        src={photo.url}
                        alt={photo.caption ?? ""}
                        loading="lazy"
                        className="aspect-square w-full rounded-[2px] border border-mr-rule object-cover"
                      />
                    </a>
                  </li>
                ) : null,
              )}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proposition
// ---------------------------------------------------------------------------

const DECLINE_REASONS = [
  ["payout_insufficient", "Rémunération insuffisante"],
  ["deadline_impossible", "Délai impossible"],
  ["outside_specialty", "Hors de ma spécialité"],
  ["no_capacity", "Capacité indisponible"],
  ["other", "Autre"],
] as const;

function OfferView({ caseId, data }: { caseId: string; data: WorkshopCase }) {
  const respond = useServerFn(respondToBinderOffer);
  const queryClient = useQueryClient();
  const [reasonCode, setReasonCode] = useState<(typeof DECLINE_REASONS)[number][0]>("no_capacity");
  const [reasonDetail, setReasonDetail] = useState("");
  const [minimumPayout, setMinimumPayout] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
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
      await queryClient.invalidateQueries({ queryKey: ["marketplace", "binder", "case", caseId] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace", "binder", "cases"] });
    },
    onError: (err: Error) => setProblem(err.message),
  });

  const offer = data.offer;
  const fieldClass =
    "mt-1 block w-full rounded-[2px] border border-mr-rule-strong bg-white px-3 py-2 text-[0.9375rem]";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <CaseBriefPanel view={data.view} />
      <aside className="space-y-6">
        <section className="border border-mr-rule bg-white p-5">
          <h2 className="mr-heading text-mr-ink">Proposition de projet</h2>
          {offer?.binder_payout_cents ? (
            <>
              <p className="mr-small mt-3 text-mr-graphite">Votre rémunération fixe</p>
              <p className="mr-title mt-1 tabular-nums text-mr-ink">
                {formatEuros(offer.binder_payout_cents)}
              </p>
              <p className="mr-small mt-3 text-mr-graphite">
                Cette rémunération couvre le périmètre décrit dans le projet. Aucun prix n'est
                demandé à l'atelier.
              </p>
            </>
          ) : (
            <p className="mr-small mt-3 text-mr-graphite">
              Cette sollicitation ne contient pas de rémunération validée. Ma Reliure doit la
              reprendre avant toute réponse.
            </p>
          )}
        </section>

        {data.canRespond && offer?.binder_payout_cents ? (
          <section className="space-y-4 border border-mr-rule bg-white p-5">
            <h2 className="mr-heading text-mr-ink">Votre disponibilité</h2>
            <button
              type="button"
              disabled={answer.isPending}
              onClick={() => answer.mutate(true)}
              className="mr-tap w-full rounded-[2px] bg-mr-ink px-5 py-3 text-[0.9375rem] font-semibold text-mr-paper hover:bg-mr-walnut disabled:opacity-50"
            >
              Accepter cette offre
            </button>
            <div className="border-t border-mr-rule pt-4">
              <label className="mr-small block text-mr-ink" htmlFor="decline-reason">
                Motif de refus
              </label>
              <select
                id="decline-reason"
                className={fieldClass}
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
                  facultatif : révélé par une décision réelle, sans effet sur
                  l'issue de cette offre. */}
              {reasonCode === "payout_insufficient" && (
                <label className="mr-small mt-3 block text-mr-ink">
                  À quelle rémunération auriez-vous accepté ? (facultatif)
                  <input
                    className={fieldClass}
                    inputMode="decimal"
                    value={minimumPayout}
                    onChange={(event) => setMinimumPayout(event.target.value)}
                    placeholder="en euros"
                  />
                  <span className="mr-meta mt-1 block">
                    Cela ne rouvre pas cette proposition. Nous nous en servons pour ajuster nos
                    prix.
                  </span>
                </label>
              )}
              <textarea
                className={`${fieldClass} mt-3`}
                rows={3}
                value={reasonDetail}
                onChange={(event) => setReasonDetail(event.target.value)}
                placeholder="Précision facultative"
              />
              <button
                type="button"
                disabled={answer.isPending}
                onClick={() => answer.mutate(false)}
                className="mr-tap mt-3 w-full rounded-[2px] border border-mr-ink px-5 py-3 text-[0.9375rem] font-semibold text-mr-ink disabled:opacity-50"
              >
                Refuser cette offre
              </button>
            </div>
            {problem && <p className="mr-small text-mr-bordeaux">{problem}</p>}
          </section>
        ) : (
          <section className="mr-small border border-mr-rule bg-white p-5 text-mr-graphite">
            {offer?.state === "accepted" &&
              "Offre acceptée. Ma Reliure vous confirmera si votre atelier est retenu."}
            {offer?.state === "declined" && "Vous avez refusé cette offre."}
            {offer?.state === "cancelled" && "Cette offre a été clôturée."}
            {!offer && "Aucune offre active pour ce projet."}
          </section>
        )}
      </aside>
    </div>
  );
}
