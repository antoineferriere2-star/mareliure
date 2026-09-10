/**
 * Le parcours du livre, et les gestes qui le font avancer.
 *
 * Fait, en cours, à venir : trois marques, écrites pour les lecteurs d'écran.
 * Pas de barre, pas de pourcentage. Les actions d'avancement ne montrent que
 * ce que l'acteur a le droit de faire depuis l'état actuel, et demandent une
 * confirmation : « Travail terminé » prévient le client.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { advanceProjectStatus } from "@/marketplace/services/projectThread.functions";
import type { JourneyState } from "@/marketplace/cases/journey";

const MARKS: Record<JourneyState, { symbol: string; label: string; className: string }> = {
  done: { symbol: "✓", label: "étape franchie", className: "text-mr-ink" },
  current: { symbol: "●", label: "étape en cours", className: "text-mr-bordeaux" },
  upcoming: { symbol: "○", label: "étape à venir", className: "text-mr-muted" },
};

export function JourneyTimeline({
  stages,
}: {
  stages: readonly { id: string; title: string; upcoming: string; state: JourneyState }[];
}) {
  return (
    <ol className="space-y-2.5">
      {stages.map((stage) => {
        const mark = MARKS[stage.state];
        return (
          <li key={stage.id} className="flex gap-3">
            <span aria-hidden="true" className={`w-4 shrink-0 text-center ${mark.className}`}>
              {mark.symbol}
            </span>
            <div>
              <p
                className={`mr-body ${stage.state === "current" ? "font-semibold text-mr-ink" : stage.state === "done" ? "text-mr-ink" : "text-mr-muted"}`}
              >
                {stage.title}
                <span className="sr-only"> — {mark.label}</span>
              </p>
              {stage.state === "current" && (
                <p className="mr-small text-mr-graphite">{stage.upcoming}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export type ProgressStepView = {
  to: "paid" | "received_by_binder" | "in_progress" | "work_finished";
  label: string;
};

const CONFIRMATIONS: Record<string, string> = {
  paid: "Le règlement du client a bien été reçu par Ma Reliure. L'atelier pourra confirmer la réception du livre.",
  received_by_binder: "Le livre est bien entre vos mains. Le client en sera prévenu par e-mail.",
  in_progress: "Vous commencez le travail commandé.",
  work_finished:
    "Le travail est terminé. Le client en sera prévenu, et Ma Reliure préparera le retour.",
};

export function ProgressActions({
  caseId,
  steps,
  onDone,
}: {
  caseId: string;
  steps: readonly {
    to: "paid" | "received_by_binder" | "in_progress" | "work_finished";
    label: string;
  }[];
  onDone: () => Promise<unknown>;
}) {
  const advance = useServerFn(advanceProjectStatus);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const move = useMutation({
    mutationFn: (to: (typeof steps)[number]["to"]) => advance({ data: { caseId, to } }),
    onMutate: () => setProblem(null),
    onSuccess: async () => {
      setConfirming(null);
      await onDone();
    },
    onError: (error: Error) => setProblem(error.message),
  });
  if (steps.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {steps.map((step) =>
          confirming === step.to ? (
            <div
              key={step.to}
              className="flex flex-wrap items-center gap-2 border border-mr-ink bg-white px-3 py-2"
            >
              <span className="mr-small max-w-md text-mr-ink">{CONFIRMATIONS[step.to]}</span>
              <button
                type="button"
                disabled={move.isPending}
                onClick={() => move.mutate(step.to)}
                className="mr-tap rounded-[2px] bg-mr-ink px-4 py-2 text-[0.875rem] font-semibold text-mr-paper disabled:opacity-50"
              >
                {move.isPending ? "…" : `Confirmer : ${step.label.toLowerCase()}`}
              </button>
              <button
                type="button"
                className="mr-small text-mr-muted"
                onClick={() => setConfirming(null)}
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              key={step.to}
              type="button"
              onClick={() => setConfirming(step.to)}
              className="mr-tap rounded-[2px] bg-mr-ink px-4 py-2.5 text-[0.9375rem] font-semibold text-mr-paper hover:bg-mr-walnut"
            >
              {step.label}
            </button>
          ),
        )}
      </div>
      {problem && (
        <p role="alert" className="mr-small text-mr-bordeaux">
          {problem}
        </p>
      )}
    </div>
  );
}
