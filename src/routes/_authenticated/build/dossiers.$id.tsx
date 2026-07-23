import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBuildDossier } from "@/build/services/admin.data.functions";

export const Route = createFileRoute("/_authenticated/build/dossiers/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dossier — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: DossierDetailPage,
});

type QuestionItem = { question?: string; label?: string; text?: string } | string;

function DossierDetailPage() {
  const { id } = Route.useParams();
  const fetchDossier = useServerFn(getBuildDossier);
  const key = ["build-admin", "dossier", id] as const;
  const opts = queryOptions({ queryKey: key, queryFn: () => fetchDossier({ data: { id } }) });
  const { data } = useSuspenseQuery(opts);
  const { dossier, mission, session } = data;

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
