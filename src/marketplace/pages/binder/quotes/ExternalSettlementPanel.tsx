import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getExternalSettlements, recordExternalSettlement } from "@/marketplace/services/externalSettlement.data.functions";
import { SETTLEMENT_UNAVAILABLE } from "./settlementCopy";
import { isNoWorkshopError } from "@/marketplace/i18n/noWorkshopCopy";
import { NoWorkshopNotice } from "../NoWorkshopNotice";
import { CARD, FIELD, Field, PRIMARY_BUTTON } from "./quoteUi";
import { INVOICES_KEY } from "./quoteQueryKeys";

const labels = { receipt: "Règlement reçu", refund: "Remboursement effectué", dispute_open: "Ouvrir un litige", dispute_close: "Clore le litige" } as const;
export function ExternalSettlementPanel({ invoiceId }: { invoiceId: string }) {
  const fetchState = useServerFn(getExternalSettlements);
  const record = useServerFn(recordExternalSettlement);
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<keyof typeof labels>("receipt");
  const [amount, setAmount] = useState("");
  const [evidence, setEvidence] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const state = useQuery({ queryKey: ["external-settlement", invoiceId], queryFn: () => fetchState({ data: { id: invoiceId } }) });
  const monetary = kind === "receipt" || kind === "refund";
  const cents = monetary ? (/^\d+([,.]\d{1,2})?$/.test(amount) ? Math.round(Number(amount.replace(",", ".")) * 100) : NaN) : 0;
  const write = useMutation({
    mutationFn: () => record({ data: { id: requestId, invoiceId, kind, amountCents: cents, evidence } }),
    onSuccess: async () => {
      setRequestId(crypto.randomUUID()); setAmount(""); setEvidence("");
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["external-settlement", invoiceId] }), queryClient.invalidateQueries({ queryKey: INVOICES_KEY })]);
    },
  });
  if (state.isPending) return <p role="status">Chargement du suivi des règlements…</p>;
  if (state.error && isNoWorkshopError(state.error)) return <NoWorkshopNotice />;
  if (state.error) return <p role="alert">Suivi des règlements indisponible. Rechargez la page avant toute déclaration.</p>;
  if (!state.data?.eligible) return <p className="text-sm text-muted-foreground">{SETTLEMENT_UNAVAILABLE[state.data?.reason ?? "not_issued"] ?? SETTLEMENT_UNAVAILABLE.not_issued} Aucun paiement en ligne n'est activé.</p>;
  const money = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: state.data.currency }).format(n / 100);
  return <section className={CARD} aria-labelledby="settlement-title">
    <h2 id="settlement-title" className="font-serif text-lg">Règlements directs à l'atelier</h2>
    <p className="mt-2 text-sm">Vous êtes le vendeur et l'émetteur de la facture. Frais de paiement plateforme : 0 €. Ces déclarations ne déclenchent aucun paiement et ne valent pas confirmation bancaire automatique.</p>
    <p className="mt-2 font-medium">Net déclaré reçu : {money(state.data.netCents)} · Facture : {money(state.data.totalCents)}</p>
    {state.data.disputed && <p role="status" className="mt-2 font-medium">Litige ouvert : aucune nouvelle déclaration de règlement avant clôture. Un remboursement reste possible.</p>}
    <p className="mt-2 text-sm text-muted-foreground">Référence obligatoire : reçu, écriture bancaire ou justificatif conservé par votre atelier. Un remboursement ne remplace pas l'avoir ; un avoir ne rembourse pas le client. Les corrections sont ajoutées à l'historique, jamais effacées.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Field label="Opération déjà effectuée ou litige" htmlFor="settlement-kind"><select id="settlement-kind" className={FIELD} value={kind} disabled={write.isPending} onChange={e => { setKind(e.target.value as keyof typeof labels); setRequestId(crypto.randomUUID()); }}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      {monetary && <Field label={`Montant (${state.data.currency})`} htmlFor="settlement-amount"><input id="settlement-amount" inputMode="decimal" className={FIELD} value={amount} disabled={write.isPending} onChange={e => { setAmount(e.target.value); setRequestId(crypto.randomUUID()); }} /></Field>}
      <div className="sm:col-span-2"><Field label="Référence du justificatif et motif (sans coordonnées bancaires)" htmlFor="settlement-evidence"><input id="settlement-evidence" className={FIELD} maxLength={500} value={evidence} disabled={write.isPending} onChange={e => { setEvidence(e.target.value); setRequestId(crypto.randomUUID()); }} /></Field></div>
    </div>
    <button className={`${PRIMARY_BUTTON} mt-3`} type="button" disabled={write.isPending || (kind === "receipt" && state.data.disputed) || evidence.trim().length < 8 || !Number.isSafeInteger(cents) || (monetary && cents <= 0)} onClick={() => write.mutate()}>Enregistrer la déclaration</button>
    {write.isError && <p role="alert" className="mt-2 text-sm">Écriture refusée : vérifiez le solde, l'état du litige et la référence du justificatif. Rechargez en cas de doute ; aucun mouvement bancaire n'a été déclenché.</p>}
    <ul className="mt-4 space-y-2">{state.data.events.map(event => <li key={event.id} className="break-words border-t border-border pt-2 text-sm">{new Date(event.created_at).toLocaleDateString("fr-FR")} · {labels[event.kind as keyof typeof labels]}{event.kind === "receipt" || event.kind === "refund" ? ` · ${money(event.amount_cents)}` : ""} · {event.evidence}</li>)}</ul>
  </section>;
}
