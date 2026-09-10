/**
 * Les imprévus : l'atelier signale, Ma Reliure reprend la main.
 *
 * Le formulaire le dit en toutes lettres : le client n'est pas prévenu par ce
 * chemin, et aucun prix ne se discute avec lui. Ma Reliure examine, puis
 * décide s'il y a lieu de proposer une modification de la commande.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { reportScopeIssue, updateScopeIssue } from "@/marketplace/services/projectThread.functions";
import {
  SCOPE_REASON_LABELS,
  SCOPE_REASONS,
  validateScopeIssue,
  type ScopeReason,
} from "@/marketplace/project/scopeIssues";
import { PROJECT_FILES_PER_ITEM } from "@/marketplace/project/thread";
import { Attachments } from "./ProjectThread";
import { formatDateTime } from "./projectFormat";
import type { ProjectThreadData } from "./useProjectThread";
import { PROJECT_FILE_ACCEPT, useProjectUpload } from "./useProjectUpload";

const fieldClass =
  "mt-1 block w-full rounded-[2px] border border-mr-rule-strong bg-white px-3 py-2 text-[0.9375rem] text-mr-ink";

export function ScopeIssueForm({
  caseId,
  onReported,
}: {
  caseId: string;
  onReported: () => Promise<unknown>;
}) {
  const report = useServerFn(reportScopeIssue);
  const upload = useProjectUpload(caseId);
  const [reason, setReason] = useState<ScopeReason>("SEWING_WORSE");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const errors = validateScopeIssue({ description });

  const submit = useMutation({
    mutationFn: async () =>
      report({ data: { caseId, reason, description, files: await upload(files) } }),
    onMutate: () => {
      setProblem(null);
      setDone(false);
    },
    onSuccess: async () => {
      setDescription("");
      setFiles([]);
      setDone(true);
      await onReported();
    },
    onError: (error: Error) => setProblem(error.message),
  });

  return (
    <form
      className="space-y-3 border border-mr-rule bg-white p-4 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (errors.length === 0) submit.mutate();
      }}
    >
      <p className="mr-small text-mr-graphite">
        Signalé à Ma Reliure uniquement. Le client n'est pas prévenu par ce formulaire, et aucun
        prix ne se discute avec lui : Ma Reliure examine et reprend contact avec vous.
      </p>
      <label className="mr-small block text-mr-ink">
        Nature de l'imprévu
        <select
          className={fieldClass}
          value={reason}
          onChange={(event) => setReason(event.target.value as ScopeReason)}
        >
          {SCOPE_REASONS.map((value) => (
            <option key={value} value={value}>
              {SCOPE_REASON_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="mr-small block text-mr-ink">
        Ce que vous avez découvert
        <textarea
          className={fieldClass}
          rows={4}
          maxLength={3000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="mr-small cursor-pointer border border-mr-rule px-3 py-2 text-mr-ink hover:border-mr-ink">
          <input
            type="file"
            className="sr-only"
            accept={PROJECT_FILE_ACCEPT}
            multiple
            onChange={(event) => {
              setFiles([...files, ...(event.target.files ?? [])].slice(0, PROJECT_FILES_PER_ITEM));
              event.target.value = "";
            }}
          />
          Ajouter des photos{files.length > 0 ? ` (${files.length})` : ""}
        </label>
        <button
          type="submit"
          disabled={errors.length > 0 || submit.isPending}
          className="mr-tap rounded-[2px] border border-mr-ink px-5 py-2.5 text-[0.9375rem] font-semibold text-mr-ink hover:bg-mr-ink/[0.04] disabled:opacity-40"
        >
          {submit.isPending ? "Envoi…" : "Signaler à Ma Reliure"}
        </button>
      </div>
      {done && <p className="mr-small text-mr-ink">Imprévu transmis à Ma Reliure.</p>}
      {problem && (
        <p role="alert" className="mr-small text-mr-bordeaux">
          {problem}
        </p>
      )}
    </form>
  );
}

export function ScopeIssueList({
  issues,
  canManage,
  onChange,
}: {
  issues: ProjectThreadData["scopeIssues"];
  canManage: boolean;
  onChange: () => Promise<unknown>;
}) {
  const update = useServerFn(updateScopeIssue);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const change = useMutation({
    mutationFn: (input: { issueId: string; status: "IN_REVIEW" | "RESOLVED" }) =>
      update({ data: { ...input, note: notes[input.issueId]?.trim() || null } }),
    onSuccess: onChange,
  });
  if (issues.length === 0) return <p className="mr-small text-mr-muted">Aucun imprévu signalé.</p>;
  return (
    <ul className="border-b border-mr-rule">
      {issues.map((issue) => (
        <li key={issue.id} className="border-t border-mr-rule py-3">
          <p className="mr-meta">
            {formatDateTime(issue.createdAt)} · {issue.statusLabel}
          </p>
          <p className="mr-body font-semibold text-mr-ink">{issue.reasonLabel}</p>
          <p className="mr-body whitespace-pre-line text-mr-graphite">{issue.description}</p>
          <Attachments files={issue.files} />
          {issue.resolutionNote && (
            <p className="mr-small mt-1 text-mr-graphite">Ma Reliure : {issue.resolutionNote}</p>
          )}
          {canManage && issue.status !== "RESOLVED" && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                aria-label="Note de traitement"
                className="mr-small h-9 min-w-[14rem] flex-1 rounded-[2px] border border-mr-rule bg-white px-2"
                placeholder="Note (visible de l'atelier)"
                value={notes[issue.id] ?? ""}
                onChange={(event) => setNotes({ ...notes, [issue.id]: event.target.value })}
              />
              {issue.status === "OPEN" && (
                <button
                  type="button"
                  className="mr-small border border-mr-rule px-3 py-2 hover:border-mr-ink"
                  disabled={change.isPending}
                  onClick={() => change.mutate({ issueId: issue.id, status: "IN_REVIEW" })}
                >
                  Mettre en examen
                </button>
              )}
              <button
                type="button"
                className="mr-small border border-mr-ink px-3 py-2"
                disabled={change.isPending}
                onClick={() => change.mutate({ issueId: issue.id, status: "RESOLVED" })}
              >
                Marquer traité
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
