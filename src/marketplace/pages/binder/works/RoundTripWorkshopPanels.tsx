/**
 * Côté atelier : accord de réception (fiche dossier), puis suivi des deux trajets, retour prêt
 * et étiquette retour (fiche ouvrage). Le serveur arbitre tout ; aucun prix ni coût affiché.
 */
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ensureMyCaseWork } from "@/marketplace/services/binderCaseWorkspace.data.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  declareCaseReturnReady, decideCaseReception, getWorkshopCaseLogistics, getWorkshopReturnLabel,
} from "@/marketplace/services/caseLogistics.data.functions";
import type { WorkshopLogisticsView } from "@/marketplace/services/caseLogistics.server";
import { parcelWithinRoundTripLimits } from "@/marketplace/shipping/logisticsPlan";
import { roundTripWorkshopCopy, type RoundTripWorkshopCopy } from "@/marketplace/works/roundTripWorkshopCopy";
import { useFineBinderyWorkspace } from "@/marketplace/i18n/FineBinderyWorkspaceContext";
import { CARD, ErrorNote, PRIMARY_BUTTON } from "../quotes/quoteUi";

const FIELD = "mt-1 block w-full min-w-0 rounded-md border border-border bg-background p-2 text-base";
const errorText = (error: unknown, t: RoundTripWorkshopCopy) =>
  t.errors[error instanceof Error ? error.message : ""] ?? t.genericError;
const keyFor = (caseId: string) => ["atelier", "case", caseId, "logistics"] as const;

function useWorkshopLogistics(caseId: string) {
  const read = useServerFn(getWorkshopCaseLogistics);
  return useQuery({ queryKey: keyFor(caseId), queryFn: () => read({ data: { caseId } }), refetchInterval: 60_000 });
}

function PlanFacts({ view, t }: { view: WorkshopLogisticsView; t: RoundTripWorkshopCopy }) {
  const plan = view.plan!;
  const euros = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2 [overflow-wrap:anywhere]">
      <div className="sm:col-span-2"><dt className="font-medium">{t.modes[plan.mode]}</dt><dd>{plan.bookDescription} · {t.bookKinds[plan.bookKind]}</dd></div>
      <div><dt className="text-muted-foreground">{t.declaredValue}</dt><dd>{euros(plan.declaredValueCents)}</dd></div>
      {plan.parcel && <div><dt className="text-muted-foreground">{t.parcel}</dt><dd>{plan.parcel.weightGrams} g · {plan.parcel.lengthMm / 10} × {plan.parcel.widthMm / 10} × {plan.parcel.heightMm / 10} cm</dd></div>}
      {plan.customerArea && <div><dt className="text-muted-foreground">{t.customerArea}</dt><dd>{plan.customerArea.postalCode} {plan.customerArea.city} · {plan.customerArea.countryCode}</dd></div>}
    </dl>
  );
}

/** Fiche dossier (français) : l'atelier invité ou retenu confirme qu'il peut recevoir le livre. */
export function WorkshopReceptionPanel({ caseId }: { caseId: string }) {
  const t = roundTripWorkshopCopy.fr;
  const query = useWorkshopLogistics(caseId);
  const decide = useServerFn(decideCaseReception);
  const cache = useQueryClient();
  const [address, setAddress] = useState({ name: "", line1: "", line2: "", postalCode: "", city: "", countryCode: "FR", phone: "" });
  const mutation = useMutation({
    mutationFn: (decision: "accepted" | "declined") => decide({ data: { caseId, decision, reception: decision === "declined" ? null : {
      name: address.name, line1: address.line1, line2: address.line2.trim() || null, postalCode: address.postalCode.trim(),
      city: address.city, countryCode: address.countryCode, phone: address.phone.trim() || null } } }),
    onSuccess: () => cache.invalidateQueries({ queryKey: keyFor(caseId) }),
  });
  const view = query.data;
  if (query.isPending) return <section className={CARD}><p role="status">…</p></section>;
  if (query.isError || !view) return null;
  const field = (label: string, key: keyof typeof address, wide = false, extra: Record<string, string> = {}) => (
    <label className={`block text-sm ${wide ? "sm:col-span-2" : ""}`}>{label}
      <input className={FIELD} value={address[key]} maxLength={160} onChange={(e) => setAddress({ ...address, [key]: e.target.value })} {...extra} />
    </label>
  );
  return (
    <section aria-labelledby="reception-title" className="space-y-3 rounded-lg border border-border bg-card p-5">
      <h2 id="reception-title" className="font-serif text-lg">{t.receptionTitle}</h2>
      {!view.plan ? <p className="text-sm text-muted-foreground">{t.noPlan}</p> : (
        <>
          <PlanFacts view={view} t={t} />
          {view.decision?.decision === "accepted" && <p className="text-sm font-medium">{t.accepted}</p>}
          {view.decision?.decision === "declined" && <p className="text-sm font-medium">{t.declined}</p>}
          {view.decidedByOtherWorkshop && !view.decision && <p className="text-sm text-muted-foreground">{t.otherWorkshop}</p>}
          {view.canDecide && !view.decision ? (
            <div className="space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">{t.receptionIntro}</p>
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="mb-1 text-sm font-medium">{t.receptionAddress}</legend>
                {field(t.name, "name", true)}{field(t.line1, "line1", true)}{field(t.line2, "line2", true)}
                {field(t.postalCode, "postalCode", false, { inputMode: "numeric" })}{field(t.city, "city")}
                {field(t.country, "countryCode")}{field(t.phone, "phone", false, { type: "tel" })}
              </fieldset>
              {mutation.isError && <ErrorNote>{errorText(mutation.error, t)}</ErrorNote>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={PRIMARY_BUTTON} disabled={mutation.isPending} onClick={() => mutation.mutate("accepted")}>{t.accept}</button>
                <button type="button" className="min-h-11 rounded-md border border-border px-4" disabled={mutation.isPending} onClick={() => mutation.mutate("declined")}>{t.decline}</button>
              </div>
            </div>
          ) : view.decision && !view.canDecide ? <p className="text-xs text-muted-foreground">{t.lockedDecision}</p> : null}
          {view.selected && view.accepted && <OpenWorkJournal caseId={caseId} t={t} />}
        </>
      )}
    </section>
  );
}

/** Fiche ouvrage d'un dossier Ma Reliure : trajets, retour prêt, étiquette retour. */
export function WorkshopRoundTripPanel({ caseId }: { caseId: string }) {
  const { locale } = useFineBinderyWorkspace();
  const t = roundTripWorkshopCopy[locale];
  const query = useWorkshopLogistics(caseId);
  const view = query.data;
  if (query.isPending || query.isError || !view?.plan || !view.selected || !view.accepted) return null;
  const organized = view.offerKind === "book_round_trip_fr";
  return (
    <section aria-labelledby="round-trip-title" className={`${CARD} space-y-4`}>
      <h2 id="round-trip-title" className="font-serif text-xl">{organized ? t.roundTripTitle : t.receptionTitle}</h2>
      <PlanFacts view={view} t={t} />
      {organized && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Leg title={t.outbound} leg={view.outbound} t={t} />
          <Leg title={t.return} leg={view.return} t={t}>
            {view.return?.downloadable && <ReturnLabel caseId={caseId} t={t} />}
          </Leg>
        </div>
      )}
      {!view.received && <p className="text-sm text-muted-foreground">{t.journalHint}</p>}
      {organized && <ReturnReady caseId={caseId} view={view} t={t} />}
    </section>
  );
}

function Leg({ title, leg, t, children }: { title: string; leg: WorkshopLogisticsView["outbound"]; t: RoundTripWorkshopCopy; children?: ReactNode }) {
  return (
    <div className="min-w-0 rounded border border-border p-3 text-sm [overflow-wrap:anywhere]">
      <p className="font-medium">{title}</p>
      {!leg ? <p className="text-muted-foreground">{t.notStarted}</p>
        : leg.state === "preparing" ? <p>{t.preparing}</p>
        : leg.state === "cancelled" ? <p>{t.cancelled}</p>
        : <>{leg.method && <p>{t.method} : {leg.method}</p>}<p>{t.tracking} : {leg.carrier} · {leg.tracking}</p></>}
      {children}
    </div>
  );
}

function ReturnLabel({ caseId, t }: { caseId: string; t: RoundTripWorkshopCopy }) {
  const download = useServerFn(getWorkshopReturnLabel);
  const open = useMutation({ mutationFn: () => download({ data: { caseId } }), onSuccess: (r) => window.location.assign(r.url) });
  return (
    <div className="mt-2 space-y-1">
      <button type="button" className={PRIMARY_BUTTON} disabled={open.isPending} onClick={() => open.mutate()}>{t.downloadReturn}</button>
      <p className="text-xs text-muted-foreground">{t.linkExpires}</p>
      {open.isError && <ErrorNote>{t.labelError}</ErrorNote>}
    </div>
  );
}

function ReturnReady({ caseId, view, t }: { caseId: string; view: WorkshopLogisticsView; t: RoundTripWorkshopCopy }) {
  const declare = useServerFn(declareCaseReturnReady);
  const cache = useQueryClient();
  const ready = view.plan?.returnReady;
  const [parcel, setParcel] = useState({ weight: "", length: "", width: "", height: "" });
  const mm = (cm: string) => Math.round(Number(cm.replace(",", ".")) * 10);
  const mutation = useMutation({
    mutationFn: () => declare({ data: { caseId, parcel: { weightGrams: Math.round(Number(parcel.weight)), lengthMm: mm(parcel.length),
      widthMm: mm(parcel.width), heightMm: mm(parcel.height) } } }),
    onSuccess: () => cache.invalidateQueries({ queryKey: keyFor(caseId) }),
  });
  return (
    <div className="space-y-2 border-t border-border pt-4">
      <h3 className="font-medium">{t.readyTitle}</h3>
      {ready ? (
        <>
          <p className="text-sm">{t.readyDeclared} {ready.parcel.weightGrams} g · {ready.parcel.lengthMm / 10} × {ready.parcel.widthMm / 10} × {ready.parcel.heightMm / 10} cm</p>
          {!parcelWithinRoundTripLimits(ready.parcel) && <p className="text-sm">{t.parcelOutOfLimits}</p>}
          <p className="text-sm text-muted-foreground">{view.returnAddressConfirmed ? t.customerConfirmed : t.awaitingCustomerConfirmation}</p>
        </>
      ) : !view.received ? <p className="text-sm text-muted-foreground">{t.readyNeedsReceipt}</p> : view.canDeclareReturnReady ? (
        <>
          <p className="text-sm leading-6 text-muted-foreground">{t.readyIntro}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["weight", "length", "width", "height"] as const).map((k) => (
              <label key={k} className="block text-sm">{t[k]}
                <input className={FIELD} inputMode="decimal" value={parcel[k]} onChange={(e) => setParcel({ ...parcel, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          {mutation.isError && <ErrorNote>{errorText(mutation.error, t)}</ErrorNote>}
          <button type="button" className={PRIMARY_BUTTON} disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? t.saving : t.declareReady}
          </button>
        </>
      ) : null}
    </div>
  );
}

/** Le journal de réception vit sur la fiche ouvrage : l'atelier retenu l'ouvre sans passer par un devis. */
function OpenWorkJournal({ caseId, t }: { caseId: string; t: RoundTripWorkshopCopy }) {
  const ensure = useServerFn(ensureMyCaseWork);
  const navigate = useNavigate();
  const open = useMutation({
    mutationFn: () => ensure({ data: { caseId } }),
    onSuccess: ({ workId }) => void navigate({ to: "/atelier/ouvrages/$workId", params: { workId } }),
  });
  return (
    <div className="space-y-1 border-t border-border pt-3">
      <button type="button" className="min-h-11 rounded-md border border-border px-4 text-sm" disabled={open.isPending} onClick={() => open.mutate()}>
        {t.openJournal}
      </button>
      {open.isError && <ErrorNote>{t.genericError}</ErrorNote>}
    </div>
  );
}
