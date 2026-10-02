/**
 * L'acheminement du livre, vu du client : choix avant l'accord, puis étiquette aller, suivi,
 * reconfirmation de l'adresse de retour. Rien n'est décidé ici : le serveur renvoie des faits
 * arbitrés (verrou, éligibilité, prochaine action) et refuse ce que la base refuse.
 */
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  confirmMyReturnAddress, getMyCaseLogistics, getMyOutboundLabel, saveMyCaseLogistics,
} from "@/marketplace/services/caseLogistics.data.functions";
import type { CustomerLogisticsView } from "@/marketplace/services/caseLogistics.server";
import { carrierEventLabel, logisticsCustomerCopy, type LogisticsCustomerCopy } from "@/marketplace/customer/logisticsCustomerCopy";
import { formatCustomerDate, type CustomerLocale } from "@/marketplace/customer/customerPresentation";
import { LOGISTICS_MODES, type BookKind, type LogisticsMode, type PostalAddress } from "@/marketplace/shipping/logisticsPlan";
import { Button } from "@/components/ui/button";

const CARD = "rounded-2xl border border-[#3b2a1d]/15 bg-[#fdfaf3] p-5 sm:p-6";
const FIELD = "mt-1 block w-full min-w-0 rounded-md border border-[#3b2a1d]/25 bg-white px-3 py-2 text-base text-[#241a12]";
const LABEL = "block text-sm font-medium text-[#3b2a1d]";

const errorText = (error: unknown, copy: LogisticsCustomerCopy) => {
  const code = error instanceof Error ? error.message : "";
  return copy.errors[code] ?? copy.genericError;
};

function useCustomerLogistics(caseId: string) {
  const read = useServerFn(getMyCaseLogistics);
  return useQuery({ queryKey: ["marketplace", "customer", "case", caseId, "logistics"] as const,
    queryFn: () => read({ data: { caseId } }), refetchInterval: 60_000 });
}

/** Étapes où le client doit agir lui-même : elles remontent en tête de page. */
const CUSTOMER_ACTIONS = new Set(["choose_mode", "drop_parcel", "send_or_bring", "confirm_return_address"]);

export function LogisticsActionBanner({ caseId, locale }: { caseId: string; locale: CustomerLocale }) {
  const copy = logisticsCustomerCopy(locale);
  const { data } = useCustomerLogistics(caseId);
  if (!data || (!data.plan && data.locked) || !CUSTOMER_ACTIONS.has(data.next)) return null;
  return (
    <p role="status" className="rounded-xl border border-[#a98c55] bg-[#f6eedf] px-4 py-3 text-sm font-medium text-[#3b2a1d]">
      {copy.next[data.next]}{" "}
      <a href="#logistics-title" className="underline underline-offset-4">{copy.title}</a>
    </p>
  );
}

export function CustomerLogisticsPanel({ caseId, locale }: { caseId: string; locale: CustomerLocale }) {
  const copy = logisticsCustomerCopy(locale);
  const query = useCustomerLogistics(caseId);
  const [editing, setEditing] = useState(false);
  // Dossier historique accepté sans plan : rien à choisir ici, le suivi reste celui du journal atelier.
  if (query.data && !query.data.plan && query.data.locked) return null;

  return (
    <section aria-labelledby="logistics-title" className={CARD}>
      <h2 id="logistics-title" className="scroll-mt-6 font-serif text-2xl text-[#241a12]">{copy.title}</h2>
      {query.isPending ? (
        <p role="status" className="mt-3 text-sm text-[#6b5847]">{copy.loading}</p>
      ) : query.isError || !query.data ? (
        <p role="alert" className="mt-3 text-sm text-[#8a2b1b]">
          {copy.loadError}{" "}
          <button type="button" className="underline" onClick={() => void query.refetch()}>{copy.retry}</button>
        </p>
      ) : (
        <LogisticsBody view={query.data} caseId={caseId} copy={copy} locale={locale}
          editing={editing || (!query.data.plan && !query.data.locked)} setEditing={setEditing} />
      )}
    </section>
  );
}

function LogisticsBody({ view, caseId, copy, locale, editing, setEditing }: {
  view: CustomerLogisticsView; caseId: string; copy: LogisticsCustomerCopy; locale: CustomerLocale;
  editing: boolean; setEditing: (value: boolean) => void;
}) {
  const plan = view.plan;
  const organized = view.offerKind === "book_round_trip_fr";
  return (
    <div className="mt-3 space-y-5 text-[#4b3a2c]">
      <p className="rounded-lg border border-[#a98c55]/40 bg-[#f6eedf] px-4 py-3 text-sm font-medium text-[#3b2a1d]" role="status">
        {copy.next[view.next]}
      </p>
      {!plan && <p className="text-sm leading-6">{copy.intro}</p>}
      {editing && !view.locked ? (
        <PlanForm view={view} caseId={caseId} copy={copy} onDone={() => setEditing(false)} onCancel={plan ? () => setEditing(false) : undefined} />
      ) : plan ? (
        <PlanSummary view={view} copy={copy} onEdit={view.locked ? undefined : () => setEditing(true)} />
      ) : null}

      {view.paid && organized && view.next !== "completed" && (
        <Legs view={view} caseId={caseId} copy={copy} locale={locale} />
      )}
      {view.accepted && !organized && plan?.workshop?.reception && (
        <div>
          <h3 className="font-medium text-[#241a12]">{copy.receptionAddressTitle}</h3>
          <Address address={plan.workshop.reception} />
        </div>
      )}
      {view.canConfirmReturnAddress && plan && <ConfirmReturn view={view} caseId={caseId} copy={copy} />}
    </div>
  );
}

function Address({ address }: { address: PostalAddress }) {
  return (
    <address className="mt-1 not-italic text-sm leading-6 [overflow-wrap:anywhere]">
      {address.name}<br />{address.line1}{address.line2 ? <><br />{address.line2}</> : null}<br />
      {address.postalCode} {address.city} · {address.countryCode}
    </address>
  );
}

function PlanSummary({ view, copy, onEdit }: { view: CustomerLogisticsView; copy: LogisticsCustomerCopy; onEdit?: () => void }) {
  const plan = view.plan!;
  const verdict = plan.mode !== "organized_round_trip" || view.accepted ? null
    : plan.workshop?.decision === "declined" ? copy.workshopDeclined
    : view.block === null ? copy.eligible
    : view.block === "workshop_acceptance_required" ? copy.eligiblePending
    : copy.blocks[view.block];
  return (
    <div className="space-y-3">
      <h3 className="font-medium text-[#241a12]">{copy.summaryTitle}</h3>
      <p className="font-medium">{copy.modes[plan.mode].label}</p>
      {plan.contact && <Address address={plan.contact} />}
      {plan.parcel && (
        <p className="text-sm">{plan.parcel.weightGrams} {copy.grams} · {plan.parcel.lengthMm / 10} × {plan.parcel.widthMm / 10} × {plan.parcel.heightMm / 10} {copy.centimetres}</p>
      )}
      <p className="text-sm [overflow-wrap:anywhere]">{plan.bookDescription} · {copy.bookKinds[plan.bookKind]}</p>
      {verdict && <p className="rounded-lg border border-[#8a5a2b]/30 bg-[#f3e6d3] px-4 py-3 text-sm text-[#5b3a17]">{verdict}</p>}
      {view.locked ? <p className="text-sm text-[#6b5847]">{copy.locked}</p>
        : onEdit && <Button type="button" variant="outline" onClick={onEdit}>{copy.edit}</Button>}
    </div>
  );
}

type AddressDraft = { name: string; line1: string; line2: string; postalCode: string; city: string; countryCode: string };
const emptyAddress: AddressDraft = { name: "", line1: "", line2: "", postalCode: "", city: "", countryCode: "FR" };
const toDraft = (a: PostalAddress | null | undefined): AddressDraft =>
  a ? { name: a.name, line1: a.line1, line2: a.line2 ?? "", postalCode: a.postalCode, city: a.city, countryCode: a.countryCode } : emptyAddress;
const mm = (cm: string) => Math.round(Number(cm.replace(",", ".")) * 10);

function PlanForm({ view, caseId, copy, onDone, onCancel }: {
  view: CustomerLogisticsView; caseId: string; copy: LogisticsCustomerCopy; onDone: () => void; onCancel?: () => void;
}) {
  const plan = view.plan;
  const save = useServerFn(saveMyCaseLogistics);
  const cache = useQueryClient();
  const roundTripOffered = view.brand === "MA_RELIURE";
  const modes = LOGISTICS_MODES.filter((m) => roundTripOffered || m !== "organized_round_trip");
  const [mode, setMode] = useState<LogisticsMode>(plan?.mode ?? (roundTripOffered ? "organized_round_trip" : "hand_delivery"));
  const [contact, setContact] = useState<AddressDraft>(toDraft(plan?.contact));
  const [phone, setPhone] = useState(plan?.contact?.phone ?? "");
  const [same, setSame] = useState(plan?.returnSameAddress ?? true);
  const [back, setBack] = useState<AddressDraft>(toDraft(plan?.returnAddress));
  const [parcel, setParcel] = useState({
    weight: plan?.parcel ? String(plan.parcel.weightGrams) : "",
    length: plan?.parcel ? String(plan.parcel.lengthMm / 10) : "",
    width: plan?.parcel ? String(plan.parcel.widthMm / 10) : "",
    height: plan?.parcel ? String(plan.parcel.heightMm / 10) : "",
  });
  const [description, setDescription] = useState(plan?.bookDescription ?? "");
  const [kind, setKind] = useState<BookKind>(plan?.bookKind ?? "ordinary");
  const [value, setValue] = useState(plan ? String(plan.declaredValueCents / 100) : "");
  const [accepted, setAccepted] = useState(false);
  const mutation = useMutation({
    mutationFn: () => {
      const address = (a: AddressDraft) => ({ name: a.name, line1: a.line1, line2: a.line2.trim() || null,
        postalCode: a.postalCode.trim(), city: a.city, countryCode: a.countryCode });
      const organized = mode === "organized_round_trip";
      return save({ data: { caseId, plan: {
        mode,
        contact: organized ? { ...address(contact), phone } : null,
        returnSameAddress: organized ? same : true,
        returnAddress: organized && !same ? address(back) : null,
        parcel: organized ? { weightGrams: Math.round(Number(parcel.weight)), lengthMm: mm(parcel.length),
          widthMm: mm(parcel.width), heightMm: mm(parcel.height) } : null,
        bookDescription: description,
        bookKind: kind,
        declaredValueCents: Math.round(Number(value.replace(",", ".")) * 100),
        acceptConditions: accepted,
      } } });
    },
    onSuccess: async () => { await cache.invalidateQueries({ queryKey: ["marketplace", "customer", "case", caseId] }); onDone(); },
  });

  const addressFields = (a: AddressDraft, set: (next: AddressDraft) => void, prefix: string) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={copy.name} className="sm:col-span-2"><input className={FIELD} autoComplete={`${prefix} name`} maxLength={120} value={a.name} onChange={(e) => set({ ...a, name: e.target.value })} /></Field>
      <Field label={copy.line1} className="sm:col-span-2"><input className={FIELD} autoComplete={`${prefix} address-line1`} maxLength={160} value={a.line1} onChange={(e) => set({ ...a, line1: e.target.value })} /></Field>
      <Field label={copy.line2} className="sm:col-span-2"><input className={FIELD} autoComplete={`${prefix} address-line2`} maxLength={160} value={a.line2} onChange={(e) => set({ ...a, line2: e.target.value })} /></Field>
      <Field label={copy.postalCode}><input className={FIELD} autoComplete={`${prefix} postal-code`} inputMode="numeric" maxLength={12} value={a.postalCode} onChange={(e) => set({ ...a, postalCode: e.target.value })} /></Field>
      <Field label={copy.city}><input className={FIELD} autoComplete={`${prefix} address-level2`} maxLength={100} value={a.city} onChange={(e) => set({ ...a, city: e.target.value })} /></Field>
      <Field label={copy.country}>
        <select className={FIELD} value={a.countryCode} onChange={(e) => set({ ...a, countryCode: e.target.value })}>
          {["FR", "BE", "CH", "LU", "MC", "DE", "IT", "ES", "GB", "US"].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
    </div>
  );

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
      <fieldset className="space-y-2">
        <legend className="font-medium text-[#241a12]">{copy.modeLegend}</legend>
        {modes.map((m) => (
          <label key={m} className="flex cursor-pointer gap-3 rounded-lg border border-[#3b2a1d]/15 bg-white p-3">
            <input type="radio" name="logistics-mode" className="mt-1 h-4 w-4 shrink-0" checked={mode === m} onChange={() => setMode(m)} />
            <span><span className="block font-medium text-[#241a12]">{copy.modes[m].label}</span>
              <span className="block text-sm leading-6">{copy.modes[m].detail}</span></span>
          </label>
        ))}
        {!roundTripOffered && <p className="text-sm text-[#6b5847]">{copy.roundTripUnavailableBrand}</p>}
      </fieldset>

      {mode === "organized_round_trip" && (
        <>
          <fieldset className="space-y-3">
            <legend className="font-medium text-[#241a12]">{copy.contactLegend}</legend>
            {addressFields(contact, setContact, "shipping")}
            <Field label={copy.phone}><input className={FIELD} type="tel" autoComplete="tel" maxLength={24} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={same} onChange={(e) => setSame(e.target.checked)} />{copy.returnSame}</label>
          </fieldset>
          {!same && (
            <fieldset className="space-y-3">
              <legend className="font-medium text-[#241a12]">{copy.returnLegend}</legend>
              {addressFields(back, setBack, "billing")}
            </fieldset>
          )}
          <fieldset className="space-y-3">
            <legend className="font-medium text-[#241a12]">{copy.parcelLegend}</legend>
            <p className="text-sm leading-6">{copy.parcelHelp}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label={copy.weight}><input className={FIELD} inputMode="numeric" value={parcel.weight} onChange={(e) => setParcel({ ...parcel, weight: e.target.value })} /></Field>
              <Field label={copy.length}><input className={FIELD} inputMode="decimal" value={parcel.length} onChange={(e) => setParcel({ ...parcel, length: e.target.value })} /></Field>
              <Field label={copy.width}><input className={FIELD} inputMode="decimal" value={parcel.width} onChange={(e) => setParcel({ ...parcel, width: e.target.value })} /></Field>
              <Field label={copy.height}><input className={FIELD} inputMode="decimal" value={parcel.height} onChange={(e) => setParcel({ ...parcel, height: e.target.value })} /></Field>
            </div>
          </fieldset>
        </>
      )}

      <fieldset className="space-y-3">
        <legend className="font-medium text-[#241a12]">{copy.bookLegend}</legend>
        <Field label={copy.bookDescription}><textarea className={FIELD} rows={2} maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={copy.bookKind}>
            <select className={FIELD} value={kind} onChange={(e) => setKind(e.target.value as BookKind)}>
              {(Object.keys(copy.bookKinds) as BookKind[]).map((k) => <option key={k} value={k}>{copy.bookKinds[k]}</option>)}
            </select>
          </Field>
          <Field label={copy.declaredValue}><input className={FIELD} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
        </div>
        <p className="text-xs text-[#6b5847]">{copy.declaredValueHelp}</p>
      </fieldset>

      <div className="rounded-lg border border-[#3b2a1d]/15 bg-white p-4">
        <h3 className="font-medium text-[#241a12]">{copy.conditionsTitle}</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">{copy.conditions.map((c) => <li key={c}>{c}</li>)}</ul>
        <label className="mt-3 flex items-start gap-2 text-sm font-medium">
          <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          {copy.acceptConditions}
        </label>
      </div>

      {mutation.isError && <p role="alert" className="text-sm text-[#8a2b1b]">{errorText(mutation.error, copy)}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={mutation.isPending || !accepted}>{mutation.isPending ? copy.saving : copy.save}</Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>{copy.cancel}</Button>}
      </div>
    </form>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={`${LABEL} ${className ?? ""}`}>{label}{children}</label>;
}

function Legs({ view, caseId, copy, locale }: { view: CustomerLogisticsView; caseId: string; copy: LogisticsCustomerCopy; locale: CustomerLocale }) {
  const download = useServerFn(getMyOutboundLabel);
  const [failed, setFailed] = useState(false);
  const open = useMutation({
    mutationFn: () => download({ data: { caseId } }),
    // Navigation directe : une fenêtre ouverte après un appel asynchrone serait bloquée sur mobile.
    onSuccess: (result) => { setFailed(false); window.location.assign(result.url); },
    onError: () => setFailed(true),
  });
  const leg = (title: string, value: CustomerLogisticsView["return"], extra?: ReactNode) => (
    <div className="rounded-lg border border-[#3b2a1d]/15 bg-white p-4">
      <h3 className="font-medium text-[#241a12]">{title}</h3>
      {!value || value.state === "preparing" ? <p className="mt-1 text-sm">{copy.preparing}</p>
        : value.state === "cancelled" ? <p className="mt-1 text-sm">{copy.cancelledLeg}</p>
        : <dl className="mt-1 space-y-1 text-sm [overflow-wrap:anywhere]">
            {value.method && <div><dt className="inline font-medium">{copy.method} : </dt><dd className="inline">{value.method}</dd></div>}
            <div><dt className="inline font-medium">{copy.tracking} : </dt><dd className="inline">{value.carrier} · {value.tracking}</dd></div>
          </dl>}
      {extra}
    </div>
  );
  return (
    <div className="space-y-4">
      {leg(copy.outboundTitle, view.outbound, view.outbound?.downloadable ? (
        <div className="mt-3 space-y-2">
          <Button type="button" onClick={() => open.mutate()} disabled={open.isPending}>{copy.downloadLabel}</Button>
          <p className="text-xs text-[#6b5847]">{copy.labelExpires}</p>
          {failed && <p role="alert" className="text-sm text-[#8a2b1b]">{copy.labelError}</p>}
        </div>
      ) : null)}
      {view.outbound?.downloadable && (
        <div>
          <h3 className="font-medium text-[#241a12]">{copy.packagingTitle}</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6">{copy.packaging.map((p) => <li key={p}>{p}</li>)}</ol>
        </div>
      )}
      {(view.next === "await_return" || view.next === "return_in_transit" || view.return) && leg(copy.returnTitle, view.return)}
      {view.carrierEvents.length > 0 && (
        <div>
          <h3 className="font-medium text-[#241a12]">{copy.carrierEventsTitle}</h3>
          <ol className="mt-2 space-y-2">
            {view.carrierEvents.map((e, i) => (
              <li key={`${e.at}-${i}`} className="border-l-2 border-[#a98c55] pl-3 text-sm">
                <span className="font-medium">{e.direction === "outbound" ? copy.outboundTitle : copy.returnTitle}</span> — {carrierEventLabel(e.code, locale)}
                <span className="block text-[#6b5847]">{formatCustomerDate(e.at, locale)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-[#6b5847]">{copy.carrierEventNote}</p>
        </div>
      )}
    </div>
  );
}

function ConfirmReturn({ view, caseId, copy }: { view: CustomerLogisticsView; caseId: string; copy: LogisticsCustomerCopy }) {
  const confirm = useServerFn(confirmMyReturnAddress);
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => confirm({ data: { caseId } }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["marketplace", "customer", "case", caseId] }),
  });
  const plan = view.plan!;
  const address = plan.returnSameAddress ? plan.contact : plan.returnAddress;
  return (
    <div className="rounded-lg border border-[#a98c55] bg-white p-4">
      <h3 className="font-medium text-[#241a12]">{copy.confirmReturnTitle}</h3>
      <p className="mt-1 text-sm leading-6">{copy.confirmReturnBody}</p>
      {address && <Address address={address} />}
      {mutation.isError && <p role="alert" className="mt-2 text-sm text-[#8a2b1b]">{errorText(mutation.error, copy)}</p>}
      <Button type="button" className="mt-3" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{copy.confirmReturn}</Button>
    </div>
  );
}
