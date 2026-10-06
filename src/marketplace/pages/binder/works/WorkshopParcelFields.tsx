import { useWorkshopTransportCopy } from "@/marketplace/works/workshopTransportCopy";
import type { WorkshopParcelPlan } from "@/marketplace/works/workshopTransport";
import { workshopParcelPlan } from "@/marketplace/works/workshopTransport";
import { useFineBinderyWorkspace } from "@/marketplace/i18n/FineBinderyWorkspaceContext";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkshopTransportOptions } from "@/marketplace/services/workLogistics.data.functions";

export function WorkshopParcelFields({ workId, invoiceId, value, change, outbound }: { workId: string; invoiceId: string; value: WorkshopParcelPlan; change: (value: WorkshopParcelPlan) => void; outbound?: WorkshopParcelPlan }) {
  const t = useWorkshopTransportCopy();
  const { locale } = useFineBinderyWorkspace();
  const query = useServerFn(getWorkshopTransportOptions);
  const planKey = JSON.stringify({ value, invoiceId, workId });
  const options = useMutation({ mutationFn: async () => {
    const result = await query({ data: { ...workshopParcelPlan.parse(value), invoiceId, workId } });
    return { ...result, planKey };
  } });
  const currentOptions = options.data?.planKey === planKey ? options.data : null;
  const optional = { fr: { line2: "Complément d’adresse (facultatif)", phone: "Téléphone (facultatif)" }, en: { line2: "Address line 2 (optional)", phone: "Phone (optional)" }, de: { line2: "Adresszusatz (optional)", phone: "Telefon (optional)" }, it: { line2: "Complemento indirizzo (facoltativo)", phone: "Telefono (facoltativo)" }, es: { line2: "Complemento de dirección (opcional)", phone: "Teléfono (opcional)" } }[locale];
  const field = "block w-full min-w-0 rounded-md border border-border bg-background p-3 text-base";
  return <div className="space-y-4">
    {outbound && <button type="button" className="underline" onClick={() => change({ ...value, fromAddress: outbound.toAddress, toAddress: outbound.fromAddress })}>{t.reverse}</button>}
    <div className="grid gap-4 sm:grid-cols-2">
      {(["fromAddress", "toAddress"] as const).map(side => <fieldset key={side} className="min-w-0 space-y-2 rounded border p-3">
        <legend className="font-medium">{side === "fromAddress" ? t.from : t.to}</legend>
        {(["name", "line1", "postalCode", "city", "countryCode"] as const).map(key => <label className="block" key={key}>{t[key]}
          <input className={field} value={value[side][key]} maxLength={key === "countryCode" ? 2 : 160} onChange={e => { options.reset(); change({ ...value, [side]: { ...value[side], [key]: key === "countryCode" ? e.target.value.toUpperCase() : e.target.value } }); }} />
        </label>)}
        {(["line2", "phone"] as const).map(key => <label className="block" key={key}>{optional[key]}
          <input className={field} type={key === "phone" ? "tel" : "text"} value={value[side][key] ?? ""} maxLength={key === "phone" ? 24 : 160} onChange={e => { options.reset(); change({ ...value, [side]: { ...value[side], [key]: e.target.value || null } }); }} />
        </label>)}
      </fieldset>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">{(["weightGrams", "lengthMm", "widthMm", "heightMm"] as const).map(key => <label key={key}>{t[key]}
      <input className={field} type="number" min="1" step="1" value={value.parcel[key] || ""} onChange={e => { options.reset(); change({ ...value, parcel: { ...value.parcel, [key]: Number(e.target.value) } }); }} />
    </label>)}</div>
    <button type="button" disabled={options.isPending || !invoiceId || !workshopParcelPlan.safeParse(value).success} className="underline disabled:opacity-50" onClick={() => void options.mutate()}>{t.options}</button>
    <p className="text-sm">{t.note}</p>
    {options.isError && <p role="alert">{t.unavailable}</p>}
    {currentOptions && (!currentOptions.available || !currentOptions.options.length) && <p role="status">{t.unavailable}</p>}
    {currentOptions?.available && <ul className="text-sm">{currentOptions.options.map(option => <li key={option.code}>{option.carrier} · {option.name} · {new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(option.priceCents! / 100)}</li>)}</ul>}
  </div>;
}
