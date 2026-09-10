/**
 * Les décisions d'un projet, telles que le client les tranche et que l'atelier
 * les suit.
 *
 * Côté client : de gros boutons, lisibles au pouce, une étape de confirmation
 * qui nomme ce qu'on confirme (« Confirmer Bordeaux »), et une phrase qui dit
 * que le choix sera enregistré. Le texte à dorer s'affiche comme il sera doré,
 * avec l'avertissement sur l'orthographe.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  answerProjectDecision,
  cancelProjectDecision,
} from "@/marketplace/services/projectThread.functions";
import { DECISION_TYPE_LABELS, GILDING_WARNING } from "@/marketplace/project/decisions";
import { Attachments } from "./ProjectThread";
import { formatDateTime } from "./projectFormat";
import type { ProjectDecisionData } from "./useProjectThread";

function GildingLines({ decision }: { decision: ProjectDecisionData }) {
  return (
    <dl className="mt-4 border border-mr-rule bg-mr-paper px-4 py-3">
      {(decision.gildingText?.lines ?? []).map((line, index) => (
        <div
          key={`${line.position}-${index}`}
          className="flex flex-wrap items-baseline gap-x-4 py-1.5"
        >
          <dt className="mr-meta w-24 shrink-0">{line.position}</dt>
          <dd className="font-serif text-[1.25rem] tracking-[0.06em] text-mr-ink">{line.text}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OpenDecisionCard({
  decision,
  onAnswered,
}: {
  decision: ProjectDecisionData;
  onAnswered: () => Promise<unknown>;
}) {
  const answer = useServerFn(answerProjectDecision);
  const [selected, setSelected] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const gilding = decision.decisionType === "GILDING_TEXT";

  const submit = useMutation({
    mutationFn: (payload: { optionId: string | null; freeText: string | null }) =>
      answer({ data: { decisionId: decision.id, ...payload } }),
    onMutate: () => setProblem(null),
    onSuccess: onAnswered,
    onError: (error: Error) => setProblem(error.message),
  });

  const chosen = decision.options.find((option) => option.id === selected);

  return (
    <article className="border border-mr-ink/25 bg-white p-5 sm:p-6">
      <p className="mr-eyebrow text-mr-bordeaux">
        {decision.createdByRole === "admin"
          ? "Ma Reliure a besoin de votre réponse"
          : "L'atelier a besoin de votre choix"}
      </p>
      <h3 className="mr-heading mt-2 text-mr-ink">{decision.question}</h3>
      {decision.description && (
        <p className="mr-body mt-2 whitespace-pre-line text-mr-graphite">{decision.description}</p>
      )}

      {gilding ? (
        <>
          <GildingLines decision={decision} />
          <p className="mr-small mt-3 font-semibold text-mr-ink">{GILDING_WARNING}</p>
          {selected === "confirm" ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={submit.isPending}
                onClick={() => submit.mutate({ optionId: "confirm", freeText: null })}
                className="mr-tap rounded-[2px] bg-mr-ink px-6 py-3.5 text-[0.9375rem] font-semibold text-mr-paper hover:bg-mr-walnut disabled:opacity-50"
              >
                {submit.isPending ? "Enregistrement…" : "Oui, je confirme définitivement ce texte"}
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="mr-tap mr-small px-4 py-3 text-mr-graphite underline-offset-4 hover:underline"
              >
                Relire encore
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSelected("confirm")}
              className="mr-tap mt-4 w-full rounded-[2px] bg-mr-ink px-6 py-3.5 text-[0.9375rem] font-semibold text-mr-paper hover:bg-mr-walnut sm:w-auto"
            >
              Je confirme ce texte
            </button>
          )}
        </>
      ) : (
        <>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {decision.options.map((option) => {
              const photos = decision.optionFiles[option.id] ?? [];
              const active = selected === option.id;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelected(option.id)}
                    className={`block min-h-[3.75rem] w-full rounded-[2px] border bg-white p-3 text-left transition-colors ${
                      active
                        ? "border-mr-ink ring-1 ring-mr-ink"
                        : "border-mr-rule-strong hover:border-mr-ink"
                    }`}
                  >
                    {photos[0]?.url &&
                      photos[0].mimeType.startsWith("image/") &&
                      !photos[0].mimeType.includes("hei") && (
                        <img
                          src={photos[0].url}
                          alt={option.label}
                          className="mb-3 aspect-[4/3] w-full rounded-[2px] object-cover"
                        />
                      )}
                    <span className="block text-[1.0625rem] font-semibold text-mr-ink">
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="mr-small mt-1 block text-mr-graphite">
                        {option.description}
                      </span>
                    )}
                  </button>
                  {photos.length > 1 && <Attachments files={photos.slice(1)} />}
                </li>
              );
            })}
          </ul>
          {chosen && (
            <button
              type="button"
              disabled={submit.isPending}
              onClick={() => submit.mutate({ optionId: chosen.id, freeText: null })}
              className="mr-tap mt-4 w-full rounded-[2px] bg-mr-ink px-6 py-3.5 text-[0.9375rem] font-semibold text-mr-paper hover:bg-mr-walnut disabled:opacity-50 sm:w-auto"
            >
              {submit.isPending ? "Enregistrement…" : `Confirmer ${chosen.label}`}
            </button>
          )}
        </>
      )}

      {decision.allowFreeText && (
        <div className="mt-4">
          {writing ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit.mutate({ optionId: null, freeText });
              }}
            >
              <label className="mr-small block text-mr-ink" htmlFor={`free-${decision.id}`}>
                {gilding ? "Quelle correction faut-il apporter ?" : "Votre réponse"}
              </label>
              <textarea
                id={`free-${decision.id}`}
                rows={3}
                maxLength={2000}
                value={freeText}
                onChange={(event) => setFreeText(event.target.value)}
                className="mr-body mt-1 block w-full rounded-[2px] border border-mr-rule-strong bg-white px-3 py-2"
              />
              <button
                type="submit"
                disabled={freeText.trim() === "" || submit.isPending}
                className="mr-tap mt-2 rounded-[2px] border border-mr-ink px-5 py-2.5 text-[0.9375rem] font-semibold text-mr-ink hover:bg-mr-ink/[0.04] disabled:opacity-40"
              >
                Envoyer ma réponse
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setWriting(true)} className="mr-link mr-small">
              {gilding ? "Signaler une correction" : "Répondre autrement"}
            </button>
          )}
        </div>
      )}

      <p className="mr-meta mt-4">
        Votre réponse est enregistrée dans le dossier de votre livre et transmise à l'atelier. Elle
        ne se modifie plus ensuite : pour changer d'avis, écrivez-le dans la conversation.
      </p>
      {problem && (
        <p role="alert" className="mr-small mt-2 text-mr-bordeaux">
          {problem}
        </p>
      )}
    </article>
  );
}

/** Les décisions tranchées ou retirées, pour le client comme pour l'atelier. */
export function DecisionHistory({
  decisions,
  audience,
}: {
  decisions: readonly ProjectDecisionData[];
  audience: "customer" | "team";
}) {
  const settled = decisions.filter((decision) => decision.status !== "OPEN");
  if (settled.length === 0)
    return <p className="mr-small text-mr-muted">Aucun choix enregistré pour l'instant.</p>;
  return (
    <ul className="border-b border-mr-rule">
      {[...settled].reverse().map((decision) => (
        <li key={decision.id} className="border-t border-mr-rule py-3">
          <p className="mr-meta">
            {DECISION_TYPE_LABELS[decision.decisionType]} ·{" "}
            {formatDateTime(decision.answeredAt ?? decision.cancelledAt ?? decision.createdAt)}
          </p>
          <p className="mr-body text-mr-ink">{decision.question}</p>
          {decision.decisionType === "GILDING_TEXT" && decision.status === "ANSWERED" && (
            <p className="font-serif tracking-[0.05em] text-mr-ink">
              {(decision.gildingText?.lines ?? []).map((line) => line.text).join(" / ")}
            </p>
          )}
          <p
            className={`mr-small ${decision.status === "CANCELLED" ? "text-mr-muted" : "text-mr-graphite"}`}
          >
            {decision.status === "ANSWERED"
              ? `${audience === "customer" ? "Votre choix" : "Choix confirmé"} : ${decision.outcome}`
              : decision.outcome}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Pour l'atelier et Ma Reliure : les questions en attente, et la possibilité de les retirer. */
export function PendingDecisionList({
  decisions,
  canCancel,
  onChange,
}: {
  decisions: readonly ProjectDecisionData[];
  canCancel: boolean;
  onChange: () => Promise<unknown>;
}) {
  const cancel = useServerFn(cancelProjectDecision);
  const [confirming, setConfirming] = useState<string | null>(null);
  const removal = useMutation({
    mutationFn: (decisionId: string) => cancel({ data: { decisionId, reason: null } }),
    onSuccess: async () => {
      setConfirming(null);
      await onChange();
    },
  });
  const open = decisions.filter((decision) => decision.status === "OPEN");
  if (open.length === 0)
    return <p className="mr-small text-mr-muted">Aucune question en attente du client.</p>;
  return (
    <ul className="border-b border-mr-rule">
      {open.map((decision) => (
        <li key={decision.id} className="border-t border-mr-rule py-3">
          <p className="mr-meta">
            {DECISION_TYPE_LABELS[decision.decisionType]} · posée{" "}
            {formatDateTime(decision.createdAt)} par {decision.askedBy}
          </p>
          <p className="mr-body text-mr-ink">{decision.question}</p>
          <p className="mr-small text-mr-bordeaux">En attente de la réponse du client</p>
          <p className="mr-small text-mr-graphite">
            {decision.decisionType === "GILDING_TEXT"
              ? (decision.gildingText?.lines ?? [])
                  .map((line) => `${line.position} : ${line.text}`)
                  .join(" · ")
              : decision.options.map((option) => option.label).join(" · ")}
          </p>
          {canCancel &&
            (confirming === decision.id ? (
              <span className="mr-small mt-1 inline-flex gap-3">
                <button
                  type="button"
                  className="mr-link"
                  disabled={removal.isPending}
                  onClick={() => removal.mutate(decision.id)}
                >
                  Retirer la question
                </button>
                <button type="button" className="text-mr-muted" onClick={() => setConfirming(null)}>
                  Garder
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="mr-small mt-1 text-mr-muted underline-offset-4 hover:underline"
                onClick={() => setConfirming(decision.id)}
              >
                Retirer…
              </button>
            ))}
        </li>
      ))}
    </ul>
  );
}
