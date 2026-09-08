/**
 * The matching screen (§33): the Project Brief on the left, the relieurs who
 * could take it on the right, and a hard ceiling of three.
 *
 * The score orders the right-hand column and explains itself; it never ticks a
 * box. The admin decides, which is the whole point of a concierge MVP — and of
 * the CLAUDE.md rule that the system proposes and the human disposes.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  clearCaseManualReview,
  getMarketplaceCase,
  sendCaseToBinders,
} from "@/marketplace/services/marketplace.data.functions";
import { CaseBriefPanel } from "@/marketplace/pages/CaseBriefPanel";
import { binderSkillLabel } from "@/marketplace/binders/skills";
import { CASE_STATUS_LABELS, isCaseStatus } from "@/marketplace/cases/state";
import { formatEuros } from "@/marketplace/orders/commission";
import { Button } from "@/components/ui/button";

export function CaseMatchingPage({ caseId }: { caseId: string }) {
  const fetchCase = useServerFn(getMarketplaceCase);
  const send = useServerFn(sendCaseToBinders);
  const clearReview = useServerFn(clearCaseManualReview);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const queryKey = ["marketplace", "case", caseId] as const;
  const { data, isPending, error } = useQuery({
    queryKey,
    queryFn: () => fetchCase({ data: { caseId } }),
  });

  const invite = useMutation({
    mutationFn: () => send({ data: { caseId, binderIds: selected } }),
    onSuccess: async () => {
      setSelected([]);
      setProblem(null);
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["marketplace", "cases"] });
    },
    onError: (err: Error) => setProblem(err.message),
  });

  const release = useMutation({
    mutationFn: () => clearReview({ data: { caseId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const remaining = data.remainingInvitations;
  const held = data.case.manual_review_required;
  const canInvite = !held && remaining > 0 && selected.length > 0;

  function toggle(id: string) {
    setProblem(null);
    setSelected((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length >= remaining
          ? current
          : [...current, id],
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div>
        <CaseBriefPanel view={data.view} />
      </div>

      <aside className="space-y-6">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Statut
          </h2>
          <p className="mt-2 text-lg">
            {isCaseStatus(data.case.status)
              ? CASE_STATUS_LABELS[data.case.status]
              : data.case.status}
          </p>
          {held && (
            <div className="mt-4 rounded-md border border-amber-600/30 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <p className="font-medium">Revue manuelle requise</p>
              {data.case.admin_notes && (
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {data.case.admin_notes.split("\n").map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                disabled={release.isPending}
                onClick={() => release.mutate()}
              >
                J'ai vérifié : ouvrir à la sélection
              </Button>
            </div>
          )}
          {data.requiredSkills.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Compétences attendues : {data.requiredSkills.map(binderSkillLabel).join(", ")}.
            </p>
          )}
        </section>

        {data.quotes.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Propositions reçues
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {data.quotes.map((quote) => (
                <li key={quote.id} className="flex justify-between gap-3">
                  <span className="truncate">{quote.description}</span>
                  <span className="shrink-0 font-medium">
                    {formatEuros(quote.amount_cents)} · {quote.lead_time_weeks} sem.
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Relieurs compatibles
            </h2>
            <span className="text-xs text-muted-foreground">
              {remaining} invitation(s) restante(s)
            </span>
          </div>

          {data.candidates.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun relieur approuvé pour le moment.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.candidates.map((candidate) => {
                const checked = selected.includes(candidate.id);
                return (
                  <li key={candidate.id}>
                    <label
                      className={`flex cursor-pointer gap-3 rounded-md border p-3 transition ${
                        checked
                          ? "border-foreground bg-muted/60"
                          : "border-border hover:border-foreground/30"
                      } ${candidate.alreadyInvited ? "opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={checked}
                        disabled={candidate.alreadyInvited || held}
                        onChange={() => toggle(candidate.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-medium">
                            {candidate.workshopName ?? candidate.displayName}
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                            {candidate.score}/100
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {[
                            candidate.city,
                            candidate.yearsExperience ? `${candidate.yearsExperience} ans` : null,
                            candidate.ratingCount > 0 && candidate.ratingAvg
                              ? `${candidate.ratingAvg}/5 (${candidate.ratingCount})`
                              : null,
                            `${candidate.activeLoad}/${candidate.capacitySlots} en cours`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {candidate.skills.length > 0 && (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {candidate.skills.map(binderSkillLabel).join(", ")}
                          </span>
                        )}
                        {candidate.missingSkills.length > 0 && (
                          <span className="mt-1 block text-xs text-amber-700">
                            Ne déclare pas :{" "}
                            {candidate.missingSkills.map(binderSkillLabel).join(", ")}
                          </span>
                        )}
                        {candidate.alreadyInvited && (
                          <span className="mt-1 block text-xs">Déjà invité</span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {problem && <p className="mt-4 text-sm text-destructive">{problem}</p>}

          <Button
            className="mt-5 w-full"
            disabled={!canInvite || invite.isPending}
            onClick={() => invite.mutate()}
          >
            {invite.isPending ? "Envoi…" : "Envoyer le projet à ces relieurs"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Un dossier est envoyé à trois relieurs au maximum.
          </p>
        </section>
      </aside>
    </div>
  );
}
