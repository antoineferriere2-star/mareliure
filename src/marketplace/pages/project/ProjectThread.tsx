/**
 * La conversation d'un projet.
 *
 * Une messagerie moderne par l'usage — envoi immédiat, photos depuis le
 * téléphone, non-lus — mais pas par le décor : pas de bulles, pas de couleurs
 * par personne. Un filet entre les messages, le nom en capitales discrètes,
 * l'heure, le texte. Les messages de la personne qui lit sont décalés, pas
 * colorés.
 */
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { postProjectMessage } from "@/marketplace/services/projectThread.functions";
import { CONTACT_GUARD_MESSAGE, detectContactDetails } from "@/marketplace/project/contactGuard";
import {
  MESSAGE_MAX_LENGTH,
  PROJECT_FILES_PER_ITEM,
  UPDATE_TYPE_LABELS,
  UPDATE_TYPES,
  type ThreadFile,
  type ThreadMessage,
  type UpdateType,
} from "@/marketplace/project/thread";
import { formatWhen } from "./projectFormat";
import type { ProjectThreadData } from "./useProjectThread";
import { PROJECT_FILE_ACCEPT, useProjectUpload } from "./useProjectUpload";

export function Attachments({ files }: { files: readonly ThreadFile[] }) {
  if (files.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {files.map((file) => {
        const displayable = file.mimeType.startsWith("image/") && !file.mimeType.includes("hei");
        return (
          <li key={file.id}>
            {file.url && displayable ? (
              <a href={file.url} target="_blank" rel="noreferrer" className="block">
                <img
                  src={file.url}
                  alt="Photo jointe"
                  loading="lazy"
                  className="h-28 w-28 rounded-[2px] border border-mr-rule object-cover sm:h-36 sm:w-36"
                />
              </a>
            ) : file.url ? (
              <a href={file.url} target="_blank" rel="noreferrer" className="mr-link mr-small">
                {file.mimeType === "application/pdf"
                  ? "Document PDF"
                  : "Photo (HEIC) à télécharger"}
              </a>
            ) : (
              <span className="mr-small text-mr-muted">Fichier indisponible</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function MessageItem({ message }: { message: ThreadMessage }) {
  return (
    <li className={`border-t border-mr-rule py-4 ${message.mine ? "pl-6 sm:pl-16" : ""}`}>
      <p className="mr-meta flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-semibold uppercase tracking-[0.08em] text-mr-ink">
          {message.authorLabel}
        </span>
        <span aria-hidden="true">·</span>
        <time dateTime={message.createdAt}>{formatWhen(message.createdAt)}</time>
        {message.kind === "update" && (
          <span>
            · Mise à jour{message.updateType ? ` — ${UPDATE_TYPE_LABELS[message.updateType]}` : ""}
          </span>
        )}
        {message.important && <span className="text-mr-bordeaux">· Important</span>}
      </p>
      {message.deleted && !message.body ? (
        <p className="mr-small mt-1 italic text-mr-muted">Message retiré.</p>
      ) : (
        message.body && (
          <p className="mr-body mt-1.5 whitespace-pre-line text-mr-graphite">{message.body}</p>
        )
      )}
      <Attachments files={message.files} />
    </li>
  );
}

export function ProjectThread({
  caseId,
  thread,
  title,
  notice,
  onChange,
}: {
  caseId: string;
  thread: ProjectThreadData;
  title: string;
  notice: string;
  onChange: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState<{ body: string; fileCount: number } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  return (
    <section aria-labelledby={`thread-${caseId}`} className="space-y-3">
      <header>
        <h2 id={`thread-${caseId}`} className="mr-heading text-mr-ink">
          {title}
        </h2>
        <p className="mr-small mt-1 text-mr-muted">{notice}</p>
      </header>

      <ol aria-live="polite" className="border-b border-mr-rule">
        {thread.messages.length === 0 && !pending && (
          <li className="mr-small border-t border-mr-rule py-5 text-mr-muted">
            Aucun échange pour l'instant.
          </li>
        )}
        {thread.messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
        {pending && (
          <li className="border-t border-mr-rule py-4 pl-6 opacity-70 sm:pl-16">
            <p className="mr-meta">
              <span className="font-semibold uppercase tracking-[0.08em] text-mr-ink">Vous</span> ·
              envoi…
            </p>
            <p className="mr-body mt-1.5 whitespace-pre-line text-mr-graphite">{pending.body}</p>
            {pending.fileCount > 0 && (
              <p className="mr-small mt-1 text-mr-muted">
                {pending.fileCount} fichier(s) en cours d'envoi
              </p>
            )}
          </li>
        )}
      </ol>
      <div ref={endRef} />

      {thread.access === "write" ? (
        <Composer
          caseId={caseId}
          role={thread.role}
          onPending={setPending}
          onSent={async () => {
            await onChange();
            setPending(null);
            endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }}
        />
      ) : (
        <p className="mr-small text-mr-muted">
          Ce projet est archivé : sa conversation reste lisible.
        </p>
      )}
    </section>
  );
}

function Composer({
  caseId,
  role,
  onPending,
  onSent,
}: {
  caseId: string;
  role: ProjectThreadData["role"];
  onPending: (pending: { body: string; fileCount: number } | null) => void;
  onSent: () => Promise<void>;
}) {
  const post = useServerFn(postProjectMessage);
  const upload = useProjectUpload(caseId);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState<"message" | "update">("message");
  const [updateType, setUpdateType] = useState<UpdateType | "">("");
  const [important, setImportant] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const team = role !== "customer";

  const contactIssue = role !== "admin" && detectContactDetails(body).length > 0;
  const empty = body.trim() === "" && (kind === "message" || files.length === 0);

  const sending = useMutation({
    mutationFn: async () => {
      const paths = await upload(files);
      return post({
        data: {
          caseId,
          body,
          kind,
          updateType: kind === "update" && updateType ? updateType : null,
          important: team && important,
          files: paths,
        },
      });
    },
    onMutate: () => {
      setProblem(null);
      onPending({ body: body.trim(), fileCount: files.length });
    },
    onSuccess: async () => {
      setBody("");
      setFiles([]);
      setKind("message");
      setUpdateType("");
      setImportant(false);
      await onSent();
    },
    onError: (error: Error) => {
      onPending(null);
      setProblem(error.message);
    },
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!empty && !contactIssue && !sending.isPending) sending.mutate();
      }}
    >
      {team && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="mr-small flex items-center gap-2">
            <input
              type="radio"
              name={`kind-${caseId}`}
              checked={kind === "message"}
              onChange={() => setKind("message")}
            />
            Message
          </label>
          <label className="mr-small flex items-center gap-2">
            <input
              type="radio"
              name={`kind-${caseId}`}
              checked={kind === "update"}
              onChange={() => setKind("update")}
            />
            Mise à jour d'avancement
          </label>
          {kind === "update" && (
            <select
              aria-label="Type de mise à jour"
              className="mr-small h-9 rounded-[2px] border border-mr-rule bg-white px-2"
              value={updateType}
              onChange={(event) => setUpdateType(event.target.value as UpdateType | "")}
            >
              <option value="">Sans type</option>
              {UPDATE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {UPDATE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          )}
          <label className="mr-small flex items-center gap-2">
            <input
              type="checkbox"
              checked={important}
              onChange={(event) => setImportant(event.target.checked)}
            />
            Prévenir le client par e-mail
          </label>
        </div>
      )}

      <label className="sr-only" htmlFor={`message-${caseId}`}>
        Votre message
      </label>
      <textarea
        id={`message-${caseId}`}
        rows={3}
        maxLength={MESSAGE_MAX_LENGTH}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={kind === "update" ? "Où en est le travail ?" : "Écrire un message…"}
        className="mr-body block w-full resize-y rounded-[2px] border border-mr-rule-strong bg-white px-3 py-2.5 text-mr-ink placeholder:text-mr-muted focus:border-mr-ink focus:outline-none"
      />

      {contactIssue && (
        <p role="alert" className="mr-small text-mr-bordeaux">
          {CONTACT_GUARD_MESSAGE}
        </p>
      )}

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="mr-small flex items-center gap-2 border border-mr-rule bg-white px-2 py-1"
            >
              <span className="max-w-[12rem] truncate">{file.name}</span>
              <button
                type="button"
                className="text-mr-muted hover:text-mr-ink"
                aria-label={`Retirer ${file.name}`}
                onClick={() => setFiles(files.filter((_, position) => position !== index))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="mr-tap mr-small inline-flex cursor-pointer items-center gap-2 border border-mr-rule bg-white px-3 py-2 text-mr-ink hover:border-mr-ink">
          <input
            type="file"
            className="sr-only"
            accept={PROJECT_FILE_ACCEPT}
            multiple
            onChange={(event) => {
              const chosen = [...(event.target.files ?? [])];
              setFiles([...files, ...chosen].slice(0, PROJECT_FILES_PER_ITEM));
              event.target.value = "";
            }}
          />
          Ajouter une photo
        </label>
        <button
          type="submit"
          disabled={empty || contactIssue || sending.isPending}
          className="mr-tap rounded-[2px] bg-mr-ink px-6 py-2.5 text-[0.9375rem] font-semibold text-mr-paper transition-colors hover:bg-mr-walnut disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending.isPending ? "Envoi…" : "Envoyer"}
        </button>
      </div>
      {problem && (
        <p role="alert" className="mr-small text-mr-bordeaux">
          {problem}
        </p>
      )}
    </form>
  );
}
