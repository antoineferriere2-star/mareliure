/**
 * Back-office : l'acheminement d'un dossier de bout en bout. L'opérateur voit le plan complet,
 * dépose les étiquettes achetées à la main (traitement manuel, toujours disponible), consigne
 * annulations et frais réellement facturés, et ouvre ou ferme l'achat automatique.
 * Aucun remboursement n'est présumé, aucun supplément n'est ajouté au client.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getOperatorCaseLogistics, getOperatorLabel, purchaseRoundTripLabel, recordLabelEvent, recordManualLabel,
  recordRoundTripRateApproval, setRoundTripAutomation,
} from "@/marketplace/services/caseLogistics.data.functions";
import type { OperatorLogisticsView } from "@/marketplace/services/caseLogistics.server";
import { ROUND_TRIP_TTC_CENTS } from "@/marketplace/shipping/logisticsPlan";
import { Button } from "@/components/ui/button";
import { formatEuros } from "@/marketplace/pricing/money";

const BLOCKS: Record<string, string> = {
  logistics_plan_required: "Aucun plan logistique : le client n'a pas encore choisi.",
  brand_unsupported: "Dossier Fine Bindery : pas d'ouvrage atelier importable, forfait indisponible.",
  mode_not_organized: "Le client n'a pas choisi l'expédition organisée.",
  valuable_book: "Livre ancien, unique ou valeur ≥ 100 € : traitement adapté.",
  workshop_acceptance_required: "Accord de réception de l'atelier retenu manquant pour cette version.",
  outside_mainland: "Adresse hors France métropolitaine : devis distinct.",
  parcel_review: "Colis hors plafond (500 g, 35 × 25 × 8 cm) : traitement adapté.",
};
const MODES: Record<string, string> = {
  organized_round_trip: "Expédition organisée", customer_arranged: "Transport par le client", hand_delivery: "Remise en main propre",
};
const ERRORS: Record<string, string> = {
  platform_payment_required: "Paiement plateforme Stripe non constaté : aucune étiquette.",
  round_trip_offer_required: "Aucune proposition acceptée avec le forfait aller-retour.",
  physical_receipt_required: "Réception physique non confirmée par l'atelier.",
  return_not_ready: "L'atelier n'a pas déclaré le retour prêt.",
  return_address_confirmation_required: "Le client n'a pas reconfirmé son adresse de retour.",
  deficit_acknowledgement_required: "Le coût total dépasse 15 € TTC : cochez la reconnaissance du déficit.",
  replacement_confirmation_required: "Une étiquette précédente a échoué ou été annulée : cochez « remplacement ».",
  label_pdf_invalid: "Le fichier n'est pas un PDF valide de 5 Mo maximum.",
  logistics_plan_changed_review_required: "Le plan a changé depuis la proposition : revue nécessaire.",
  evidence_missing: "Chaque preuve d'ouverture doit être renseignée (8 caractères minimum).",
  invalid_input: "Saisie invalide ou transition impossible pour cette étiquette.",
  accepted_workshop_required: "Aucun atelier retenu ayant accepté l'offre.",
};
const errorText = (e: unknown) => {
  const code = e instanceof Error ? e.message.split(":")[0] : "";
  return ERRORS[code] ?? (e instanceof Error ? e.message : "Erreur inconnue");
};
const FIELD = "mt-1 block w-full min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-sm";

export function OperatorLogisticsPanel({ caseId }: { caseId: string }) {
  const read = useServerFn(getOperatorCaseLogistics);
  const key = ["marketplace", "case", caseId, "logistics"] as const;
  const { data, isPending, error, refetch } = useQuery({ queryKey: key, queryFn: () => read({ data: { caseId } }) });
  return (
    <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="operator-logistics">
      <h2 id="operator-logistics" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Acheminement du livre</h2>
      {isPending ? <p className="mt-2 text-xs text-muted-foreground">Chargement…</p>
        : error || !data ? <p className="mt-2 text-xs text-destructive">Acheminement illisible. <button className="underline" onClick={() => void refetch()}>Réessayer</button></p>
        : <Body caseId={caseId} view={data} />}
    </section>
  );
}

function Body({ caseId, view }: { caseId: string; view: OperatorLogisticsView }) {
  const plan = view.plan;
  const confirmed = view.jobs.filter((j) => j.status === "confirmed");
  const charged = confirmed.reduce((sum, j) => sum + (j.charged_cost_ttc_cents ?? 0), 0);
  const refunded = view.jobs.reduce((sum, j) => sum + (j.refunded_cost_ttc_cents ?? 0), 0);
  const organized = view.offerKind === "book_round_trip_fr";
  return (
    <div className="mt-3 space-y-4 text-sm">
      {!plan ? <p className="text-muted-foreground">{BLOCKS.logistics_plan_required}</p> : (
        <div className="space-y-1">
          <p><strong>{MODES[plan.mode]}</strong> · plan v{plan.version} · {plan.bookDescription} · {plan.bookKind} · valeur déclarée {formatEuros(plan.declaredValueCents)}</p>
          {plan.contact && <p className="[overflow-wrap:anywhere]">Client : {plan.contact.name}, {plan.contact.line1}{plan.contact.line2 ? `, ${plan.contact.line2}` : ""}, {plan.contact.postalCode} {plan.contact.city} {plan.contact.countryCode} · {plan.contact.phone}</p>}
          {!plan.returnSameAddress && plan.returnAddress && <p>Retour : {plan.returnAddress.name}, {plan.returnAddress.line1}, {plan.returnAddress.postalCode} {plan.returnAddress.city} {plan.returnAddress.countryCode}</p>}
          {plan.parcel && <p>Colis aller : {plan.parcel.weightGrams} g · {plan.parcel.lengthMm} × {plan.parcel.widthMm} × {plan.parcel.heightMm} mm</p>}
          <p>Atelier : {plan.workshop ? `${plan.workshop.decision === "accepted" ? "réception acceptée" : "réception refusée"} (v${plan.workshop.planVersion})` : "pas de réponse"}
            {plan.workshop?.reception && ` · ${plan.workshop.reception.name}, ${plan.workshop.reception.line1}, ${plan.workshop.reception.postalCode} ${plan.workshop.reception.city}`}</p>
          {plan.returnReady && <p>Retour prêt : {plan.returnReady.parcel.weightGrams} g · {plan.returnReady.parcel.lengthMm} × {plan.returnReady.parcel.widthMm} × {plan.returnReady.parcel.heightMm} mm · adresse {plan.returnAddressConfirmedVersion === plan.version ? "reconfirmée" : "non reconfirmée"}</p>}
          <p className={view.block ? "text-amber-700" : "text-emerald-700"}>
            {view.block ? BLOCKS[view.block] : "Éligible au forfait « Transport aller-retour — 15 € TTC »."}
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Proposition : {view.offerKind === "book_round_trip_fr" ? "avec forfait aller-retour" : view.offerKind ? "sans forfait" : "aucune"} · {view.accepted ? "acceptée" : "non acceptée"} · {view.paid ? "payée (Stripe)" : "non payée"} · journal atelier : {view.journal.map((j) => j.kind).join(" → ") || "vide"}
      </p>

      {organized && (
        <>
          <p>Frais réellement facturés (étiquettes confirmées) : <strong>{formatEuros(charged)}</strong> TTC sur {formatEuros(ROUND_TRIP_TTC_CENTS)} encaissés
            {charged > ROUND_TRIP_TTC_CENTS && <span className="text-amber-700"> — déficit {formatEuros(charged - ROUND_TRIP_TTC_CENTS)} supporté par la plateforme</span>}
            {refunded > 0 && <> · remboursements constatés {formatEuros(refunded)}</>}</p>
          {(["outbound", "return"] as const).map((direction) => (
            <Leg key={direction} caseId={caseId} direction={direction} view={view} />
          ))}
        </>
      )}
      <Automation view={view} caseId={caseId} />
    </div>
  );
}

function Leg({ caseId, direction, view }: { caseId: string; direction: "outbound" | "return"; view: OperatorLogisticsView }) {
  const jobs = view.jobs.filter((j) => j.direction === direction);
  const active = jobs.find((j) => ["claimed", "ambiguous", "confirmed"].includes(j.status));
  const open = useServerFn(getOperatorLabel);
  const opening = useMutation({ mutationFn: () => open({ data: { caseId, direction } }), onSuccess: (r) => window.open(r.url, "_blank", "noopener") });
  const plan = view.plan;
  const returnReady = Boolean(plan?.returnReady && plan.returnAddressConfirmedVersion === plan.version);
  return (
    <div className="space-y-2 rounded border border-border p-3">
      <p className="font-medium">{direction === "outbound" ? "Aller (client → atelier)" : "Retour (atelier → client)"}</p>
      {jobs.length === 0 && <p className="text-muted-foreground">Aucune étiquette.</p>}
      {jobs.map((job) => (
        <div key={job.id} className="space-y-1 border-l-2 border-border pl-2 [overflow-wrap:anywhere]">
          <p>{job.status} · {job.fulfilment === "manual" ? "manuel" : "automatique"} {job.carrier && `· ${job.carrier} ${job.tracking}`} {job.method_label && `· ${job.method_label}`}
            {job.charged_cost_ttc_cents !== null && ` · facturé ${formatEuros(job.charged_cost_ttc_cents)}`}
            {job.refunded_cost_ttc_cents !== null && ` · remboursé ${formatEuros(job.refunded_cost_ttc_cents)}`}</p>
          <ul className="text-xs text-muted-foreground">
            {job.events.map((e, i) => <li key={i}>{new Date(e.created_at).toLocaleString("fr-FR")} · {e.kind}
              {Object.entries(e.details).filter(([k]) => !["actor", "provider"].includes(k)).map(([k, v]) => ` · ${k}=${v}`).join("")}</li>)}
          </ul>
          <JobActions caseId={caseId} job={job} />
        </div>
      ))}
      {active?.status === "confirmed" && <Button size="sm" variant="outline" onClick={() => opening.mutate()}>Ouvrir l'étiquette</Button>}
      {opening.isError && <p className="text-xs text-destructive">{errorText(opening.error)}</p>}
      {view.automation.enabled && view.automation.providerConfigured && view.paid && active?.status !== "confirmed" && (
        <AutomaticPurchase caseId={caseId} direction={direction} />
      )}
      {direction === "return" && !returnReady && <p className="text-xs text-muted-foreground">Étiquette retour possible après « retour prêt » déclaré par l'atelier et adresse reconfirmée par le client.</p>}
      {(!active || (active.status === "claimed" && active.fulfilment === "manual")) && view.paid && (direction === "outbound" || returnReady) && (
        <ManualLabelForm caseId={caseId} direction={direction} chargedOther={view.jobs.filter((j) => j.status === "confirmed" && j.direction !== direction).reduce((s, j) => s + (j.charged_cost_ttc_cents ?? 0), 0)} replace={jobs.length > 0 && !active} />
      )}
    </div>
  );
}

function JobActions({ caseId, job }: { caseId: string; job: OperatorLogisticsView["jobs"][number] }) {
  const record = useServerFn(recordLabelEvent);
  const cache = useQueryClient();
  const [kind, setKind] = useState<"operator_note" | "cancellation_requested" | "cancelled" | "cost_adjusted" | "unused" | "purchase_failed">("operator_note");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [charged, setCharged] = useState("");
  const [refunded, setRefunded] = useState("");
  const toCents = (v: string) => (v.trim() ? Math.round(Number(v.replace(",", ".")) * 100) : undefined);
  const mutation = useMutation({
    mutationFn: () => record({ data: { caseId, jobId: job.id, kind, note: note || undefined, reference: reference || undefined,
      chargedCostTtcCents: toCents(charged), refundedCostTtcCents: toCents(refunded) } }),
    onSuccess: () => { setNote(""); setReference(""); setCharged(""); setRefunded(""); return cache.invalidateQueries({ queryKey: ["marketplace", "case", caseId, "logistics"] }); },
  });
  const kinds = job.status === "claimed" ? ["operator_note", "purchase_failed"] as const
    : job.status === "confirmed" ? ["operator_note", "cancellation_requested", "cancelled", "cost_adjusted", "unused"] as const
    : job.status === "cancelled" ? ["operator_note", "cost_adjusted", "unused"] as const : ["operator_note"] as const;
  const labels: Record<string, string> = { operator_note: "Note", purchase_failed: "Abandonner (aucune étiquette achetée)",
    cancellation_requested: "Annulation demandée", cancelled: "Annulée (référence)", cost_adjusted: "Frais réels / remboursement constatés", unused: "Étiquette inutilisée" };
  return (
    <details className="text-xs">
      <summary className="cursor-pointer">Consigner un événement</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label>Événement<select className={FIELD} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>{kinds.map((k) => <option key={k} value={k}>{labels[k]}</option>)}</select></label>
        <label>Note<input className={FIELD} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
        {kind === "cancelled" && <label>Référence d'annulation<input className={FIELD} value={reference} onChange={(e) => setReference(e.target.value)} /></label>}
        {kind === "cost_adjusted" && <><label>Facturé TTC (€)<input className={FIELD} inputMode="decimal" value={charged} onChange={(e) => setCharged(e.target.value)} /></label>
          <label>Remboursé TTC (€, constaté)<input className={FIELD} inputMode="decimal" value={refunded} onChange={(e) => setRefunded(e.target.value)} /></label></>}
      </div>
      {mutation.isError && <p className="text-destructive">{errorText(mutation.error)}</p>}
      <Button size="sm" className="mt-2" disabled={mutation.isPending} onClick={() => mutation.mutate()}>Enregistrer</Button>
    </details>
  );
}

function ManualLabelForm({ caseId, direction, chargedOther, replace }: { caseId: string; direction: "outbound" | "return"; chargedOther: number; replace: boolean }) {
  const recordLabel = useServerFn(recordManualLabel);
  const cache = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [carrier, setCarrier] = useState("Mondial Relay");
  const [tracking, setTracking] = useState("");
  const [method, setMethod] = useState(direction === "outbound" ? "Dépôt en Point Relais Mondial Relay" : "Livraison en Point Relais Mondial Relay");
  const [reference, setReference] = useState("");
  const [cost, setCost] = useState("");
  const [deficit, setDeficit] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const costCents = Math.round(Number(cost.replace(",", ".")) * 100);
  const overBudget = Number.isFinite(costCents) && chargedOther + costCents > ROUND_TRIP_TTC_CENTS;
  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("label_pdf_invalid");
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      return recordLabel({ data: { caseId, direction, base64, carrier, tracking, method, providerReference: reference || tracking,
        chargedCostTtcCents: costCents, deficitAcknowledged: deficit, replace: confirmReplace } });
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: ["marketplace", "case", caseId, "logistics"] }),
  });
  return (
    <details className="rounded bg-muted/40 p-2">
      <summary className="cursor-pointer font-medium">Déposer une étiquette achetée manuellement</summary>
      <p className="mt-1 text-xs text-muted-foreground">Achetez l'étiquette dans l'outil du transporteur (adresse {direction === "outbound" ? "client → atelier" : "atelier → client"} du plan), puis déposez le PDF. Le client ne paie jamais plus que 15 € TTC.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="sm:col-span-2">PDF de l'étiquette<input className={FIELD} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <label>Transporteur<input className={FIELD} value={carrier} onChange={(e) => setCarrier(e.target.value)} /></label>
        <label>N° de suivi<input className={FIELD} value={tracking} onChange={(e) => setTracking(e.target.value)} /></label>
        <label className="sm:col-span-2">Méthode affichée (dépôt / livraison)<input className={FIELD} value={method} onChange={(e) => setMethod(e.target.value)} /></label>
        <label>Référence d'achat (facultatif)<input className={FIELD} value={reference} onChange={(e) => setReference(e.target.value)} /></label>
        <label>Coût réel TTC (€)<input className={FIELD} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></label>
      </div>
      {overBudget && <label className="mt-2 flex gap-2 text-amber-800"><input type="checkbox" checked={deficit} onChange={(e) => setDeficit(e.target.checked)} />
        Le coût total dépasse 15 € TTC : je reconnais le déficit supporté par la plateforme (aucun supplément client).</label>}
      {replace && <label className="mt-2 flex gap-2"><input type="checkbox" checked={confirmReplace} onChange={(e) => setConfirmReplace(e.target.checked)} />
        Remplacement d'une étiquette échouée ou annulée (vérifier les frais de l'ancienne).</label>}
      {mutation.isError && <p className="mt-1 text-xs text-destructive">{errorText(mutation.error)}</p>}
      {mutation.data && <p className="mt-1 text-xs text-emerald-700">{mutation.data.outcome === "existing" ? "Étiquette déjà enregistrée." : "Étiquette enregistrée."}</p>}
      <Button size="sm" className="mt-2" disabled={mutation.isPending || !file || !tracking || !cost} onClick={() => mutation.mutate()}>Enregistrer l'étiquette</Button>
    </details>
  );
}

const EVIDENCE: [string, string][] = [
  ["provider_quote", "Devis fournisseur des deux trajets (référence, date)"],
  ["coverage_terms", "Conditions écrites de couverture d'un livre confié"],
  ["tax_validation", "Validation fiscale de la ligne 15 € TTC et TVA récupérable"],
  ["api_recette", "Recette API isolée (création, annulation, webhook) réussie"],
  ["commercial_decision", "Décision commerciale d'ouverture (qui, quand)"],
];

function Automation({ view, caseId }: { view: OperatorLogisticsView; caseId: string }) {
  const set = useServerFn(setRoundTripAutomation);
  const cache = useQueryClient();
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const mutation = useMutation({
    mutationFn: (enabled: boolean) => set({ data: { enabled, evidence: enabled ? evidence : { closed_reason: "fermeture opérateur" } } }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["marketplace", "case", caseId, "logistics"] }),
  });
  const a = view.automation;
  return (
    <details className="rounded border border-border p-3">
      <summary className="cursor-pointer font-medium">
        Achat automatique : {a.enabled ? "OUVERT" : "fermé"} · clés fournisseur {a.providerConfigured ? "présentes" : "absentes"}
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">Fermé : seul le traitement manuel achète des étiquettes. Fermer est immédiat et toujours possible ; ouvrir exige les cinq preuves, tracées.</p>
      {a.enabled && view.offerKind === "book_round_trip_fr" && view.accepted && <RateApprovalForm caseId={caseId} />}
      {a.enabled ? (
        <Button size="sm" variant="destructive" className="mt-2" disabled={mutation.isPending} onClick={() => mutation.mutate(false)}>Fermer l'achat automatique</Button>
      ) : (
        <div className="mt-2 grid gap-2">
          {EVIDENCE.map(([k, label]) => (
            <label key={k} className="text-xs">{label}<input className={FIELD} value={evidence[k] ?? ""} maxLength={500} onChange={(e) => setEvidence({ ...evidence, [k]: e.target.value })} /></label>
          ))}
          <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate(true)}>Ouvrir l'achat automatique</Button>
        </div>
      )}
      {mutation.isError && <p className="mt-1 text-xs text-destructive">{errorText(mutation.error)}</p>}
    </details>
  );
}

function AutomaticPurchase({ caseId, direction }: { caseId: string; direction: "outbound" | "return" }) {
  const purchase = useServerFn(purchaseRoundTripLabel);
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => purchase({ data: { caseId, direction } }),
    onSettled: () => cache.invalidateQueries({ queryKey: ["marketplace", "case", caseId, "logistics"] }),
  });
  return (
    <div className="space-y-1">
      <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>Acheter l'étiquette automatiquement (facturable)</Button>
      {mutation.data && <p className="text-xs">Résultat : {mutation.data.state}{"code" in mutation.data ? ` (${mutation.data.code})` : ""}</p>}
      {mutation.isError && <p className="text-xs text-destructive">{errorText(mutation.error)}</p>}
    </div>
  );
}

function RateApprovalForm({ caseId }: { caseId: string }) {
  const save = useServerFn(recordRoundTripRateApproval);
  const cache = useQueryClient();
  const [v, setV] = useState({ outboundOptionCode: "", returnOptionCode: "", providerQuoteReference: "", coverageEvidenceReference: "",
    outbound: "", back: "", other: "0", economic: "", economicRef: "", days: "7" });
  const c = (x: string) => Math.round(Number(x.replace(",", ".")) * 100);
  const mutation = useMutation({
    mutationFn: () => save({ data: { caseId, outboundOptionCode: v.outboundOptionCode, returnOptionCode: v.returnOptionCode,
      providerQuoteReference: v.providerQuoteReference, coverageEvidenceReference: v.coverageEvidenceReference,
      outboundCostTtcCents: c(v.outbound), returnCostTtcCents: c(v.back), allOtherCostsTtcCents: c(v.other),
      estimatedEconomicCostCents: c(v.economic), economicCostEvidenceReference: v.economicRef,
      validUntil: new Date(Date.now() + Number(v.days) * 86_400_000).toISOString() } }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["marketplace", "case", caseId, "logistics"] }),
  });
  const field = (k: keyof typeof v, label: string) => (
    <label className="text-xs">{label}<input className={FIELD} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>
  );
  return (
    <div className="mt-2 grid gap-2 rounded bg-muted/40 p-2 sm:grid-cols-2">
      <p className="text-xs font-medium sm:col-span-2">Tarif revu pour ce dossier (devis réel, coûts TTC ≤ 15 €, coût économique ≤ 12,50 €)</p>
      {field("outboundOptionCode", "Code méthode aller")}{field("returnOptionCode", "Code méthode retour")}
      {field("providerQuoteReference", "Référence du devis")}{field("coverageEvidenceReference", "Référence des conditions de couverture")}
      {field("outbound", "Coût aller TTC (€)")}{field("back", "Coût retour TTC (€)")}{field("other", "Autres frais TTC (€)")}
      {field("economic", "Coût économique HT (€)")}{field("economicRef", "Justification du coût économique")}{field("days", "Validité (jours)")}
      {mutation.isError && <p className="text-xs text-destructive sm:col-span-2">{errorText(mutation.error)}</p>}
      {mutation.isSuccess && <p className="text-xs text-emerald-700 sm:col-span-2">Tarif revu enregistré.</p>}
      <Button size="sm" className="sm:col-span-2" disabled={mutation.isPending} onClick={() => mutation.mutate()}>Enregistrer le tarif revu</Button>
    </div>
  );
}
