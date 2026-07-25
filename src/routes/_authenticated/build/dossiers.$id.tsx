import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBuildDossier, analyzeDossierWithAI, getInspirationPhotoUrl } from "@/build/services/admin.data.functions";
import type { AiInsights } from "@/build/ai/schema";
import type { InspirationPhotoAnswer } from "@/build/schema/answers";
import { DetectionBadge } from "@/build/components/DetectionBadge";
import { AgentBlock } from "@/build/components/AgentFindings";

export const Route = createFileRoute("/_authenticated/build/dossiers/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dossier — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: DossierDetailPage,
});

type QuestionItem = { question?: string; label?: string; text?: string } | string;

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

function isInspirationPhotoAnswer(value: unknown): value is InspirationPhotoAnswer {
  return (
    !!value &&
    typeof value === "object" &&
    "photoPath" in value &&
    "hypotheses" in value &&
    typeof (value as InspirationPhotoAnswer).photoPath === "string"
  );
}

function findInspirationPhotoAnswers(answers: Record<string, unknown>): { fieldKey: string; answer: InspirationPhotoAnswer }[] {
  return Object.entries(answers)
    .filter(([, value]) => isInspirationPhotoAnswer(value))
    .map(([fieldKey, value]) => ({ fieldKey, answer: value as InspirationPhotoAnswer }));
}

function InspirationPhotoCard({ fieldKey, answer }: { fieldKey: string; answer: InspirationPhotoAnswer }) {
  const fetchUrl = useServerFn(getInspirationPhotoUrl);
  const { data } = useQuery({
    queryKey: ["build-admin", "inspiration-photo-url", answer.photoPath],
    queryFn: () => fetchUrl({ data: { path: answer.photoPath } }),
  });

  const rows: { label: string; text: string; confirmed: boolean }[] = [
    { label: "Style", text: answer.hypotheses.style ?? "", confirmed: answer.confirmed.style === true },
    {
      label: "Matériaux",
      text: answer.hypotheses.materials.join(", "),
      confirmed: answer.confirmed.materials === true,
    },
    { label: "Forme", text: answer.hypotheses.shape ?? "", confirmed: answer.confirmed.shape === true },
    {
      label: "Éléments",
      text: answer.hypotheses.elements.join(", "),
      confirmed: answer.confirmed.elements === true,
    },
  ].filter((r) => r.text.length > 0);

  return (
    <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
      {data?.url ? (
        <img src={data.url} alt="" className="h-48 w-full rounded-md border border-border object-cover sm:w-[200px]" />
      ) : (
        <div className="flex h-48 w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground sm:w-[200px]">
          Chargement…
        </div>
      )}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Champ : {fieldKey}</p>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune hypothèse détectée sur cette image.</p>
        ) : (
          rows.map((row) => (
            <div key={row.label} className="flex items-center gap-2 text-sm">
              <span className="w-20 shrink-0 font-medium text-foreground">{row.label}</span>
              <span className="text-foreground">{row.text}</span>
              <DetectionBadge state={row.confirmed ? "confirmed" : "detected"} />
            </div>
          ))
        )}
        {answer.suggestedQuestions.length > 0 && (
          <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Pistes suggérées :</p>
            <ul className="mt-1 list-disc pl-4">
              {answer.suggestedQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
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
  const inspirationPhotos = findInspirationPhotoAnswers(answers);

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

      {inspirationPhotos.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Photo d'inspiration</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Hypothèses proposées par l'IA à partir de l'image déposée par le visiteur — confirmées ou non par lui.
          </p>
          <div className="mt-3 space-y-4">
            {inspirationPhotos.map(({ fieldKey, answer }) => (
              <InspirationPhotoCard key={fieldKey} fieldKey={fieldKey} answer={answer} />
            ))}
          </div>
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
