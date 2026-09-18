/**
 * Structured decisions (§20-§22) — never mixed with the conversation. A
 * question here gets one immutable answer; correcting one creates a new
 * decision rather than rewriting the old (superseded_by).
 *
 * `locale` defaults to French — BinderCasePage never passes it, and an
 * atelier's own decisions screen stays exactly as it was (an atelier always
 * requests in French, whichever brand the case belongs to — §44). Only
 * CustomerCasePage passes "en-US", for a Fine Bindery customer answering.
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  customerCopy,
  formatCustomerDate,
  humanizeDecisionAnswer,
} from "@/marketplace/customer/customerPresentation";
import { PortalError } from "@/marketplace/pages/customer/CustomerPortalUi";

type Locale = "fr-FR" | "en-US";

const KIND_LABELS: Record<Locale, Record<DecisionKind, string>> = {
  "fr-FR": {
    COLOR: "Couleur",
    MATERIAL: "Matière",
    PAPER: "Papier",
    GILDING_TEXT: "Texte de dorure",
    GILDING_STYLE: "Style de dorure",
    DECOR: "Décor",
    TECHNICAL_CHOICE: "Choix technique",
    OTHER: "Autre",
  },
  "en-US": {
    COLOR: "Colour",
    MATERIAL: "Material",
    PAPER: "Paper",
    GILDING_TEXT: "Gilding text",
    GILDING_STYLE: "Gilding style",
    DECOR: "Decoration",
    TECHNICAL_CHOICE: "Technical choice",
    OTHER: "Other",
  },
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
  locale = "fr-FR",
  hideWhenEmpty = false,
}: {
  caseId: string;
  /** "customer" answers; "binder" (and admin, from the back-office) requests. */
  role: "customer" | "binder";
  locale?: Locale;
  /** Customer only: render nothing when there is no decision at all, rather than an empty card. */
  hideWhenEmpty?: boolean;
}) {
  const en = locale === "en-US";
  const kindLabels = KIND_LABELS[locale];
  const customer = role === "customer";
  const copy = customerCopy(locale);
  const fetchDecisions = useServerFn(listCaseDecisions);
  const answer = useServerFn(answerCaseDecision);
  const request = useServerFn(requestCaseDecision);
  const cancel = useServerFn(cancelCaseDecision);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "decisions", caseId] as const;

  const { data, isPending, error, refetch, isFetching } = useQuery({
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

  // Le client ne lit jamais un message d'erreur du serveur : une phrase et un
  // bouton pour réessayer. L'atelier garde son affichage d'origine.
  if (isPending)
    return customer ? (
      <div role="status" aria-busy="true" className="rounded-lg border border-border bg-card p-5">
        <span className="sr-only">{copy.loading}</span>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-16 w-full" />
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">
        {en ? "Loading decisions…" : "Chargement des décisions…"}
      </p>
    );
  // Même règle que la conversation : un rechargement raté ne masque pas des
  // décisions déjà affichées.
  if (error && !(customer && data))
    return customer ? (
      <PortalError
        message={copy.sectionError}
        retryLabel={copy.retry}
        onRetry={() => void refetch()}
        busy={isFetching}
      />
    ) : (
      <p className="text-sm text-destructive">{(error as Error).message}</p>
    );

  const decisions = (data ?? []) as DecisionRow[];
  const open = decisions.filter((d) => d.status === "open");
  const settled = decisions.filter((d) => d.status !== "open");

  if (customer && hideWhenEmpty && decisions.length === 0) return null;

  return (
    <section id="decisions" className="scroll-mt-6 rounded-lg border border-border bg-card p-5">
      <h2 className="font-serif text-lg">
        {customer ? copy.decisions : en ? "Decisions" : "Décisions"}
      </h2>

      {decisions.length === 0 && customer && (
        <p className="mt-3 text-sm text-muted-foreground">{copy.decisionsEmpty}</p>
      )}

      {open.length > 0 && (
        <ul className="mt-4 space-y-4">
          {open.map((decision) => (
            <li key={decision.id} className="rounded-md border border-amber-300 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                {kindLabels[decision.kind as DecisionKind] ?? decision.kind} ·{" "}
                {en ? "Action required" : "Action requise"}
              </p>
              <p className="mt-1 text-sm font-medium">{decision.question}</p>
              {decision.kind === "GILDING_TEXT" && (
                <p className="mt-1 text-xs text-amber-800">
                  {en
                    ? "Check the spelling carefully. This confirmation will be passed on to the workshop."
                    : "Vérifiez attentivement l'orthographe. Cette validation sera transmise à l'atelier."}
                </p>
              )}
              {role === "customer" ? (
                <DecisionAnswerForm
                  decisionId={decision.id}
                  kind={decision.kind as DecisionKind}
                  question={decision.question}
                  options={optionsOf(decision.options)}
                  locale={locale}
                  onAnswer={(value) => answerMutation.mutate({ decisionId: decision.id, answer: value })}
                  pending={answerMutation.isPending}
                  failed={answerMutation.isError}
                />
              ) : (
                <div className="mt-3 flex items-center gap-3">
                  <p className="text-xs text-muted-foreground">
                    {en
                      ? "Awaiting a reply from the customer."
                      : "En attente d'une réponse du client."}
                  </p>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(decision.id)}
                  >
                    {en ? "Cancel this request" : "Annuler cette demande"}
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
              {decision.status === "answered" &&
                (customer ? (
                  // Le client relit sa réponse en mots — jamais le JSON stocké.
                  <p className="mt-1 text-muted-foreground">
                    {copy.decisionConfirmedOn(formatCustomerDate(decision.answered_at, locale))}
                    {humanizeDecisionAnswer(decision.answer) && (
                      <> : <span className="text-foreground">{humanizeDecisionAnswer(decision.answer)}</span></>
                    )}
                    {decision.superseded_by && <> {copy.decisionSuperseded}</>}
                  </p>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    {en ? "Confirmed" : "Confirmé"}{" "}
                    {decision.answered_at &&
                      (en
                        ? `on ${new Date(decision.answered_at).toLocaleDateString("en-US")}`
                        : `le ${new Date(decision.answered_at).toLocaleDateString("fr-FR")}`)}{" "}
                    : {JSON.stringify(decision.answer)}
                    {decision.superseded_by &&
                      (en
                        ? " (since corrected — see the more recent decision)"
                        : " (depuis corrigé — voir la décision plus récente)")}
                  </p>
                ))}
              {decision.status === "cancelled" && (
                <p className="mt-1 text-muted-foreground">
                  {customer ? copy.decisionCancelled : en ? "Request cancelled." : "Demande annulée."}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {role === "binder" && (
        <RequestDecisionForm
          onRequest={(input) => request({ data: { caseId, ...input } })}
          onRequested={() => queryClient.invalidateQueries({ queryKey })}
        />
      )}
    </section>
  );
}

// Toujours rendu pour le client (`role === "customer"`) : le formulaire
// d'atelier, lui, ne répond jamais à une décision.
function DecisionAnswerForm({
  decisionId,
  kind,
  question,
  options,
  locale,
  onAnswer,
  pending,
  failed,
}: {
  decisionId: string;
  kind: DecisionKind;
  question: string;
  options: string[];
  locale: Locale;
  onAnswer: (answer: Record<string, unknown>) => void;
  pending: boolean;
  failed: boolean;
}) {
  const copy = customerCopy(locale);
  const [choice, setChoice] = useState(options[0] ?? "");
  const [freeText, setFreeText] = useState("");
  const fieldId = `decision-${decisionId}`;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onAnswer(options.length > 0 ? { choice } : { text: freeText.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3" key={decisionId}>
      {/* Le champ est nommé par la question posée : un lecteur d'écran lit
          « Quelle couleur de toile souhaitez-vous ? », pas « liste déroulante ». */}
      <label htmlFor={fieldId} className="sr-only">
        {question}
      </label>
      <div className="flex flex-wrap items-end gap-3">
        {options.length > 0 ? (
          <select
            id={fieldId}
            className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm sm:flex-none"
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
            id={fieldId}
            type="text"
            required
            value={freeText}
            onChange={(event) => setFreeText(event.target.value)}
            placeholder={
              kind === "GILDING_TEXT" ? copy.decisionGildingPlaceholder : copy.decisionAnswerPlaceholder
            }
            className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          />
        )}
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? copy.decisionConfirming : copy.decisionConfirm}
        </Button>
      </div>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {copy.decisionError}
        </p>
      )}
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

  // Toujours français — l'atelier reste l'atelier, quelle que soit la
  // marque du dossier (§44).
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
            {KIND_LABELS["fr-FR"][value]}
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
