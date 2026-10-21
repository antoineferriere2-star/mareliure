import { useEffect, useState, type ReactNode } from "react";
import { isInternalVisitor, setInternalVisitor } from "@/build/analytics/internalVisitor";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminDashboard, sendTeamAlertTest } from "@/marketplace/services/adminDashboard.data.functions";
import type { AdminDashboard, DashboardBrand } from "@/marketplace/admin/adminDashboard";
import type { TrafficSummary } from "@/marketplace/admin/trafficSummary";
import type { IntakeFunnel } from "@/marketplace/admin/intakeFunnel";
import { formatEuros } from "@/marketplace/pricing/money";
import { CARD } from "@/marketplace/pages/binder/quotes/quoteUi";

const BRANDS: [DashboardBrand, string][] = [["ALL", "Les deux marques"], ["MA_RELIURE", "Ma Reliure"], ["FINE_BINDERY", "Fine Bindery"]];
const PERIODS: [7 | 30 | 90 | null, string][] = [[7, "7 jours"], [30, "30 jours"], [90, "90 jours"], [null, "Depuis l'ouverture"]];
const BRAND_LABEL = { MA_RELIURE: "Ma Reliure", FINE_BINDERY: "Fine Bindery" } as const;

function Toggle<T>({ label, options, value, onChange }: { label: string; options: [T, string][]; value: T; onChange: (value: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map(([option, text]) => (
        <button key={text} type="button" aria-pressed={value === option} onClick={() => onChange(option)}
          className={`min-h-11 rounded-full border px-3 text-sm ${value === option ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <header><h2 className="font-serif text-xl">{title}</h2>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</header>
      {children}
    </section>
  );
}

function Stat({ label, value, detail, to }: { label: string; value: ReactNode; detail?: ReactNode; to?: "/admin/ateliers" | "/admin/leads" | "/marketplace/binders" }) {
  const body = <><span className="text-sm text-muted-foreground">{label}</span><strong className="mt-1 block text-2xl tabular-nums">{value}</strong>
    {detail && <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>}</>;
  return to ? <Link to={to} className={`${CARD} block hover:border-foreground/40`}>{body}</Link> : <div className={CARD}>{body}</div>;
}

function State({ open, label }: { open: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-1 border px-2 py-1 text-xs ${open ? "border-emerald-700 text-emerald-800" : "border-border text-muted-foreground"}`}>
    {label} : {open ? "ouvert" : "fermé"}</span>;
}

/** Chaque alerte mène à la liste où elle se traite. */
const ALERT_TARGETS: Record<string, "/admin/leads" | "/admin/ateliers" | "/admin/messages" | "/marketplace/binders"> = {
  newCases: "/admin/leads", disputes: "/admin/leads", refunds: "/admin/leads", labels: "/admin/leads", shipping: "/admin/leads",
  // Les candidatures se traitent dans « Relieurs » (back-office), pas sur la liste des ateliers.
  applications: "/marketplace/binders", workshopReview: "/admin/ateliers", subscriptions: "/admin/ateliers", messages: "/admin/messages",
};

const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)} %`);

export function AdminDashboardPage() {
  const [brand, setBrand] = useState<DashboardBrand>("ALL");
  const [days, setDays] = useState<7 | 30 | 90 | null>(30);
  const fetchDashboard = useServerFn(getAdminDashboard);
  const dashboard = useQuery({ queryKey: ["admin", "dashboard", brand, days], queryFn: () => fetchDashboard({ data: { brand, days } }) });
  const periodLabel = days === null ? "depuis l'ouverture" : `sur les ${days} derniers jours`;
  // Ouvrir le pilotage exclut ce navigateur de la fréquentation (internalVisitor.ts) ; réversible ci-dessous.
  const [internal, setInternal] = useState(false);
  useEffect(() => { setInternalVisitor(true); setInternal(isInternalVisitor()); }, []);
  const toggleInternal = () => { setInternalVisitor(!internal); setInternal(isInternalVisitor()); };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div><h1 className="font-serif text-2xl">Pilotage Ma Reliure · Fine Bindery</h1>
          <p className="text-sm text-muted-foreground">Dossiers, ateliers, paiements et envois. Les flux suivent la période ; les états sont ceux d'aujourd'hui.</p></div>
        <div className="flex flex-wrap gap-3">
          <Toggle label="Marque" options={BRANDS} value={brand} onChange={setBrand} />
          <Toggle label="Période" options={PERIODS} value={days} onChange={setDays} />
        </div>
        <p className="text-xs text-muted-foreground">
          {internal ? "Ce navigateur est exclu de la fréquentation et du parcours de présentation." : "Ce navigateur est compté comme un visiteur."}{" "}
          <button type="button" onClick={toggleInternal} className="underline">{internal ? "Le compter à nouveau" : "L'exclure"}</button>
          {" "}· Autre appareil : ouvrir une page du site avec « ?interne=1 ».
        </p>
      </header>
      {dashboard.isPending && <p role="status">Chargement du pilotage…</p>}
      {dashboard.isError && <p role="alert">Le tableau de bord n'a pas pu être chargé.</p>}
      {dashboard.data && <Dashboard data={dashboard.data} unread={dashboard.data.unreadMessages} periodLabel={periodLabel} />}
    </div>
  );
}

function Dashboard({ data, unread, periodLabel }: { data: AdminDashboard; unread: number; periodLabel: string }) {
  const { cases, onboarding, payments, shipping } = data;
  const allBrands = data.brand === "ALL";
  // Le parcours actif d'abord ; les dossiers clos à part, pour qu'ils n'écrasent pas l'échelle.
  const activeStages = cases.byStage.filter((stage) => stage.key !== "closed");
  const closedStage = cases.byStage.find((stage) => stage.key === "closed");
  const maxStage = Math.max(1, ...activeStages.map((stage) => stage.count));
  const alerts = [...data.alerts, ...(unread ? [{ key: "messages", label: "Messages non lus", count: unread, tone: "todo" as const }] : [])];
  return (
    <>
      <Section title="À traiter">
        {alerts.length === 0 ? <p className={CARD}>Rien en attente.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {alerts.map((alert) => (
              <li key={alert.key}>
                <Link to={ALERT_TARGETS[alert.key] ?? "/admin/leads"} className={`${CARD} block h-full hover:border-foreground/40 ${alert.tone === "urgent" ? "border-[#7a2230]" : ""}`}>
                  <span className={`text-sm ${alert.tone === "urgent" ? "font-medium text-[#7a2230]" : "text-muted-foreground"}`}>{alert.label}</span>
                  <span className="mt-1 flex items-baseline justify-between gap-2"><strong className="text-2xl tabular-nums">{alert.count}</strong><span className="text-xs underline">Traiter →</span></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {data.traffic === null && <p className={CARD}>La fréquentation n'a pas pu être lue ; le reste du pilotage est à jour.</p>}
      {data.traffic && <Traffic traffic={data.traffic} casesCreated={cases.created} periodLabel={periodLabel} />}
      {data.intake === null && <p className={CARD}>Le parcours de présentation n'a pas pu être lu.</p>}
      {data.intake && <IntakeSteps funnel={data.intake} periodLabel={periodLabel} />}

      <Section title="Dossiers" hint={`${cases.created} dossier(s) créé(s) ${periodLabel}. Entonnoir : état actuel de tous les dossiers.`}>
        <div className={CARD}>
          <ol className="space-y-2">
            {activeStages.map((stage) => (
              <li key={stage.key} className="grid grid-cols-[minmax(0,1fr)_5.5rem_2rem] items-center gap-3 text-sm sm:grid-cols-[minmax(0,16rem)_1fr_2.5rem]">
                <span className="truncate">{stage.label}</span>
                <span className="h-3 rounded-sm bg-muted" aria-hidden="true"><span className="block h-3 rounded-sm bg-[#7a2230]" style={{ width: `${(stage.count / maxStage) * 100}%` }} /></span>
                <span className="text-right tabular-nums">{stage.count}</span>
              </li>
            ))}
          </ol>
          {closedStage && (
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_5.5rem_2rem] items-center gap-3 border-t border-border pt-3 text-sm text-muted-foreground sm:grid-cols-[minmax(0,16rem)_1fr_2.5rem]">
              <span className="truncate">{closedStage.label}</span>
              <span className="h-3 rounded-sm bg-muted" aria-hidden="true"><span className="block h-3 rounded-sm bg-muted-foreground/40" style={{ width: `${Math.min(100, (closedStage.count / maxStage) * 100)}%` }} /></span>
              <span className="text-right tabular-nums">{closedStage.count}</span>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Atelier retenu parmi les dossiers ayant trouvé un atelier : {percent(cases.acceptanceRate)}. <Link to="/admin/leads" className="underline">Voir les dossiers</Link></p>
        </div>
      </Section>

      <Section title="Derniers dossiers">
        {cases.recent.length === 0 ? <p className={CARD}>Aucun dossier pour cette marque.</p> : (
          <ul className={`${CARD} divide-y divide-border p-0 sm:p-0`}>
            {cases.recent.map((row) => (
              <li key={row.id}>
                <Link to="/admin/leads/$leadId" params={{ leadId: row.id }} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm hover:bg-muted sm:px-5">
                  <strong className="tabular-nums">{row.reference}</strong>
                  <span className={`text-xs ${row.stage === "closed" ? "text-muted-foreground" : ""}`}>{row.stageLabel}</span>
                  {data.brand === "ALL" && <span className="text-xs text-muted-foreground">{BRAND_LABEL[row.brand]}</span>}
                  <time dateTime={row.createdAt} className="ml-auto text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleDateString("fr-FR")}</time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Paiements" hint={`Encaissements ${periodLabel}, rapprochés des événements Stripe.`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Circuit A : encaissé par OPPE" value={formatEuros(payments.a.grossCents)}
            detail={<>{payments.a.count} paiement(s) · frais Stripe {formatEuros(payments.a.stripeFeeCents)}</>} />
          <Stat label="Circuit A : remboursé" value={formatEuros(payments.a.refundedCents)}
            detail={<>{payments.a.openDisputes} litige(s) ouvert(s){payments.a.disputedCents ? ` · ${formatEuros(payments.a.disputedCents)} contestés` : ""}</>} />
          <Stat label="Circuit C : encaissé par les ateliers" value={formatEuros(payments.c.grossCents)}
            detail={<>{payments.c.count} paiement(s) · remboursé {formatEuros(payments.c.refundedCents)}</>} />
          <Stat label="Circuit C : retenue OPPE 3 % TTC" value={formatEuros(payments.c.platformFeeCents)}
            detail={<>nette des frais remboursés · frais Stripe atelier {formatEuros(payments.c.stripeFeeCents)}{allBrands ? ` · ${payments.c.openDisputes} litige(s)` : ""}</>} />
        </div>
        <div className={CARD}>
          <h3 className="text-sm font-medium">Derniers encaissements</h3>
          {payments.recent.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Aucun encaissement sur la période.</p> : (
            <table className="mt-2 w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1 pr-3 font-normal">Date</th><th className="pr-3 font-normal">Circuit</th><th className="hidden pr-3 font-normal sm:table-cell">Marque</th><th className="pr-3 font-normal">Dossier</th><th className="text-right font-normal">Montant</th></tr></thead>
              <tbody>{payments.recent.map((row, index) => (
                <tr key={`${row.at}-${index}`} className="border-t border-border">
                  <td className="py-1.5 pr-3"><time dateTime={row.at}>{new Date(row.at).toLocaleDateString("fr-FR")}</time></td>
                  <td className="pr-3">{row.circuit}</td><td className="hidden pr-3 sm:table-cell">{row.brand ? BRAND_LABEL[row.brand] : "—"}</td><td className="pr-3">{row.reference ?? "client de l'atelier"}</td>
                  <td className="text-right tabular-nums">{formatEuros(row.amountCents)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </Section>

      <Section title="Onboarding des ateliers" hint={allBrands ? "Les ateliers servent les deux marques." : "Les ateliers servent les deux marques : chiffres communs."}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Candidatures" value={onboarding.applications.created} to="/marketplace/binders"
            detail={<>{periodLabel} · {onboarding.applications.pending} en attente · {onboarding.applications.accepted} acceptée(s) · {onboarding.applications.rejected} refusée(s)</>} />
          <Stat label="Ateliers validés" value={onboarding.workshops.approved} to="/admin/ateliers"
            detail={<>{onboarding.workshops.pendingReview} à valider · {onboarding.workshops.suspended} suspendu(s) · {onboarding.workshops.published} profil(s) publié(s)</>} />
          <Stat label="Paiement en ligne (Stripe Connect)" value={`${onboarding.connect.chargesEnabled} actif(s)`}
            detail={<>{onboarding.connect.consents} accord(s) C · {onboarding.connect.started} compte(s) créé(s) · {onboarding.connect.onboarded} onboarding terminé · {onboarding.connect.payoutsEnabled} virement(s) actif(s)</>} />
          <Stat label="Abonnements B payants" value={onboarding.subscriptions.paying}
            detail={<>≈ {formatEuros(onboarding.subscriptions.monthlyHtCents)} HT / mois · {onboarding.subscriptions.legacyFree} gratuit(s) historique(s) · {onboarding.subscriptions.late} impayé(s) · {onboarding.subscriptions.cancelling} résiliation(s) programmée(s)</>} />
        </div>
        {onboarding.offer && <div className="flex flex-wrap gap-2">
          <State open={onboarding.offer.subscriptionOpen} label="Abonnement B" /><State open={onboarding.offer.onlinePaymentOpen} label="Paiement C" />
          <State open={onboarding.offer.connectOnboardingOpen} label="Onboarding Stripe" />
        </div>}
      </Section>

      <Section title="Envois" hint={`Étiquettes créées ${periodLabel} ; plans et étiquettes en cours : état actuel.`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Aller-retour organisé" value={shipping.plans.roundTrip}
            detail={<>{shipping.plans.awaitingWorkshop} en attente de l'atelier · {shipping.plans.returnReadyWithoutLabel} retour(s) prêt(s) sans étiquette</>} />
          <Stat label="Autres acheminements" value={shipping.plans.customerArranged + shipping.plans.handDelivery}
            detail={<>{shipping.plans.customerArranged} par le client · {shipping.plans.handDelivery} remise(s) en main propre</>} />
          <Stat label="Étiquettes confirmées" value={shipping.labels.confirmed}
            detail={<>{shipping.labels.automatic} automatique(s) · {shipping.labels.manual} manuelle(s) · {formatEuros(shipping.labels.chargedCents)} TTC facturés · {shipping.labels.inProgress} en cours · {shipping.labels.failedOrCancelled} échec(s) ou annulation(s)</>} />
          <Stat label="Étiquettes clients des ateliers" value={allBrands ? shipping.ownClientLabels : "—"}
            detail={allBrands ? "transport des ouvrages clients propres, depuis l'ouverture" : "non rattachées à une marque"} />
        </div>
        <div className="flex flex-wrap gap-2">
          <State open={shipping.automation.enabled} label="Achat automatique Sendcloud" />
          <span className="inline-flex items-center border border-border px-2 py-1 text-xs text-muted-foreground">Clés Sendcloud : {shipping.automation.providerConfigured ? "présentes" : "absentes"}</span>
          {shipping.automation.changedAt && <span className="inline-flex items-center px-2 py-1 text-xs text-muted-foreground">Verrou modifié le {new Date(shipping.automation.changedAt).toLocaleString("fr-FR")}</span>}
        </div>
      </Section>
      <AlertTest />
      <p className="text-xs text-muted-foreground">Calculé le {new Date(data.generatedAt).toLocaleString("fr-FR")}. Aucun nom ni adresse de client n'est affiché ici.</p>
    </>
  );
}

const DEVICE_LABEL: Record<string, string> = { desktop: "Ordinateur", mobile: "Mobile", tablet: "Tablette" };

/** Fréquentation des sites publics : ce que la mesure permet de dire (voir trafficSummary.ts). */
function Traffic({ traffic, casesCreated, periodLabel }: { traffic: TrafficSummary; casesCreated: number; periodLabel: string }) {
  const maxDay = Math.max(1, ...traffic.perDay.map((day) => day.views));
  const rate = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 1000) / 10} %` : "—");
  return (
    <Section title="Fréquentation" hint={`Pages publiques ${periodLabel}. Un visiteur est compté une fois par jour de venue ; robots exclus depuis le 21 octobre 2026, navigateurs de l’équipe dès leur marquage.`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pages vues" value={traffic.views} />
        <Stat label="Visites" value={traffic.visits} detail={`${traffic.visitors} visiteur(s), comptés par jour`} />
        <Stat label="Présentations ouvertes" value={traffic.intakeVisits} detail={`${rate(traffic.intakeVisits, traffic.visits)} des visites`} />
        <Stat label="Dossiers créés" value={casesCreated} detail={`${rate(casesCreated, traffic.visits)} des visites`} />
      </div>
      {traffic.perDay.length > 0 && (
        <div className={CARD}>
          <p className="text-sm text-muted-foreground">Pages vues par jour</p>
          <ol className="mt-3 flex h-24 items-end gap-px" aria-label="Pages vues par jour">
            {traffic.perDay.map((day) => (
              <li key={day.day} className="flex h-full flex-1 items-end" title={`${new Date(`${day.day}T12:00:00Z`).toLocaleDateString("fr-FR")} : ${day.views} vue(s), ${day.visits} visite(s)`}>
                <span className="block w-full rounded-t-sm bg-[#7a2230]" style={{ height: `${(day.views / maxDay) * 100}%`, minHeight: day.views ? 2 : 0 }} />
              </li>
            ))}
          </ol>
          <p className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{new Date(`${traffic.perDay[0].day}T12:00:00Z`).toLocaleDateString("fr-FR")}</span>
            <span>{new Date(`${traffic.perDay[traffic.perDay.length - 1].day}T12:00:00Z`).toLocaleDateString("fr-FR")}</span>
          </p>
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className={`${CARD} lg:col-span-2`}>
          <p className="text-sm text-muted-foreground">Pages les plus vues</p>
          {traffic.topPages.length === 0 ? <p className="mt-2 text-sm">Aucune vue sur la période.</p> : (
            <table className="mt-2 w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1 font-normal">Page</th><th className="py-1 text-right font-normal">Vues</th><th className="py-1 text-right font-normal">Visites</th></tr></thead>
              <tbody>{traffic.topPages.map((page) => (
                <tr key={page.path} className="border-t border-border"><td className="max-w-0 truncate py-1.5 pr-3">{page.path}</td><td className="py-1.5 text-right tabular-nums">{page.views}</td><td className="py-1.5 text-right tabular-nums">{page.visits}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <div className="space-y-3">
          <div className={CARD}>
            <p className="text-sm text-muted-foreground">D'où viennent les visites</p>
            <ul className="mt-2 space-y-1 text-sm">{traffic.sources.map((source) => (
              <li key={source.source} className="flex justify-between gap-3"><span className="truncate">{source.source}</span><span className="tabular-nums">{source.visits}</span></li>
            ))}</ul>
          </div>
          <div className={CARD}>
            <p className="text-sm text-muted-foreground">Appareils (pages vues)</p>
            <ul className="mt-2 space-y-1 text-sm">{traffic.devices.map((device) => (
              <li key={device.device} className="flex justify-between gap-3"><span>{DEVICE_LABEL[device.device] ?? device.device}</span><span className="tabular-nums">{device.views}</span></li>
            ))}</ul>
          </div>
        </div>
      </div>
    </Section>
  );
}

/** Où s'arrêtent les présentations de livre, étape par étape (voir intakeFunnel.ts). */
function IntakeSteps({ funnel, periodLabel }: { funnel: IntakeFunnel; periodLabel: string }) {
  const max = Math.max(1, funnel.answeredFirst);
  return (
    <Section title="Parcours « Présenter mon livre »"
      hint={`Présentations ouvertes ${periodLabel}. Une présentation s'ouvre à l'affichage de la page : « sans réponse » compte aussi les robots ; les navigateurs de l’équipe sont exclus dès leur marquage. Seuls les noms des questions répondues sont lus.`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Ouvertes" value={funnel.opened} detail={`${funnel.opened - funnel.answeredFirst} sans aucune réponse`} />
        <Stat label="Ont commencé" value={funnel.answeredFirst} detail="au moins une réponse" />
        <Stat label="Envoyées" value={funnel.submitted} detail={funnel.answeredFirst ? `${Math.round((funnel.submitted / funnel.answeredFirst) * 100)} % de celles commencées` : undefined} />
      </div>
      {funnel.answeredFirst > 0 && (
        <div className={CARD}>
          <p className="text-sm text-muted-foreground">Arrivées à chaque étape (parmi celles commencées) — et arrêts sur l'étape</p>
          <ol className="mt-3 space-y-2">
            {funnel.steps.map((step, index) => (
              <li key={step.id} className="grid grid-cols-[minmax(0,1fr)_5.5rem_4.5rem] items-center gap-3 text-sm sm:grid-cols-[minmax(0,20rem)_1fr_5rem]">
                <span className="truncate" title={step.title}>{index + 1}. {step.title}</span>
                <span className="h-3 rounded-sm bg-muted" aria-hidden="true"><span className="block h-3 rounded-sm bg-[#7a2230]" style={{ width: `${(step.reached / max) * 100}%` }} /></span>
                <span className="text-right tabular-nums">{step.reached}{step.stoppedHere ? <span className="text-[#7a2230]"> · −{step.stoppedHere}</span> : null}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">« −n » : présentations arrêtées après avoir répondu à cette étape, sans envoi.</p>
        </div>
      )}
    </Section>
  );
}

/** Vérifie en un clic que les alertes e-mail de l'équipe partent (clé Resend, domaine, modèle). */
function AlertTest() {
  const send = useServerFn(sendTeamAlertTest);
  const test = useMutation({ mutationFn: () => send() });
  return (
    <div className={`${CARD} flex flex-wrap items-center gap-3 text-sm`}>
      <span className="text-muted-foreground">Alertes e-mail de l'équipe (contact@oppe.fr)</span>
      <button type="button" disabled={test.isPending} onClick={() => test.mutate()}
        className="min-h-11 rounded-full border border-border px-3 hover:bg-muted disabled:opacity-50">
        {test.isPending ? "Envoi…" : "Envoyer une alerte de test"}
      </button>
      {test.data && (test.data.sent
        ? <span role="status" className="text-emerald-800">Acceptée par le service d'envoi : vérifiez la boîte de réception.</span>
        : <span role="alert" className="text-[#7a2230]">Non envoyée : {test.data.reason ?? "raison inconnue"}.</span>)}
      {test.isError && <span role="alert" className="text-[#7a2230]">Le test n'a pas pu être lancé.</span>}
    </div>
  );
}
