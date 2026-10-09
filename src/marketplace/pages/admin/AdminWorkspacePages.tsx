import { CASE_STAGES, caseStageLabel } from "@/marketplace/admin/adminDashboard";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMarketplaceCases } from "@/marketplace/services/marketplace.data.functions";
import { getAdminWorkshopDetail, listAdminConversationPreviews, listAdminWorkshopSummaries } from "@/marketplace/services/adminWorkspace.data.functions";
import { CARD, FIELD } from "@/marketplace/pages/binder/quotes/quoteUi";
import { binderSkillLabel } from "@/marketplace/binders/skills";
import { listBinderApplications } from "@/marketplace/services/binderApplications.data.functions";
import { ONLINE_PAYMENT_LABELS, SUBSCRIPTION_LABELS, onboardingTone } from "@/marketplace/admin/workshopOnboarding";
import { AdminWorkshopAccessControl, AdminWorkshopReviewSummary, WorkshopStatusText } from "@/marketplace/pages/admin/AdminWorkshopAccessControl";

type WorkshopSummary = Awaited<ReturnType<typeof listAdminWorkshopSummaries>>[number];

const TONE_CLASS = { ok: "border-emerald-700 text-emerald-800", attention: "border-[#7a2230] text-[#7a2230]", neutral: "border-border text-muted-foreground" } as const;

function OnboardingBadges({ row }: { row: WorkshopSummary }) {
  const { subscription, onlinePayment } = row.onboarding;
  return <span className="mt-2 flex flex-wrap gap-1.5 text-[0.7rem]">
    <span className={`border px-2 py-0.5 ${TONE_CLASS[onboardingTone(subscription)]}`}>{SUBSCRIPTION_LABELS[subscription]}</span>
    <span className={`border px-2 py-0.5 ${TONE_CLASS[onboardingTone(onlinePayment)]}`}>{ONLINE_PAYMENT_LABELS[onlinePayment]}</span>
  </span>;
}

function WorkshopCard({ row }: { row: WorkshopSummary }) {
  return <Link to="/admin/ateliers/$binderId" params={{ binderId: row.id }} className={`${CARD} block hover:border-foreground/40`}><span className="flex items-start justify-between gap-3"><strong className="font-serif text-lg">{row.name}</strong><span className="flex flex-wrap justify-end gap-1">{row.isDemo && <span className="border border-border px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Démo</span>}<span className={`border px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.1em] ${row.publicProfileStatus === "published" ? "border-emerald-700 text-emerald-800" : "border-amber-700 text-amber-800"}`}>{row.publicProfileStatus === "published" ? "Profil publié" : "Profil non publié"}</span></span></span><span className="mt-1 block text-sm text-muted-foreground">{row.relieur} · {row.city || "Ville non renseignée"} · {row.countryCode} · <WorkshopStatusText status={row.status} /></span><OnboardingBadges row={row} /><span className="mt-2 block text-sm">{row.quoteCount} devis · {row.workCount} ouvrages · {row.invoiceCount} factures · {row.portfolioCount} réalisation(s)</span><span className="mt-2 block text-xs text-muted-foreground">{row.specialties.map(binderSkillLabel).join(" · ") || "Aucune spécialité déclarée"}</span><time className="mt-1 block text-xs text-muted-foreground" dateTime={row.lastActivity}>Dernière activité : {new Date(row.lastActivity).toLocaleString("fr-FR")}</time></Link>;
}

export function AdminWorkshopsPage() {
  const fetchRows = useServerFn(listAdminWorkshopSummaries);
  const fetchApplications = useServerFn(listBinderApplications);
  const rows = useQuery({ queryKey: ["admin", "workshops"], queryFn: () => fetchRows() });
  const applications = useQuery({ queryKey: ["admin", "binder-applications"], queryFn: () => fetchApplications() });
  const pendingApplications = (applications.data ?? []).filter((row) => row.status === "new").length;
  const real = (rows.data ?? []).filter((row) => !row.isDemo);
  const demo = (rows.data ?? []).filter((row) => row.isDemo);
  return <div className="space-y-5"><h1 className="font-serif text-2xl">Ateliers</h1>
    {rows.isPending && <p role="status">Chargement…</p>}{rows.isError && <p role="alert">Les ateliers n'ont pas pu être chargés.</p>}
    {pendingApplications > 0 && <p className="border border-amber-700 bg-amber-50 p-4 text-sm text-amber-950" role="status"><strong>{pendingApplications} candidature{pendingApplications > 1 ? "s" : ""} à examiner.</strong>{" "}<Link to="/marketplace/binders" className="underline">Ouvrir les candidatures</Link></p>}
    <AdminWorkshopReviewSummary statuses={real.map((row) => row.status)} />
    {rows.data && !real.length && <p>Aucun atelier réel pour le moment.</p>}
    <ul className="grid gap-3 md:grid-cols-2">{real.map((row) => <li key={row.id}><WorkshopCard row={row} /></li>)}</ul>
    {demo.length > 0 && <details className="rounded-sm border border-border p-4"><summary className="cursor-pointer text-sm text-muted-foreground">Ateliers de démonstration ({demo.length}) — exclus des compteurs du pilotage</summary><ul className="mt-3 grid gap-3 md:grid-cols-2">{demo.map((row) => <li key={row.id}><WorkshopCard row={row} /></li>)}</ul></details>}
  </div>;
}

type Detail = Awaited<ReturnType<typeof getAdminWorkshopDetail>>;
const TABS = ["Aperçu", "Projets", "Messages", "Ouvrages", "Devis", "Factures", "Prestations", "Activité"] as const;

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
    {tab === "Projets" && <ul className="space-y-2">{data.leads.map((row) => <li key={row.case_id} className={CARD}><Link to="/admin/leads/$leadId" params={{ leadId: row.case_id }} className="inline-flex min-h-11 items-center underline">{row.reference} · {row.state} · {row.caseStatus}</Link></li>)}{!data.leads.length && <li className={CARD}>Aucun dossier Ma Reliure.</li>}</ul>}
    {tab === "Messages" && <div className={CARD}><p className="text-sm">Les échanges sont rattachés à chaque dossier Ma Reliure.</p>{data.leads.map((row) => <Link key={row.case_id} to="/admin/leads/$leadId" params={{ leadId: row.case_id }} className="block min-h-11 content-center underline">Conversation du dossier {row.reference}</Link>)}{!data.leads.length && <p className="mt-2 text-sm text-muted-foreground">Aucune conversation Ma Reliure.</p>}</div>}
    {tab === "Ouvrages" && <ul className="space-y-2">{data.works.map((row) => <li key={row.id} className={CARD}>{row.title} · {row.reference}{row.brand === "FINE_BINDERY" ? " · Fine Bindery" : " · Ma Reliure"} · <Link to="/admin/leads/$leadId" params={{ leadId: row.caseId! }} className="underline">Dossier</Link></li>)}{!data.works.length && <li className={CARD}>Aucun ouvrage lié à Ma Reliure ou Fine Bindery.</li>}</ul>}
    {tab === "Devis" && <ul className="space-y-2">{data.quotes.map((row) => <li key={row.id} className={CARD}>{row.number} · {row.status} · {(row.totalTtcCents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</li>)}{!data.quotes.length && <li className={CARD}>Aucun devis lié à Ma Reliure.</li>}</ul>}
    {tab === "Factures" && <ul className="space-y-2">{data.invoices.map((row) => <li key={row.id} className={CARD}>{row.number} · {row.status}</li>)}{!data.invoices.length && <li className={CARD}>Aucune facture liée à Ma Reliure.</li>}</ul>}
    {tab === "Prestations" && <div className={CARD}>{data.serviceCount} prestations dans le catalogue de l'atelier. Les détails de ses clients personnels ne sont pas affichés.</div>}
    {tab === "Activité" && <ul className="space-y-2">{data.activity.map((row) => <li key={row.id} className={CARD}>{new Date(row.at).toLocaleString("fr-FR")} · {row.type}</li>)}{!data.activity.length && <li className={CARD}>Aucune activité récente.</li>}</ul>}
  </div>;
}

const BRAND_FILTERS = [["ALL", "Les deux marques"], ["MA_RELIURE", "Ma Reliure"], ["FINE_BINDERY", "Fine Bindery"]] as const;
const FILTERS = ["Tous", ...CASE_STAGES.map(([, label]) => label), "Statut non reconnu"] as const;
export function AdminLeadsPage() {
  const fetchCases = useServerFn(listMarketplaceCases);
  const cases = useQuery({ queryKey: ["admin", "cases"], queryFn: () => fetchCases() });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Tous");
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState<(typeof BRAND_FILTERS)[number][0]>("ALL");
  const rows = (cases.data ?? []).filter((row) => (row.brand === "MA_RELIURE" || row.brand === "FINE_BINDERY") && (brand === "ALL" || row.brand === brand) && (filter === "Tous" || adminCaseGroup(row.status) === filter) && `${row.title} ${row.reference}`.toLocaleLowerCase("fr-FR").includes(search.toLocaleLowerCase("fr-FR")));
  return <div className="space-y-5"><header><h1 className="font-serif text-2xl">Dossiers</h1><p className="text-sm text-muted-foreground">Toutes les demandes reçues par Ma Reliure et Fine Bindery.</p></header><input aria-label="Rechercher un projet" className={`${FIELD} w-full sm:max-w-sm`} placeholder="Ouvrage, référence…" value={search} onChange={(event) => setSearch(event.target.value)} /><div role="group" aria-label="Marque" className="flex flex-wrap gap-2">{BRAND_FILTERS.map(([value, label]) => <button key={value} type="button" aria-pressed={brand === value} onClick={() => setBrand(value)} className={`min-h-11 rounded-full border px-3 text-sm ${brand === value ? "bg-foreground text-background" : "border-border"}`}>{label}</button>)}</div><div role="group" aria-label="Étape" className="flex flex-wrap gap-2">{FILTERS.map((name) => <button key={name} type="button" aria-pressed={filter === name} onClick={() => setFilter(name)} className={`min-h-11 rounded-full border px-3 text-sm ${filter === name ? "bg-foreground text-background" : "border-border"}`}>{name}</button>)}</div>{cases.isPending && <p role="status">Chargement…</p>}{cases.isError && <p role="alert">Les dossiers n'ont pas pu être chargés.</p>}{cases.data && !rows.length && <p>Aucun dossier dans cette vue.</p>}<ul className="grid gap-3 md:grid-cols-2">{rows.map((row) => <li key={row.id}><Link to="/admin/leads/$leadId" params={{ leadId: row.id }} className={`${CARD} block`}><strong className="font-serif text-lg">{row.title}</strong><span className="mt-1 block text-sm text-muted-foreground">{row.reference} · {row.brand === "FINE_BINDERY" ? "Fine Bindery" : "Ma Reliure"} · {adminCaseGroup(row.status)} · {row.invitedCount} atelier(s) sollicité(s)</span>{row.unreadMessages > 0 && <span className="mt-2 block text-xs">{row.unreadMessages} message(s) non lu(s)</span>}</Link></li>)}</ul></div>;
}

const adminCaseGroup = caseStageLabel;

export function AdminMessagesPage() {
  const fetchRows = useServerFn(listAdminConversationPreviews);
  const rows = useQuery({ queryKey: ["admin", "messages"], queryFn: () => fetchRows() });
  return <div className="space-y-5"><header><h1 className="font-serif text-2xl">Messages</h1><p className="text-sm text-muted-foreground">Conversations des dossiers Ma Reliure et Fine Bindery.</p></header>{rows.isPending && <p role="status">Chargement…</p>}{rows.isError && <p role="alert">Les messages n'ont pas pu être chargés.</p>}{rows.data?.length === 0 && <div className={CARD}>Aucune conversation pour le moment.</div>}<ul className="space-y-3">{rows.data?.map((row) => <li key={row.caseId}><Link to="/admin/leads/$leadId" params={{ leadId: row.caseId }} className={`${CARD} block`}><strong>{row.reference}</strong><span className="ml-2 text-xs text-muted-foreground">{row.brand === "FINE_BINDERY" ? "Fine Bindery" : "Ma Reliure"} · {row.binderName}</span><p className="mt-2 line-clamp-2 text-sm">{row.latest.body}</p><time dateTime={row.latest.at} className="text-xs text-muted-foreground">{new Date(row.latest.at).toLocaleString("fr-FR")}</time></Link></li>)}</ul></div>;
}
