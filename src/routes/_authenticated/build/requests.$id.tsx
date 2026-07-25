import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getBuildPublicRequest,
  updateBuildPublicRequestStatus,
  runSiteAuditForRequest,
  REQUEST_STATUSES,
} from "@/build/services/requests.data.functions";
import type { SiteAuditOutput } from "@/build/ai/siteAudit";
import { FindingsList } from "@/build/components/AgentFindings";

export const Route = createFileRoute("/_authenticated/build/requests/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Request — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: RequestDetailPage,
});

function humanizeKey(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

function RequestDetailPage() {
  const { id } = Route.useParams();
  const fetchRequest = useServerFn(getBuildPublicRequest);
  const key = ["build-admin", "requests", "detail", id] as const;
  const opts = queryOptions({ queryKey: key, queryFn: () => fetchRequest({ data: { id } }) });
  const { data: request } = useSuspenseQuery(opts);
  const queryClient = useQueryClient();

  const updateStatusFn = useServerFn(updateBuildPublicRequestStatus);
  const runAuditFn = useServerFn(runSiteAuditForRequest);

  const statusMutation = useMutation({
    mutationFn: (status: (typeof REQUEST_STATUSES)[number]) => updateStatusFn({ data: { id, status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const auditMutation = useMutation({
    mutationFn: () => runAuditFn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const payload = (request.payload ?? {}) as Record<string, unknown>;
  const websiteUrl = typeof payload.websiteUrl === "string" ? payload.websiteUrl : null;
  const auditResult = request.audit_result as unknown as SiteAuditOutput | null;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/build/requests" className="text-xs text-muted-foreground hover:underline">
          ← Requests
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          {typeof payload.firstName === "string"
            ? `${payload.firstName} ${payload.lastName ?? ""}`
            : (payload.name as string | undefined) ?? "Demande"}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {request.request_type} · reçue le {new Date(request.created_at).toLocaleString()} via {request.source_path}
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Statut</h2>
          <select
            value={request.status}
            onChange={(e) => statusMutation.mutate(e.target.value as (typeof REQUEST_STATUSES)[number])}
            disabled={statusMutation.isPending}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Détails de la demande</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {Object.entries(payload).map(([field, value]) => (
            <div key={field}>
              <dt className="text-xs text-muted-foreground">{humanizeKey(field)}</dt>
              <dd className="text-sm text-foreground">
                {field === "websiteUrl" && typeof value === "string" ? (
                  <a href={value} target="_blank" rel="noreferrer" className="text-primary underline">
                    {value}
                  </a>
                ) : (
                  String(value || "—")
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Audit du site</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {request.audit_analyzed_at
                ? `Dernier audit : ${new Date(request.audit_analyzed_at).toLocaleString()}`
                : websiteUrl
                  ? "Aucun audit lancé pour l'instant."
                  : "Cette demande n'a pas d'URL de site."}
            </p>
          </div>
          <button
            onClick={() => auditMutation.mutate()}
            disabled={auditMutation.isPending || !websiteUrl}
            className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            {auditMutation.isPending ? "Audit en cours…" : request.audit_analyzed_at ? "Relancer l'audit" : "Lancer l'audit du site"}
          </button>
        </div>
        {auditMutation.isError && (
          <p className="mt-2 text-xs text-destructive">
            {auditMutation.error instanceof Error ? auditMutation.error.message : "L'audit a échoué."}
          </p>
        )}
      </section>

      {auditResult && (
        <section className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
          <h2 className="text-sm font-semibold">Suggestions de l'audit — à valider</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Pistes proposées par l'IA sur le parcours de contact actuel du site. Le commercial garde toujours la
            décision finale.
          </p>
          <p className="mt-3 text-sm text-foreground">{auditResult.summary}</p>

          {auditResult.strengths.length > 0 && (
            <div className="mt-3">
              <h3 className="text-xs font-semibold text-foreground">Points forts</h3>
              <ul className="mt-1 list-disc pl-5 text-sm text-foreground">
                {auditResult.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {auditResult.gaps.length > 0 && (
            <div className="mt-3">
              <h3 className="text-xs font-semibold text-foreground">Manques</h3>
              <FindingsList findings={auditResult.gaps} />
            </div>
          )}

          {auditResult.suggestedNextSteps.length > 0 && (
            <div className="mt-3">
              <h3 className="text-xs font-semibold text-foreground">Prochaines étapes suggérées</h3>
              <ul className="mt-1 list-disc pl-5 text-sm text-foreground">
                {auditResult.suggestedNextSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
