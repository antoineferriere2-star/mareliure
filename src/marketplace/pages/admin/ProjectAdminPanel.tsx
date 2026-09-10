/**
 * Le suivi d'un projet, côté Ma Reliure.
 *
 * Une seule conversation — client, atelier, Ma Reliure —, pas trois
 * messageries. L'admin la lit, y intervient (ses messages sont signés « Ma
 * Reliure »), suit les décisions, traite les imprévus et confirme la commande.
 * Le panneau n'apparaît qu'une fois un atelier retenu : avant, il n'y a pas de
 * fil.
 */
import { useQueryClient } from "@tanstack/react-query";
import { DecisionRequestForm } from "@/marketplace/pages/project/DecisionRequestForm";
import { DecisionHistory, PendingDecisionList } from "@/marketplace/pages/project/ProjectDecisions";
import {
  ProgressActions,
  type ProgressStepView,
} from "@/marketplace/pages/project/ProjectProgress";
import { ProjectThread } from "@/marketplace/pages/project/ProjectThread";
import { ScopeIssueList } from "@/marketplace/pages/project/ScopeIssues";
import { useProjectThread } from "@/marketplace/pages/project/useProjectThread";

const THREAD_STATUSES = new Set([
  "binder_selected",
  "awaiting_payment",
  "paid",
  "shipping_to_binder",
  "received_by_binder",
  "in_progress",
  "awaiting_approval",
  "work_finished",
  "shipping_to_customer",
  "delivered",
  "completed",
  "cancelled",
]);

export function ProjectAdminPanel({ caseId, caseStatus }: { caseId: string; caseStatus: string }) {
  const enabled = THREAD_STATUSES.has(caseStatus);
  const queryClient = useQueryClient();
  const { thread, refresh } = useProjectThread(caseId, enabled);
  if (!enabled) return null;

  const onChange = async () => {
    await refresh();
    await queryClient.invalidateQueries({ queryKey: ["marketplace", "case", caseId] });
  };
  if (thread.isPending)
    return <p className="text-sm text-muted-foreground">Chargement du suivi…</p>;
  if (thread.error)
    return <p className="text-sm text-destructive">{(thread.error as Error).message}</p>;
  const data = thread.data!;
  const openIssues = data.scopeIssues.filter((issue) => issue.status !== "RESOLVED").length;
  const openDecisions = data.decisions.filter((decision) => decision.status === "OPEN").length;
  const lastMessage = data.messages.at(-1);

  return (
    <section className="mr-site space-y-8 rounded-lg border border-border bg-mr-paper p-5 sm:p-6">
      <header>
        <h2 className="mr-heading text-mr-ink">Suivi du projet</h2>
        <p className="mr-small mt-1 text-mr-graphite">
          {[
            `${data.messages.length} message${data.messages.length > 1 ? "s" : ""}`,
            openDecisions > 0
              ? `${openDecisions} décision${openDecisions > 1 ? "s" : ""} en attente du client`
              : null,
            openIssues > 0 ? `${openIssues} imprévu${openIssues > 1 ? "s" : ""} à traiter` : null,
            lastMessage
              ? `dernière activité ${new Date(lastMessage.createdAt).toLocaleString("fr-FR")}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-4">
          <ProgressActions
            caseId={caseId}
            steps={data.progressSteps as ProgressStepView[]}
            onDone={onChange}
          />
        </div>
      </header>

      <div>
        <h3 className="mr-eyebrow text-mr-ink">Imprévus signalés par l'atelier</h3>
        <div className="mt-2">
          <ScopeIssueList issues={data.scopeIssues} canManage onChange={onChange} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <h3 className="mr-eyebrow text-mr-ink">Décisions en attente</h3>
          <div className="mt-2">
            <PendingDecisionList
              decisions={data.decisions}
              canCancel={data.access === "write"}
              onChange={onChange}
            />
          </div>
        </div>
        <div>
          <h3 className="mr-eyebrow text-mr-ink">Choix enregistrés</h3>
          <div className="mt-2">
            <DecisionHistory decisions={data.decisions} audience="team" />
          </div>
        </div>
      </div>

      <ProjectThread
        caseId={caseId}
        thread={data}
        title="Conversation du projet"
        notice="Client, atelier et Ma Reliure dans un seul fil. Ce que vous écrivez ici est signé « Ma Reliure »."
        onChange={onChange}
      />

      {data.access === "write" && (
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
  );
}
