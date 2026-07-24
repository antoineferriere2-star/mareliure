import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBuildDossier, analyzeDossierWithAI } from "@/build/services/admin.data.functions";
import type { AiInsights, AgentResult, Finding, FindingSeverity } from "@/build/ai/schema";

export const Route = createFileRoute("/_authenticated/build/dossiers/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dossier — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: DossierDetailPage,
});

type QuestionItem = { question?: string; label?: string; text?: string } | string;

const SEVERITY_STYLES: Record<FindingSeverity, string> = {
  info: "border-sky-300 bg-sky-50 text-sky-800",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
  critical: "border-red-300 bg-red-50 text-red-800",
};

function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${SEVERITY_STYLES[severity]}`}>
      {severity}
    </span>
  );
}

function AgentBlock({
  title,
  result,
  extra,
}: {
  title: string;
  result: AgentResult<{ summary: string; findings: Finding[] }>;
  extra?: string[];
}) {
  if (result.status === "error") {
    return (
      <div className="rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3">
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-destructive">Échec de l'analyse : {result.error}</p>
      </div>
    );
  }
  const data = result.data;
  if (!data) return null;
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <h3 className="text-xs font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-foreground">{data.summary}</p>
      {data.findings.length > 0 && (
        <ul className="mt-2 space-y-2">
          {data.findings.map((f, i) => (
            <li key={i} className="flex flex-col gap-1 rounded border border-border p-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{f.label}</span>
                <SeverityBadge severity={f.severity} />
              </div>
              <p className="text-muted-foreground">{f.detail}</p>
            </li>
          ))}
        </ul>
      )}
      {extra && extra.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">Notes utilisées : {extra.join(", ")}</p>
      )}
    </div>
  );
}

function AiInsightsSection({ insights }: { insights: AiInsights }) {
  return (
    <section className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Suggestions de l'IA — à valider</h2>
        <span className="text-[11px] text-muted-foreground">
          {new Date(insights.generatedAt).toLocaleString()} · {insights.model}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Pistes proposées par les agents IA. Le commercial garde toujours la décision finale — ceci ne modifie jamais
        le Dossier déterministe ci-dessous.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <AgentBlock title="Analyste" result={insights.analyste} />
        <AgentBlock
          title="Technicien"
          result={insights.technicien}
          extra={insights.technicien.data?.knowledgeNoteTitlesUsed}
        />
        <AgentBlock title="Vérificateur" result={insights.verificateur} />
        <div className="rounded-md border border-border bg-background p-3">
          <h3 className="text-xs font-semibold text-foreground">Rédacteur</h3>
          {insights.redacteur.status === "error" ? (
            <p className="mt-1 text-xs text-destructive">Échec de l'analyse : {insights.redacteur.error}</p>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{insights.redacteur.data?.narrative}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function DossierDetailPage() {
  const { id } = Route.useParams();
  const fetchDossier = useServerFn(getBuildDossier);
  const key = ["build-admin", "dossier", id] as const;
  const opts = queryOptions({ queryKey: key, queryFn: () => fetchDossier({ data: { id } }) });
  const { data } = useSuspenseQuery(opts);
  const { dossier, mission, session } = data;
  const queryClient = useQueryClient();
  const runAnalysis = useServerFn(analyzeDossierWithAI);

  const analyzeMutation = useMutation({
    mutationFn: () => runAnalysis({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const aiInsights = dossier.ai_insights as unknown as AiInsights | null;
  const content = (dossier.content ?? {}) as Record<string, unknown>;
  const nextQuestions = (dossier.next_questions ?? []) as QuestionItem[];
  const answers = (session?.answers ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/build/dossiers" className="text-xs text-muted-foreground hover:underline">← Dossiers</Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          {dossier.summary ?? `Dossier ${dossier.id.slice(0, 8)}`}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Créé {new Date(dossier.created_at).toLocaleString()} · Statut {dossier.status}
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Provenance</h2>
        <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Mission</dt>
            <dd>
              {mission ? (
                <Link to="/build/missions/$id" params={{ id: mission.id }} className="text-primary underline">
                  {mission.name}
                </Link>
              ) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Playbook</dt>
            <dd>{mission?.playbook_name ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Agents IA</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {dossier.ai_analyzed_at
                ? `Dernière analyse : ${new Date(dossier.ai_analyzed_at).toLocaleString()}`
                : "Aucune analyse IA n'a encore été lancée pour ce dossier."}
            </p>
          </div>
          <button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            {analyzeMutation.isPending ? "Analyse en cours…" : dossier.ai_analyzed_at ? "Relancer l'analyse" : "Analyser avec l'IA"}
          </button>
        </div>
        {analyzeMutation.isError && (
          <p className="mt-2 text-xs text-destructive">
            {analyzeMutation.error instanceof Error ? analyzeMutation.error.message : "L'analyse a échoué."}
          </p>
        )}
      </section>

      {aiInsights && <AiInsightsSection insights={aiInsights} />}

      {dossier.summary && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Résumé</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{dossier.summary}</p>
        </section>
      )}

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Contenu du dossier</h2>
        <pre className="mt-2 max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
{JSON.stringify(content, null, 2)}
        </pre>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Réponses collectées</h2>
        {Object.keys(answers).length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Aucune réponse disponible.</p>
        ) : (
          <pre className="mt-2 max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
{JSON.stringify(answers, null, 2)}
          </pre>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Prochaines questions</h2>
        {nextQuestions.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Aucune question de relance suggérée.</p>
        ) : (
          <ul className="mt-2 list-disc pl-5 text-sm text-foreground">
            {nextQuestions.map((q, i) => (
              <li key={i}>
                {typeof q === "string" ? q : q.question ?? q.label ?? q.text ?? JSON.stringify(q)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
