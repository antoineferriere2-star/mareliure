import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminDashboard } from "@/marketplace/services/adminDashboard.data.functions";
import type { AdminDashboard, DashboardBrand } from "@/marketplace/admin/adminDashboard";
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

function Stat({ label, value, detail, to }: { label: string; value: ReactNode; detail?: ReactNode; to?: "/admin/ateliers" | "/admin/leads" }) {
  const body = <><span className="text-sm text-muted-foreground">{label}</span><strong className="mt-1 block text-2xl tabular-nums">{value}</strong>
    {detail && <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>}</>;
  return to ? <Link to={to} className={`${CARD} block hover:border-foreground/40`}>{body}</Link> : <div className={CARD}>{body}</div>;
}

function State({ open, label }: { open: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-1 border px-2 py-1 text-xs ${open ? "border-emerald-700 text-emerald-800" : "border-border text-muted-foreground"}`}>
    {label} : {open ? "ouvert" : "fermé"}</span>;
}

const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)} %`);

export function AdminDashboardPage() {
  const [brand, setBrand] = useState<DashboardBrand>("ALL");
  const [days, setDays] = useState<7 | 30 | 90 | null>(30);
  const fetchDashboard = useServerFn(getAdminDashboard);
  const dashboard = useQuery({ queryKey: ["admin", "dashboard", brand, days], queryFn: () => fetchDashboard({ data: { brand, days } }) });
  const periodLabel = days === null ? "depuis l'ouverture" : `sur les ${days} derniers jours`;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div><h1 className="font-serif text-2xl">Pilotage Ma Reliure · Fine Bindery</h1>
          <p className="text-sm text-muted-foreground">Dossiers, ateliers, paiements et envois. Les flux suivent la période ; les états sont ceux d'aujourd'hui.</p></div>
        <div className="flex flex-wrap gap-3">
          <Toggle label="Marque" options={BRANDS} value={brand} onChange={setBrand} />
          <Toggle label="Période" options={PERIODS} value={days} onChange={setDays} />
        </div>
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
  const maxStage = Math.max(1, ...cases.byStage.map((stage) => stage.count));
  const alerts = [...data.alerts, ...(unread ? [{ key: "messages", label: "Messages non lus", count: unread, tone: "todo" as const }] : [])];
  return (
    <>
      <Section title="À traiter">
        {alerts.length === 0 ? <p className={CARD}>Rien en attente.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {alerts.map((alert) => (
              <li key={alert.key} className={`${CARD} ${alert.tone === "urgent" ? "border-[#7a2230]" : ""}`}>
                <span className={`text-sm ${alert.tone === "urgent" ? "font-medium text-[#7a2230]" : "text-muted-foreground"}`}>{alert.label}</span>
                <strong className="mt-1 block text-2xl tabular-nums">{alert.count}</strong>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Dossiers" hint={`${cases.created} dossier(s) créé(s) ${periodLabel}. Entonnoir : état actuel de tous les dossiers.`}>
        <div className={CARD}>
          <ol className="space-y-2">
            {cases.byStage.map((stage) => (
              <li key={stage.key} className="grid grid-cols-[minmax(0,1fr)_5.5rem_2rem] items-center gap-3 text-sm sm:grid-cols-[minmax(0,16rem)_1fr_2.5rem]">
                <span className="truncate">{stage.label}</span>
                <span className="h-3 rounded-sm bg-muted" aria-hidden="true"><span className="block h-3 rounded-sm bg-[#7a2230]" style={{ width: `${(stage.count / maxStage) * 100}%` }} /></span>
                <span className="text-right tabular-nums">{stage.count}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">Atelier retenu parmi les dossiers ayant trouvé un atelier : {percent(cases.acceptanceRate)}. <Link to="/admin/leads" className="underline">Voir les dossiers</Link></p>
        </div>
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
          <Stat label="Candidatures" value={onboarding.applications.created} to="/admin/ateliers"
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
      <p className="text-xs text-muted-foreground">Calculé le {new Date(data.generatedAt).toLocaleString("fr-FR")}. Aucun nom ni adresse de client n'est affiché ici.</p>
    </>
  );
}
