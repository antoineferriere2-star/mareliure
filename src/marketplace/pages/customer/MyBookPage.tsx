/**
 * La fiche d'un livre : ce qui se passe maintenant, puis tout le reste.
 *
 * Colonne principale : l'état, la réponse attendue s'il y en a une, le
 * parcours, la conversation avec l'atelier, les choix enregistrés. Barre
 * latérale : le livre, le prix, l'atelier, la commande. Sur téléphone, le même
 * ordre, en colonne — la réponse attendue reste avant la conversation.
 *
 * Ce que le client ne voit jamais ici : la rémunération de l'atelier, les
 * notes internes, les imprévus signalés par l'atelier. Le serveur ne les
 * renvoie pas.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyCustomerCase } from "@/marketplace/services/marketplace.data.functions";
import { CaseBriefPanel } from "@/marketplace/pages/CaseBriefPanel";
import { binderSkillLabel } from "@/marketplace/binders/skills";
import { formatEuros } from "@/marketplace/pricing/money";
import { lastActivityAt } from "@/marketplace/project/thread";
import { describeWork } from "@/marketplace/project/views";
import { DecisionHistory, OpenDecisionCard } from "../project/ProjectDecisions";
import { JourneyTimeline } from "../project/ProjectProgress";
import { ProjectThread } from "../project/ProjectThread";
import { formatDay, formatWhen } from "../project/projectFormat";
import { useProjectThread } from "../project/useProjectThread";

export const CUSTOMER_THREAD_NOTICE =
  "Échanges tenus dans le cadre du service Ma Reliure, qui peut les consulter pour suivre votre commande et vous assister. Coordonnées, paiement et prix n'y passent pas.";

export function MyBookPage({ caseId }: { caseId: string }) {
  const fetchCase = useServerFn(getMyCustomerCase);
  const queryClient = useQueryClient();
  const caseKey = ["marketplace", "customer", "case", caseId] as const;
  const { data, isPending, error } = useQuery({
    queryKey: caseKey,
    queryFn: () => fetchCase({ data: { caseId } }),
  });
  const hasThread = data !== undefined && data.threadAccess !== "none";
  const { thread, refresh } = useProjectThread(caseId, hasThread);

  if (isPending) return <p className="mr-small text-mr-muted">Chargement…</p>;
  if (error) return <p className="mr-small text-mr-bordeaux">{(error as Error).message}</p>;
  if (!data) return null;

  const onChange = async () => {
    await refresh();
    await queryClient.invalidateQueries({ queryKey: caseKey });
  };
  const decisions = thread.data?.decisions ?? [];
  const open = decisions.filter((decision) => decision.status === "OPEN");
  const cover = data.view.photos.find((photo) => photo.url)?.url ?? null;
  const updatedAt = lastActivityAt([
    data.case.createdAt,
    thread.data?.messages.at(-1)?.createdAt,
    ...decisions.map((decision) => decision.answeredAt ?? decision.createdAt),
  ]);
  const price = data.case.customerPriceTtcCents ?? data.case.customerPriceCents;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
      <div className="min-w-0 space-y-12">
        <header className="grid grid-cols-[5.5rem_1fr] gap-5 sm:grid-cols-[8rem_1fr] sm:gap-7">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="aspect-[3/4] w-full rounded-[2px] border border-mr-rule object-cover"
            />
          ) : (
            <div className="aspect-[3/4] w-full rounded-[2px] border border-mr-rule bg-mr-paper-deep" />
          )}
          <div className="min-w-0">
            <p className="mr-meta">{data.case.reference}</p>
            <h1 className="mr-title text-mr-ink">{data.view.title}</h1>
            {data.work.length > 0 && (
              <p className="mr-small mt-1 text-mr-graphite">{describeWork(data.work)}</p>
            )}
            <p className="mr-heading mt-5 text-mr-ink">{data.statusText.headline}</p>
            <p className="mr-body text-mr-graphite">{data.statusText.detail}</p>
            {updatedAt && (
              <p className="mr-meta mt-2">Dernière mise à jour : {formatWhen(updatedAt)}</p>
            )}
          </div>
        </header>

        {open.length > 0 && (
          <section
            id="decisions"
            aria-labelledby="decisions-title"
            className="scroll-mt-6 space-y-4"
          >
            <h2 id="decisions-title" className="mr-eyebrow text-mr-bordeaux">
              Votre réponse est attendue
            </h2>
            {open.map((decision) => (
              <OpenDecisionCard key={decision.id} decision={decision} onAnswered={onChange} />
            ))}
          </section>
        )}

        <section aria-labelledby="journey-title">
          <h2 id="journey-title" className="mr-heading text-mr-ink">
            Où en est votre livre
          </h2>
          <div className="mt-4">
            <JourneyTimeline stages={data.journey} />
          </div>
        </section>

        {hasThread && thread.data ? (
          <ProjectThread
            caseId={caseId}
            thread={thread.data}
            title="Conversation avec l'atelier"
            notice={CUSTOMER_THREAD_NOTICE}
            onChange={onChange}
          />
        ) : (
          <section className="border-t border-mr-rule pt-6">
            <h2 className="mr-heading text-mr-ink">Conversation avec l'atelier</h2>
            <p className="mr-small mt-1 text-mr-muted">
              {thread.isPending && hasThread
                ? "Chargement…"
                : "Elle s'ouvre dès que l'atelier est retenu pour votre livre."}
            </p>
          </section>
        )}

        {hasThread && (
          <section aria-labelledby="choices-title" id={open.length === 0 ? "decisions" : undefined}>
            <h2 id="choices-title" className="mr-heading text-mr-ink">
              Vos choix
            </h2>
            <div className="mt-3">
              <DecisionHistory decisions={decisions} audience="customer" />
            </div>
          </section>
        )}
      </div>

      <aside className="space-y-8 lg:border-l lg:border-mr-rule lg:pl-10">
        <section>
          <h2 className="mr-eyebrow text-mr-ink">Votre livre</h2>
          {data.view.photos.length > 0 ? (
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
          ) : (
            <p className="mr-small mt-2 text-mr-muted">Aucune photo.</p>
          )}
        </section>

        <section>
          <h2 className="mr-eyebrow text-mr-ink">Prix</h2>
          {price !== null ? (
            <>
              <p className="mr-title mt-2 text-mr-ink">
                {formatEuros(price)}
                {data.case.customerPriceTtcCents !== null && (
                  <span className="mr-small ml-1 text-mr-graphite">TTC</span>
                )}
              </p>
              <p className="mr-small text-mr-graphite">Fixé par Ma Reliure.</p>
              {data.case.priceIncludes.length > 0 && (
                <p className="mr-small mt-1 text-mr-graphite">
                  Comprend : {data.case.priceIncludes.join(", ")}.
                </p>
              )}
            </>
          ) : (
            <p className="mr-small mt-2 text-mr-graphite">
              Ma Reliure étudie le travail à faire avant de vous présenter son prix.
            </p>
          )}
        </section>

        {data.selectedBinder && (
          <section>
            <h2 className="mr-eyebrow text-mr-ink">Atelier</h2>
            <p className="mr-heading mt-2 text-mr-ink">
              {data.selectedBinder.workshop_name ?? data.selectedBinder.display_name}
            </p>
            <p className="mr-small text-mr-graphite">
              {[
                data.selectedBinder.city,
                data.selectedBinder.years_experience
                  ? `${data.selectedBinder.years_experience} ans de métier`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {data.selectedBinder.skills.length > 0 && (
              <p className="mr-small mt-1 text-mr-graphite">
                {data.selectedBinder.skills.map(binderSkillLabel).join(", ")}
              </p>
            )}
            {data.selectedBinder.bio && (
              <p className="mr-small mt-2 text-mr-graphite">{data.selectedBinder.bio}</p>
            )}
          </section>
        )}

        <section>
          <h2 className="mr-eyebrow text-mr-ink">Commande</h2>
          <p className="mr-small mt-2 text-mr-graphite">
            {data.case.reference} · présenté le {formatDay(data.case.createdAt)}
          </p>
        </section>

        <details>
          <summary className="mr-small cursor-pointer text-mr-graphite">
            Votre demande, telle que vous l'avez décrite
          </summary>
          <div className="mt-4">
            <CaseBriefPanel view={data.view} />
          </div>
        </details>
      </aside>
    </div>
  );
}
