import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getWorkspaceDossier,
  updateDossierFollowUp,
  type CommercialStatus,
} from "@/build/services/portal.data.functions";
import type { ProjectBrief } from "@/build/schema/brief";
import { ProjectBriefView } from "@/build/components/ProjectBriefView";

export const Route = createFileRoute("/_authenticated/portal/dossiers/$id")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Dossier — Espace Client" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: PortalDossierDetailPage,
});

const STATUS_OPTIONS: { id: CommercialStatus; label: string }[] = [
  { id: "nouveau", label: "Nouveau" },
  { id: "contacte", label: "Contacté" },
  { id: "devise", label: "Devisé" },
  { id: "gagne", label: "Gagné" },
  { id: "perdu", label: "Perdu" },
];

function PortalDossierDetailPage() {
  const { id } = Route.useParams();
  const fetchDossier = useServerFn(getWorkspaceDossier);
  const key = ["portal", "dossier", id] as const;
  const opts = queryOptions({ queryKey: key, queryFn: () => fetchDossier({ data: { id } }) });
  const { data } = useSuspenseQuery(opts);
  const { dossier, mission } = data;
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(dossier.commercial_notes ?? "");

  const updateFollowUp = useServerFn(updateDossierFollowUp);
  const statusMutation = useMutation({
    mutationFn: (status: CommercialStatus) =>
      updateFollowUp({ data: { id, commercial_status: status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["portal", "dossiers"] });
    },
  });
  const notesMutation = useMutation({
    mutationFn: () => updateFollowUp({ data: { id, commercial_notes: notes } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["portal", "dossiers"] });
    },
  });

  const brief = dossier.content as unknown as ProjectBrief;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/portal" className="text-xs text-muted-foreground hover:underline">
          ← Mes Dossiers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          {dossier.summary ?? `Dossier ${dossier.id.slice(0, 8)}`}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Reçu {new Date(dossier.created_at).toLocaleString()}
          {mission?.name ? ` · via ${mission.name}` : ""}
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Suivi</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => statusMutation.mutate(s.id)}
              disabled={statusMutation.isPending}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                dossier.commercial_status === s.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-accent"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-muted-foreground">Notes internes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Notes visibles uniquement par votre équipe."
          />
          <button
            onClick={() => notesMutation.mutate()}
            disabled={notesMutation.isPending || notes === (dossier.commercial_notes ?? "")}
            className="mt-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
          >
            {notesMutation.isPending ? "Enregistrement…" : "Enregistrer les notes"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Détail du projet</h2>
        <div className="mt-3">
          <ProjectBriefView brief={brief} />
        </div>
      </section>
    </div>
  );
}
