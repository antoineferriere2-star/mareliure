import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBuildDossiers } from "@/build/services/admin.data.functions";

const dossiersKey = ["build-admin", "dossiers"] as const;

export const Route = createFileRoute("/_authenticated/build/dossiers")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dossiers — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: DossiersPage,
});

function DossiersPage() {
  const fetchDossiers = useServerFn(listBuildDossiers);
  const opts = queryOptions({ queryKey: dossiersKey, queryFn: () => fetchDossiers() });
  const { data: dossiers } = useSuspenseQuery(opts);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Dossiers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Briefs générés par les visiteurs publics via `/m/:publicToken`.
        </p>
      </header>

      {dossiers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Aucun dossier généré pour le moment.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Publie une mission puis partage le lien `/m/:publicToken` pour collecter des briefs.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Résumé</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-left">Mission</th>
                <th className="px-4 py-2 text-left">Créé</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.map((d) => (
                <tr key={d.id} className="border-b border-border/60 last:border-b-0 hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <Link
                      to="/build/dossiers/$id"
                      params={{ id: d.id }}
                      className="font-medium text-foreground hover:underline"
                    >
                      {d.summary ?? `Dossier ${d.id.slice(0, 8)}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase">
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {d.mission_id ? d.mission_id.slice(0, 8) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
