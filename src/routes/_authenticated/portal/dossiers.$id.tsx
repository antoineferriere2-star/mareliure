import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useMutation,
  useQuery,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  assignMyDossier,
  getWorkspaceDossier,
  getWorkspaceDossierPhotos,
  listMyWorkspaceMembers,
  updateDossierFollowUp,
  type CommercialStatus,
} from "@/build/services/portal.data.functions";
import type { ProjectBrief } from "@/build/schema/brief";
import { resolveDossierTitle } from "@/build/dossiers/dossierDisplay";
import type { AiInsights } from "@/build/ai/schema";
import { ProjectBriefView } from "@/build/components/ProjectBriefView";
import { AgentBlock } from "@/build/components/AgentFindings";
import { PortalError, PortalPending } from "@/build/pages/portal/PortalStates";

export const Route = createFileRoute("/_authenticated/portal/dossiers/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Project Brief — Client Portal" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  pendingComponent: PortalPending,
  errorComponent: PortalError,
  component: PortalDossierDetailPage,
});

type QuestionItem = { question?: string; label?: string; text?: string } | string;

function questionText(q: QuestionItem): string {
  if (typeof q === "string") return q;
  return q.question ?? q.label ?? q.text ?? "";
}

/** Read-only view of what the AI agents suggested. The team always decides. */
function PortalAiInsights({ insights }: { insights: AiInsights }) {
  return (
    <section className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">What the AI suggests — for your team to confirm</h2>
        <span className="text-[11px] text-muted-foreground">
          {new Date(insights.generatedAt).toLocaleString()}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Suggestions drawn from the Dossier. They never change the confirmed information below.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <AgentBlock title="Project analysis" result={insights.analyste} />
        <AgentBlock
          title="Technical read"
          result={insights.technicien}
          extra={insights.technicien.data?.knowledgeNoteTitlesUsed}
        />
        <AgentBlock title="Points to verify" result={insights.verificateur} />
        <div className="rounded-md border border-border bg-background p-3">
          <h3 className="text-xs font-semibold text-foreground">Summary</h3>
          {insights.redacteur.status === "error" ? (
            <p className="mt-1 text-xs text-destructive">
              Summary unavailable: {insights.redacteur.error}
            </p>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {insights.redacteur.data?.narrative}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

const STATUS_OPTIONS: { id: CommercialStatus; label: string }[] = [
  { id: "nouveau", label: "New" },
  { id: "contacte", label: "Contacted" },
  { id: "devise", label: "Quoted" },
  { id: "gagne", label: "Won" },
  { id: "perdu", label: "Lost" },
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

  // Who this Dossier can be handed to. Scoped to its own workspace, so the
  // list can never offer someone who would not be allowed to open it.
  const fetchMembers = useServerFn(listMyWorkspaceMembers);
  const { data: members } = useQuery({
    queryKey: ["portal", "members", dossier.workspace_id] as const,
    queryFn: () => fetchMembers({ data: { workspaceId: dossier.workspace_id! } }),
    enabled: Boolean(dossier.workspace_id),
  });

  const assign = useServerFn(assignMyDossier);
  const assignMutation = useMutation({
    mutationFn: (userId: string | null) => assign({ data: { id, userId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["portal", "dossiers"] });
    },
  });

  const brief = dossier.content as unknown as ProjectBrief;
  const aiInsights = dossier.ai_insights as unknown as AiInsights | null;
  const nextQuestions = ((dossier.next_questions ?? []) as QuestionItem[])
    .map(questionText)
    .filter((q) => q.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/portal" className="text-xs text-muted-foreground hover:underline">
          ← Project Briefs
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          {resolveDossierTitle({
            storedSummary: dossier.summary,
            projectSummary: brief?.projectSummary ?? null,
            visitorName: dossier.visitor_name ?? null,
            missionName: mission?.name ?? null,
            id: dossier.id,
          })}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Received {new Date(dossier.created_at).toLocaleString()}
          {mission?.name ? ` · via ${mission.name}` : ""}
        </p>
      </div>

      {nextQuestions.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Ask at the next contact</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {nextQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      )}

      {aiInsights && <PortalAiInsights insights={aiInsights} />}

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Follow-up</h2>

        <div className="mt-3">
          <label
            htmlFor="dossier-assignee"
            className="block text-xs font-medium text-muted-foreground"
          >
            Assigned to
          </label>
          <select
            id="dossier-assignee"
            value={dossier.assigned_to_user_id ?? ""}
            disabled={assignMutation.isPending || !members}
            onChange={(event) => assignMutation.mutate(event.target.value || null)}
            className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Unassigned</option>
            {(members ?? []).map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.email}
                {m.isSelf ? " (you)" : ""}
              </option>
            ))}
          </select>
          {assignMutation.isError && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {assignMutation.error instanceof Error
                ? assignMutation.error.message
                : "Could not change the assignee."}
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
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
          <label className="block text-xs font-medium text-muted-foreground">Internal notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Notes visible only to your team."
          />
          <button
            onClick={() => notesMutation.mutate()}
            disabled={notesMutation.isPending || notes === (dossier.commercial_notes ?? "")}
            className="mt-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
          >
            {notesMutation.isPending ? "Saving…" : "Save notes"}
          </button>
          {(statusMutation.isError || notesMutation.isError) && (
            <p className="mt-2 text-xs text-destructive">
              Saving failed. Please try again in a moment.
            </p>
          )}
        </div>
      </section>

      <DossierPhotos dossierId={dossier.id} />

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Project details</h2>
        <div className="mt-3">
          <ProjectBriefView brief={brief} />
        </div>
      </section>
    </div>
  );
}

/**
 * The photos the visitor attached. Loaded separately from the Dossier because
 * the URLs are signed and expire — freezing them into the Dossier payload
 * would hand the page links that are already dead by the time anyone reopens
 * a cached brief.
 *
 * Renders nothing at all when there are no photos: an empty "Photos" card on
 * every text-only Dossier would be noise on the page the sales team reads
 * before each call.
 */
function DossierPhotos({ dossierId }: { dossierId: string }) {
  const fetchPhotos = useServerFn(getWorkspaceDossierPhotos);
  const { data, isPending } = useQuery({
    queryKey: ["portal", "dossier-photos", dossierId] as const,
    queryFn: () => fetchPhotos({ data: { id: dossierId } }),
  });

  if (isPending) {
    return <div className="h-24 animate-pulse rounded-lg border border-border bg-muted" />;
  }
  const photos = data?.photos ?? [];
  if (photos.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">
        Photos from the visitor
        <span className="ml-2 font-normal text-muted-foreground">({photos.length})</span>
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo, index) => (
          <li key={photo.url ?? index}>
            <a href={photo.url ?? "#"} target="_blank" rel="noreferrer" className="block">
              <img
                src={photo.url ?? ""}
                alt={photo.caption ?? `Photo ${index + 1} attached by the visitor`}
                loading="lazy"
                className="h-40 w-full rounded-md border border-border object-cover"
              />
            </a>
            {photo.caption && <p className="mt-1 text-xs text-muted-foreground">{photo.caption}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Links expire after an hour — reopen this Project Brief to view them again.
      </p>
    </section>
  );
}
