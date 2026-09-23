import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyBinderCases, getBinderCase } from "@/marketplace/services/marketplace.data.functions";
import { listMyConversationPreviews } from "@/marketplace/services/binderConversations.data.functions";
import { ConversationPanel } from "@/marketplace/pages/ConversationPanel";
import { BinderEmptyState, BinderPageHeader } from "./BinderPageUi";

export function MessagesPage() {
  const fetchCases = useServerFn(listMyBinderCases);
  const fetchPreviews = useServerFn(listMyConversationPreviews);
  const cases = useQuery({ queryKey: ["marketplace", "binder", "cases"], queryFn: () => fetchCases() });
  const previews = useQuery({ queryKey: ["marketplace", "binder", "conversation-previews"], queryFn: () => fetchPreviews() });
  const previewByCase = new Map((previews.data ?? []).map((row) => [row.caseId, row.latest] as const));
  const rows = (cases.data ?? []).filter((row) => row.state === "selected");
  return <div className="space-y-7">
    <BinderPageHeader eyebrow="Conversations" title="Messages" description="Un fil par projet, avec le livre et la prochaine action toujours visibles." />
    {(cases.isPending || previews.isPending) && <p role="status">Chargement des conversations…</p>}
    {(cases.isError || previews.isError) && <p role="alert">Les conversations n'ont pas pu être chargées.</p>}
    {cases.data && rows.length === 0 && <BinderEmptyState title="Aucune conversation pour le moment" description="Les messages s'ouvrent quand votre atelier est retenu sur un dossier." />}
    <ul className="divide-y divide-[#d8d0c4] border-y border-[#cfc5b6] bg-[#fffdf8]">{rows.map((row) => {
      const latest = previewByCase.get(row.caseId);
      const client = row.clientName || "Client du dossier";
      return <li key={row.caseId}><Link to="/atelier/messages/$conversationId" params={{ conversationId: row.caseId }} className="grid min-h-24 gap-3 px-4 py-4 transition hover:bg-[#f5f0e8] sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center sm:px-5">
        <span className="hidden h-10 w-10 items-center justify-center rounded-full bg-[#e9e0d3] text-xs font-bold text-[#5f1b27] sm:flex">{client.slice(0, 2).toUpperCase()}</span>
        <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className="font-editorial text-lg font-normal">{row.title}</strong>{row.unreadCount > 0 && <span className="h-2 w-2 rounded-full bg-[#7a2230]" aria-label={`${row.unreadCount} message(s) non lu(s)`} />}</span><span className="mt-0.5 block text-xs text-[#74695d]">{client} · {row.reference}</span><span className={`mt-2 block truncate text-sm ${row.unreadCount > 0 ? "font-semibold text-[#34281f]" : "text-[#685d51]"}`}>{latest?.body ?? "Aucun message pour le moment."}</span></span>
        {latest && <time dateTime={latest.createdAt} className="text-xs tabular-nums text-[#74695d]">{new Date(latest.createdAt).toLocaleDateString("fr-FR")}</time>}
      </Link></li>;
    })}</ul>
  </div>;
}

export function MessageThreadPage({ caseId }: { caseId: string }) {
  const fetchCase = useServerFn(getBinderCase);
  const dossier = useQuery({ queryKey: ["marketplace", "binder", "case", caseId], queryFn: () => fetchCase({ data: { caseId } }) });
  if (dossier.isPending) return <p role="status">Chargement de la conversation…</p>;
  if (dossier.isError || dossier.data?.offer?.state !== "selected") return <p role="alert">Conversation introuvable.</p>;
  return <div className="space-y-5">
    <Link to="/atelier/messages" className="text-sm underline">← Messages</Link>
    <header><h1 className="font-serif text-2xl">{dossier.data.view.title}</h1><p className="text-sm text-muted-foreground">{dossier.data.view.contact?.name || "Client du dossier"} · {dossier.data.view.reference}</p><Link to="/atelier/leads/$leadId" params={{ leadId: caseId }} className="mt-2 inline-flex min-h-11 items-center text-sm underline">Voir le dossier →</Link></header>
    <ConversationPanel caseId={caseId} viewerRole="binder" heading="Conversation" />
  </div>;
}
