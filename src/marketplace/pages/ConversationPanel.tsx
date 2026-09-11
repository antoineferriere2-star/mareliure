/**
 * "Conversation avec votre atelier" (§14) — one thread per case, shared by
 * CustomerCasePage and BinderCasePage. The server decides who may read and
 * post (conversation.ts); this component only renders what it gets back.
 *
 * §18: React Query, not Supabase Realtime — optimistic update on send,
 * invalidation on success, and a bounded poll while the panel is visible.
 * The transport is entirely inside this one component: swapping polling for
 * a Realtime subscription later only touches this file, never the callers
 * or the server functions.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCaseMessages,
  markConversationRead,
  sendCaseMessage,
} from "@/marketplace/services/messaging.data.functions";

const POLL_INTERVAL_MS = 15_000;

const SENDER_LABELS: Record<string, string> = {
  customer: "Vous",
  binder: "Votre atelier",
  admin: "Ma Reliure",
};

export function ConversationPanel({ caseId, viewerRole }: { caseId: string; viewerRole: "customer" | "binder" }) {
  const fetchMessages = useServerFn(listCaseMessages);
  const send = useServerFn(sendCaseMessage);
  const markRead = useServerFn(markConversationRead);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "conversation", caseId] as const;
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isPending, error } = useQuery({
    queryKey,
    queryFn: () => fetchMessages({ data: { caseId } }),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const mutation = useMutation({
    mutationFn: (body: string) => send({ data: { caseId, body } }),
    // Optimistic update: the message appears immediately, under the
    // sender's own name, before the server confirms it — the mutation's
    // onError below rolls it back if the send actually failed.
    onMutate: async (body: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (current: typeof data) =>
        current
          ? {
              ...current,
              messages: [
                ...current.messages,
                {
                  id: `optimistic-${Date.now()}`,
                  senderRole: viewerRole,
                  isMine: true,
                  body,
                  deleted: false,
                  attachmentCount: 0,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : current,
      );
      return { previous };
    },
    onError: (_err, _body, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["marketplace", "customer", "cases"] });
      void queryClient.invalidateQueries({ queryKey: ["marketplace", "binder", "cases"] });
    },
  });

  // Opening the panel counts as reading it — the same instant a person
  // would expect a "2 new messages" badge to clear.
  useEffect(() => {
    void markRead({ data: { caseId } });
  }, [caseId, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [data?.messages.length]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    mutation.mutate(body);
  }

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement de la conversation…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-serif text-lg">
        {viewerRole === "customer" ? "Conversation avec votre atelier" : "Conversation"}
      </h2>
      <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
        {data!.messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun message pour l'instant.</p>
        )}
        {data!.messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              message.isMine ? "ml-auto bg-foreground text-background" : "bg-muted"
            }`}
          >
            <p className="text-xs font-semibold opacity-70">
              {SENDER_LABELS[message.senderRole] ?? message.senderRole}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap">
              {message.deleted ? "Message supprimé." : message.body}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit(event);
            }
          }}
          rows={2}
          placeholder="Écrire un message…"
          className="min-w-0 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={draft.trim() === "" || mutation.isPending}
          className="self-end rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          Envoyer
        </button>
      </form>
    </section>
  );
}
