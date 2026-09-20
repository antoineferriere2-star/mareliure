/**
 * "Conversation avec votre atelier" / "Conversation with your workshop"
 * (§14) — one thread per case, shared by CustomerCasePage and
 * BinderCasePage. The server decides who may read and post
 * (conversation.ts); this component only renders what it gets back.
 *
 * §18: React Query, not Supabase Realtime — optimistic update on send,
 * invalidation on success, and a bounded poll while the panel is visible.
 * The transport is entirely inside this one component: swapping polling for
 * a Realtime subscription later only touches this file, never the callers
 * or the server functions.
 *
 * `locale` defaults to French — BinderCasePage never passes it, and an
 * atelier's own conversation stays exactly as it was. Only
 * CustomerCasePage passes "en-US", for a Fine Bindery customer.
 *
 * `channel` (customer only) is what the server says this customer's thread is:
 * "direct" (Ma Reliure — one thread shared with the workshop) or "concierge"
 * (Fine Bindery — the customer writes to the concierge and never to the
 * workshop). In "concierge" the panel names the concierge, never mentions the
 * workshop, and renders no workshop-authored message even if one were sent (the
 * server already withholds them; this is the second lock, not the first).
 *
 * Everything under `customer` below is the customer's own presentation only
 * (friendly errors, a kept draft when a send fails, message times, scrolling
 * inside the thread rather than jumping the page). Who may read and write is decided
 * on the server from each message's persisted audience (messaging/audience.ts):
 * nothing here changes it, and the workshop's own panel only ever receives its channel.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCaseMessages,
  markConversationRead,
  sendCaseMessage,
} from "@/marketplace/services/messaging.data.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { customerCopy } from "@/marketplace/customer/customerPresentation";
import type { MessageAudience } from "@/marketplace/messaging/audience";
import { PortalError } from "@/marketplace/pages/customer/CustomerPortalUi";

const POLL_INTERVAL_MS = 15_000;

type Locale = "fr-FR" | "en-US";

const SENDER_LABELS: Record<Locale, Record<string, string>> = {
  "fr-FR": { customer: "Vous", binder: "Votre atelier", admin: "Ma Reliure" },
  "en-US": { customer: "You", binder: "Your workshop", admin: "Fine Bindery" },
};

/** Ce que voit l'équipe (le concierge) : elle nomme les parties, elle ne parle pas « à la première personne ». */
const ADMIN_SENDER_LABELS: Record<string, string> = { customer: "Client", binder: "Atelier", admin: "Équipe" };

function formatMessageTime(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function ConversationPanel({
  caseId,
  viewerRole,
  locale = "fr-FR",
  channel = "direct",
  audience,
  heading,
}: {
  caseId: string;
  viewerRole: "customer" | "binder" | "admin";
  locale?: Locale;
  channel?: "direct" | "concierge";
  /**
   * Le canal affiché et dans lequel on écrit — pour l'équipe seulement (qui lit tous les canaux). Client et atelier
   * n'en choisissent jamais : le serveur les range dans leur seul canal.
   */
  audience?: MessageAudience;
  heading?: string;
}) {
  const en = locale === "en-US";
  const customer = viewerRole === "customer";
  const concierge = customer && channel === "concierge";
  const copy = customerCopy(locale);
  const fetchMessages = useServerFn(listCaseMessages);
  const send = useServerFn(sendCaseMessage);
  const markRead = useServerFn(markConversationRead);
  const queryClient = useQueryClient();
  // La clé du client et de l'atelier ne change pas ; seul un canal explicite (l'équipe) en ajoute un.
  const queryKey = (audience
    ? (["marketplace", "conversation", caseId, audience] as const)
    : (["marketplace", "conversation", caseId] as const)) as readonly unknown[];
  const [draft, setDraft] = useState("");
  const [sendFailed, setSendFailed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchMessages({ data: { caseId, ...(audience ? { audience } : {}) } }),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const mutation = useMutation({
    mutationFn: (body: string) => send({ data: { caseId, body, ...(audience ? { audience } : {}) } }),
    // Optimistic update: the message appears immediately, under the
    // sender's own name, before the server confirms it — the mutation's
    // onError below rolls it back if the send actually failed.
    onMutate: async (body: string) => {
      setSendFailed(false);
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
                  audience: audience ?? "shared",
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
    onError: (_err, body, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      // Le client ne perd jamais ce qu'il a écrit : le texte revient dans le champ.
      if (customer) {
        setSendFailed(true);
        setDraft((current) => (current.trim() === "" ? body : current));
      }
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
    if (customer) {
      // Défilement dans le fil seulement : ne jamais faire sauter la page
      // jusqu'aux messages quand le client vient de l'ouvrir.
      const thread = threadRef.current;
      if (thread) thread.scrollTop = thread.scrollHeight;
      return;
    }
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [data?.messages.length, customer]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    mutation.mutate(body);
  }

  if (isPending)
    return customer ? (
      <section id="messages" className="scroll-mt-6 rounded-lg border border-border bg-card p-5">
        <div role="status" aria-busy="true">
          <span className="sr-only">{copy.messagesLoad}</span>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-4 h-10 w-3/4" />
          <Skeleton className="mt-3 ml-auto h-10 w-2/3" />
        </div>
      </section>
    ) : (
      <p className="text-sm text-muted-foreground">
        {en ? "Loading the conversation…" : "Chargement de la conversation…"}
      </p>
    );
  // Un rechargement qui échoue ne doit pas effacer ce que le client voit déjà :
  // l'écran d'erreur n'apparaît que s'il n'y a rien à montrer.
  if (error && !(customer && data))
    return customer ? (
      <div id="messages" className="scroll-mt-6">
        <PortalError
          message={copy.messagesError}
          retryLabel={copy.messagesRetry}
          onRetry={() => void refetch()}
          busy={isFetching}
        />
      </div>
    ) : (
      <p className="text-sm text-destructive">{(error as Error).message}</p>
    );

  const title = concierge ? copy.conciergeTitle : copy.messages;
  // Le concierge est le seul interlocuteur : un message d'atelier n'a rien à faire ici.
  const messages = concierge ? data!.messages.filter((message) => message.senderRole !== "binder") : data!.messages;

  return (
    <section id="messages" className="scroll-mt-6 rounded-lg border border-border bg-card p-5">
      <h2 className="font-serif text-lg">{customer ? title : (heading ?? "Conversation")}</h2>
      {concierge && <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.conciergeIntro}</p>}
      <div
        ref={threadRef}
        className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1"
        {...(customer ? { role: "log", "aria-live": "polite", "aria-label": title } : {})}
      >
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {concierge
              ? copy.conciergeEmpty
              : customer
                ? copy.messagesEmpty
                : en
                  ? "No messages yet."
                  : "Aucun message pour l'instant."}
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              message.isMine ? "ml-auto bg-foreground text-background" : "bg-muted"
            }`}
          >
            <p className="text-xs font-semibold opacity-70">
              {concierge && message.senderRole === "admin"
                ? copy.conciergeAuthor
                : viewerRole === "admin"
                  ? (ADMIN_SENDER_LABELS[message.senderRole] ?? message.senderRole)
                  : (SENDER_LABELS[locale][message.senderRole] ?? message.senderRole)}
              {customer && (
                <span className="ml-2 font-normal opacity-80">
                  {formatMessageTime(message.createdAt, locale)}
                </span>
              )}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap break-words">
              {message.deleted
                ? customer
                  ? copy.messageDeleted
                  : en
                    ? "Message deleted."
                    : "Message supprimé."
                : message.body}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className={`mt-4 flex gap-2 ${customer ? "flex-col sm:flex-row" : ""}`}>
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
          aria-label={concierge ? copy.conciergePlaceholder : customer ? copy.messagesPlaceholder : undefined}
          placeholder={
            concierge
              ? copy.conciergePlaceholder
              : customer
                ? copy.messagesPlaceholder
                : en
                  ? "Write a message…"
                  : "Écrire un message…"
          }
          className="min-w-0 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={draft.trim() === "" || mutation.isPending}
          className={`rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50 ${
            customer ? "min-h-11 sm:self-end" : "self-end"
          }`}
        >
          {customer
            ? mutation.isPending
              ? copy.messagesSending
              : copy.messagesSend
            : en
              ? "Send"
              : "Envoyer"}
        </button>
      </form>
      {customer && error && (
        <p role="status" className="mt-2 text-sm text-[#6b5847]">
          {copy.messagesRefreshError}{" "}
          <button type="button" className="min-h-11 underline" onClick={() => void refetch()} disabled={isFetching}>
            {copy.messagesRetry}
          </button>
        </p>
      )}
      {customer && sendFailed && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {copy.messagesSendError}
        </p>
      )}
    </section>
  );
}
