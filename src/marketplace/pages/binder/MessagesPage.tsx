import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyBinderCases, getBinderCase } from "@/marketplace/services/marketplace.data.functions";
import { listMyConversationPreviews } from "@/marketplace/services/binderConversations.data.functions";
import { ConversationPanel } from "@/marketplace/pages/ConversationPanel";
import { CARD } from "@/marketplace/pages/binder/quotes/quoteUi";

export function MessagesPage() {
  const fetchCases = useServerFn(listMyBinderCases);
  const fetchPreviews = useServerFn(listMyConversationPreviews);
  const cases = useQuery({ queryKey: ["marketplace", "binder", "cases"], queryFn: () => fetchCases() });
  const previews = useQuery({ queryKey: ["marketplace", "binder", "conversation-previews"], queryFn: () => fetchPreviews() });
  const previewByCase = new Map((previews.data ?? []).map((row) => [row.caseId, row.latest] as const));
  const rows = (cases.data ?? []).filter((row) => row.state === "selected");
  return <div className="space-y-5">
    <header><h1 className="font-serif text-2xl">Messages</h1><p className="mt-1 text-sm text-muted-foreground">Vos échanges liés aux dossiers Ma Reliure.</p></header>
    {(cases.isPending || previews.isPending) && <p role="status">Chargement des conversations…</p>}
    {(cases.isError || previews.isError) && <p role="alert">Les conversations n'ont pas pu être chargées.</p>}
    {cases.data && rows.length === 0 && <div className={CARD}>Aucune conversation pour le moment. Les messages s'ouvrent quand votre atelier est retenu sur un dossier.</div>}
    <ul className="space-y-3">{rows.map((row) => {
      const latest = previewByCase.get(row.caseId);
      return <li key={row.caseId}><Link to="/atelier/messages/$conversationId" params={{ conversationId: row.caseId }} className={`${CARD} block hover:border-foreground/40`}>
        <span className="flex flex-wrap items-start justify-between gap-2"><span className="font-serif text-lg">{row.title}</span>{row.unreadCount > 0 && <span className="rounded-full bg-foreground px-2 py-0.5 text-xs text-background">{row.unreadCount} non lu(s)</span>}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{row.clientName || "Client du dossier"} · {row.reference}</span>
        <span className="mt-2 block line-clamp-2 text-sm">{latest?.body ?? "Aucun message pour le moment."}</span>
        {latest && <time dateTime={latest.createdAt} className="mt-1 block text-xs text-muted-foreground">{new Date(latest.createdAt).toLocaleString("fr-FR")}</time>}
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
