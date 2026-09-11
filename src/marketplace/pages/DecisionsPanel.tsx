/**
 * Structured decisions (§20-§22) — never mixed with the conversation. A
 * question here gets one immutable answer; correcting one creates a new
 * decision rather than rewriting the old (superseded_by).
 */
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  answerCaseDecision,
  cancelCaseDecision,
  listCaseDecisions,
  requestCaseDecision,
} from "@/marketplace/services/decisions.data.functions";
import { DECISION_KINDS, type DecisionKind } from "@/marketplace/decisions/decisions";
import { Button } from "@/components/ui/button";

const KIND_LABELS: Record<DecisionKind, string> = {
  COLOR: "Couleur",
  MATERIAL: "Matière",
  PAPER: "Papier",
  GILDING_TEXT: "Texte de dorure",
  GILDING_STYLE: "Style de dorure",
  DECOR: "Décor",
  TECHNICAL_CHOICE: "Choix technique",
  OTHER: "Autre",
};

interface DecisionRow {
  id: string;
  kind: string;
  question: string;
  options: unknown;
  status: string;
  answer: unknown;
  answered_at: string | null;
  cancelled_at: string | null;
  superseded_by: string | null;
  created_at: string;
}

function optionsOf(options: unknown): string[] {
  return Array.isArray(options) ? options.filter((o): o is string => typeof o === "string") : [];
}

export function DecisionsPanel({
  caseId,
  role,
}: {
  caseId: string;
  /** "customer" answers; "binder" (and admin, from the back-office) requests. */
  role: "customer" | "binder";
}) {
  const fetchDecisions = useServerFn(listCaseDecisions);
  const answer = useServerFn(answerCaseDecision);
  const request = useServerFn(requestCaseDecision);
  const cancel = useServerFn(cancelCaseDecision);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "decisions", caseId] as const;

  const { data, isPending, error } = useQuery({
    queryKey,
    queryFn: () => fetchDecisions({ data: { caseId } }),
  });

  const answerMutation = useMutation({
    mutationFn: (input: { decisionId: string; answer: Record<string, unknown> }) =>
      answer({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const cancelMutation = useMutation({
    mutationFn: (decisionId: string) => cancel({ data: { decisionId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement des décisions…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  const decisions = (data ?? []) as DecisionRow[];
  const open = decisions.filter((d) => d.status === "open");
  const settled = decisions.filter((d) => d.status !== "open");

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-serif text-lg">Décisions</h2>

      {decisions.length === 0 && role === "customer" && (
        <p className="mt-3 text-sm text-muted-foreground">Aucune décision à confirmer pour l'instant.</p>
      )}

      {open.length > 0 && (
        <ul className="mt-4 space-y-4">
          {open.map((decision) => (
            <li key={decision.id} className="rounded-md border border-amber-300 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                {KIND_LABELS[decision.kind as DecisionKind] ?? decision.kind} · Action requise
              </p>
              <p className="mt-1 text-sm font-medium">{decision.question}</p>
              {decision.kind === "GILDING_TEXT" && (
                <p className="mt-1 text-xs text-amber-800">
                  Vérifiez attentivement l'orthographe. Cette validation sera transmise à l'atelier.
                </p>
              )}
              {role === "customer" ? (
                <DecisionAnswerForm
                  decisionId={decision.id}
                  kind={decision.kind as DecisionKind}
                  options={optionsOf(decision.options)}
                  onAnswer={(value) => answerMutation.mutate({ decisionId: decision.id, answer: value })}
                  pending={answerMutation.isPending}
                />
              ) : (
                <div className="mt-3 flex items-center gap-3">
                  <p className="text-xs text-muted-foreground">En attente d'une réponse du client.</p>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(decision.id)}
                  >
                    Annuler cette demande
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {settled.length > 0 && (
        <ul className="mt-4 space-y-2">
          {settled.map((decision) => (
            <li key={decision.id} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{decision.question}</p>
              {decision.status === "answered" && (
                <p className="mt-1 text-muted-foreground">
                  Confirmé{" "}
                  {decision.answered_at &&
                    `le ${new Date(decision.answered_at).toLocaleDateString("fr-FR")}`}{" "}
                  : {JSON.stringify(decision.answer)}
                  {decision.superseded_by && " (depuis corrigé — voir la décision plus récente)"}
                </p>
              )}
              {decision.status === "cancelled" && (
                <p className="mt-1 text-muted-foreground">Demande annulée.</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {role === "binder" && <RequestDecisionForm onRequest={(input) => request({ data: { caseId, ...input } })} onRequested={() => queryClient.invalidateQueries({ queryKey })} />}
    </section>
  );
}

function DecisionAnswerForm({
  decisionId,
  kind,
  options,
  onAnswer,
  pending,
}: {
  decisionId: string;
  kind: DecisionKind;
  options: string[];
  onAnswer: (answer: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const [choice, setChoice] = useState(options[0] ?? "");
  const [freeText, setFreeText] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onAnswer(options.length > 0 ? { choice } : { text: freeText.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-3" key={decisionId}>
      {options.length > 0 ? (
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          required
          value={freeText}
          onChange={(event) => setFreeText(event.target.value)}
          placeholder={kind === "GILDING_TEXT" ? "Texte exact à dorer" : "Votre réponse"}
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
        />
      )}
      <Button type="submit" size="sm" disabled={pending}>
        Confirmer
      </Button>
    </form>
  );
}

function RequestDecisionForm({
  onRequest,
  onRequested,
}: {
  onRequest: (input: { kind: DecisionKind; question: string; options: string[] }) => Promise<unknown>;
  onRequested: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<DecisionKind>("OTHER");
  const [question, setQuestion] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await onRequest({
        kind,
        question: question.trim(),
        options: optionsText
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      });
      setQuestion("");
      setOptionsText("");
      setOpen(false);
      onRequested();
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="mt-4" onClick={() => setOpen(true)}>
        Demander une décision
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-border pt-4">
      <select
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        value={kind}
        onChange={(event) => setKind(event.target.value as DecisionKind)}
      >
        {DECISION_KINDS.map((value) => (
          <option key={value} value={value}>
            {KIND_LABELS[value]}
          </option>
        ))}
      </select>
      <input
        type="text"
        required
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Question au client"
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      />
      <input
        type="text"
        value={optionsText}
        onChange={(event) => setOptionsText(event.target.value)}
        placeholder="Options séparées par des virgules (facultatif)"
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || question.trim() === ""}>
          Envoyer au client
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
