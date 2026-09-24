import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMarketplaceCases } from "@/marketplace/services/marketplace.data.functions";
import { getAdminWorkshopDetail, listAdminConversationPreviews, listAdminWorkshopSummaries } from "@/marketplace/services/adminWorkspace.data.functions";
import { CARD, FIELD } from "@/marketplace/pages/binder/quotes/quoteUi";
import { binderSkillLabel } from "@/marketplace/binders/skills";
import { AdminWorkshopAccessControl, AdminWorkshopReviewSummary, WorkshopStatusText } from "@/marketplace/pages/admin/AdminWorkshopAccessControl";

export function AdminTodayPage() {
  const fetchCases = useServerFn(listMarketplaceCases);
  const fetchWorkshops = useServerFn(listAdminWorkshopSummaries);
  const cases = useQuery({ queryKey: ["admin", "cases"], queryFn: () => fetchCases() });
  const workshops = useQuery({ queryKey: ["admin", "workshops"], queryFn: () => fetchWorkshops() });
  if (cases.isPending || workshops.isPending) return <p role="status">Chargement du pilotage…</p>;
  if (cases.isError || workshops.isError) return <p role="alert">Le pilotage n'a pas pu être chargé.</p>;
  const rows = (cases.data ?? []).filter((row) => row.brand === "MA_RELIURE");
  const cards = [
    ["Nouveaux leads", rows.filter((row) => row.status === "under_review").length, "/admin/leads"],
    ["Leads sans réponse", rows.filter((row) => row.status === "sent_to_binders" && row.acceptedCount === 0).length, "/admin/leads"],
    ["Messages en attente", rows.reduce((total, row) => total + row.unreadMessages, 0), "/admin/messages"],
    ["Devis en cours", rows.filter((row) => row.status === "quotes_received").length, "/admin/leads"],
    ["Devis envoyés", rows.filter((row) => row.status === "awaiting_approval").length, "/admin/leads"],
    ["Projets acceptés", rows.filter((row) => row.status === "binder_selected").length, "/admin/leads"],
    ["Ateliers actifs", (workshops.data ?? []).filter((row) => row.status === "approved").length, "/admin/ateliers"],
  ] as const;
  return <div className="space-y-5"><header><h1 className="font-serif text-2xl">Pilotage Ma Reliure</h1><p className="text-sm text-muted-foreground">Les dossiers et ateliers à suivre.</p></header><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, count, to]) => <Link key={label} to={to} className={`${CARD} block`}><span className="text-sm text-muted-foreground">{label}</span><strong className="mt-2 block text-3xl">{count}</strong></Link>)}</div></div>;
}

export function AdminWorkshopsPage() {
  const fetchRows = useServerFn(listAdminWorkshopSummaries);
  const rows = useQuery({ queryKey: ["admin", "workshops"], queryFn: () => fetchRows() });
  return <div className="space-y-5"><h1 className="font-serif text-2xl">Ateliers</h1>
    {rows.isPending && <p role="status">Chargement…</p>}{rows.isError && <p role="alert">Les ateliers n'ont pas pu être chargés.</p>}
    <AdminWorkshopReviewSummary statuses={(rows.data ?? []).map((row) => row.status)} />
    {rows.data?.length === 0 && <p>Aucun atelier pour le moment.</p>}
    <ul className="grid gap-3 md:grid-cols-2">{rows.data?.map((row) => <li key={row.id}><Link to="/admin/ateliers/$binderId" params={{ binderId: row.id }} className={`${CARD} block hover:border-foreground/40`}><span className="flex items-start justify-between gap-3"><strong className="font-serif text-lg">{row.name}</strong><span className={`border px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.1em] ${row.publicProfileStatus === "published" ? "border-emerald-700 text-emerald-800" : "border-amber-700 text-amber-800"}`}>{row.publicProfileStatus === "published" ? "Profil publié" : "Profil non publié"}</span></span><span className="mt-1 block text-sm text-muted-foreground">{row.relieur} · {row.city || "Ville non renseignée"} · {row.countryCode} · <WorkshopStatusText status={row.status} /></span><span className="mt-2 block text-sm">{row.quoteCount} devis · {row.workCount} ouvrages · {row.invoiceCount} factures · {row.portfolioCount} réalisation(s)</span><span className="mt-2 block text-xs text-muted-foreground">{row.specialties.map(binderSkillLabel).join(" · ") || "Aucune spécialité déclarée"}</span><time className="mt-1 block text-xs text-muted-foreground" dateTime={row.lastActivity}>Dernière activité : {new Date(row.lastActivity).toLocaleString("fr-FR")}</time></Link></li>)}</ul>
  </div>;
}

type Detail = Awaited<ReturnType<typeof getAdminWorkshopDetail>>;
const TABS = ["Aperçu", "Leads", "Messages", "Ouvrages", "Devis", "Factures", "Prestations", "Activité"] as const;

export function AdminWorkshopPage({ binderId }: { binderId: string }) {
  const fetchDetail = useServerFn(getAdminWorkshopDetail);
  const detail = useQuery({ queryKey: ["admin", "workshop", binderId], queryFn: () => fetchDetail({ data: { binderId } }) });
  const [tab, setTab] = useState<(typeof TABS)[number]>("Aperçu");
  if (detail.isPending) return <p role="status">Chargement de l'atelier…</p>;
  if (detail.isError || !detail.data) return <p role="alert">Cet atelier est introuvable.</p>;
  const data: Detail = detail.data;
  return <div className="space-y-5">
    <Link to="/admin/ateliers" className="text-sm underline">← Ateliers</Link>
    <header><h1 className="font-serif text-2xl">{data.binder.name}</h1><p className="text-sm text-muted-foreground">{data.binder.relieur} · {data.binder.status}</p></header>
    <AdminWorkshopAccessControl binderId={binderId} status={data.binder.status} />
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Fiche atelier">{TABS.map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)} className={`min-h-11 rounded-full border px-3 text-sm ${tab === name ? "bg-foreground text-background" : "border-border"}`}>{name}</button>)}</div>
    {tab === "Aperçu" && <div className={CARD}><p>{data.works.length} ouvrages liés · {data.quotes.length} devis liés · {data.invoices.length} factures liées.</p><p className="mt-2 text-sm">FineBindery : <strong>{data.binder.publicProfileStatus === "published" ? "profil publié" : "profil non publié"}</strong> · {data.binder.countryCode} · {data.binder.portfolioCount} réalisation(s).</p>{data.binder.publicSlug && <a href={`/fr/${data.binder.publicSlug}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm underline">Voir la page publique</a>}<p className="mt-2 text-sm text-muted-foreground">Spécialités : {data.binder.specialties.map(binderSkillLabel).join(" · ") || "aucune"}.</p><p className="mt-2 text-sm text-muted-foreground">Clients personnels : {data.privateCounts.works} ouvrages, {data.privateCounts.quotes} devis, {data.privateCounts.invoices} factures. Seuls ces totaux sont visibles ici.</p></div>}
    {tab === "Leads" && <ul className="space-y-2">{data.leads.map((row) => <li key={row.case_id} className={CARD}><Link to="/admin/leads/$leadId" params={{ leadId: row.case_id }} className="inline-flex min-h-11 items-center underline">{row.reference} · {row.state} · {row.caseStatus}</Link></li>)}{!data.leads.length && <li className={CARD}>Aucun dossier Ma Reliure.</li>}</ul>}
    {tab === "Messages" && <div className={CARD}><p className="text-sm">Les échanges sont rattachés à chaque dossier Ma Reliure.</p>{data.leads.map((row) => <Link key={row.case_id} to="/admin/leads/$leadId" params={{ leadId: row.case_id }} className="block min-h-11 content-center underline">Conversation du dossier {row.reference}</Link>)}{!data.leads.length && <p className="mt-2 text-sm text-muted-foreground">Aucune conversation Ma Reliure.</p>}</div>}
    {tab === "Ouvrages" && <ul className="space-y-2">{data.works.map((row) => <li key={row.id} className={CARD}>{row.title} · {row.reference} · <Link to="/admin/leads/$leadId" params={{ leadId: row.caseId! }} className="underline">Dossier</Link></li>)}{!data.works.length && <li className={CARD}>Aucun ouvrage lié à Ma Reliure.</li>}</ul>}
    {tab === "Devis" && <ul className="space-y-2">{data.quotes.map((row) => <li key={row.id} className={CARD}>{row.number} · {row.status} · {(row.totalTtcCents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</li>)}{!data.quotes.length && <li className={CARD}>Aucun devis lié à Ma Reliure.</li>}</ul>}
    {tab === "Factures" && <ul className="space-y-2">{data.invoices.map((row) => <li key={row.id} className={CARD}>{row.number} · {row.status}</li>)}{!data.invoices.length && <li className={CARD}>Aucune facture liée à Ma Reliure.</li>}</ul>}
    {tab === "Prestations" && <div className={CARD}>{data.serviceCount} prestations dans le catalogue de l'atelier. Les détails de ses clients personnels ne sont pas affichés.</div>}
    {tab === "Activité" && <ul className="space-y-2">{data.activity.map((row) => <li key={row.id} className={CARD}>{new Date(row.at).toLocaleString("fr-FR")} · {row.type}</li>)}{!data.activity.length && <li className={CARD}>Aucune activité récente.</li>}</ul>}
  </div>;
}

const FILTERS = ["Tous", "Nouveau", "À qualifier", "Assigné", "En discussion", "Devis en cours", "Devis envoyé", "Accepté", "Clos"] as const;
export function AdminLeadsPage() {
  const fetchCases = useServerFn(listMarketplaceCases);
  const cases = useQuery({ queryKey: ["admin", "cases"], queryFn: () => fetchCases() });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Tous");
  const [search, setSearch] = useState("");
  const rows = (cases.data ?? []).filter((row) => row.brand === "MA_RELIURE" && (filter === "Tous" || adminCaseGroup(row.status) === filter) && `${row.title} ${row.reference}`.toLocaleLowerCase("fr-FR").includes(search.toLocaleLowerCase("fr-FR")));
  return <div className="space-y-5"><header><h1 className="font-serif text-2xl">Leads Ma Reliure</h1><p className="text-sm text-muted-foreground">Tous les projets apportés par la plateforme.</p></header><input aria-label="Rechercher un lead" className={`${FIELD} w-full sm:max-w-sm`} placeholder="Ouvrage, référence…" value={search} onChange={(event) => setSearch(event.target.value)} /><div className="flex flex-wrap gap-2">{FILTERS.map((name) => <button key={name} type="button" aria-pressed={filter === name} onClick={() => setFilter(name)} className={`min-h-11 rounded-full border px-3 text-sm ${filter === name ? "bg-foreground text-background" : "border-border"}`}>{name}</button>)}</div>{cases.isPending && <p role="status">Chargement…</p>}{cases.isError && <p role="alert">Les dossiers n'ont pas pu être chargés.</p>}{cases.data && !rows.length && <p>Aucun dossier dans cette vue.</p>}<ul className="grid gap-3 md:grid-cols-2">{rows.map((row) => <li key={row.id}><Link to="/admin/leads/$leadId" params={{ leadId: row.id }} className={`${CARD} block`}><strong className="font-serif text-lg">{row.title}</strong><span className="mt-1 block text-sm text-muted-foreground">{row.reference} · {adminCaseGroup(row.status)} · {row.invitedCount} atelier(s) sollicité(s)</span>{row.unreadMessages > 0 && <span className="mt-2 block text-xs">{row.unreadMessages} message(s) non lu(s)</span>}</Link></li>)}</ul></div>;
}

function adminCaseGroup(status: string): (typeof FILTERS)[number] {
  if (status === "under_review") return "Nouveau";
  if (status === "matching") return "À qualifier";
  if (status === "sent_to_binders") return "Assigné";
  if (status === "quotes_received") return "Devis en cours";
  if (status === "binder_selected" || status === "awaiting_payment" || status === "paid" || status === "in_progress") return "En discussion";
  if (status === "awaiting_approval") return "Devis envoyé";
  if (status === "completed" || status === "delivered") return "Accepté";
  return "Clos";
}

export function AdminMessagesPage() {
  const fetchRows = useServerFn(listAdminConversationPreviews);
  const rows = useQuery({ queryKey: ["admin", "messages"], queryFn: () => fetchRows() });
  return <div className="space-y-5"><header><h1 className="font-serif text-2xl">Messages Ma Reliure</h1><p className="text-sm text-muted-foreground">Conversations liées aux dossiers de la plateforme uniquement.</p></header>{rows.isPending && <p role="status">Chargement…</p>}{rows.isError && <p role="alert">Les messages n'ont pas pu être chargés.</p>}{rows.data?.length === 0 && <div className={CARD}>Aucune conversation pour le moment.</div>}<ul className="space-y-3">{rows.data?.map((row) => <li key={row.caseId}><Link to="/admin/leads/$leadId" params={{ leadId: row.caseId }} className={`${CARD} block`}><strong>{row.reference}</strong><span className="ml-2 text-xs text-muted-foreground">{row.binderName}</span><p className="mt-2 line-clamp-2 text-sm">{row.latest.body}</p><time dateTime={row.latest.at} className="text-xs text-muted-foreground">{new Date(row.latest.at).toLocaleString("fr-FR")}</time></Link></li>)}</ul></div>;
}
